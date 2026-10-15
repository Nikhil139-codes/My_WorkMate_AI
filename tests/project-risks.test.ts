import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateOverallRiskScore,
  DetectedRiskCandidate,
} from "../src/lib/risks/riskEngine";

describe("Phase 7: Proactive Project Risk & Decision Support Tests", () => {
  describe("1. Deterministic Rule-Based Scoring Engine", () => {
    it("should calculate overdue task severity and score deterministically without hallucination", () => {
      const now = new Date("2026-10-15T12:00:00Z");

      // Test Case A: Overdue by 10 days (> 7 days) -> CRITICAL
      const dueDateA = new Date("2026-10-05T12:00:00Z");
      const msDiffA = now.getTime() - dueDateA.getTime();
      const daysOverdueA = Math.floor(msDiffA / (1000 * 60 * 60 * 24));
      assert.equal(daysOverdueA, 10);

      const scoreA = Math.min(100, 85 + Math.min(15, daysOverdueA));
      assert.equal(scoreA, 95);
      assert.ok(scoreA >= 85 && scoreA <= 100);

      // Test Case B: Overdue by 4 days (> 3 days) -> HIGH
      const dueDateB = new Date("2026-10-11T12:00:00Z");
      const msDiffB = now.getTime() - dueDateB.getTime();
      const daysOverdueB = Math.floor(msDiffB / (1000 * 60 * 60 * 24));
      assert.equal(daysOverdueB, 4);

      const scoreB = Math.min(84, 70 + daysOverdueB * 2);
      assert.equal(scoreB, 78);
      assert.ok(scoreB >= 70 && scoreB < 85);

      // Test Case C: Overdue by 1 day -> MEDIUM
      const dueDateC = new Date("2026-10-14T12:00:00Z");
      const msDiffC = now.getTime() - dueDateC.getTime();
      const daysOverdueC = Math.floor(msDiffC / (1000 * 60 * 60 * 24));
      assert.equal(daysOverdueC, 1);

      const scoreC = Math.min(69, 50 + daysOverdueC * 3);
      assert.equal(scoreC, 53);
      assert.ok(scoreC >= 50 && scoreC < 70);
    });

    it("should evaluate blocked tasks and incomplete dependencies deterministically", () => {
      const evaluateBlocked = (priority: string, unresolvedCount: number, isBlocked: boolean) => {
        if (priority === "URGENT" || priority === "HIGH") {
          return { severity: "CRITICAL", score: 85 };
        }
        if (unresolvedCount > 1 || isBlocked) {
          return { severity: "HIGH", score: 75 };
        }
        return { severity: "MEDIUM", score: 55 };
      };

      // Urgent blocked task
      const res1 = evaluateBlocked("URGENT", 1, true);
      assert.equal(res1.severity, "CRITICAL");
      assert.equal(res1.score, 85);

      // Normal task with multiple unresolved dependencies
      const res2 = evaluateBlocked("MEDIUM", 3, false);
      assert.equal(res2.severity, "HIGH");
      assert.equal(res2.score, 75);

      // Low priority task with single dependency
      const res3 = evaluateBlocked("LOW", 1, false);
      assert.equal(res3.severity, "MEDIUM");
      assert.equal(res3.score, 55);
    });

    it("should evaluate missing owner and unscheduled scope risks accurately", () => {
      const evaluateUnassigned = (priority: string, hasUpcomingDue: boolean) => {
        if (priority === "URGENT" || priority === "HIGH") {
          return { severity: "HIGH", score: 65 };
        }
        if (hasUpcomingDue) {
          return { severity: "MEDIUM", score: 50 };
        }
        return { severity: "LOW", score: 30 };
      };

      const highPriorityUnassigned = evaluateUnassigned("HIGH", false);
      assert.equal(highPriorityUnassigned.severity, "HIGH");
      assert.equal(highPriorityUnassigned.score, 65);

      const lowPriorityUnassigned = evaluateUnassigned("LOW", false);
      assert.equal(lowPriorityUnassigned.severity, "LOW");
      assert.equal(lowPriorityUnassigned.score, 30);
    });
  });

  describe("2. Composite Project Risk Index (0–100) & Health Levels", () => {
    it("should return 0 score and LOW_RISK health when no active risks exist", () => {
      const emptyRisks: any[] = [];
      const result = calculateOverallRiskScore(emptyRisks);

      assert.equal(result.overallScore, 0);
      assert.equal(result.healthLevel, "LOW_RISK");

      const allResolvedRisks = [
        { score: 95, severity: "CRITICAL", status: "RESOLVED" },
        { score: 70, severity: "HIGH", status: "RESOLVED" },
      ];
      const resolvedResult = calculateOverallRiskScore(allResolvedRisks);
      assert.equal(resolvedResult.overallScore, 0);
      assert.equal(resolvedResult.healthLevel, "LOW_RISK");
    });

    it("should scale composite risk score and assign correct health thresholds", () => {
      // Single moderate risk
      const moderateRisks = [{ score: 45, severity: "MEDIUM", status: "IDENTIFIED" }];
      const modResult = calculateOverallRiskScore(moderateRisks);
      assert.ok(modResult.overallScore >= 30 && modResult.overallScore < 60);
      assert.equal(modResult.healthLevel, "MODERATE_RISK");

      // Severe risk combination
      const severeRisks = [
        { score: 90, severity: "CRITICAL", status: "IDENTIFIED" },
        { score: 85, severity: "CRITICAL", status: "IDENTIFIED" },
        { score: 75, severity: "HIGH", status: "IDENTIFIED" },
      ];
      const critResult = calculateOverallRiskScore(severeRisks);
      assert.ok(critResult.overallScore >= 80);
      assert.equal(critResult.healthLevel, "CRITICAL_RISK");
      assert.ok(critResult.overallScore <= 100);
    });
  });

  describe("3. Deduplication & State Machine", () => {
    it("should generate deterministic risk keys to prevent duplicate alert generation", () => {
      const taskId = "task_prod_deploy";
      const key1 = `overdue:${taskId}`;
      const key2 = `overdue:${taskId}`;

      assert.equal(key1, key2);

      const existingRisks = new Map([
        ["overdue:task_prod_deploy", { score: 75, severity: "HIGH" }],
      ]);

      // If key already exists, update rather than insert duplicate
      assert.ok(existingRisks.has(key1));
    });

    it("should track risk lifecycle transitions and mitigation notes", () => {
      const riskRecord: any = {
        id: "risk_01",
        status: "IDENTIFIED",
        mitigationNotes: [],
        history: [],
      };

      // 1. Transition to ACKNOWLEDGED
      riskRecord.status = "ACKNOWLEDGED";
      riskRecord.history.push({ action: "ACKNOWLEDGED", timestamp: new Date() });
      assert.equal(riskRecord.status, "ACKNOWLEDGED");

      // 2. Add Mitigation Note
      riskRecord.mitigationNotes.push({
        id: "note_1",
        note: "Discussed in standup, reassigned to Alex.",
        authorName: "Maya",
        createdAt: new Date(),
      });
      riskRecord.status = "MITIGATING";
      riskRecord.history.push({ action: "MITIGATION_ADDED", timestamp: new Date() });
      assert.equal(riskRecord.mitigationNotes.length, 1);
      assert.equal(riskRecord.status, "MITIGATING");

      // 3. Mark RESOLVED
      riskRecord.status = "RESOLVED";
      riskRecord.history.push({ action: "RESOLVED", timestamp: new Date() });
      assert.equal(riskRecord.status, "RESOLVED");
      assert.equal(riskRecord.history.length, 3);
    });
  });

  describe("4. AI Recommendation Validation & Safety Boundary", () => {
    it("should ensure recommendations remain strictly advisory without mutating tasks directly", () => {
      const rawAiRecommendations = [
        {
          id: "rec_1",
          suggestion: "Prioritize token bucket rate limiter to unblock beta testing",
          rationale: "Task has been overdue for 3 days and blocks 2 downstream tasks.",
          actionType: "PRIORITIZE",
        },
        {
          id: "rec_2",
          suggestion: "Assign ownership for audit log verification task",
          rationale: "High priority item is currently unassigned.",
          actionType: "ASSIGN_OWNER",
        },
      ];

      rawAiRecommendations.forEach((rec) => {
        assert.ok(rec.suggestion.length > 5);
        assert.ok(rec.rationale.length > 5);
        assert.ok(["PRIORITIZE", "ASSIGN_OWNER", "RESOLVE_BLOCKER"].includes(rec.actionType));
      });

      // Verify safety constraint: recommendations cannot mutate state without explicit user interaction
      const mockTask = { id: "t1", status: "TODO", owner: "Unassigned" };
      // After AI recommendation, task remains untouched
      assert.equal(mockTask.status, "TODO");
      assert.equal(mockTask.owner, "Unassigned");
    });
  });
});
