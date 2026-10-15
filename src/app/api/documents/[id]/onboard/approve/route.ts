import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel, DocumentChunk } from "@/lib/db/models";
import { onboardingApprovalSchema } from "@/lib/documents/onboarding";
import { indexDocument } from "@/lib/documents/indexer";
import { indexMultimodalDocument } from "@/lib/multimodal/multimodalIndexer";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Verify user session & workspace access
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // 2. Parse and validate user approval configuration
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const validationResult = onboardingApprovalSchema.safeParse(body);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: "Invalid onboarding configuration parameters",
        details: validationResult.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const approvedConfig = validationResult.data;

  try {
    await connectToDatabase();

    // 3. Find document strictly in user's authorized workspace
    const doc = await DocumentModel.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const mediaType = (doc as any).mediaType || "document";

    let result;
    if (mediaType === "image" || mediaType === "audio" || mediaType === "video") {
      result = await indexMultimodalDocument(id, session.workspaceId);
    } else {
      result = await indexDocument(id, session.workspaceId, {
        ...approvedConfig,
        approvedAt: new Date(),
        approvedByUserId: session.userId,
      });
    }

    const updatedDoc = await DocumentModel.findById(id).lean();

    return NextResponse.json({
      message: "Document onboarded, segmented, and vector-indexed successfully",
      document: {
        id: (updatedDoc as any)._id.toString(),
        originalFilename: (updatedDoc as any).originalFilename,
        processingStatus: (updatedDoc as any).processingStatus,
        pageCount: (updatedDoc as any).pageCount,
        chunkCount: (updatedDoc as any).chunkCount,
        onboardingConfig: (updatedDoc as any).onboardingConfig,
      },
    });
  } catch (error: any) {
    console.error("Onboarding approval error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to approve and index document" },
      { status: 500 }
    );
  }
}
