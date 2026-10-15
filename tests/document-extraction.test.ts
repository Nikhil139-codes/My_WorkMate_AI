import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractDocumentContent } from "../src/lib/documents/extractor";

describe("Document Text & Page Extraction Tests", () => {
  it("should extract plain text and preserve page structure", async () => {
    const sampleText = "WorkMate AI Phase 2\n\nThis is a corporate knowledge document for automated retrieval.";
    const buffer = Buffer.from(sampleText, "utf-8");

    const result = await extractDocumentContent(buffer, "text/plain", "overview.txt");

    assert.equal(result.metadata.format, "txt");
    assert.ok(result.text.includes("WorkMate AI Phase 2"));
    assert.equal(result.pageCount, 1);
    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].pageNumber, 1);
    assert.ok(result.pages[0].text.includes("automated retrieval"));
  });

  it("should parse CSV tables into structured rows and virtual pages", async () => {
    const csvContent =
      "Employee,Department,Role,Salary\n" +
      "Alice Smith,Engineering,Lead Architect,160000\n" +
      "Bob Jones,Finance,Financial Analyst,110000\n" +
      "Charlie Brown,Legal,Corporate Counsel,145000\n";

    const buffer = Buffer.from(csvContent, "utf-8");
    const result = await extractDocumentContent(buffer, "text/csv", "headcount.csv");

    assert.equal(result.metadata.format, "csv");
    assert.ok(result.text.includes("Alice Smith"));
    assert.ok(result.text.includes("Engineering"));
    assert.ok(result.text.includes("Lead Architect"));
    assert.ok(result.pages.length >= 1);
    assert.equal(result.pages[0].pageNumber, 1);
    assert.equal(result.metadata.rowCount, 3);
  });

  it("should correctly handle multi-page text documents with form-feed delimiters", async () => {
    const multiPageText = "Page 1 Content\fPage 2 Content\fPage 3 Content";
    const buffer = Buffer.from(multiPageText, "utf-8");

    const result = await extractDocumentContent(buffer, "text/plain", "multi_page.txt");

    assert.equal(result.pages.length, 3);
    assert.equal(result.pages[0].pageNumber, 1);
    assert.equal(result.pages[0].text, "Page 1 Content");
    assert.equal(result.pages[1].pageNumber, 2);
    assert.equal(result.pages[1].text, "Page 2 Content");
    assert.equal(result.pages[2].pageNumber, 3);
    assert.equal(result.pages[2].text, "Page 3 Content");
  });

  it("should fail gracefully on completely unsupported formats", async () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // raw PNG bytes
    // Expect error when unsupported format cannot be parsed
    await assert.rejects(
      async () => {
        await extractDocumentContent(buffer, "image/png", "unsupported.png");
      },
      (err: any) => {
        assert.ok(err.message.includes("Unsupported document format"));
        return true;
      }
    );
  });
});
