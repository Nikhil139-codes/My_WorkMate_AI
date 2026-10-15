import { connectToDatabase } from "@/lib/db/mongodb";
import { Task, ITask } from "@/lib/db/models/Task";
import { Meeting, IMeeting } from "@/lib/db/models/Meeting";
import {
  ProjectRisk,
  IProjectRisk,
  IRiskRecommendation,
} from "@/lib/db/models/ProjectRisk";
import { sendGroqChat } from "@/lib/ai/groq";

export interface DetectedRiskCandidate {
  riskKey: string;
  title: string;
  description: string;
  category: "OVERDUE" | "BLOCKED_DEPENDENCY" | "MISSING_OWNER" | "MISSING_DEADLINE" | "UNRESOLVED_DECISION" | "BOTTLENECK" | "GENERAL";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  score: number; // Deterministic rule-based score 0–100
  contributingFactors: string[];
  evidence: string;
  affectedTaskIds: string[];
  affectedMeetingIds: string[];
}

export interface WorkspaceRiskSummary {
  overallScore: number; // 0–100
  healthLevel: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK";
  totalRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  activeRisks: IProjectRisk[];
  evaluatedAt: Date;
}

/**
 * Deterministically calculates the composite Project Risk Index (0–100)
 */
export function calculateOverallRiskScore(
  risks: Array<{ score: number; severity: string; status?: string }>
): {
  overallScore: number;
  healthLevel: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK";
} {
  const active = risks.filter((r) => r.status !== "RESOLVED");
  if (active.length === 0) {
    return { overallScore: 0, healthLevel: "LOW_RISK" };
  }

  const scores = active.map((r) => r.score);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  const criticalCount = active.filter((r) => r.severity === "CRITICAL").length;
  const highCount = active.filter((r) => r.severity === "HIGH").length;

  // Composite formula: 50% max severity risk + 30% average risk + density penalty (10 per critical, 5 per high)
  const composite = Math.round(
    maxScore * 0.5 + avgScore * 0.3 + criticalCount * 8 + highCount * 4
  );
  const overallScore = Math.max(0, Math.min(100, composite));

  let healthLevel: "LOW_RISK" | "MODERATE_RISK" | "HIGH_RISK" | "CRITICAL_RISK" = "LOW_RISK";
  if (overallScore >= 80) healthLevel = "CRITICAL_RISK";
  else if (overallScore >= 60) healthLevel = "HIGH_RISK";
  else if (overallScore >= 30) healthLevel = "MODERATE_RISK";

  return { overallScore, healthLevel };
}

/**
 * Deterministic Risk Detection Engine Rules
 * Evaluates real tasks and meetings without hallucinating scores or fake data.
 */
export async function detectWorkspaceRisks(
  workspaceId: string,
  now = new Date()
): Promise<DetectedRiskCandidate[]> {
  await connectToDatabase();

  const tasks: ITask[] = await Task.find({ workspaceId }).sort({ createdAt: -1 });
  const meetings: IMeeting[] = await Meeting.find({ workspaceId }).sort({ createdAt: -1 });

  const detected: DetectedRiskCandidate[] = [];

  // Map tasks by ID and lower-case title for dependency tracking
  const taskMap = new Map<string, ITask>();
  tasks.forEach((t) => {
    taskMap.set(t.id, t);
    taskMap.set(t.title.toLowerCase().trim(), t);
  });

  // RULE 1: Overdue Tasks Detection
  tasks.forEach((task) => {
    if (task.status !== "COMPLETED" && task.dueDate && new Date(task.dueDate) < now) {
      const msDiff = now.getTime() - new Date(task.dueDate).getTime();
      const daysOverdue = Math.max(1, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

      let severity: "CRITICAL" | "HIGH" | "MEDIUM" = "MEDIUM";
      let score = 55;

      if (daysOverdue >= 7 || task.priority === "URGENT") {
        severity = "CRITICAL";
        score = Math.min(100, 85 + Math.min(15, daysOverdue));
      } else if (daysOverdue >= 3 || task.priority === "HIGH") {
        severity = "HIGH";
        score = Math.min(84, 70 + daysOverdue * 2);
      } else {
        severity = "MEDIUM";
        score = Math.min(69, 50 + daysOverdue * 3);
      }

      const factors: string[] = [
        `Task is overdue by ${daysOverdue} day${daysOverdue > 1 ? "s" : ""}.`,
        `Current status is ${task.status}.`,
        `Priority is set to ${task.priority}.`,
      ];
      if (task.owner && task.owner !== "Unknown") {
        factors.push(`Assigned owner: ${task.owner}.`);
      } else {
        factors.push("Task has no assigned owner to take accountability.");
      }

      detected.push({
        riskKey: `overdue:${task.id}`,
        title: `Overdue Task: "${task.title}"`,
        description: `This task missed its delivery deadline of ${new Date(
          task.dueDate
        ).toLocaleDateString()} and remains incomplete.`,
        category: "OVERDUE",
        severity,
        score,
        contributingFactors: factors,
        evidence: `Deadline was ${new Date(task.dueDate).toISOString().split("T")[0]}. Overdue by ${daysOverdue} days.`,
        affectedTaskIds: [task.id],
        affectedMeetingIds: task.meetingId ? [task.meetingId] : [],
      });
    }
  });

  // RULE 2: Blocked Tasks & Unresolved Dependencies
  tasks.forEach((task) => {
    if (task.status !== "COMPLETED") {
      const unresolvedDeps: string[] = [];

      (task.dependencies || []).forEach((dep) => {
        const found = taskMap.get(dep) || taskMap.get(dep.toLowerCase().trim());
        if (!found || found.status !== "COMPLETED") {
          unresolvedDeps.push(dep);
        }
      });

      const isExplicitlyBlocked = task.status === "BLOCKED";

      if (isExplicitlyBlocked || unresolvedDeps.length > 0) {
        let severity: "CRITICAL" | "HIGH" | "MEDIUM" = "MEDIUM";
        let score = 50;

        if (task.priority === "URGENT" || task.priority === "HIGH") {
          severity = "CRITICAL";
          score = 85;
        } else if (unresolvedDeps.length > 1 || isExplicitlyBlocked) {
          severity = "HIGH";
          score = 75;
        } else {
          severity = "MEDIUM";
          score = 55;
        }

        const factors: string[] = [];
        if (isExplicitlyBlocked) {
          factors.push("Task status is explicitly set to BLOCKED.");
        }
        if (unresolvedDeps.length > 0) {
          factors.push(
            `Blocked by ${unresolvedDeps.length} unresolved prerequisite${
              unresolvedDeps.length > 1 ? "s" : ""
            }: ${unresolvedDeps.join(", ")}.`
          );
        }
        if (task.dueDate) {
          factors.push(`Due date committed for ${new Date(task.dueDate).toLocaleDateString()}.`);
        }

        detected.push({
          riskKey: `blocked:${task.id}`,
          title: `Blocked Execution: "${task.title}"`,
          description: isExplicitlyBlocked
            ? `Task is marked BLOCKED and cannot make progress without resolution.`
            : `Task cannot proceed because required prerequisite dependencies remain incomplete.`,
          category: "BLOCKED_DEPENDENCY",
          severity,
          score,
          contributingFactors: factors,
          evidence: `Dependencies: [${(task.dependencies || []).join(", ")}]. Incomplete: [${unresolvedDeps.join(", ")}].`,
          affectedTaskIds: [task.id],
          affectedMeetingIds: task.meetingId ? [task.meetingId] : [],
        });
      }
    }
  });

  // RULE 3: Missing Owners on Active Tasks
  tasks.forEach((task) => {
    const isUnassigned =
      !task.owner ||
      task.owner.trim() === "" ||
      /^(unknown|unassigned|none|tbd)$/i.test(task.owner.trim());

    if (task.status !== "COMPLETED" && isUnassigned) {
      let severity: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      let score = 30;

      const hasUpcomingDue =
        task.dueDate &&
        new Date(task.dueDate).getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;

      if (task.priority === "URGENT" || task.priority === "HIGH") {
        severity = "HIGH";
        score = 65;
      } else if (hasUpcomingDue) {
        severity = "MEDIUM";
        score = 50;
      } else {
        severity = "LOW";
        score = 30;
      }

      detected.push({
        riskKey: `missing_owner:${task.id}`,
        title: `Unassigned Ownership: "${task.title}"`,
        description: `This active task has no designated owner, risking omission during sprint execution.`,
        category: "MISSING_OWNER",
        severity,
        score,
        contributingFactors: [
          "No workspace member has accepted ownership.",
          `Priority level: ${task.priority}.`,
          task.dueDate
            ? `Has due date ${new Date(task.dueDate).toLocaleDateString()} without owner.`
            : "No delivery owner or due date defined.",
        ],
        evidence: `Owner field: "${task.owner || "null"}". Priority: ${task.priority}.`,
        affectedTaskIds: [task.id],
        affectedMeetingIds: task.meetingId ? [task.meetingId] : [],
      });
    }
  });

  // RULE 4: Missing Deadlines on Active Tasks
  tasks.forEach((task) => {
    if (task.status !== "COMPLETED" && !task.dueDate) {
      let severity: "MEDIUM" | "LOW" = "LOW";
      let score = 25;

      if (task.priority === "URGENT" || task.priority === "HIGH") {
        severity = "MEDIUM";
        score = 45;
      } else if (task.dependencies && task.dependencies.length > 0) {
        severity = "MEDIUM";
        score = 40;
      }

      detected.push({
        riskKey: `missing_deadline:${task.id}`,
        title: `Unscheduled Scope: "${task.title}"`,
        description: `Active task is missing a target due date, making progress tracking unpredictable.`,
        category: "MISSING_DEADLINE",
        severity,
        score,
        contributingFactors: [
          "Target delivery date is unspecified.",
          `Priority is ${task.priority}.`,
          task.owner ? `Assigned to ${task.owner}.` : "Unassigned owner.",
        ],
        evidence: `dueDate is null on active task id ${task.id}.`,
        affectedTaskIds: [task.id],
        affectedMeetingIds: task.meetingId ? [task.meetingId] : [],
      });
    }
  });

  // RULE 5: Unresolved Meeting Decisions & Stated Blockers
  meetings.forEach((meeting) => {
    if (meeting.analysis?.blockers?.length) {
      meeting.analysis.blockers.forEach((blocker, idx) => {
        const hash = Buffer.from(blocker).toString("base64").slice(0, 12);
        detected.push({
          riskKey: `meeting_blocker:${meeting.id}:${hash}`,
          title: `Meeting Blocker: "${blocker.slice(0, 60)}..."`,
          description: `An explicit operational blocker was flagged during "${meeting.title}".`,
          category: "BOTTLENECK",
          severity: "HIGH",
          score: 70,
          contributingFactors: [
            `Reported in meeting "${meeting.title}".`,
            `Direct blocker statement: "${blocker}".`,
          ],
          evidence: `Source Meeting: ${meeting.title}. Blocker excerpt: "${blocker}".`,
          affectedTaskIds: [],
          affectedMeetingIds: [meeting.id],
        });
      });
    }

    if (meeting.analysis?.unresolvedQuestions?.length) {
      meeting.analysis.unresolvedQuestions.slice(0, 3).forEach((question, idx) => {
        const hash = Buffer.from(question).toString("base64").slice(0, 12);
        detected.push({
          riskKey: `unresolved_decision:${meeting.id}:${hash}`,
          title: `Unresolved Question: "${question.slice(0, 60)}..."`,
          description: `Open decision or question pending resolution from "${meeting.title}".`,
          category: "UNRESOLVED_DECISION",
          severity: "MEDIUM",
          score: 45,
          contributingFactors: [
            `Question raised during "${meeting.title}".`,
            `Open inquiry: "${question}".`,
          ],
          evidence: `Source Meeting: ${meeting.title}. Question: "${question}".`,
          affectedTaskIds: [],
          affectedMeetingIds: [meeting.id],
        });
      });
    }
  });

  return detected;
}

/**
 * Synchronizes detected risk candidates with MongoDB Atlas, preserving history and mitigation notes.
 */
export async function syncWorkspaceRisks(
  workspaceId: string,
  now = new Date()
): Promise<WorkspaceRiskSummary> {
  await connectToDatabase();

  const candidates = await detectWorkspaceRisks(workspaceId, now);
  const candidateKeys = new Set(candidates.map((c) => c.riskKey));

  // 1. Fetch existing risks for this workspace
  const existingRisks = await ProjectRisk.find({ workspaceId });
  const existingMap = new Map<string, IProjectRisk>();
  existingRisks.forEach((r) => existingMap.set(r.riskKey, r));

  // 2. Insert or update candidate risks
  for (const candidate of candidates) {
    const existing = existingMap.get(candidate.riskKey);

    if (existing) {
      // Check if score or severity changed
      const scoreDiff = Math.abs(existing.score - candidate.score);
      const severityChanged = existing.severity !== candidate.severity;

      if (scoreDiff >= 5 || severityChanged) {
        existing.history.push({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: "SCORE_CHANGED",
          details: `Risk score updated from ${existing.score} (${existing.severity}) to ${candidate.score} (${candidate.severity}).`,
          timestamp: now,
        });
      }

      existing.title = candidate.title;
      existing.description = candidate.description;
      existing.severity = candidate.severity;
      existing.score = candidate.score;
      existing.contributingFactors = candidate.contributingFactors;
      existing.evidence = candidate.evidence;
      existing.affectedTaskIds = candidate.affectedTaskIds;
      existing.affectedMeetingIds = candidate.affectedMeetingIds;
      existing.lastEvaluatedAt = now;

      // If it was previously marked resolved but the underlying problem still exists, reopen it
      if (existing.status === "RESOLVED") {
        existing.status = "IDENTIFIED";
        existing.history.push({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: "REOPENED",
          details: "Risk condition re-detected during automated evaluation.",
          timestamp: now,
        });
      }

      await existing.save();
    } else {
      // Create new risk entry
      await ProjectRisk.create({
        workspaceId,
        riskKey: candidate.riskKey,
        title: candidate.title,
        description: candidate.description,
        category: candidate.category,
        severity: candidate.severity,
        score: candidate.score,
        contributingFactors: candidate.contributingFactors,
        evidence: candidate.evidence,
        affectedTaskIds: candidate.affectedTaskIds,
        affectedMeetingIds: candidate.affectedMeetingIds,
        status: "IDENTIFIED",
        mitigationNotes: [],
        history: [
          {
            id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            action: "DETECTED",
            details: `Risk initially identified with score ${candidate.score} (${candidate.severity}).`,
            timestamp: now,
          },
        ],
        aiRecommendations: [],
        lastEvaluatedAt: now,
      });
    }
  }

  // 3. Mark existing risks as RESOLVED if their trigger condition is no longer present
  for (const [key, existing] of existingMap.entries()) {
    if (!candidateKeys.has(key) && existing.status !== "RESOLVED") {
      existing.status = "RESOLVED";
      existing.resolvedAt = now;
      existing.history.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: "RESOLVED",
        details: "Underlying risk condition resolved (task completed, dependency satisfied, or date adjusted).",
        timestamp: now,
      });
      await existing.save();
    }
  }

  // 4. Return refreshed workspace risk summary
  const allWorkspaceRisks = await ProjectRisk.find({ workspaceId }).sort({
    score: -1,
    createdAt: -1,
  });

  const activeRisks = allWorkspaceRisks.filter((r) => r.status !== "RESOLVED");

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let acknowledgedCount = 0;
  let resolvedCount = 0;

  allWorkspaceRisks.forEach((r) => {
    if (r.status === "RESOLVED") {
      resolvedCount++;
    } else {
      if (r.status === "ACKNOWLEDGED") acknowledgedCount++;
      if (r.severity === "CRITICAL") criticalCount++;
      else if (r.severity === "HIGH") highCount++;
      else if (r.severity === "MEDIUM") mediumCount++;
      else if (r.severity === "LOW") lowCount++;
    }
  });

  const { overallScore, healthLevel } = calculateOverallRiskScore(allWorkspaceRisks);

  return {
    overallScore,
    healthLevel,
    totalRisks: allWorkspaceRisks.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    acknowledgedCount,
    resolvedCount,
    activeRisks,
    evaluatedAt: now,
  };
}

/**
 * Generates actionable next-step recommendations using Groq grounded in real risk evidence.
 * Output is strictly validated as suggestions (never modifies tasks automatically).
 */
export async function generateGroqRiskRecommendations(
  risks: IProjectRisk[]
): Promise<IRiskRecommendation[]> {
  const activeRisks = risks.filter((r) => r.status !== "RESOLVED").slice(0, 10);
  if (activeRisks.length === 0) {
    return [
      {
        id: "rec_healthy",
        suggestion: "All project milestones on track.",
        rationale: "No active overdue tasks, unresolved blockers, or unassigned priorities detected.",
        actionType: "CUSTOM",
      },
    ];
  }

  const contextList = activeRisks.map((r, i) => ({
    id: r.id,
    title: r.title,
    severity: r.severity,
    score: r.score,
    factors: r.contributingFactors,
    evidence: r.evidence,
  }));

  const systemPrompt = `You are WorkMate AI's Project Risk & Decision Support Advisor.
Analyze the provided deterministic project risks and generate structured, actionable recommendations.

CRITICAL INSTRUCTIONS:
1. Do NOT invent or alter numerical risk scores.
2. Label recommendations as concrete suggestions for team leads to review and approve.
3. Suggest practical remedies: prioritizing overdue work, reallocating unassigned tasks, resolving blockers, or reviewing deadlines.
4. Output strictly a JSON object matching this schema:
{
  "recommendations": [
    {
      "id": "rec_1",
      "suggestion": "Specific actionable next step",
      "rationale": "Clear reason grounded in the evidence provided",
      "actionType": "PRIORITIZE" | "RESOLVE_BLOCKER" | "ASSIGN_OWNER" | "SET_DEADLINE" | "DECISION_FOLLOWUP" | "CUSTOM"
    }
  ]
}`;

  const userPrompt = `Active Project Risks (${activeRisks.length}):
${JSON.stringify(contextList, null, 2)}

Provide up to 5 prioritized, high-leverage recommendations now:`;

  try {
    const aiRes = await sendGroqChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(aiRes.content.trim());
    if (Array.isArray(parsed.recommendations)) {
      return parsed.recommendations.map((rec: any, idx: number) => ({
        id: rec.id || `rec_${idx + 1}`,
        suggestion: String(rec.suggestion || "Review identified risk item").trim(),
        rationale: String(rec.rationale || "Suggested based on active risk factors.").trim(),
        actionType: [
          "PRIORITIZE",
          "RESOLVE_BLOCKER",
          "ASSIGN_OWNER",
          "SET_DEADLINE",
          "DECISION_FOLLOWUP",
          "CUSTOM",
        ].includes(String(rec.actionType))
          ? (rec.actionType as any)
          : "CUSTOM",
      }));
    }
  } catch (err) {
    console.error("Groq recommendation generation failed:", err);
  }

  // Fallback heuristic recommendations if Groq is unreachable
  return activeRisks.slice(0, 3).map((r, idx) => ({
    id: `rec_fallback_${idx + 1}`,
    suggestion: `Review and mitigate: ${r.title}`,
    rationale: r.contributingFactors.join(" ") || r.description,
    actionType: r.category === "OVERDUE" ? "PRIORITIZE" : r.category === "BLOCKED_DEPENDENCY" ? "RESOLVE_BLOCKER" : "ASSIGN_OWNER",
  }));
}
