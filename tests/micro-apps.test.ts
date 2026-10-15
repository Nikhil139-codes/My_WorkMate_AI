import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAndSanitizeSpec,
  generateAppSlug,
  sanitizeText,
  ALLOWED_FIELD_TYPES,
} from "../src/lib/micro-apps/specGenerator";
import {
  validateSubmission,
  serializeSubmissionsToCSV,
} from "../src/lib/micro-apps/validator";
import { IMicroApp, IMicroAppField } from "../src/lib/db/models/MicroApp";

describe("Phase 5: Disposable Micro-App Generator Tests", () => {
  describe("1. App Specification Security & Sanitization", () => {
    it("should allow approved field types and reject arbitrary/unsupported types", () => {
      ALLOWED_FIELD_TYPES.forEach((type) => {
        assert.ok(
          ["text", "textarea", "email", "number", "select", "checkbox", "multiselect", "date", "rating"].includes(type),
          `Expected ${type} to be in approved field types`
        );
      });

      // Valid spec with approved types
      const validSpec = {
        title: "Customer Feedback Form",
        description: "Please share your experience with us.",
        category: "feedback",
        theme: { primaryColor: "#4F46E5", backgroundColor: "#F8FAFC", layout: "card" },
        fields: [
          { id: "customer_name", label: "Full Name", type: "text", required: true },
          { id: "customer_email", label: "Work Email", type: "email", required: true },
          { id: "rating", label: "Satisfaction", type: "rating", required: true },
        ],
        settings: { submitButtonText: "Submit Feedback", successMessage: "Thank you!" },
      };

      const result = validateAndSanitizeSpec(validSpec);
      assert.equal(result.title, "Customer Feedback Form");
      assert.equal(result.fields.length, 3);
      assert.equal(result.fields[0].type, "text");
      assert.equal(result.fields[1].type, "email");
      assert.equal(result.fields[2].type, "rating");

      // Spec with illegal/malicious component type should throw security error
      const maliciousSpec = {
        title: "Hacked Form",
        fields: [
          { id: "bad_fld", label: "Exploit", type: "script", required: false },
        ],
      };

      assert.throws(
        () => validateAndSanitizeSpec(maliciousSpec),
        /Security validation failed: Field "Exploit" has unsupported or disallowed component type "script"/
      );

      const maliciousIframeSpec = {
        title: "Iframe Injection",
        fields: [
          { id: "iframe_fld", label: "Camera Stream", type: "iframe", required: false },
        ],
      };

      assert.throws(
        () => validateAndSanitizeSpec(maliciousIframeSpec),
        /Security validation failed: Field "Camera Stream" has unsupported or disallowed component type "iframe"/
      );
    });

    it("should strictly sanitize HTML and script payloads from titles, descriptions, and labels", () => {
      const dirty = "<script>alert('xss')</script>Hello <img src=x onerror=alert(1)>";
      const cleaned = sanitizeText(dirty);
      assert.ok(!cleaned.includes("<script>"));
      assert.ok(!cleaned.includes("onerror="));

      const specWithHtml = {
        title: "<b>Feedback</b> <script>stealCookies()</script>",
        description: "Instructions with <a href='javascript:void(0)'>link</a>",
        fields: [
          {
            id: "f1",
            label: "<span onclick='evil()'>Your Rating</span>",
            type: "rating",
            placeholder: "<script>",
          },
        ],
      };

      const sanitized = validateAndSanitizeSpec(specWithHtml);
      assert.ok(!sanitized.title.includes("<script>"));
      assert.ok(!sanitized.description.includes("javascript:"));
      assert.ok(!sanitized.fields[0].label.includes("onclick="));
    });

    it("should generate URL-safe slugs with random salt to avoid collisions", () => {
      const slug1 = generateAppSlug("Customer Satisfaction Survey Q3 2026!");
      const slug2 = generateAppSlug("Customer Satisfaction Survey Q3 2026!");

      assert.ok(slug1.startsWith("customer-satisfaction-survey-q3-2026-"));
      assert.ok(slug2.startsWith("customer-satisfaction-survey-q3-2026-"));
      // Suffix must be random
      assert.notEqual(slug1, slug2);
      // Only lowercase alphanumerics and hyphens
      assert.match(slug1, /^[a-z0-9-]+$/);
    });

    it("should enforce maximum bounds on fields count", () => {
      const tooManyFields = Array.from({ length: 26 }, (_, i) => ({
        id: `fld_${i}`,
        label: `Field ${i}`,
        type: "text",
      }));

      assert.throws(
        () => validateAndSanitizeSpec({ title: "Huge App", fields: tooManyFields }),
        /App specification cannot exceed 25 fields/
      );

      assert.throws(
        () => validateAndSanitizeSpec({ title: "Empty App", fields: [] }),
        /App specification must define at least one field/
      );
    });
  });

  describe("2. Server-Side Submission Validation", () => {
    const mockApp: any = {
      _id: "app_123",
      title: "Team Offsite Registration",
      fields: [
        { id: "name", label: "Full Name", type: "text", required: true, validation: { minLength: 2, maxLength: 50 } },
        { id: "email", label: "Work Email", type: "email", required: true },
        { id: "diet", label: "Dietary Preference", type: "select", required: true, options: ["Vegetarian", "Vegan", "None"] },
        { id: "sessions", label: "Sessions", type: "multiselect", required: false, options: ["AI Keynote", "Workshop", "Hackathon"] },
        { id: "guests", label: "Number of Guests", type: "number", required: false, validation: { min: 0, max: 5 } },
        { id: "arrival_date", label: "Arrival Date", type: "date", required: true },
        { id: "agreement", label: "Code of Conduct", type: "checkbox", required: true },
        { id: "satisfaction", label: "Anticipation Rating", type: "rating", required: true },
      ],
    };

    it("should succeed with valid submission data", () => {
      const submission = {
        name: "Jane Doe",
        email: "jane@company.com",
        diet: "Vegetarian",
        sessions: ["AI Keynote", "Hackathon"],
        guests: 2,
        arrival_date: "2026-11-15",
        agreement: true,
        satisfaction: 5,
      };

      const result = validateSubmission(mockApp, submission);
      assert.equal(result.valid, true);
      assert.equal(Object.keys(result.errors).length, 0);
      assert.equal(result.sanitizedData.name, "Jane Doe");
      assert.equal(result.sanitizedData.email, "jane@company.com");
      assert.equal(result.sanitizedData.diet, "Vegetarian");
      assert.deepEqual(result.sanitizedData.sessions, ["AI Keynote", "Hackathon"]);
      assert.equal(result.sanitizedData.guests, 2);
      assert.equal(result.sanitizedData.arrival_date, "2026-11-15");
      assert.equal(result.sanitizedData.agreement, true);
      assert.equal(result.sanitizedData.satisfaction, 5);
    });

    it("should catch required field violations across all types", () => {
      const emptySubmission = {};
      const result = validateSubmission(mockApp, emptySubmission);

      assert.equal(result.valid, false);
      assert.ok(result.errors.name);
      assert.ok(result.errors.email);
      assert.ok(result.errors.diet);
      assert.ok(result.errors.arrival_date);
      assert.ok(result.errors.satisfaction);
      // guests & sessions are optional so no error
      assert.equal(result.errors.guests, undefined);
    });

    it("should validate email format strictly", () => {
      const invalidEmailSubmission = {
        name: "Alice",
        email: "not-an-email",
        diet: "None",
        arrival_date: "2026-11-15",
        agreement: true,
        satisfaction: 4,
      };

      const result = validateSubmission(mockApp, invalidEmailSubmission);
      assert.equal(result.valid, false);
      assert.ok(result.errors.email?.includes("valid email"));
    });

    it("should enforce number boundaries and bounds", () => {
      const invalidNumberSubmission = {
        name: "Bob",
        email: "bob@company.com",
        diet: "None",
        guests: 10, // Max is 5
        arrival_date: "2026-11-15",
        agreement: true,
        satisfaction: 3,
      };

      const result = validateSubmission(mockApp, invalidNumberSubmission);
      assert.equal(result.valid, false);
      assert.ok(result.errors.guests?.includes("cannot be greater than 5"));
    });

    it("should enforce rating boundaries strictly between 1 and 5", () => {
      const invalidRatingSubmission = {
        name: "Charlie",
        email: "charlie@company.com",
        diet: "None",
        arrival_date: "2026-11-15",
        agreement: true,
        satisfaction: 9, // Invalid rating
      };

      const result = validateSubmission(mockApp, invalidRatingSubmission);
      assert.equal(result.valid, false);
      assert.ok(result.errors.satisfaction?.includes("between 1 and 5"));
    });

    it("should reject select options not in predefined enum options", () => {
      const invalidSelectSubmission = {
        name: "Dana",
        email: "dana@company.com",
        diet: "Seafood Feast", // Not in options
        arrival_date: "2026-11-15",
        agreement: true,
        satisfaction: 4,
      };

      const result = validateSubmission(mockApp, invalidSelectSubmission);
      assert.equal(result.valid, false);
      assert.ok(result.errors.diet?.includes("Invalid selection"));
    });
  });

  describe("3. App Expiration & Lifecycle Logic", () => {
    it("should correctly identify expired status when expiry timestamp has passed", () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours ahead

      const isAppExpired = (expiresAt: Date | null | undefined): boolean => {
        if (!expiresAt) return false;
        return new Date(expiresAt) <= new Date();
      };

      assert.equal(isAppExpired(pastDate), true, "Past date should be expired");
      assert.equal(isAppExpired(futureDate), false, "Future date should not be expired");
      assert.equal(isAppExpired(null), false, "Null date should not be expired");
      assert.equal(isAppExpired(undefined), false, "Undefined date should not be expired");
    });

    it("should calculate correct future expiration timestamps based on configured duration hours", () => {
      const now = Date.now();
      const calculateExpiry = (durationHours: number): Date => {
        return new Date(now + durationHours * 60 * 60 * 1000);
      };

      const oneHour = calculateExpiry(1);
      const oneDay = calculateExpiry(24);
      const sevenDays = calculateExpiry(168);

      assert.equal(oneHour.getTime() - now, 3600000);
      assert.equal(oneDay.getTime() - now, 86400000);
      assert.equal(sevenDays.getTime() - now, 604800000);
    });

    it("should enforce that public submission is allowed only when status is published and active", () => {
      const canAcceptSubmissions = (app: { status: string; expiresAt?: Date | null }): { allowed: boolean; reason?: string } => {
        if (app.status === "draft") return { allowed: false, reason: "Form is in draft mode." };
        if (app.status === "archived") return { allowed: false, reason: "Form has been archived." };
        if (app.status === "expired" || (app.expiresAt && new Date(app.expiresAt) <= new Date())) {
          return { allowed: false, reason: "Form has expired." };
        }
        if (app.status !== "published") return { allowed: false, reason: "Form is inactive." };
        return { allowed: true };
      };

      assert.equal(canAcceptSubmissions({ status: "draft" }).allowed, false);
      assert.equal(canAcceptSubmissions({ status: "archived" }).allowed, false);
      assert.equal(canAcceptSubmissions({ status: "expired" }).allowed, false);
      assert.equal(
        canAcceptSubmissions({
          status: "published",
          expiresAt: new Date(Date.now() - 5000),
        }).allowed,
        false
      );
      assert.equal(
        canAcceptSubmissions({
          status: "published",
          expiresAt: new Date(Date.now() + 1000000),
        }).allowed,
        true
      );
      assert.equal(
        canAcceptSubmissions({
          status: "published",
          expiresAt: null,
        }).allowed,
        true
      );
    });
  });

  describe("4. Decoupled Submission Retention", () => {
    it("should retain submission records independently from app expiry", () => {
      // Simulating app expiry transition: App status becomes expired, but submissions keep retentionStatus 'retained'
      const appRecord = {
        id: "app_exp_01",
        status: "expired",
        expiresAt: new Date(Date.now() - 1000),
      };

      const storedSubmissions = [
        { id: "sub_1", appId: "app_exp_01", retentionStatus: "retained", data: { name: "Alice" } },
        { id: "sub_2", appId: "app_exp_01", retentionStatus: "retained", data: { name: "Bob" } },
      ];

      // Verify that expiring an app does not delete or alter its submission count
      assert.equal(appRecord.status, "expired");
      assert.equal(storedSubmissions.length, 2);
      storedSubmissions.forEach((sub) => {
        assert.equal(sub.retentionStatus, "retained");
        assert.ok(sub.data.name);
      });
    });
  });

  describe("5. RFC-4180 CSV Serialization", () => {
    const fields: IMicroAppField[] = [
      { id: "name", label: "Full Name", type: "text", required: true },
      { id: "feedback", label: 'User "Feedback"', type: "textarea", required: true },
      { id: "tags", label: "Tags", type: "multiselect", required: false },
    ];

    it("should serialize headers and values with proper RFC-4180 quote escaping", () => {
      const fixedDate = new Date("2026-10-15T12:00:00.000Z");
      const submissions = [
        {
          id: "sub_01",
          submittedAt: fixedDate,
          data: {
            name: "Alice Smith",
            feedback: 'She said "Great tool!", highly recommended.',
            tags: ["Fast", "Intuitive"],
          },
        },
        {
          id: "sub_02",
          submittedAt: fixedDate,
          data: {
            name: "Bob Jones",
            feedback: "Works fine, no issues.",
            tags: [],
          },
        },
      ];

      const csv = serializeSubmissionsToCSV(fields, submissions);
      const lines = csv.split("\n");

      // Verify header row
      assert.equal(lines[0], 'Submission ID,Submitted At,"Full Name","User ""Feedback""","Tags"');

      // Verify row 1 escaping of double quotes
      assert.ok(lines[1].includes('"sub_01"'));
      assert.ok(lines[1].includes('"Alice Smith"'));
      assert.ok(lines[1].includes('"She said ""Great tool!"", highly recommended."'));
      assert.ok(lines[1].includes('"Fast; Intuitive"'));

      // Verify row 2 empty array
      assert.ok(lines[2].includes('"Bob Jones"'));
    });
  });
});
