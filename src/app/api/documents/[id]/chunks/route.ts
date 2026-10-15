import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DocumentChunk } from "@/lib/db/models";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

  try {
    await connectToDatabase();

    const chunks = await DocumentChunk.find({
      documentId: id,
      workspaceId: session.workspaceId,
    })
      .sort({ chunkIndex: 1 })
      .limit(limit)
      .select("_id chunkIndex content pageNumber tokenCount metadata createdAt")
      .lean();

    return NextResponse.json({
      chunks: (chunks as any[]).map((c) => ({
        id: c._id.toString(),
        chunkIndex: c.chunkIndex,
        content: c.content,
        pageNumber: c.pageNumber || 1,
        tokenCount: c.tokenCount || 0,
        metadata: c.metadata,
      })),
      count: chunks.length,
    });
  } catch (error: any) {
    console.error("Fetch chunks error:", error);
    return NextResponse.json(
      { error: "Failed to load document chunks" },
      { status: 500 }
    );
  }
}
