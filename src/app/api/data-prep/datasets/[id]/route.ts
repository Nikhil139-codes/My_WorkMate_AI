import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Dataset } from "@/lib/db/models/Dataset";
import { CleaningJob } from "@/lib/db/models/CleaningJob";
import { storage } from "@/lib/storage";
import { logActivity } from "@/lib/workspace/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();

    const dataset = await Dataset.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const latestJob = await CleaningJob.findOne({
      datasetId: id,
      workspaceId: session.workspaceId,
    }).sort({ createdAt: -1 });

    return NextResponse.json({
      dataset,
      latestCleaningJob: latestJob,
    });
  } catch (error: any) {
    console.error("Get dataset error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dataset details" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();

    const dataset = await Dataset.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    // Delete stored files
    if (dataset.storageKey) {
      await storage.deleteFile(dataset.storageKey).catch(() => {});
    }
    if (dataset.cleanedStorageKey) {
      await storage.deleteFile(dataset.cleanedStorageKey).catch(() => {});
    }

    // Delete associated jobs and dataset record
    await CleaningJob.deleteMany({ datasetId: id, workspaceId: session.workspaceId });
    await Dataset.deleteOne({ _id: id, workspaceId: session.workspaceId });

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "DATASET_DELETED",
      resourceType: "DATASET",
      resourceId: id,
      metadata: { filename: dataset.originalFilename },
    });

    return NextResponse.json({ message: "Dataset and associated records deleted successfully" });
  } catch (error: any) {
    console.error("Delete dataset error:", error);
    return NextResponse.json(
      { error: "Failed to delete dataset" },
      { status: 500 }
    );
  }
}
