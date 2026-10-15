import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateOnboardingSuggestion,
  onboardingApprovalSchema,
} from "../src/lib/documents/onboarding";

describe("AI Document Onboarding Agent & Security Tests", () => {
  it("should generate structured onboarding suggestions with fallback heuristics", async () => {
    // With no Groq key configured in test, verify graceful fallback
    const suggestion = await generateOnboardingSuggestion(
      "annual_financial_audit.csv",
      "Revenue,Expenses,NetProfit\n$10M,$6M,$4M",
      "Auditing corporate fiscal performance"
    );

    assert.ok(suggestion.documentType);
    assert.ok(suggestion.department);
    assert.ok(
      ["paragraph-semantic", "page-level", "tabular-fixed"].includes(
        suggestion.chunkingStrategy
      )
    );
    assert.ok(suggestion.chunkSize > 0);
    assert.ok(suggestion.chunkOverlap >= 0);
    assert.ok(
      ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].includes(
        suggestion.sensitivityLabel
      )
    );
    assert.ok(Array.isArray(suggestion.validationRules));
    assert.ok(Array.isArray(suggestion.suggestedTags));
  });

  it("should validate and sanitize approved onboarding parameters on the server", () => {
    const validConfig = {
      documentType: "Master Services Agreement",
      department: "Legal",
      chunkingStrategy: "paragraph-semantic",
      chunkSize: 700,
      chunkOverlap: 120,
      sensitivityLabel: "CONFIDENTIAL",
      validationRules: ["Mask PII before exporting", "Require legal review"],
      tags: ["Contract", "Vendor"],
      summary: "Standard MSA terms and conditions.",
    };

    const result = onboardingApprovalSchema.safeParse(validConfig);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.documentType, "Master Services Agreement");
      assert.equal(result.data.sensitivityLabel, "CONFIDENTIAL");
      assert.equal(result.data.chunkSize, 700);
    }
  });

  it("should reject invalid chunk sizes and illegal sensitivity labels", () => {
    const invalidConfig = {
      documentType: "Test",
      department: "Ops",
      chunkingStrategy: "invalid-strategy",
      chunkSize: -50, // Invalid negative chunk size
      chunkOverlap: 9999,
      sensitivityLabel: "TOP_SECRET_UNKNOWN", // Invalid label
    };

    const result = onboardingApprovalSchema.safeParse(invalidConfig);
    assert.equal(result.success, false);
  });

  it("should strip out unauthorized permission escalation fields from AI input", () => {
    // If an attacker attempts to inject permissions or roles via onboarding proposal
    const maliciousConfig = {
      documentType: "Contract",
      department: "Legal",
      chunkingStrategy: "paragraph-semantic",
      chunkSize: 500,
      chunkOverlap: 50,
      sensitivityLabel: "INTERNAL",
      validationRules: [],
      tags: [],
      // Injected keys that must NOT exist in schema
      userRole: "ADMIN",
      grantAccessToUsers: ["all"],
      makePublicToInternet: true,
    };

    const result = onboardingApprovalSchema.safeParse(maliciousConfig);
    assert.equal(result.success, true);
    if (result.success) {
      const data = result.data as any;
      assert.equal(data.userRole, undefined);
      assert.equal(data.grantAccessToUsers, undefined);
      assert.equal(data.makePublicToInternet, undefined);
    }
  });
});
