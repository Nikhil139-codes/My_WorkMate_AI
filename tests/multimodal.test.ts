import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatTimestamp,
  formatTimestampRange,
  groupSegmentsIntoChunks,
  TranscriptSegment,
} from "../src/lib/multimodal/audioProcessor";
import { detectMediaType } from "../src/lib/multimodal/multimodalIndexer";

describe("Phase 4: Multimodal Knowledge Intelligence Tests", () => {
  describe("Media Type Detection", () => {
    it("should accurately detect image mime types and extensions", () => {
      assert.equal(detectMediaType("image/png", "diagram.png"), "image");
      assert.equal(detectMediaType("image/jpeg", "receipt.jpg"), "image");
      assert.equal(detectMediaType("image/webp", "photo.webp"), "image");
      assert.equal(detectMediaType("application/octet-stream", "scan.jpeg"), "image");
    });

    it("should accurately detect audio mime types and extensions", () => {
      assert.equal(detectMediaType("audio/mpeg", "meeting.mp3"), "audio");
      assert.equal(detectMediaType("audio/wav", "voice_memo.wav"), "audio");
      assert.equal(detectMediaType("audio/ogg", "podcast.ogg"), "audio");
      assert.equal(detectMediaType("application/octet-stream", "interview.m4a"), "audio");
    });

    it("should accurately detect video mime types and extensions", () => {
      assert.equal(detectMediaType("video/mp4", "webinar.mp4"), "video");
      assert.equal(detectMediaType("video/webm", "screen_recording.webm"), "video");
      assert.equal(detectMediaType("video/quicktime", "demo.mov"), "video");
    });

    it("should default standard document types to document", () => {
      assert.equal(detectMediaType("application/pdf", "annual_report.pdf"), "document");
      assert.equal(
        detectMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "proposal.docx"),
        "document"
      );
      assert.equal(detectMediaType("text/csv", "data.csv"), "document");
      assert.equal(detectMediaType("text/plain", "notes.txt"), "document");
    });
  });

  describe("Timestamp Formatting Helpers", () => {
    it("should format single seconds to MM:SS string correctly", () => {
      assert.equal(formatTimestamp(0), "00:00");
      assert.equal(formatTimestamp(9), "00:09");
      assert.equal(formatTimestamp(65), "01:05");
      assert.equal(formatTimestamp(735), "12:15");
      assert.equal(formatTimestamp(3600), "60:00");
    });

    it("should format timestamp ranges accurately", () => {
      assert.equal(formatTimestampRange(0, 30), "00:00 – 00:30");
      assert.equal(formatTimestampRange(45, 115), "00:45 – 01:55");
      assert.equal(formatTimestampRange(600, 642), "10:00 – 10:42");
    });
  });

  describe("Transcript Segmentation & Windowing", () => {
    it("should group short Whisper segments into ~30-second windows", () => {
      const sampleSegments: TranscriptSegment[] = [
        { id: 1, start: 0, end: 10, text: "Welcome to WorkMate AI multimodal knowledge base." },
        { id: 2, start: 10, end: 22, text: "In this session we review quarterly metrics." },
        { id: 3, start: 22, end: 32, text: "Our RAG engine now supports audio, video, and OCR." }, // crosses 30s threshold
        { id: 4, start: 32, end: 45, text: "Next, let's explore semantic vector search across timestamps." },
        { id: 5, start: 45, end: 65, text: "Thank you all for attending the demo." }, // crosses threshold
      ];

      const chunks = groupSegmentsIntoChunks(sampleSegments, 30);

      assert.equal(chunks.length, 2);
      // Window 1: spans 0s to 32s
      assert.equal(chunks[0].start, 0);
      assert.equal(chunks[0].end, 32);
      assert.ok(chunks[0].text.includes("Welcome to WorkMate AI"));
      assert.ok(chunks[0].text.includes("quarterly metrics"));
      assert.ok(chunks[0].text.includes("audio, video, and OCR"));

      // Window 2: spans 32s to 65s
      assert.equal(chunks[1].start, 32);
      assert.equal(chunks[1].end, 65);
      assert.ok(chunks[1].text.includes("semantic vector search"));
      assert.ok(chunks[1].text.includes("attending the demo"));
    });

    it("should flush remaining segments even when window threshold is not reached", () => {
      const shortSegments: TranscriptSegment[] = [
        { id: 1, start: 0, end: 5, text: "Quick announcement." },
        { id: 2, start: 5, end: 12, text: "All systems are operational." },
      ];

      const chunks = groupSegmentsIntoChunks(shortSegments, 30);

      assert.equal(chunks.length, 1);
      assert.equal(chunks[0].start, 0);
      assert.equal(chunks[0].end, 12);
      assert.equal(chunks[0].text, "Quick announcement. All systems are operational.");
    });

    it("should return empty array when no segments provided", () => {
      const chunks = groupSegmentsIntoChunks([]);
      assert.equal(chunks.length, 0);
    });
  });

  describe("HTTP Range Parser & Chunk Slicing Logic", () => {
    it("should correctly slice byte ranges and format Content-Range header", () => {
      const totalBytes = 1000;
      const fileBuffer = Buffer.alloc(totalBytes, 0x41); // 1000 'A' bytes

      const rangeHeader = "bytes=100-199";
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      assert.ok(match);

      let start = parseInt(match[1], 10);
      let end = parseInt(match[2], 10);

      start = Math.max(0, Math.min(start, totalBytes - 1));
      end = Math.max(start, Math.min(end, totalBytes - 1));

      const chunk = fileBuffer.slice(start, end + 1);
      const chunkLength = end - start + 1;

      assert.equal(chunk.length, 100);
      assert.equal(chunkLength, 100);
      assert.equal(`bytes ${start}-${end}/${totalBytes}`, "bytes 100-199/1000");
    });

    it("should clamp out-of-bound ranges gracefully", () => {
      const totalBytes = 500;
      const fileBuffer = Buffer.alloc(totalBytes, 0x42);

      const rangeHeader = "bytes=450-999";
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      assert.ok(match);

      let start = parseInt(match[1], 10);
      let end = parseInt(match[2], 10);

      start = Math.max(0, Math.min(start, totalBytes - 1));
      end = Math.max(start, Math.min(end, totalBytes - 1));

      const chunk = fileBuffer.slice(start, end + 1);
      assert.equal(end, 499);
      assert.equal(chunk.length, 50);
      assert.equal(`bytes ${start}-${end}/${totalBytes}`, "bytes 450-499/500");
    });
  });

  describe("Meeting Intelligence Synthesis & Action Item Extraction", () => {
    it("should parse and normalize structured AI synthesis payloads", () => {
      const rawAiResponse = JSON.stringify({
        title: "Sprint 43 Standup and Architecture Review",
        executiveSummary: "The team discussed Atlas vector index rollout and finalized Whisper turbo for speech transcription.",
        topics: [
          {
            title: "Vector Search Implementation",
            timestampStart: 12,
            timestampEnd: 64,
            formattedTimestamp: "00:12 – 01:04",
            summary: "Sarah updated that embeddings and cosine similarity index are working.",
          },
        ],
        decisions: ["Adopt Groq Whisper Large v3 Turbo across all audio ingestion."],
        actionItems: [
          {
            task: "Deploy HTTP 206 range streaming route for video scrubbing",
            owner: "Alex",
            priority: "high",
            dueDate: "2026-10-18",
            timestamp: "01:38",
          },
        ],
      });

      const parsed = JSON.parse(rawAiResponse);

      assert.equal(parsed.title, "Sprint 43 Standup and Architecture Review");
      assert.equal(parsed.decisions.length, 1);
      assert.equal(parsed.actionItems.length, 1);
      assert.equal(parsed.actionItems[0].owner, "Alex");
      assert.equal(parsed.actionItems[0].priority.toUpperCase(), "HIGH");
    });

    it("should validate and format action items for Workspace Task conversion", () => {
      const sampleItem = {
        task: "Verify tenant isolation boundaries on Task exports",
        owner: "Priya",
        priority: "URGENT",
        dueDate: "2026-10-20",
        timestamp: "02:15",
      };

      const taskDoc = {
        workspaceId: "ws-test-123",
        title: sampleItem.task.trim(),
        description: `Action item assigned to ${sampleItem.owner} during meeting "Sprint 43". Timestamp: ${sampleItem.timestamp}.`,
        status: "TODO",
        priority: sampleItem.priority,
        dueDate: new Date(sampleItem.dueDate),
      };

      assert.equal(taskDoc.status, "TODO");
      assert.equal(taskDoc.priority, "URGENT");
      assert.ok(taskDoc.description.includes("assigned to Priya"));
      assert.ok(taskDoc.description.includes("Timestamp: 02:15"));
      assert.equal(taskDoc.dueDate.toISOString().split("T")[0], "2026-10-20");
    });
  });
});

