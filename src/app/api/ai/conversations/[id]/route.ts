import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AIConversation, AIMessage } from "@/lib/db/models";

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

    const conversation = await AIConversation.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    }).lean();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const rawMessages = await AIMessage.find({ conversationId: id })
      .sort({ createdAt: 1 })
      .lean();

    const messages = rawMessages.map((m: any) => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      modelId: m.modelId,
      citations: m.citations,
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      conversation: {
        id: (conversation as any)._id.toString(),
        title: (conversation as any).title,
        workspaceId: (conversation as any).workspaceId,
        userId: (conversation as any).userId,
        createdAt: (conversation as any).createdAt,
        updatedAt: (conversation as any).updatedAt,
        messages,
      },
    });
  } catch (error: any) {
    console.error("Fetch conversation error:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
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

    const conversation = await AIConversation.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    await Promise.all([
      AIConversation.deleteOne({ _id: id }),
      AIMessage.deleteMany({ conversationId: id }),
    ]);

    return NextResponse.json({ message: "Conversation deleted successfully" });
  } catch (error: any) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
