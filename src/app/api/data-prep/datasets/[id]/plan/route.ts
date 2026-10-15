import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Dataset } from "@/lib/db/models/Dataset";
import { CleaningJob } from "@/lib/db/models/CleaningJob";
import { generateAICleaningPlan } from "@/lib/data-prep/aiAgent";
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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional (defaults to automatic profiling clean)
  }

  const userPrompt = typeof body.prompt === "string" ? body.prompt.trim() : null;

  try {
    await connectToDatabase();

    const dataset = await Dataset.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    if (!dataset.profilingReport) {
      return NextResponse.json(
        { error: "Dataset profiling report is not ready" },
        { status: 400 }
      );
    }

    // Generate structured cleaning plan via Groq AI
    const { reasoning, plan } = await generateAICleaningPlan(
      dataset.originalFilename,
      dataset.columns,
      dataset.profilingReport,
      userPrompt
    );

    // Save proposed CleaningJob record
    const job = await CleaningJob.create({
      datasetId: id,
      workspaceId: session.workspaceId,
      userId: session.userId,
      userPrompt,
      aiReasoning: reasoning,
      plan,
      beforeMetrics: {
        rowCount: dataset.rowCount,
        colCount: dataset.columnCount,
        qualityScore: dataset.profilingReport.qualityScore,
      },
      status: "PROPOSED",
    });

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "DATASET_CLEANING_PLAN_GENERATED",
      resourceType: "DATASET",
      resourceId: id,
      metadata: {
        stepsCount: plan.length,
        hasUserPrompt: Boolean(userPrompt),
      },
    });

    return NextResponse.json({
      message: "Cleaning plan generated successfully",
      jobId: job.id,
      reasoning,
      plan,
    });
  } catch (error: any) {
    console.error("Generate cleaning plan error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate cleaning plan" },
      { status: 500 }
    );
  }
}
