import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Meeting } from "@/lib/db/models/Meeting";
import { formatFollowUpSummary } from "@/lib/meetings/meetingAnalyzer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const download = req.nextUrl.searchParams.get("download") === "true";

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

    const summary = meeting.followUpSummary || formatFollowUpSummary(meeting);

    if (download) {
      const filename = `meeting-summary-${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
      return new NextResponse(summary, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      title: meeting.title,
      meetingDate: meeting.meetingDate,
      summary,
    });
  } catch (error: any) {
    console.error("Get follow-up summary error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate follow-up summary" },
      { status: 500 }
    );
  }
}
