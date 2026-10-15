import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel, DocumentChunk } from "@/lib/db/models";
import { storage } from "@/lib/storage";
import { logActivity } from "@/lib/workspace/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await connectToDatabase();

    const doc = await DocumentModel.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const documentData = doc as any;

    return NextResponse.json({
      document: {
        id: documentData._id.toString(),
        workspaceId: documentData.workspaceId,
        uploadedByUserId: documentData.uploadedByUserId,
        originalFilename: documentData.originalFilename,
        mimeType: documentData.mimeType,
        fileSize: documentData.fileSize,
        pageCount: documentData.pageCount || 1,
        chunkCount: documentData.chunkCount || 0,
        processingStatus: documentData.processingStatus,
        purpose: documentData.purpose,
        extractedTextPreview: documentData.extractedText?.substring(0, 2000) || null,
        onboardingSuggestion: documentData.onboardingSuggestion,
        onboardingConfig: documentData.onboardingConfig,
        failureReason: documentData.failureReason,
        createdAt: documentData.createdAt,
        updatedAt: documentData.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Fetch document error:", error);
    return NextResponse.json(
      { error: "Failed to load document details" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await connectToDatabase();

    const doc = await DocumentModel.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 1. Delete physical file from storage
    if (doc.storageKey) {
      await storage.deleteFile(doc.storageKey);
    }

    // 2. Cascade delete all document chunks in MongoDB
    await DocumentChunk.deleteMany({
      documentId: id,
      workspaceId: session.workspaceId,
    });

    // 3. Delete document record
    await DocumentModel.deleteOne({ _id: id });

    // 4. Log activity
    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "DOCUMENT_DELETED",
      resourceType: "DOCUMENT",
      resourceId: id,
      metadata: {
        filename: doc.originalFilename,
      },
    });

    return NextResponse.json({
      message: `Document "${doc.originalFilename}" and associated vector chunks were deleted successfully`,
    });
  } catch (error: any) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
