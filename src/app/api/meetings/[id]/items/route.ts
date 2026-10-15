import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Meeting } from "@/lib/db/models/Meeting";
import { formatFollowUpSummary } from "@/lib/meetings/meetingAnalyzer";

export async function PATCH(
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

    if (!meeting.analysis) {
      return NextResponse.json(
        { error: "No analysis exists for this meeting yet." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { decisions, actionItems } = body;

    // Update decisions
    if (Array.isArray(decisions) && meeting.analysis.decisions) {
      decisions.forEach((updateItem: any) => {
        const existing = meeting.analysis!.decisions.find((d) => d.id === updateItem.id);
        if (existing) {
          if (typeof updateItem.approved === "boolean") existing.approved = updateItem.approved;
          if (updateItem.decision) existing.decision = String(updateItem.decision).trim();
        }
      });
    }

    // Update action items
    if (Array.isArray(actionItems) && meeting.analysis.actionItems) {
      actionItems.forEach((updateItem: any) => {
        const existing = meeting.analysis!.actionItems.find((a) => a.id === updateItem.id);
        if (existing) {
          if (typeof updateItem.approved === "boolean") existing.approved = updateItem.approved;
          if (updateItem.task) existing.task = String(updateItem.task).trim();
          if (updateItem.owner !== undefined) existing.owner = String(updateItem.owner).trim() || "Unknown";
          if (updateItem.dueDate !== undefined) existing.dueDate = String(updateItem.dueDate).trim() || "Unknown";
          if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(updateItem.priority).toUpperCase())) {
            existing.priority = String(updateItem.priority).toUpperCase() as any;
          }
          if (Array.isArray(updateItem.dependencies)) {
            existing.dependencies = updateItem.dependencies.map(String).filter(Boolean);
          }
          if (["PENDING", "APPROVED", "REJECTED", "CONVERTED"].includes(updateItem.status)) {
            existing.status = updateItem.status;
          }
        }
      });
    }

    // Re-generate follow up summary with updated approvals
    meeting.followUpSummary = formatFollowUpSummary(meeting);
    meeting.markModified("analysis");
    await meeting.save();

    return NextResponse.json({
      success: true,
      analysis: meeting.analysis,
      followUpSummary: meeting.followUpSummary,
    });
  } catch (error: any) {
    console.error("Update meeting items error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update meeting decisions or action items" },
      { status: 500 }
    );
  }
}
