import { sendGroqChat } from "@/lib/ai/groq";
import {
  IMeeting,
  IMeetingAnalysis,
  IMeetingActionItem,
  IMeetingDecision,
  IMeetingTopic,
} from "@/lib/db/models/Meeting";
import { Task, ITask } from "@/lib/db/models/Task";

/**
 * Validates and strictly sanitizes raw AI output against the meeting analysis schema.
 * Enforces rule: Never invent owners or deadlines; fallback to "Unknown".
 */
export function validateAndSanitizeAnalysis(raw: any): IMeetingAnalysis {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid meeting analysis payload: must be an object.");
  }

  const executiveSummary = String(
    raw.executiveSummary || raw.summary || "Summary generated from meeting transcript."
  ).trim();

  const keyDiscussionPoints: string[] = Array.isArray(raw.keyDiscussionPoints)
    ? raw.keyDiscussionPoints.map((p: any) => String(p).trim()).filter(Boolean)
    : [];

  const rawTopics = Array.isArray(raw.topics) ? raw.topics : [];
  const topics: IMeetingTopic[] = rawTopics.map((t: any) => ({
    title: String(t.title || "Discussion Topic").trim(),
    summary: String(t.summary || "").trim(),
    timestampStart: typeof t.timestampStart === "number" ? t.timestampStart : undefined,
    timestampEnd: typeof t.timestampEnd === "number" ? t.timestampEnd : undefined,
    formattedTimestamp: t.formattedTimestamp ? String(t.formattedTimestamp) : undefined,
  }));

  const rawDecisions = Array.isArray(raw.decisions) ? raw.decisions : [];
  const decisions: IMeetingDecision[] = rawDecisions.map((d: any, idx: number) => {
    const text = typeof d === "string" ? d : d.decision || d.text || `Decision ${idx + 1}`;
    const excerpt = typeof d === "object" && d.excerpt ? String(d.excerpt).trim() : "";
    const timestamp = typeof d === "object" && d.timestamp ? String(d.timestamp).trim() : "";
    const id = typeof d === "object" && d.id ? String(d.id) : `dec_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;
    const approved = typeof d === "object" && typeof d.approved === "boolean" ? d.approved : true;

    return {
      id,
      decision: String(text).trim(),
      excerpt,
      timestamp,
      approved,
    };
  });

  const rawActionItems = Array.isArray(raw.actionItems) ? raw.actionItems : [];
  const actionItems: IMeetingActionItem[] = rawActionItems.map((a: any, idx: number) => {
    const task = String(a.task || a.title || `Action item ${idx + 1}`).trim();
    
    // Strict requirement: Never invent owners. Fallback to "Unknown" if not explicitly specified.
    let owner = "Unknown";
    if (a.owner && String(a.owner).trim() && !/^(unknown|unassigned|none|tbd|anyone)$/i.test(String(a.owner).trim())) {
      owner = String(a.owner).trim();
    }

    // Priorities must be strictly validated
    let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "MEDIUM";
    const rawPriority = String(a.priority || "").toUpperCase();
    if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(rawPriority)) {
      priority = rawPriority as any;
    }

    // Strict requirement: Never invent deadlines. Fallback to "Unknown".
    let dueDate = "Unknown";
    if (a.dueDate && String(a.dueDate).trim() && !/^(unknown|tbd|none|n\/a)$/i.test(String(a.dueDate).trim())) {
      dueDate = String(a.dueDate).trim();
    }

    const dependencies = Array.isArray(a.dependencies)
      ? a.dependencies.map((dep: any) => String(dep).trim()).filter(Boolean)
      : [];

    const excerpt = a.excerpt ? String(a.excerpt).trim() : "";
    const timestamp = a.timestamp ? String(a.timestamp).trim() : "";

    // Explicit commitment check
    const isExplicitCommitment = Boolean(a.isExplicitCommitment);
    const id = a.id ? String(a.id) : `act_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`;
    const approved = typeof a.approved === "boolean" ? a.approved : true;
    const status = a.status && ["PENDING", "APPROVED", "REJECTED", "CONVERTED"].includes(a.status)
      ? a.status
      : (approved ? "APPROVED" : "PENDING");

    return {
      id,
      task,
      owner,
      priority,
      dueDate,
      dependencies,
      excerpt,
      timestamp,
      isExplicitCommitment,
      approved,
      status,
      createdTaskId: a.createdTaskId ? String(a.createdTaskId) : undefined,
    };
  });

  const unresolvedQuestions = Array.isArray(raw.unresolvedQuestions)
    ? raw.unresolvedQuestions.map((q: any) => String(q).trim()).filter(Boolean)
    : [];

  const blockers = Array.isArray(raw.blockers)
    ? raw.blockers.map((b: any) => String(b).trim()).filter(Boolean)
    : [];

  const followUpTopics = Array.isArray(raw.followUpTopics)
    ? raw.followUpTopics.map((f: any) => String(f).trim()).filter(Boolean)
    : [];

  return {
    title: raw.title ? String(raw.title).trim() : undefined,
    executiveSummary,
    keyDiscussionPoints,
    topics,
    decisions,
    actionItems,
    unresolvedQuestions,
    blockers,
    followUpTopics,
    analyzedAt: new Date(),
  };
}

/**
 * Executes AI Meeting Analysis using Groq with structured JSON output
 */
export async function runMeetingAnalysis(
  transcriptText: string,
  meta?: { title?: string; meetingType?: string; participants?: string[] }
): Promise<IMeetingAnalysis> {
  const truncatedTranscript = transcriptText.slice(0, 15000);

  const systemPrompt = `You are WorkMate AI's Meeting-to-Execution Engine.
Analyze the provided meeting transcript with high accuracy and produce a structured analysis.

CRITICAL INSTRUCTIONS:
1. DO NOT INVENT OR GUESS OWNERS: If an owner is not explicitly stated in the transcript, set "owner": "Unknown".
2. DO NOT INVENT DEADLINES: If a due date or deadline is not explicitly agreed upon in the transcript, set "dueDate": "Unknown".
3. DISTINGUISH EXPLICIT COMMITMENTS:
   - Set "isExplicitCommitment": true ONLY when a participant explicitly volunteered, committed, or was directly assigned and accepted during the meeting (e.g., "I will fix the bug tomorrow", "Sarah will draft the spec").
   - Set "isExplicitCommitment": false for AI-suggested or inferred follow-up tasks.
4. SOURCE EXCERPTS: For each decision and action item, include the exact supporting quote ("excerpt") from the transcript, and timestamp if mentioned.
5. DEPENDENCIES: Include dependent tasks or prerequisites only when explicitly mentioned.

Return ONLY a valid JSON object matching this schema:
{
  "title": "Clear professional meeting title",
  "executiveSummary": "2-3 well-structured paragraphs summarizing core discussion, context, and outcomes",
  "keyDiscussionPoints": ["Key point 1", "Key point 2"],
  "topics": [
    {
      "title": "Topic name",
      "summary": "Summary of discussion"
    }
  ],
  "decisions": [
    {
      "id": "dec_1",
      "decision": "Explicit decision text",
      "excerpt": "Quote from transcript supporting this decision",
      "timestamp": "MM:SS (or empty)"
    }
  ],
  "actionItems": [
    {
      "id": "act_1",
      "task": "Specific actionable task",
      "owner": "Person name or Unknown",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "dueDate": "YYYY-MM-DD or Next Sprint or Unknown",
      "dependencies": ["Task or prerequisite name if mentioned"],
      "excerpt": "Supporting quote from transcript",
      "timestamp": "MM:SS (or empty)",
      "isExplicitCommitment": true | false
    }
  ],
  "unresolvedQuestions": ["Question 1", "Question 2"],
  "blockers": ["Blocker 1", "Blocker 2"],
  "followUpTopics": ["Topic for next meeting"]
}`;

  const userPrompt = `Meeting Title: ${meta?.title || "Team Meeting"}
Meeting Type: ${meta?.meetingType || "General Sync"}
Known Participants: ${meta?.participants?.join(", ") || "Unspecified"}

Meeting Transcript:
${truncatedTranscript}

Generate the structured JSON meeting analysis now:`;

  const aiRes = await sendGroqChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1, // low temperature for analytical precision
    response_format: { type: "json_object" },
  });

  let parsed: any;
  try {
    const cleanJson = aiRes.content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    throw new Error(`Failed to parse AI meeting analysis JSON: ${aiRes.content.slice(0, 200)}`);
  }

  return validateAndSanitizeAnalysis(parsed);
}

/**
 * Formats a clean, executive follow-up summary in Markdown.
 */
export function formatFollowUpSummary(meeting: IMeeting): string {
  const analysis = meeting.analysis;
  if (!analysis) {
    return `# Meeting Follow-Up: ${meeting.title}\n\n*No analysis generated yet.*`;
  }

  const dateStr = meeting.meetingDate
    ? new Date(meeting.meetingDate).toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString();

  const participantsStr = meeting.participants?.length
    ? meeting.participants.join(", ")
    : "Team members";

  let md = `# Meeting Executive Follow-Up: ${meeting.title}\n\n`;
  md += `**Date:** ${dateStr}  \n`;
  md += `**Meeting Type:** ${meeting.meetingType || "General Sync"}  \n`;
  md += `**Participants:** ${participantsStr}  \n\n`;

  md += `## 📋 Executive Summary\n${analysis.executiveSummary}\n\n`;

  if (analysis.keyDiscussionPoints?.length > 0) {
    md += `## 💡 Key Discussion Points\n`;
    analysis.keyDiscussionPoints.forEach((point) => {
      md += `- ${point}\n`;
    });
    md += `\n`;
  }

  const approvedDecisions = analysis.decisions?.filter((d) => d.approved !== false) || [];
  if (approvedDecisions.length > 0) {
    md += `## ✅ Decisions Made & Excerpts\n`;
    approvedDecisions.forEach((d, idx) => {
      md += `${idx + 1}. **${d.decision}**\n`;
      if (d.excerpt) {
        md += `   > *Excerpt: "${d.excerpt}"*${d.timestamp ? ` (at ${d.timestamp})` : ""}\n`;
      }
    });
    md += `\n`;
  }

  const approvedActionItems = analysis.actionItems?.filter((a) => a.approved !== false) || [];
  if (approvedActionItems.length > 0) {
    md += `## 🚀 Approved Action Items & Tasks\n`;
    approvedActionItems.forEach((item, idx) => {
      const typeBadge = item.isExplicitCommitment ? "[Explicit Commitment]" : "[AI-Suggested]";
      md += `### ${idx + 1}. ${item.task} ${typeBadge}\n`;
      md += `- **Owner:** ${item.owner || "Unknown"}\n`;
      md += `- **Priority:** ${item.priority}\n`;
      md += `- **Due Date:** ${item.dueDate || "Unknown"}\n`;
      if (item.dependencies?.length > 0) {
        md += `- **Dependencies:** ${item.dependencies.join(", ")}\n`;
      }
      if (item.excerpt) {
        md += `- **Transcript Source:** "${item.excerpt}"${item.timestamp ? ` (${item.timestamp})` : ""}\n`;
      }
      md += `\n`;
    });
  }

  if (analysis.unresolvedQuestions?.length > 0) {
    md += `## ❓ Unresolved Questions & Follow-Up Topics\n`;
    analysis.unresolvedQuestions.forEach((q) => {
      md += `- ${q}\n`;
    });
    md += `\n`;
  }

  if (analysis.blockers?.length > 0) {
    md += `## ⚠️ Identified Blockers & Risks\n`;
    analysis.blockers.forEach((b) => {
      md += `- ${b}\n`;
    });
    md += `\n`;
  }

  md += `---\n*Generated by WorkMate AI Meeting-to-Execution Engine*`;
  return md;
}

/**
 * Converts approved action items into Workspace Tasks, strictly preventing duplicate task creation.
 */
export async function convertApprovedActionItemsToTasks(
  meeting: IMeeting,
  actionItemIds: string[],
  workspaceId: string
): Promise<{ created: number; updated: number; taskIds: string[] }> {
  if (!meeting.analysis?.actionItems?.length) {
    return { created: 0, updated: 0, taskIds: [] };
  }

  const targetIds = new Set(actionItemIds);
  const itemsToConvert = meeting.analysis.actionItems.filter(
    (item) => targetIds.has(item.id) && item.approved !== false
  );

  let createdCount = 0;
  let updatedCount = 0;
  const taskIds: string[] = [];

  for (const item of itemsToConvert) {
    // Duplicate prevention: check if a Task with this meetingActionItemId already exists in this workspace
    const existingTask = await Task.findOne({
      workspaceId,
      meetingActionItemId: item.id,
    });

    let dueDate: Date | null = null;
    if (item.dueDate && item.dueDate !== "Unknown") {
      const parsedDate = new Date(item.dueDate);
      if (!isNaN(parsedDate.getTime())) {
        dueDate = parsedDate;
      }
    }

    if (existingTask) {
      // Update existing task instead of creating duplicate
      existingTask.title = item.task;
      existingTask.priority = item.priority;
      existingTask.owner = item.owner !== "Unknown" ? item.owner : null;
      existingTask.dueDate = dueDate;
      existingTask.dependencies = item.dependencies || [];
      existingTask.sourceExcerpt = item.excerpt || null;
      existingTask.isExplicitCommitment = item.isExplicitCommitment;
      await existingTask.save();

      item.status = "CONVERTED";
      item.createdTaskId = existingTask.id;
      taskIds.push(existingTask.id);
      updatedCount++;
    } else {
      // Create new task
      const newTask = await Task.create({
        workspaceId,
        title: item.task,
        description: `Generated from meeting "${meeting.title}".${
          item.excerpt ? ` Excerpt: "${item.excerpt}"` : ""
        }${item.timestamp ? ` [${item.timestamp}]` : ""}`,
        status: "TODO",
        priority: item.priority,
        owner: item.owner !== "Unknown" ? item.owner : null,
        dueDate,
        dependencies: item.dependencies || [],
        meetingId: meeting.id,
        meetingActionItemId: item.id,
        sourceExcerpt: item.excerpt || null,
        isExplicitCommitment: item.isExplicitCommitment,
      });

      item.status = "CONVERTED";
      item.createdTaskId = newTask.id;
      taskIds.push(newTask.id);
      createdCount++;
    }
  }

  // Update meeting followUpSummary and save state
  meeting.followUpSummary = formatFollowUpSummary(meeting);
  meeting.markModified("analysis");
  await meeting.save();

  return { created: createdCount, updated: updatedCount, taskIds };
}
