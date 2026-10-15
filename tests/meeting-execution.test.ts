import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAndSanitizeAnalysis,
  formatFollowUpSummary,
} from "../src/lib/meetings/meetingAnalyzer";
import { IMeeting, IMeetingAnalysis } from "../src/lib/db/models/Meeting";

describe("Phase 6: Meeting-to-Execution Engine Tests", () => {
  describe("1. Structured Meeting Analysis Validation & Fallbacks", () => {
    it("should validate complete analysis payload and sanitize fields", () => {
      const rawAnalysis = {
        title: "Sprint 44 Engineering Review",
        executiveSummary: "Team reviewed migration progress and agreed on timelines.",
        keyDiscussionPoints: [
          "MongoDB Atlas query latency",
          "Micro-App rate limiting",
        ],
        topics: [
          {
            title: "Database Migration",
            summary: "Maya completed staging verification.",
            timestampStart: 0,
            timestampEnd: 60,
            formattedTimestamp: "00:00 – 01:00",
          },
        ],
        decisions: [
          {
            id: "dec_1",
            decision: "Deploy production migration on Thursday at 5 PM",
            excerpt: "Maya will deploy production migration on Thursday",
            timestamp: "01:25",
            approved: true,
          },
        ],
        actionItems: [
          {
            id: "act_1",
            task: "Implement token bucket rate limiter on public app routes",
            owner: "David",
            priority: "HIGH",
            dueDate: "2026-10-18",
            dependencies: ["Database adapter"],
            excerpt: "I explicitly commit to finishing the rate limiter by tomorrow noon",
            timestamp: "02:15",
            isExplicitCommitment: true,
            approved: true,
          },
        ],
        unresolvedQuestions: ["Budget approval for third-party SMTP server"],
        blockers: ["Waiting on security audit sign-off"],
        followUpTopics: ["Performance benchmarking"],
      };

      const result = validateAndSanitizeAnalysis(rawAnalysis);

      assert.equal(result.executiveSummary, "Team reviewed migration progress and agreed on timelines.");
      assert.equal(result.keyDiscussionPoints.length, 2);
      assert.equal(result.decisions.length, 1);
      assert.equal(result.decisions[0].decision, "Deploy production migration on Thursday at 5 PM");
      assert.equal(result.decisions[0].excerpt, "Maya will deploy production migration on Thursday");
      assert.equal(result.actionItems.length, 1);
      assert.equal(result.actionItems[0].owner, "David");
      assert.equal(result.actionItems[0].priority, "HIGH");
      assert.equal(result.actionItems[0].isExplicitCommitment, true);
      assert.equal(result.actionItems[0].dependencies[0], "Database adapter");
    });

    it("should strictly enforce Unknown when owner or deadline is not explicitly stated (No Hallucination)", () => {
      const rawWithMissingDetails = {
        executiveSummary: "Discussion about documentation updates.",
        decisions: ["Update team wiki"],
        actionItems: [
          {
            task: "Write developer setup guide",
            owner: "Unknown", // explicitly unknown
            dueDate: "", // missing
            priority: "INVALID_PRIORITY", // should default to MEDIUM
          },
          {
            task: "Review telemetry dashboards",
            owner: "Anyone", // generic -> should map to Unknown
            dueDate: "TBD", // tbd -> should map to Unknown
          },
          {
            task: "Audit dependency licenses",
            // missing owner and dueDate completely
          },
        ],
      };

      const result = validateAndSanitizeAnalysis(rawWithMissingDetails);

      assert.equal(result.actionItems[0].owner, "Unknown");
      assert.equal(result.actionItems[0].dueDate, "Unknown");
      assert.equal(result.actionItems[0].priority, "MEDIUM");

      assert.equal(result.actionItems[1].owner, "Unknown");
      assert.equal(result.actionItems[1].dueDate, "Unknown");

      assert.equal(result.actionItems[2].owner, "Unknown");
      assert.equal(result.actionItems[2].dueDate, "Unknown");
    });

    it("should accurately distinguish explicit commitments from AI-suggested tasks", () => {
      const mixedActionItems = {
        actionItems: [
          {
            task: "Deploy production build",
            owner: "Maya",
            isExplicitCommitment: true,
          },
          {
            task: "Consider adding dark mode in future sprint",
            owner: "Unknown",
            isExplicitCommitment: false,
          },
        ],
      };

      const result = validateAndSanitizeAnalysis(mixedActionItems);

      assert.equal(result.actionItems[0].isExplicitCommitment, true);
      assert.equal(result.actionItems[1].isExplicitCommitment, false);
    });
  });

  describe("2. Review & Approval State Logic", () => {
    it("should allow approving and rejecting individual decisions and action items", () => {
      const analysis: IMeetingAnalysis = {
        executiveSummary: "Sprint Planning",
        keyDiscussionPoints: [],
        topics: [],
        decisions: [
          { id: "dec_1", decision: "Migrate database", approved: true },
          { id: "dec_2", decision: "Delete legacy backups immediately", approved: false }, // Rejected
        ],
        actionItems: [
          {
            id: "act_1",
            task: "Configure connection pool",
            owner: "Maya",
            priority: "HIGH",
            dueDate: "2026-10-20",
            dependencies: [],
            isExplicitCommitment: true,
            approved: true,
            status: "APPROVED",
          },
          {
            id: "act_2",
            task: "Refactor unneeded microservice",
            owner: "Alex",
            priority: "LOW",
            dueDate: "Unknown",
            dependencies: [],
            isExplicitCommitment: false,
            approved: false, // Rejected
            status: "REJECTED",
          },
        ],
        unresolvedQuestions: [],
        blockers: [],
        followUpTopics: [],
        analyzedAt: new Date(),
      };

      const approvedDecisions = analysis.decisions.filter((d) => d.approved);
      const approvedActions = analysis.actionItems.filter((a) => a.approved);

      assert.equal(approvedDecisions.length, 1);
      assert.equal(approvedDecisions[0].id, "dec_1");

      assert.equal(approvedActions.length, 1);
      assert.equal(approvedActions[0].id, "act_1");
    });
  });

  describe("3. Duplicate Prevention on Task Conversion", () => {
    it("should detect existing tasks by meetingActionItemId and prevent duplicate creations", () => {
      // Simulating conversion deduplication logic
      const existingWorkspaceTasks = [
        {
          id: "task_01",
          workspaceId: "ws_123",
          meetingActionItemId: "act_101",
          title: "Setup CI runner",
          status: "TODO",
        },
      ];

      const newActionItems = [
        { id: "act_101", task: "Setup CI runner (updated instructions)", priority: "HIGH" },
        { id: "act_102", task: "Provision Redis cache", priority: "MEDIUM" },
      ];

      let createdCount = 0;
      let updatedCount = 0;

      for (const item of newActionItems) {
        const found = existingWorkspaceTasks.find(
          (t) => t.meetingActionItemId === item.id
        );
        if (found) {
          found.title = item.task;
          updatedCount++;
        } else {
          createdCount++;
        }
      }

      // 1 should update existing, 1 should be newly created
      assert.equal(updatedCount, 1);
      assert.equal(createdCount, 1);
      assert.equal(existingWorkspaceTasks[0].title, "Setup CI runner (updated instructions)");
    });
  });

  describe("4. Overdue Tasks & Unresolved Dependencies Checks", () => {
    it("should correctly identify overdue tasks and flag unresolved dependencies", () => {
      const now = new Date("2026-10-15T12:00:00Z");

      const taskMap = new Map([
        ["task_db", { id: "task_db", title: "DB Setup", status: "COMPLETED" }],
        ["task_auth", { id: "task_auth", title: "Auth Flow", status: "IN_PROGRESS" }], // Not completed
      ]);

      const testTask = {
        id: "task_api",
        title: "Build API Gateway",
        dueDate: new Date("2026-10-10T00:00:00Z"), // Passed date -> Overdue
        status: "TODO",
        dependencies: ["task_db", "task_auth"],
      };

      const isOverdue = testTask.status !== "COMPLETED" && testTask.dueDate < now;
      assert.equal(isOverdue, true, "Task with past due date should be overdue");

      // Check dependencies
      const unresolved = testTask.dependencies.filter((dep) => {
        const found = taskMap.get(dep);
        return !found || found.status !== "COMPLETED";
      });

      assert.deepEqual(unresolved, ["task_auth"]);
      assert.equal(unresolved.length > 0, true);
    });
  });

  describe("5. Executive Follow-Up Summary Generation", () => {
    it("should format clean markdown containing approved decisions and action items while omitting rejected ones", () => {
      const mockMeeting: any = {
        title: "Sprint 44 Engineering Review",
        meetingType: "Sprint Planning",
        meetingDate: new Date("2026-10-15T10:00:00Z"),
        participants: ["Alex", "Maya", "David"],
        analysis: {
          executiveSummary: "Team agreed to prioritize MongoDB Atlas migration and security rate limiting.",
          keyDiscussionPoints: ["Database performance", "Spam protection"],
          decisions: [
            {
              id: "d1",
              decision: "Finalize MongoDB deployment on Thursday",
              excerpt: "Maya: I will deploy on Thursday",
              approved: true,
            },
            {
              id: "d2",
              decision: "Deprecate Redis",
              approved: false, // Rejected -> Must NOT appear in follow-up
            },
          ],
          actionItems: [
            {
              id: "a1",
              task: "Implement token bucket rate limiter",
              owner: "David",
              priority: "HIGH",
              dueDate: "2026-10-16",
              dependencies: ["DB Adapter"],
              excerpt: "David explicitly committed to finishing by tomorrow",
              isExplicitCommitment: true,
              approved: true,
            },
            {
              id: "a2",
              task: "Refactor legacy microservice",
              owner: "Unknown",
              priority: "LOW",
              approved: false, // Rejected -> Must NOT appear in follow-up
            },
          ],
          unresolvedQuestions: ["SMTP email budget approval"],
          blockers: ["Pending third-party compliance audit"],
        },
      };

      const markdown = formatFollowUpSummary(mockMeeting);

      // Verify title & meta
      assert.ok(markdown.includes("# Meeting Executive Follow-Up: Sprint 44 Engineering Review"));
      assert.ok(markdown.includes("Alex, Maya, David"));

      // Verify approved decision is present
      assert.ok(markdown.includes("Finalize MongoDB deployment on Thursday"));
      assert.ok(markdown.includes('Excerpt: "Maya: I will deploy on Thursday"'));

      // Verify rejected decision is excluded
      assert.ok(!markdown.includes("Deprecate Redis"));

      // Verify approved action item is present
      assert.ok(markdown.includes("Implement token bucket rate limiter"));
      assert.ok(markdown.includes("[Explicit Commitment]"));
      assert.ok(markdown.includes("Owner:** David"));
      assert.ok(markdown.includes("Due Date:** 2026-10-16"));
      assert.ok(markdown.includes("Dependencies:** DB Adapter"));

      // Verify rejected action item is excluded
      assert.ok(!markdown.includes("Refactor legacy microservice"));

      // Verify unresolved questions and blockers
      assert.ok(markdown.includes("SMTP email budget approval"));
      assert.ok(markdown.includes("Pending third-party compliance audit"));
    });
  });

  describe("4. Task Owner Assignment & Action Item Export", () => {
    it("should preserve valid owner names and clean placeholder strings", () => {
      const sanitizeOwner = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const trimmed = String(raw).trim();
        if (!trimmed || /^(unknown|unassigned|none|team|tbd)$/i.test(trimmed)) {
          return null;
        }
        return trimmed;
      };

      assert.equal(sanitizeOwner("Alex Chen"), "Alex Chen");
      assert.equal(sanitizeOwner("Maya"), "Maya");
      assert.equal(sanitizeOwner("  David Miller  "), "David Miller");
      assert.equal(sanitizeOwner("Unassigned"), null);
      assert.equal(sanitizeOwner("unknown"), null);
      assert.equal(sanitizeOwner("None"), null);
      assert.equal(sanitizeOwner(""), null);
      assert.equal(sanitizeOwner(undefined), null);
    });

    it("should correctly format task docs with assigned owner for action items export", () => {
      const mockActionItems = [
        {
          task: "Configure Prometheus metrics scraper",
          owner: "Alex Chen",
          priority: "HIGH",
          dueDate: "2026-10-20",
          timestamp: "03:45",
        },
        {
          task: "Review documentation pull request",
          owner: "Unassigned",
          priority: "LOW",
        },
      ];

      const sanitizeOwner = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const trimmed = String(raw).trim();
        return !trimmed || /^(unknown|unassigned|none|team|tbd)$/i.test(trimmed) ? null : trimmed;
      };

      const taskDocs = mockActionItems.map((item) => {
        const cleanOwner = sanitizeOwner(item.owner);
        return {
          title: item.task,
          priority: item.priority,
          owner: cleanOwner,
          status: "TODO",
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
        };
      });

      assert.equal(taskDocs[0].owner, "Alex Chen");
      assert.equal(taskDocs[0].title, "Configure Prometheus metrics scraper");
      assert.equal(taskDocs[1].owner, null);
    });
  });
});

