import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Meeting } from "@/lib/db/models/Meeting";
import { logActivity } from "@/lib/workspace/auth";
import { convertApprovedActionItemsToTasks } from "@/lib/meetings/meetingAnalyzer";

export async function POST(
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

    const meeting = await Meeting.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    if (!meeting.analysis?.actionItems?.length) {
      return NextResponse.json(
        { error: "No action items available in this meeting to convert." },
        { status: 400 }
      );
    }

    let actionItemIds: string[] = [];
    try {
      const body = await req.json();
      if (Array.isArray(body.actionItemIds) && body.actionItemIds.length > 0) {
        actionItemIds = body.actionItemIds;
      }
    } catch {
      // If no JSON body passed, default to all approved action items
    }

    if (actionItemIds.length === 0) {
      actionItemIds = meeting.analysis.actionItems
        .filter((a) => a.approved !== false)
        .map((a) => a.id);
    }

    const { created, updated, taskIds } = await convertApprovedActionItemsToTasks(
      meeting,
      actionItemIds,
      session.workspaceId
    );

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "TASKS_CREATED_FROM_MEETING",
      resourceType: "TASK",
      resourceId: meeting.id,
      metadata: {
        meetingTitle: meeting.title,
        createdCount: created,
        updatedCount: updated,
      },
    });

    return NextResponse.json({
      success: true,
      createdCount: created,
      updatedCount: updated,
      totalCount: created + updated,
      taskIds,
      analysis: meeting.analysis,
    });
  } catch (error: any) {
    console.error("Convert tasks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert action items to tasks" },
      { status: 500 }
    );
  }
}
