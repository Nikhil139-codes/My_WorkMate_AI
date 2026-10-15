import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  isGroqConfigured,
  getGroqClient,
  GroqServiceError,
  DEFAULT_GROQ_MODEL,
} from "../src/lib/ai/groq";

describe("Groq AI Provider & Service Layer Tests", () => {
  const originalKey = process.env.GROQ_API_KEY;

  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey;
  });

  describe("API Key Detection", () => {
    it("should report not configured when GROQ_API_KEY is empty", () => {
      process.env.GROQ_API_KEY = "";
      assert.equal(isGroqConfigured(), false);
    });

    it("should report not configured when GROQ_API_KEY is undefined", () => {
      delete process.env.GROQ_API_KEY;
      assert.equal(isGroqConfigured(), false);
    });

    it("should report configured when valid non-empty key is provided", () => {
      process.env.GROQ_API_KEY = "gsk_live_validkey123456789";
      assert.equal(isGroqConfigured(), true);
    });
  });

  describe("Missing Key Exception Handling", () => {
    it("should throw a structured GroqServiceError with 503 status code when key is missing", () => {
      process.env.GROQ_API_KEY = "";
      assert.throws(
        () => {
          getGroqClient();
        },
        (err: any) => {
          assert.ok(err instanceof GroqServiceError);
          assert.equal(err.statusCode, 503);
          assert.equal(err.code, "GROQ_KEY_MISSING");
          assert.ok(err.message.includes("Gemini API key is not configured"));
          return true;
        }
      );
    });
  });

  describe("Model Configuration", () => {
    it("should default to a modern production Groq model identifier", () => {
      assert.ok(
        DEFAULT_GROQ_MODEL === "openai/gpt-oss-120b" ||
        DEFAULT_GROQ_MODEL === "llama-3.1-8b-instant" ||
        DEFAULT_GROQ_MODEL.startsWith("llama")
      );
    });
  });

  describe("Groq Service Error Representation", () => {
    it("should create standard error instances with status codes and codes", () => {
      const rateLimitError = new GroqServiceError(
        "Rate limit exceeded",
        429,
        "GROQ_RATE_LIMITED"
      );
      assert.equal(rateLimitError.statusCode, 429);
      assert.equal(rateLimitError.code, "GROQ_RATE_LIMITED");
      assert.equal(rateLimitError.name, "GroqServiceError");
    });
  });
});
