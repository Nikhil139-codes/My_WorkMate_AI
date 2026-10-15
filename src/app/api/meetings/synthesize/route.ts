import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel } from "@/lib/db/models";
import { sendGroqChat } from "@/lib/ai/groq";
import { logActivity } from "@/lib/workspace/auth";
import { indexMultimodalDocument } from "@/lib/multimodal/multimodalIndexer";
import { formatTimestampRange } from "@/lib/multimodal/audioProcessor";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { documentId, force = false } = body;
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const doc = await DocumentModel.findOne({
      _id: documentId,
      workspaceId: session.workspaceId,
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Recording document not found or access denied" },
        { status: 404 }
      );
    }

    // Return cached synthesis if available and not forcing re-run
    if (doc.meetingSynthesis && !force) {
      return NextResponse.json({
        cached: true,
        synthesis: doc.meetingSynthesis,
      });
    }

    // Ensure document is transcribed
    let transcriptText = doc.transcription?.text || doc.extractedText || "";
    const segments = doc.transcription?.segments || [];

    if (!transcriptText || transcriptText.trim().length === 0) {
      if (doc.processingStatus !== "READY") {
        await indexMultimodalDocument(doc.id, session.workspaceId);
        const refreshed = await DocumentModel.findById(doc.id);
        transcriptText = refreshed?.transcription?.text || refreshed?.extractedText || "";
      }
    }

    if (!transcriptText || transcriptText.trim().length === 0) {
      return NextResponse.json(
        { error: "No audible transcript could be extracted from this recording to synthesize." },
        { status: 400 }
      );
    }

    // Prepare timestamped context for the LLM
    let formattedContext = "";
    if (segments.length > 0) {
      formattedContext = segments
        .slice(0, 150) // reasonable chunk budget
        .map((s) => `[${formatTimestampRange(s.start, s.end)}] ${s.text}`)
        .join("\n");
    } else {
      formattedContext = transcriptText.slice(0, 8000);
    }

    const systemPrompt = `You are WorkMate AI's Meeting Intelligence & Executive Synthesis Agent.
Analyze the provided meeting recording transcript and generate a comprehensive, structured synthesis.
Respond with a single valid JSON object strictly matching this schema:
{
  "title": "Clear, professional meeting title based on content",
  "executiveSummary": "2-3 well-structured paragraphs summarizing core discussion, context, and outcomes",
  "topics": [
    {
      "title": "Topic name",
      "timestampStart": 0,
      "timestampEnd": 60,
      "formattedTimestamp": "00:00 – 01:00",
      "summary": "Brief summary of what was discussed here"
    }
  ],
  "decisions": [
    "Specific agreed decision 1",
    "Specific agreed decision 2"
  ],
  "actionItems": [
    {
      "task": "Actionable task description",
      "owner": "Person name or Unassigned",
      "priority": "HIGH", // one of: LOW, MEDIUM, HIGH, URGENT
      "dueDate": "YYYY-MM-DD or Next Sprint or Soon",
      "timestamp": "MM:SS"
    }
  ]
}
Return ONLY JSON without Markdown backticks or commentary.`;

    const userPrompt = `Meeting Recording Filename: ${doc.originalFilename}
Workspace: ${session.workspaceName || "Enterprise Workspace"}

Transcript:
${formattedContext}

Generate the structured JSON meeting synthesis now:`;

    const aiResponse = await sendGroqChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    let synthesisData: any;
    try {
      const cleanJson = aiResponse.content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      synthesisData = JSON.parse(cleanJson);
    } catch {
      synthesisData = {
        title: doc.originalFilename.replace(/\.[^/.]+$/, ""),
        executiveSummary: aiResponse.content,
        topics: [],
        decisions: [],
        actionItems: [],
      };
    }

    const finalSynthesis = {
      title: synthesisData.title || doc.originalFilename,
      executiveSummary: synthesisData.executiveSummary || "Summary generated from meeting transcript.",
      topics: Array.isArray(synthesisData.topics) ? synthesisData.topics : [],
      decisions: Array.isArray(synthesisData.decisions) ? synthesisData.decisions : [],
      actionItems: Array.isArray(synthesisData.actionItems)
        ? synthesisData.actionItems.map((a: any) => ({
            task: String(a.task || "Follow up on action item"),
            owner: String(a.owner || "Unassigned"),
            priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(a.priority).toUpperCase())
              ? String(a.priority).toUpperCase()
              : "MEDIUM",
            dueDate: a.dueDate ? String(a.dueDate) : undefined,
            timestamp: a.timestamp ? String(a.timestamp) : undefined,
          }))
        : [],
      generatedAt: new Date(),
    };

    // Cache to document
    doc.meetingSynthesis = finalSynthesis;
    await doc.save();

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MEETING_SYNTHESIS_GENERATED",
      resourceType: "DOCUMENT",
      resourceId: doc.id,
      metadata: {
        documentName: doc.originalFilename,
        actionItemsCount: finalSynthesis.actionItems.length,
        decisionsCount: finalSynthesis.decisions.length,
      },
    });

    return NextResponse.json({
      cached: false,
      synthesis: finalSynthesis,
    });
  } catch (error: any) {
    console.error("Meeting synthesis error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate meeting synthesis" },
      { status: 500 }
    );
  }
}
