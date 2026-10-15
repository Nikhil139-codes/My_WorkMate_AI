import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Meeting } from "@/lib/db/models/Meeting";
import { logActivity } from "@/lib/workspace/auth";
import { extractDocumentContent } from "@/lib/documents/extractor";
import { transcribeAudio, GROQ_AUDIO_MIME_TYPES } from "@/lib/multimodal/audioProcessor";
import { runMeetingAnalysis, formatFollowUpSummary } from "@/lib/meetings/meetingAnalyzer";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query") || "";
    const meetingType = searchParams.get("type");

    const filter: any = { workspaceId: session.workspaceId };

    if (meetingType && meetingType !== "ALL") {
      filter.meetingType = meetingType;
    }

    if (query) {
      filter.$or = [
        { title: { $regex: query, $options: "i" } },
        { participants: { $regex: query, $options: "i" } },
        { "analysis.executiveSummary": { $regex: query, $options: "i" } },
      ];
    }

    const meetings = await Meeting.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json({
      meetings: meetings.map((m) => ({
        id: m.id,
        title: m.title,
        meetingType: m.meetingType,
        participants: m.participants,
        meetingDate: m.meetingDate,
        inputType: m.inputType,
        status: m.status,
        transcriptText: m.transcriptText,
        transcriptSegments: m.transcriptSegments || [],
        transcriptLength: m.transcriptText?.length || 0,
        analysis: m.analysis,
        followUpSummary: m.followUpSummary,
        sourceDocumentId: m.sourceDocumentId,
        hasAnalysis: Boolean(m.analysis),
        decisionsCount: m.analysis?.decisions?.length || 0,
        actionItemsCount: m.analysis?.actionItems?.length || 0,
        unresolvedCount: m.analysis?.unresolvedQuestions?.length || 0,
        blockersCount: m.analysis?.blockers?.length || 0,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("Failed to list meetings:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load meetings" },
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
    await connectToDatabase();

    const contentType = req.headers.get("content-type") || "";

    let title = "Meeting Sync";
    let meetingType = "General Sync";
    let participants: string[] = [];
    let meetingDate = new Date();
    let transcriptText = "";
    let transcriptSegments: any[] = [];
    let inputType: "PASTE" | "UPLOAD_TRANSCRIPT" | "AUDIO_RECORDING" = "PASTE";
    let autoAnalyze = true;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      title = (formData.get("title") as string) || title;
      meetingType = (formData.get("meetingType") as string) || meetingType;
      autoAnalyze = formData.get("autoAnalyze") !== "false";

      const rawParticipants = formData.get("participants") as string;
      if (rawParticipants) {
        participants = rawParticipants
          .split(/[,;\n]/)
          .map((p) => p.trim())
          .filter(Boolean);
      }

      const rawDate = formData.get("meetingDate") as string;
      if (rawDate) {
        const parsed = new Date(rawDate);
        if (!isNaN(parsed.getTime())) meetingDate = parsed;
      }

      const pastedNotes = formData.get("transcriptText") as string;

      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;
        const mimeType = file.type || "application/octet-stream";
        const lowerName = filename.toLowerCase();

        if (
          GROQ_AUDIO_MIME_TYPES.has(mimeType) ||
          /\.(mp3|wav|m4a|mp4|webm|mpeg)$/i.test(lowerName)
        ) {
          // Audio / Video Recording
          inputType = "AUDIO_RECORDING";
          if (!title || title === "Meeting Sync") {
            title = filename.replace(/\.[^/.]+$/, "");
          }

          const audioRes = await transcribeAudio(buffer, filename, mimeType);
          transcriptText = audioRes.text;
          transcriptSegments = audioRes.segments;
        } else {
          // Document / Transcript File (TXT, DOCX, PDF, etc.)
          inputType = "UPLOAD_TRANSCRIPT";
          if (!title || title === "Meeting Sync") {
            title = filename.replace(/\.[^/.]+$/, "");
          }

          const extracted = await extractDocumentContent(buffer, mimeType, filename);
          transcriptText = extracted.text;
        }
      } else if (pastedNotes && pastedNotes.trim()) {
        inputType = "PASTE";
        transcriptText = pastedNotes.trim();
      } else {
        return NextResponse.json(
          { error: "Please provide either a transcript file or paste meeting notes/transcript." },
          { status: 400 }
        );
      }
    } else {
      // JSON body
      const body = await req.json();
      title = body.title ? String(body.title).trim() : "Meeting Sync";
      meetingType = body.meetingType ? String(body.meetingType).trim() : "General Sync";
      if (Array.isArray(body.participants)) {
        participants = body.participants.map(String).map((p: string) => p.trim()).filter(Boolean);
      } else if (typeof body.participants === "string") {
        participants = body.participants.split(/[,;\n]/).map((p: string) => p.trim()).filter(Boolean);
      }
      if (body.meetingDate) {
        const parsed = new Date(body.meetingDate);
        if (!isNaN(parsed.getTime())) meetingDate = parsed;
      }
      transcriptText = body.transcriptText ? String(body.transcriptText).trim() : "";
      inputType = body.inputType === "AUDIO_RECORDING" ? "AUDIO_RECORDING" : "PASTE";
      if (Array.isArray(body.transcriptSegments)) {
        transcriptSegments = body.transcriptSegments;
      }
      autoAnalyze = body.autoAnalyze !== false;
    }

    if (!transcriptText || transcriptText.trim().length < 10) {
      return NextResponse.json(
        { error: "Transcript content is too short or empty. Please provide meaningful meeting discussion text." },
        { status: 400 }
      );
    }

    const meeting = await Meeting.create({
      workspaceId: session.workspaceId,
      createdByUserId: session.userId,
      title,
      meetingType,
      participants,
      meetingDate,
      inputType,
      transcriptText,
      transcriptSegments,
      status: autoAnalyze ? "ANALYZING" : "DRAFT",
    });

    if (autoAnalyze) {
      try {
        const analysis = await runMeetingAnalysis(transcriptText, {
          title,
          meetingType,
          participants,
        });
        meeting.analysis = analysis;
        meeting.followUpSummary = formatFollowUpSummary(meeting);
        meeting.status = "READY";
        await meeting.save();
      } catch (analysisErr: any) {
        console.error("Automatic meeting analysis failed:", analysisErr);
        meeting.status = "DRAFT";
        await meeting.save();
      }
    }

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MEETING_CREATED",
      resourceType: "MEETING",
      resourceId: meeting.id,
      metadata: {
        title: meeting.title,
        inputType,
        hasAnalysis: Boolean(meeting.analysis),
      },
    });

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        meetingType: meeting.meetingType,
        participants: meeting.participants,
        meetingDate: meeting.meetingDate,
        status: meeting.status,
        analysis: meeting.analysis,
        followUpSummary: meeting.followUpSummary,
      },
    });
  } catch (error: any) {
    console.error("Create meeting error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create meeting" },
      { status: 500 }
    );
  }
}
