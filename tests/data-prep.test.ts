import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseXlsx, serializeToCsv, serializeToXlsx } from "../src/lib/data-prep/parser";
import { profileDataset } from "../src/lib/data-prep/profiler";
import { validateCleaningPlanStep } from "../src/lib/data-prep/aiAgent";
import { applyDataTransformations } from "../src/lib/data-prep/transformer";

describe("Phase 3: Data Quality & Preparation Agent Tests", () => {
  describe("Dataset Parsing & Serialization", () => {
    it("should parse CSV into structured rows and column headers", () => {
      const csv = `id,name,department,salary\n1,Alice,Engineering,100000\n2,Bob,Finance,95000\n3,Charlie,Engineering,105000`;
      const buffer = Buffer.from(csv, "utf-8");
      const parsed = parseCsv(buffer);

      assert.equal(parsed.totalRows, 3);
      assert.deepEqual(parsed.columns, ["id", "name", "department", "salary"]);
      assert.equal(parsed.rows[0].name, "Alice");
      assert.equal(parsed.rows[0].salary, 100000);
    });

    it("should roundtrip serialize rows to CSV buffer", () => {
      const rows = [
        { id: 101, product: "Widget A", price: 29.99 },
        { id: 102, product: "Widget B", price: 49.99 },
      ];
      const buffer = serializeToCsv(rows, ["id", "product", "price"]);
      assert.ok(buffer.length > 0);
      const parsedAgain = parseCsv(buffer);
      assert.equal(parsedAgain.totalRows, 2);
      assert.equal(parsedAgain.rows[0].product, "Widget A");
    });

    it("should serialize and parse XLSX binary workbooks", () => {
      const rows = [
        { region: "North", sales: 12000, active: true },
        { region: "South", sales: 15400, active: false },
      ];
      const xlsxBuffer = serializeToXlsx(rows);
      assert.ok(xlsxBuffer.length > 0);
      const parsedXlsx = parseXlsx(xlsxBuffer);
      assert.equal(parsedXlsx.totalRows, 2);
      assert.ok(parsedXlsx.columns.includes("region"));
      assert.ok(parsedXlsx.columns.includes("sales"));
      assert.equal(parsedXlsx.rows[0].region, "North");
    });
  });

  describe("Deterministic Data Profiler", () => {
    it("should detect duplicate rows and missing values", () => {
      const rows = [
        { id: 1, email: "alice@test.com", date: "2024-01-01", department: "HR" },
        { id: 2, email: null, date: "2024-01-02", department: "Engineering" },
        { id: 1, email: "alice@test.com", date: "2024-01-01", department: "HR" }, // Duplicate
        { id: 3, email: "", date: "2024-01-03", department: null },
      ];
      const columns = ["id", "email", "date", "department"];
      const { columns: profiledCols, profilingReport } = profileDataset(rows, columns);

      assert.equal(profilingReport.totalRows, 4);
      assert.equal(profilingReport.duplicateRowsCount, 1);
      assert.equal(profilingReport.missingCellsCount, 3); // 2 in email, 1 in department
      assert.ok(profilingReport.qualityScore < 100);

      const dupIssue = profilingReport.issues.find((i) => i.type === "duplicates");
      assert.ok(dupIssue, "Should report duplicate rows issue");
      assert.equal(dupIssue?.affectedCount, 1);
    });

    it("should infer types accurately (number, date, category)", () => {
      const rows = [
        { age: 25, joined: "2023-05-12", tier: "Gold" },
        { age: 30, joined: "2023-06-15", tier: "Silver" },
        { age: 45, joined: "2023-07-20", tier: "Gold" },
        { age: 28, joined: "2023-08-01", tier: "Bronze" },
      ];
      const columns = ["age", "joined", "tier"];
      const { columns: profiledCols } = profileDataset(rows, columns);

      const ageCol = profiledCols.find((c) => c.name === "age");
      const dateCol = profiledCols.find((c) => c.name === "joined");
      const tierCol = profiledCols.find((c) => c.name === "tier");

      assert.equal(ageCol?.inferredType, "number");
      assert.equal(dateCol?.inferredType, "date");
      assert.equal(tierCol?.inferredType, "category");
    });

    it("should detect inconsistent date formats and inconsistent categories", () => {
      const rows = [
        { date: "2024-01-15", state: "NY" },
        { date: "02/18/2024", state: "ny" },
        { date: "2024-03-20", state: "New York" },
        { date: "15-04-2024", state: "NY" },
      ];
      const columns = ["date", "state"];
      const { profilingReport } = profileDataset(rows, columns);

      const dateIssue = profilingReport.issues.find((i) => i.type === "inconsistent_date");
      assert.ok(dateIssue, "Should detect mixed date formats");

      const catIssue = profilingReport.issues.find((i) => i.type === "inconsistent_category");
      assert.ok(catIssue, "Should detect inconsistent category casing/values (NY vs ny vs New York)");
    });
  });

  describe("Safe Allowlist Validation", () => {
    it("should accept valid allowlisted operations", () => {
      const validStep = validateCleaningPlanStep(
        {
          operation: "remove_duplicates",
          description: "Deduplicate all records",
          impact: "Eliminates identical entries",
        },
        ["id", "name"]
      );
      assert.ok(validStep);
      assert.equal(validStep?.operation, "remove_duplicates");
    });

    it("should reject malicious or disallowed operations", () => {
      const invalidStep = validateCleaningPlanStep(
        {
          operation: "execute_eval_script",
          params: { code: "process.exit(1)" },
          description: "Dangerous code injection",
        },
        ["id", "name"]
      );
      assert.equal(invalidStep, null, "Must reject non-allowlisted operations");
    });
  });

  describe("Deterministic Transformation Engine", () => {
    it("should remove confirmed duplicate rows while preserving unique records", () => {
      const rows = [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
        { id: 1, name: "Alice" }, // Duplicate
      ];
      const result = applyDataTransformations(rows, ["id", "name"], [
        {
          id: "step-1",
          operation: "remove_duplicates",
          description: "Remove duplicate rows",
          impact: "Removes duplicates",
          approved: true,
          status: "PENDING",
        },
      ]);

      assert.equal(result.cleanedRows.length, 2);
      assert.equal(result.metrics.rowsRemovedCount, 1);
      assert.equal(rows.length, 3, "Original row array must remain unchanged (immutable)");
    });

    it("should trim whitespace and standardize text casing", () => {
      const rows = [
        { code: "  alpha  ", title: "software engineer" },
        { code: "beta", title: "SENIOR DEVELOPER" },
      ];
      const result = applyDataTransformations(rows, ["code", "title"], [
        {
          id: "step-1",
          operation: "trim_whitespace",
          description: "Trim whitespace",
          impact: "Trims spaces",
          approved: true,
          status: "PENDING",
        },
        {
          id: "step-2",
          operation: "standardize_text",
          column: "title",
          params: { casing: "titlecase" },
          description: "Convert title to Title Case",
          impact: "Standardizes title",
          approved: true,
          status: "PENDING",
        },
      ]);

      assert.equal(result.cleanedRows[0].code, "alpha");
      assert.equal(result.cleanedRows[0].title, "Software Engineer");
      assert.equal(result.cleanedRows[1].title, "Senior Developer");
    });

    it("should standardize mixed date formats into ISO YYYY-MM-DD", () => {
      const rows = [
        { tx_date: "05/22/2023" },
        { tx_date: "2023-11-04T00:00:00.000Z" },
      ];
      const result = applyDataTransformations(rows, ["tx_date"], [
        {
          id: "step-1",
          operation: "standardize_dates",
          column: "tx_date",
          params: { targetFormat: "YYYY-MM-DD" },
          description: "Normalize dates",
          impact: "Converts to YYYY-MM-DD",
          approved: true,
          status: "PENDING",
        },
      ]);

      assert.equal(result.cleanedRows[0].tx_date, "2023-05-22");
      assert.equal(result.cleanedRows[1].tx_date, "2023-11-04");
    });

    it("should fill missing values according to user-approved strategy", () => {
      const rows = [
        { item: "Laptop", score: 80 },
        { item: null, score: null },
        { item: "Phone", score: 90 },
      ];
      const result = applyDataTransformations(rows, ["item", "score"], [
        {
          id: "step-1",
          operation: "fill_missing",
          column: "item",
          params: { strategy: "constant", value: "Unknown Product" },
          description: "Fill missing item",
          impact: "Fills null item",
          approved: true,
          status: "PENDING",
        },
        {
          id: "step-2",
          operation: "fill_missing",
          column: "score",
          params: { strategy: "median" },
          description: "Fill missing score with median",
          impact: "Imputes median score",
          approved: true,
          status: "PENDING",
        },
      ]);

      assert.equal(result.cleanedRows[1].item, "Unknown Product");
      assert.equal(result.cleanedRows[1].score, 85); // Median of 80 and 90
    });

    it("should replace inconsistent categories via mapping dictionary", () => {
      const rows = [
        { state: "NY" },
        { state: "ny" },
        { state: "California" },
        { state: "CA" },
      ];
      const result = applyDataTransformations(rows, ["state"], [
        {
          id: "step-1",
          operation: "replace_values",
          column: "state",
          params: {
            mapping: {
              NY: "New York",
              ny: "New York",
              CA: "California",
            },
          },
          description: "Harmonize state names",
          impact: "Maps abbreviations to full names",
          approved: true,
          status: "PENDING",
        },
      ]);

      assert.equal(result.cleanedRows[0].state, "New York");
      assert.equal(result.cleanedRows[1].state, "New York");
      assert.equal(result.cleanedRows[2].state, "California");
      assert.equal(result.cleanedRows[3].state, "California");
    });

    it("should rename and drop columns cleanly", () => {
      const rows = [
        { old_id: 1, temp_notes: "delete me", amount: 50 },
      ];
      const result = applyDataTransformations(rows, ["old_id", "temp_notes", "amount"], [
        {
          id: "step-1",
          operation: "rename_column",
          column: "old_id",
          params: { newColumnName: "user_id" },
          description: "Rename old_id to user_id",
          impact: "Renames column header",
          approved: true,
          status: "PENDING",
        },
        {
          id: "step-2",
          operation: "drop_column",
          column: "temp_notes",
          description: "Drop temp_notes column",
          impact: "Removes temporary column",
          approved: true,
          status: "PENDING",
        },
      ]);

      assert.ok(!Object.prototype.hasOwnProperty.call(result.cleanedRows[0], "old_id"));
      assert.ok(!Object.prototype.hasOwnProperty.call(result.cleanedRows[0], "temp_notes"));
      assert.equal(result.cleanedRows[0].user_id, 1);
      assert.equal(result.cleanedRows[0].amount, 50);
      assert.deepEqual(result.cleanedColumns, ["user_id", "amount"]);
    });
  });
});
