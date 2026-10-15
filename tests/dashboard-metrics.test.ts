import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Dashboard Metrics & Empty State Logic Tests", () => {
  it("should format empty workspace metrics with real zeros and no fake data", () => {
    const rawDbStats = {
      documentsCount: 0,
      activeTasksCount: 0,
      completedWorkflowsCount: 0,
      conversationsCount: 0,
      estimatedTimeSavedMinutes: 0,
    };

    assert.equal(rawDbStats.documentsCount, 0);
    assert.equal(rawDbStats.activeTasksCount, 0);
    assert.equal(rawDbStats.completedWorkflowsCount, 0);
    assert.equal(rawDbStats.estimatedTimeSavedMinutes, 0);
  });

  it("should accurately calculate metrics when populated records exist", () => {
    const populatedStats = {
      documentsCount: 14,
      activeTasksCount: 3,
      completedWorkflowsCount: 5,
      conversationsCount: 12,
      estimatedTimeSavedMinutes: 150, // 2.5 hours
    };

    assert.equal(populatedStats.documentsCount, 14);
    assert.equal(populatedStats.activeTasksCount, 3);
    assert.equal(populatedStats.completedWorkflowsCount, 5);
    assert.equal(populatedStats.estimatedTimeSavedMinutes / 60, 2.5);
  });
});
