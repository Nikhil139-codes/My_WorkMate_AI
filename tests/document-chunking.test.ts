import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkDocumentPages, estimateTokenCount } from "../src/lib/documents/chunker";

describe("Document Chunking & Segmentation Pipeline Tests", () => {
  it("should preserve page numbers accurately across chunks", () => {
    const pages = [
      { pageNumber: 1, text: "Chapter 1: The Foundation of AI in the Modern Enterprise." },
      { pageNumber: 2, text: "Chapter 2: Retrieval Augmented Generation and Vector Databases." },
      { pageNumber: 3, text: "Chapter 3: Security, Governance, and Access Control Policies." },
    ];

    const chunks = chunkDocumentPages(pages, { chunkSize: 200, chunkOverlap: 20 });

    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].pageNumber, 1);
    assert.equal(chunks[0].chunkIndex, 0);
    assert.ok(chunks[0].content.includes("Chapter 1"));

    assert.equal(chunks[1].pageNumber, 2);
    assert.equal(chunks[1].chunkIndex, 1);
    assert.ok(chunks[1].content.includes("Chapter 2"));

    assert.equal(chunks[2].pageNumber, 3);
    assert.equal(chunks[2].chunkIndex, 2);
    assert.ok(chunks[2].content.includes("Chapter 3"));
  });

  it("should split long text into multiple sequential chunks with overlap", () => {
    // Generate a long text with multiple paragraphs
    const paragraphs = [
      "Paragraph A: WorkMate AI provides enterprise teams with unified document intelligence and RAG.",
      "Paragraph B: Documents are parsed and indexed with fine-grained chunking algorithms.",
      "Paragraph C: Embeddings allow semantic search to locate exact citations and facts.",
      "Paragraph D: Security rules prevent unauthorized workspace leaks.",
    ];
    const longText = paragraphs.join("\n\n");

    const pages = [{ pageNumber: 1, text: longText }];
    const chunks = chunkDocumentPages(pages, { chunkSize: 120, chunkOverlap: 30 });

    assert.ok(chunks.length > 1);
    // Ensure every chunk has pageNumber 1
    for (const chunk of chunks) {
      assert.equal(chunk.pageNumber, 1);
      assert.ok(chunk.content.length > 0);
      assert.ok(chunk.tokenCount > 0);
    }

    // Verify sequential indexing
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].chunkIndex, i);
    }
  });

  it("should estimate token counts proportionally", () => {
    const shortText = "Hello world";
    const longerText = "The quick brown fox jumps over the lazy dog in an enterprise productivity platform.";

    assert.ok(estimateTokenCount(longerText) > estimateTokenCount(shortText));
    assert.equal(estimateTokenCount(""), 0);
  });
});
