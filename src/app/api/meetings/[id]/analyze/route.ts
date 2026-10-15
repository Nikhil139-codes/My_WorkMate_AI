import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Meeting } from "@/lib/db/models/Meeting";
import { logActivity } from "@/lib/workspace/auth";
import { runMeetingAnalysis, formatFollowUpSummary } from "@/lib/meetings/meetingAnalyzer";

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

    if (!meeting.transcriptText || meeting.transcriptText.trim().length < 10) {
      return NextResponse.json(
        { error: "Meeting transcript is empty. Please provide transcript content first." },
        { status: 400 }
      );
    }

    meeting.status = "ANALYZING";
    await meeting.save();

    const analysis = await runMeetingAnalysis(meeting.transcriptText, {
      title: meeting.title,
      meetingType: meeting.meetingType,
      participants: meeting.participants,
    });

    meeting.analysis = analysis;
    meeting.followUpSummary = formatFollowUpSummary(meeting);
    meeting.status = "READY";
    await meeting.save();

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MEETING_ANALYZED",
      resourceType: "MEETING",
      resourceId: meeting.id,
      metadata: {
        title: meeting.title,
        decisionsCount: analysis.decisions.length,
        actionItemsCount: analysis.actionItems.length,
      },
    });

    return NextResponse.json({
      success: true,
      analysis: meeting.analysis,
      followUpSummary: meeting.followUpSummary,
    });
  } catch (error: any) {
    console.error("Meeting analyze error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze meeting transcript" },
      { status: 500 }
    );
  }
}
