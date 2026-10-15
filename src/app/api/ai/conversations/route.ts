import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AIConversation, AIMessage } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const convList = await AIConversation.find({
      workspaceId: session.workspaceId,
      userId: session.userId,
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const conversationIds = convList.map((c: any) => c._id.toString());
    const messageCounts = conversationIds.length > 0
      ? await AIMessage.aggregate([
          { $match: { conversationId: { $in: conversationIds } } },
          { $group: { _id: "$conversationId", count: { $sum: 1 } } },
        ])
      : [];

    const countMap = new Map(messageCounts.map((m: any) => [m._id, m.count]));

    const conversations = convList.map((c: any) => ({
      id: c._id.toString(),
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      _count: {
        messages: countMap.get(c._id.toString()) || 0,
      },
    }));

    return NextResponse.json({ conversations });
  } catch (error: any) {
    console.error("Fetch conversations error:", error);
    return NextResponse.json(
      { error: "Failed to load conversations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const title = body.title?.trim() || "New Conversation";

    await connectToDatabase();

    const created = await AIConversation.create({
      workspaceId: session.workspaceId,
      userId: session.userId,
      title,
    });

    return NextResponse.json(
      {
        conversation: {
          id: created.id,
          title: created.title,
          workspaceId: created.workspaceId,
          userId: created.userId,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
