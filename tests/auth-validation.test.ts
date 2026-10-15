import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { registerSchema, loginSchema, chatMessageSchema } from "../src/lib/validation/schemas";

describe("Input Validation Tests", () => {
  describe("User Registration Validation", () => {
    it("should succeed with valid registration parameters", () => {
      const validData = {
        name: "Jane Doe",
        email: "jane@company.com",
        password: "securePassword123!",
        workspaceName: "Acme Corp",
      };
      const result = registerSchema.safeParse(validData);
      assert.equal(result.success, true);
    });

    it("should fail when name is shorter than 2 characters", () => {
      const invalidData = {
        name: "A",
        email: "jane@company.com",
        password: "securePassword123!",
        workspaceName: "Acme Corp",
      };
      const result = registerSchema.safeParse(invalidData);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.name);
      }
    });

    it("should fail when email address is invalid", () => {
      const invalidData = {
        name: "Jane Doe",
        email: "not-an-email",
        password: "securePassword123!",
        workspaceName: "Acme Corp",
      };
      const result = registerSchema.safeParse(invalidData);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.email);
      }
    });

    it("should fail when password is less than 8 characters", () => {
      const invalidData = {
        name: "Jane Doe",
        email: "jane@company.com",
        password: "short",
        workspaceName: "Acme Corp",
      };
      const result = registerSchema.safeParse(invalidData);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.password);
      }
    });

    it("should fail when workspace name is missing", () => {
      const invalidData = {
        name: "Jane Doe",
        email: "jane@company.com",
        password: "securePassword123!",
        workspaceName: "",
      };
      const result = registerSchema.safeParse(invalidData);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error.flatten().fieldErrors.workspaceName);
      }
    });
  });

  describe("Login Validation", () => {
    it("should succeed with valid login parameters", () => {
      const validData = {
        email: "member@company.com",
        password: "anyPassword",
      };
      const result = loginSchema.safeParse(validData);
      assert.equal(result.success, true);
    });

    it("should reject invalid login email format", () => {
      const invalidData = {
        email: "bad_email",
        password: "anyPassword",
      };
      const result = loginSchema.safeParse(invalidData);
      assert.equal(result.success, false);
    });

    it("should reject empty password", () => {
      const invalidData = {
        email: "member@company.com",
        password: "",
      };
      const result = loginSchema.safeParse(invalidData);
      assert.equal(result.success, false);
    });
  });

  describe("Chat Message Validation", () => {
    it("should succeed with valid message text", () => {
      const validData = {
        message: "Hello WorkMate AI, how are you today?",
        conversationId: "conv-123",
      };
      const result = chatMessageSchema.safeParse(validData);
      assert.equal(result.success, true);
    });

    it("should reject empty message", () => {
      const invalidData = {
        message: "   ",
      };
      const result = chatMessageSchema.safeParse(invalidData);
      assert.equal(result.success, false);
    });

    it("should reject overly long message exceeding 8000 characters", () => {
      const invalidData = {
        message: "a".repeat(8001),
      };
      const result = chatMessageSchema.safeParse(invalidData);
      assert.equal(result.success, false);
    });
  });
});
