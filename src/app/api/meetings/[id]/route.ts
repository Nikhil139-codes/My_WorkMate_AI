import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Meeting } from "@/lib/db/models/Meeting";
import { logActivity } from "@/lib/workspace/auth";

export async function GET(
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

    return NextResponse.json({ meeting });
  } catch (error: any) {
    console.error("Get meeting error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve meeting" },
      { status: 500 }
    );
  }
}

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

    const body = await req.json();

    if (body.title) meeting.title = String(body.title).trim();
    if (body.meetingType) meeting.meetingType = String(body.meetingType).trim();
    if (Array.isArray(body.participants)) {
      meeting.participants = body.participants.map(String).filter(Boolean);
    }
    if (body.meetingDate) {
      const parsed = new Date(body.meetingDate);
      if (!isNaN(parsed.getTime())) meeting.meetingDate = parsed;
    }
    if (body.transcriptText) {
      meeting.transcriptText = String(body.transcriptText).trim();
    }

    await meeting.save();

    return NextResponse.json({ success: true, meeting });
  } catch (error: any) {
    console.error("Update meeting error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update meeting" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const meeting = await Meeting.findOneAndDelete({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!meeting) {
      return NextResponse.json(
        { error: "Meeting not found or access denied" },
        { status: 404 }
      );
    }

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MEETING_DELETED",
      resourceType: "MEETING",
      resourceId: id,
      metadata: { title: meeting.title },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete meeting error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete meeting" },
      { status: 500 }
    );
  }
}
