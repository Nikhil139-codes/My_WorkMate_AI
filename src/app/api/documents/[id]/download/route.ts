import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel } from "@/lib/db/models";
import { storage } from "@/lib/storage";

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
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const fileBuffer = await storage.getFile(doc.storageKey);
    if (!fileBuffer) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalFilename)}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (error: any) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { error: "Failed to download document" },
      { status: 500 }
    );
  }
}
