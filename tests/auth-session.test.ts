import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { createSessionToken, verifySessionToken } from "../src/lib/auth/session";

describe("Authentication & Session Security Tests", () => {
  describe("Password Hashing & Verification", () => {
    it("should correctly hash a password and verify matching plain text", async () => {
      const plainPassword = "SuperSecretPassword2026!";
      const hash = await hashPassword(plainPassword);

      assert.notEqual(hash, plainPassword);
      assert.ok(hash.startsWith("$2")); // standard bcrypt hash format

      const isMatch = await verifyPassword(plainPassword, hash);
      assert.equal(isMatch, true);
    });

    it("should reject an incorrect password against a valid hash", async () => {
      const plainPassword = "CorrectPassword123";
      const wrongPassword = "WrongPassword456";
      const hash = await hashPassword(plainPassword);

      const isMatch = await verifyPassword(wrongPassword, hash);
      assert.equal(isMatch, false);
    });
  });

  describe("Session JWT Tokens", () => {
    it("should issue and successfully verify a signed session token", async () => {
      const mockSession = {
        userId: "user_clz12345",
        email: "alex@enterprise.corp",
        name: "Alex Vance",
        workspaceId: "ws_clz98765",
        workspaceName: "Vance Enterprises",
        role: "OWNER",
      };

      const token = await createSessionToken(mockSession);
      assert.ok(token);
      assert.equal(typeof token, "string");

      const decoded = await verifySessionToken(token);
      assert.ok(decoded);
      assert.equal(decoded.userId, mockSession.userId);
      assert.equal(decoded.email, mockSession.email);
      assert.equal(decoded.name, mockSession.name);
      assert.equal(decoded.workspaceId, mockSession.workspaceId);
      assert.equal(decoded.workspaceName, mockSession.workspaceName);
      assert.equal(decoded.role, mockSession.role);
    });

    it("should return null when verifying a malformed or invalid token", async () => {
      const malformedToken = "invalid.token.structure";
      const result = await verifySessionToken(malformedToken);
      assert.equal(result, null);
    });
  });
});
