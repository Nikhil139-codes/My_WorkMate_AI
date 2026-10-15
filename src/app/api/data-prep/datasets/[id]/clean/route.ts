import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Dataset } from "@/lib/db/models/Dataset";
import { CleaningJob, ICleaningPlanStep } from "@/lib/db/models/CleaningJob";
import { storage } from "@/lib/storage";
import { parseDatasetFile, serializeToCsv, serializeToXlsx } from "@/lib/data-prep/parser";
import { profileDataset } from "@/lib/data-prep/profiler";
import { applyDataTransformations } from "@/lib/data-prep/transformer";
import { validateCleaningPlanStep } from "@/lib/data-prep/aiAgent";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const { jobId, approvedPlan } = body;
  if (!Array.isArray(approvedPlan) || approvedPlan.length === 0) {
    return NextResponse.json(
      { error: "No cleaning plan steps were provided for execution" },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const dataset = await Dataset.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    dataset.status = "CLEANING";
    await dataset.save();

    // 1. Fetch original file from storage (guaranteeing original immutability)
    const originalBuffer = await storage.getFile(dataset.storageKey);
    if (!originalBuffer) {
      dataset.status = "FAILED";
      dataset.failureReason = "Original dataset file not found in storage";
      await dataset.save();
      return NextResponse.json(
        { error: "Original dataset file could not be retrieved from storage" },
        { status: 404 }
      );
    }

    // 2. Parse original dataset fresh
    const parsed = parseDatasetFile(originalBuffer, dataset.originalFilename, dataset.mimeType);

    // 3. Strictly validate every incoming approved step against safe allowlist
    const colNames = parsed.columns;
    const validatedSteps: ICleaningPlanStep[] = [];
    for (const step of approvedPlan) {
      const valid = validateCleaningPlanStep(step, colNames);
      if (valid) {
        valid.approved = Boolean(step.approved);
        validatedSteps.push(valid);
      }
    }

    // 4. Apply deterministic server-side transformations
    const transformResult = applyDataTransformations(parsed.rows, parsed.columns, validatedSteps);

    // 5. Profile cleaned dataset to compute improved quality metrics
    const { profilingReport: newReport } = profileDataset(
      transformResult.cleanedRows,
      transformResult.cleanedColumns
    );

    // 6. Serialize cleaned data and store as new file
    let cleanedBuffer: Buffer;
    let cleanedFilename: string;
    let cleanedMimeType: string;

    if (dataset.format === "xlsx") {
      cleanedBuffer = serializeToXlsx(transformResult.cleanedRows);
      cleanedFilename = `cleaned_${dataset.originalFilename}`;
      cleanedMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      cleanedBuffer = serializeToCsv(transformResult.cleanedRows, transformResult.cleanedColumns);
      cleanedFilename = `cleaned_${dataset.originalFilename.replace(/\.[^/.]+$/, "")}.csv`;
      cleanedMimeType = "text/csv";
    }

    const uploadCleaned = await storage.uploadFile({
      workspaceId: session.workspaceId,
      filename: cleanedFilename,
      mimeType: cleanedMimeType,
      buffer: cleanedBuffer,
    });

    // 7. Update Dataset record in MongoDB
    dataset.status = "CLEANED";
    dataset.cleanedStorageKey = uploadCleaned.storageKey;
    dataset.cleanedPreviewRows = transformResult.cleanedRows.slice(0, 20);
    dataset.cleaningSummary = {
      transformationsAppliedCount: transformResult.appliedSteps.filter((s) => s.status === "APPLIED").length,
      rowsRemovedCount: transformResult.metrics.rowsRemovedCount,
      cellsModifiedCount: transformResult.metrics.cellsModifiedCount,
      finalQualityScore: newReport.qualityScore,
      completedAt: new Date(),
    };
    await dataset.save();

    // 8. Update or create CleaningJob record
    let jobRecord;
    if (jobId) {
      jobRecord = await CleaningJob.findOneAndUpdate(
        { _id: jobId, datasetId: id, workspaceId: session.workspaceId },
        {
          $set: {
            plan: transformResult.appliedSteps,
            afterMetrics: {
              rowCount: transformResult.metrics.afterRowCount,
              colCount: transformResult.cleanedColumns.length,
              qualityScore: newReport.qualityScore,
            },
            status: "COMPLETED",
          },
        },
        { new: true }
      );
    } else {
      jobRecord = await CleaningJob.create({
        datasetId: id,
        workspaceId: session.workspaceId,
        userId: session.userId,
        plan: transformResult.appliedSteps,
        beforeMetrics: {
          rowCount: parsed.totalRows,
          colCount: parsed.totalColumns,
          qualityScore: dataset.profilingReport?.qualityScore || 0,
        },
        afterMetrics: {
          rowCount: transformResult.metrics.afterRowCount,
          colCount: transformResult.cleanedColumns.length,
          qualityScore: newReport.qualityScore,
        },
        status: "COMPLETED",
      });
    }

    // 9. Log activity
    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "DATASET_CLEANED",
      resourceType: "DATASET",
      resourceId: id,
      metadata: {
        transformationsCount: transformResult.appliedSteps.filter((s) => s.status === "APPLIED").length,
        rowsBefore: parsed.totalRows,
        rowsAfter: transformResult.metrics.afterRowCount,
        qualityScoreBefore: dataset.profilingReport?.qualityScore || 0,
        qualityScoreAfter: newReport.qualityScore,
      },
    });

    return NextResponse.json({
      message: "Dataset transformations applied successfully",
      dataset,
      job: jobRecord,
      metrics: transformResult.metrics,
      appliedSteps: transformResult.appliedSteps,
      newQualityScore: newReport.qualityScore,
      newProfilingReport: newReport,
    });
  } catch (error: any) {
    console.error("Clean dataset execution error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute cleaning transformations" },
      { status: 500 }
    );
  }
}
