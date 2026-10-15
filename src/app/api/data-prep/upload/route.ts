import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Dataset } from "@/lib/db/models/Dataset";
import { storage } from "@/lib/storage";
import { parseDatasetFile } from "@/lib/data-prep/parser";
import { profileDataset } from "@/lib/data-prep/profiler";
import { logActivity } from "@/lib/workspace/auth";

const ALLOWED_EXTENSIONS = new Set(["csv", "xlsx", "xls"]);
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized: Please sign in to access Data Preparation" },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file was provided in upload request" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 25MB maximum upload limit" },
        { status: 400 }
      );
    }

    const filename = file.name;
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `Unsupported file format .${ext}. WorkMate AI Data Preparation supports CSV and XLSX files.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || (ext === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    // 1. Store original file safely via storage abstraction
    const uploadResult = await storage.uploadFile({
      workspaceId: session.workspaceId,
      filename,
      mimeType,
      buffer,
    });

    // 2. Parse file content into structured records & headers
    let parsed;
    try {
      parsed = parseDatasetFile(buffer, filename, mimeType);
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: `Failed to parse tabular dataset: ${parseErr.message || "Invalid file structure"}` },
        { status: 422 }
      );
    }

    if (parsed.columns.length === 0 || parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "The uploaded file does not contain any valid data rows or column headers." },
        { status: 400 }
      );
    }

    // 3. Run statistical data profiling
    const { columns: profiledColumns, profilingReport } = profileDataset(parsed.rows, parsed.columns);

    // 4. Persist in MongoDB
    await connectToDatabase();

    const previewRows = parsed.rows.slice(0, 20);

    const newDataset = await Dataset.create({
      workspaceId: session.workspaceId,
      uploadedByUserId: session.userId,
      originalFilename: filename,
      mimeType,
      fileSize: uploadResult.fileSize,
      storageKey: uploadResult.storageKey,
      format: ext === "csv" ? "csv" : "xlsx",
      rowCount: parsed.totalRows,
      columnCount: parsed.totalColumns,
      columns: profiledColumns,
      previewRows,
      profilingReport,
      status: "READY",
    });

    // 5. Log audit activity
    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "DATASET_UPLOADED",
      resourceType: "DATASET",
      resourceId: newDataset.id,
      metadata: {
        filename,
        rowCount: parsed.totalRows,
        columnCount: parsed.totalColumns,
        qualityScore: profilingReport.qualityScore,
      },
    });

    return NextResponse.json(
      {
        message: "Dataset uploaded and profiled successfully",
        dataset: newDataset,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Dataset upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process dataset upload" },
      { status: 500 }
    );
  }
}
