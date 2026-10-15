/**
 * Multimodal Indexer — handles full ingestion pipeline for images, audio, and video.
 *
 * For documents (PDF, DOCX, TXT, CSV) the existing indexDocument() in indexer.ts is used.
 * This module handles the new media types added in Phase 4.
 */

import { Document as DocumentModel, DocumentChunk } from "@/lib/db/models";
import { storage } from "@/lib/storage";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { logActivity } from "@/lib/workspace/auth";
import { ocrImage, ocrPdf } from "./ocrProcessor";
import { transcribeAudio, groupSegmentsIntoChunks, formatTimestampRange } from "./audioProcessor";
import { processVideo } from "./videoProcessor";

export interface MultimodalIndexResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  mediaType: "image" | "audio" | "video";
  error?: string;
}

/**
 * Index an image file: run OCR, chunk text, embed, and save to MongoDB.
 */
async function indexImage(
  documentId: string,
  workspaceId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MultimodalIndexResult> {
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  doc.processingStatus = "PROCESSING";
  await doc.save();

  try {
    const ocrResult = await ocrImage(fileBuffer);

    // Chunk OCR text into segments
    const CHUNK_SIZE = 600;
    const words = ocrResult.text.split(/\s+/);
    const textChunks: string[] = [];

    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunk = words.slice(i, i + CHUNK_SIZE).join(" ").trim();
      if (chunk) textChunks.push(chunk);
    }

    if (textChunks.length === 0) {
      textChunks.push(
        ocrResult.text.trim() || `[Image: ${filename} — no readable text detected via OCR]`
      );
    }

    const embeddings = await generateEmbeddings(textChunks);

    await DocumentChunk.deleteMany({ documentId, workspaceId });

    await DocumentChunk.insertMany(
      textChunks.map((content, idx) => ({
        documentId,
        workspaceId,
        chunkIndex: idx,
        content,
        pageNumber: 1,
        tokenCount: content.split(/\s+/).length,
        embedding: embeddings[idx],
        modality: "ocr" as const,
        metadata: {
          originalFilename: filename,
          ocrEngine: ocrResult.ocrEngine,
          confidence: ocrResult.pages[0]?.confidence,
        },
      }))
    );

    doc.processingStatus = "READY";
    doc.mediaType = "image";
    doc.pageCount = 1;
    doc.chunkCount = textChunks.length;
    doc.extractedText =
      ocrResult.text.length > 5000
        ? `${ocrResult.text.substring(0, 5000)}...`
        : ocrResult.text;
    doc.mediaMetadata = {
      ocrEngine: ocrResult.ocrEngine,
    };
    doc.failureReason = null;
    await doc.save();

    await logActivity({
      workspaceId,
      userId: doc.uploadedByUserId || "system",
      action: "DOCUMENT_INDEXED",
      resourceType: "DOCUMENT",
      resourceId: documentId,
      metadata: { filename, mediaType: "image", chunkCount: textChunks.length },
    });

    return { success: true, documentId, chunkCount: textChunks.length, mediaType: "image" };
  } catch (err: any) {
    doc.processingStatus = "FAILED";
    doc.failureReason = err.message;
    await doc.save();
    throw err;
  }
}

/**
 * Index a scanned PDF: run OCR per page, chunk text, embed, and save to MongoDB.
 */
async function indexScannedPdf(
  documentId: string,
  workspaceId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<MultimodalIndexResult> {
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  doc.processingStatus = "PROCESSING";
  await doc.save();

  try {
    const ocrResult = await ocrPdf(fileBuffer);
    const chunks: Array<{ content: string; pageNumber: number }> = [];

    for (const page of ocrResult.pages) {
      const CHUNK_SIZE = 600;
      const words = page.text.split(/\s+/);
      for (let i = 0; i < words.length; i += CHUNK_SIZE) {
        const content = words.slice(i, i + CHUNK_SIZE).join(" ").trim();
        if (content) {
          chunks.push({ content, pageNumber: page.pageNumber });
        }
      }
    }

    if (chunks.length === 0) {
      chunks.push({ content: `[Scanned PDF: ${filename} — no text extracted via OCR]`, pageNumber: 1 });
    }

    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    await DocumentChunk.deleteMany({ documentId, workspaceId });

    await DocumentChunk.insertMany(
      chunks.map((c, idx) => ({
        documentId,
        workspaceId,
        chunkIndex: idx,
        content: c.content,
        pageNumber: c.pageNumber,
        tokenCount: c.content.split(/\s+/).length,
        embedding: embeddings[idx],
        modality: "ocr" as const,
        metadata: {
          originalFilename: filename,
          ocrEngine: ocrResult.ocrEngine,
          isScannedPdf: true,
        },
      }))
    );

    doc.processingStatus = "READY";
    doc.mediaType = "document";
    doc.pageCount = ocrResult.pageCount;
    doc.chunkCount = chunks.length;
    doc.extractedText =
      ocrResult.text.length > 5000
        ? `${ocrResult.text.substring(0, 5000)}...`
        : ocrResult.text;
    doc.mediaMetadata = {
      ocrEngine: ocrResult.ocrEngine,
      isScannedPdf: true,
    };
    doc.failureReason = null;
    await doc.save();

    return { success: true, documentId, chunkCount: chunks.length, mediaType: "image" };
  } catch (err: any) {
    doc.processingStatus = "FAILED";
    doc.failureReason = err.message;
    await doc.save();
    throw err;
  }
}

/**
 * Index an audio file: transcribe via Groq Whisper, chunk segments, embed, and save.
 */
async function indexAudio(
  documentId: string,
  workspaceId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MultimodalIndexResult> {
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  doc.processingStatus = "PROCESSING";
  await doc.save();

  try {
    const result = await transcribeAudio(fileBuffer, filename, mimeType);
    const windowedChunks = groupSegmentsIntoChunks(result.segments, 30);

    if (windowedChunks.length === 0 && result.text.trim()) {
      windowedChunks.push({ start: 0, end: result.durationSeconds, text: result.text.trim() });
    }

    const embeddings = await generateEmbeddings(windowedChunks.map((c) => c.text));

    await DocumentChunk.deleteMany({ documentId, workspaceId });

    await DocumentChunk.insertMany(
      windowedChunks.map((c, idx) => ({
        documentId,
        workspaceId,
        chunkIndex: idx,
        content: c.text,
        pageNumber: 1,
        tokenCount: c.text.split(/\s+/).length,
        embedding: embeddings[idx],
        modality: "audio_transcript" as const,
        timestampStart: c.start,
        timestampEnd: c.end,
        formattedTimestamp: formatTimestampRange(c.start, c.end),
        metadata: {
          originalFilename: filename,
          transcriptionModel: result.model,
          language: result.language,
        },
      }))
    );

    doc.processingStatus = "READY";
    doc.mediaType = "audio";
    doc.pageCount = 1;
    doc.chunkCount = windowedChunks.length;
    doc.extractedText =
      result.text.length > 5000
        ? `${result.text.substring(0, 5000)}...`
        : result.text;
    doc.transcription = {
      text: result.text,
      language: result.language,
      durationSeconds: result.durationSeconds,
      segments: result.segments,
    };
    doc.mediaMetadata = {
      durationSeconds: result.durationSeconds,
      transcriptionModel: result.model,
    };
    doc.failureReason = null;
    await doc.save();

    await logActivity({
      workspaceId,
      userId: doc.uploadedByUserId || "system",
      action: "DOCUMENT_INDEXED",
      resourceType: "DOCUMENT",
      resourceId: documentId,
      metadata: { filename, mediaType: "audio", chunkCount: windowedChunks.length },
    });

    return { success: true, documentId, chunkCount: windowedChunks.length, mediaType: "audio" };
  } catch (err: any) {
    doc.processingStatus = "FAILED";
    doc.failureReason = err.message;
    await doc.save();
    throw err;
  }
}

/**
 * Index a video file: extract audio, transcribe, extract frames with OCR, combine into chunks.
 */
async function indexVideo(
  documentId: string,
  workspaceId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<MultimodalIndexResult> {
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  doc.processingStatus = "PROCESSING";
  await doc.save();

  try {
    const result = await processVideo(fileBuffer, filename, mimeType);

    const allChunks: Array<{
      content: string;
      timestampStart: number;
      timestampEnd: number;
      modality: "video_transcript" | "video_visual";
    }> = [];

    // 1. Transcript chunks (30-second windows)
    const windowedChunks = groupSegmentsIntoChunks(result.segments, 30);
    if (windowedChunks.length === 0 && result.transcriptText.trim()) {
      windowedChunks.push({
        start: 0,
        end: result.durationSeconds,
        text: result.transcriptText.trim(),
      });
    }

    for (const wc of windowedChunks) {
      allChunks.push({
        content: wc.text,
        timestampStart: wc.start,
        timestampEnd: wc.end,
        modality: "video_transcript",
      });
    }

    // 2. Visual frame description chunks
    for (const frame of result.frames) {
      if (frame.description && frame.description.length > 30) {
        allChunks.push({
          content: frame.description,
          timestampStart: frame.timestampSeconds,
          timestampEnd: frame.timestampSeconds,
          modality: "video_visual",
        });
      }
    }

    if (allChunks.length === 0) {
      allChunks.push({
        content: `[Video: ${filename} — no content could be extracted]`,
        timestampStart: 0,
        timestampEnd: 0,
        modality: "video_transcript",
      });
    }

    const embeddings = await generateEmbeddings(allChunks.map((c) => c.content));

    await DocumentChunk.deleteMany({ documentId, workspaceId });

    await DocumentChunk.insertMany(
      allChunks.map((c, idx) => ({
        documentId,
        workspaceId,
        chunkIndex: idx,
        content: c.content,
        pageNumber: 1,
        tokenCount: c.content.split(/\s+/).length,
        embedding: embeddings[idx],
        modality: c.modality,
        timestampStart: c.timestampStart,
        timestampEnd: c.timestampEnd,
        formattedTimestamp: formatTimestampRange(c.timestampStart, c.timestampEnd),
        metadata: {
          originalFilename: filename,
          transcriptionModel: result.model,
          language: result.transcriptLanguage,
        },
      }))
    );

    doc.processingStatus = "READY";
    doc.mediaType = "video";
    doc.pageCount = 1;
    doc.chunkCount = allChunks.length;
    doc.extractedText =
      result.transcriptText.length > 5000
        ? `${result.transcriptText.substring(0, 5000)}...`
        : result.transcriptText;
    doc.transcription = {
      text: result.transcriptText,
      language: result.transcriptLanguage,
      durationSeconds: result.durationSeconds,
      segments: result.segments,
    };
    doc.mediaMetadata = {
      durationSeconds: result.durationSeconds,
      frameCount: result.frames.length,
      transcriptionModel: result.model,
    };
    doc.failureReason = null;
    await doc.save();

    await logActivity({
      workspaceId,
      userId: doc.uploadedByUserId || "system",
      action: "DOCUMENT_INDEXED",
      resourceType: "DOCUMENT",
      resourceId: documentId,
      metadata: { filename, mediaType: "video", chunkCount: allChunks.length },
    });

    return { success: true, documentId, chunkCount: allChunks.length, mediaType: "video" };
  } catch (err: any) {
    doc.processingStatus = "FAILED";
    doc.failureReason = err.message;
    await doc.save();
    throw err;
  }
}

/**
 * Detect media type from MIME type and filename.
 */
export function detectMediaType(
  mimeType: string,
  filename: string
): "image" | "audio" | "video" | "document" {
  const lowerMime = mimeType.toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (
    lowerMime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)
  ) {
    return "image";
  }

  if (
    lowerMime.startsWith("audio/") ||
    ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)
  ) {
    return "audio";
  }

  if (
    lowerMime.startsWith("video/") ||
    ["mp4", "webm", "mov", "avi", "mpeg", "mpg", "ogv"].includes(ext)
  ) {
    return "video";
  }

  return "document";
}

/**
 * Main dispatch function — indexes a media file based on its detected type.
 * For documents (PDF/DOCX/TXT/CSV), delegates to the existing indexDocument() in indexer.ts.
 */
export async function indexMultimodalDocument(
  documentId: string,
  workspaceId: string,
  options?: {
    /** Force OCR on PDFs even when text layer exists */
    forceOcr?: boolean;
  }
): Promise<MultimodalIndexResult> {
  const doc = await DocumentModel.findOne({ _id: documentId, workspaceId });
  if (!doc) throw new Error(`Document ${documentId} not found in workspace`);

  const fileBuffer = await storage.getFile(doc.storageKey);
  if (!fileBuffer) {
    throw new Error(`File binary not found at storage key: ${doc.storageKey}`);
  }

  const mediaType = detectMediaType(doc.mimeType, doc.originalFilename);

  if (mediaType === "image") {
    const ext = doc.originalFilename.split(".").pop()?.toLowerCase() || "";
    if (ext === "pdf" || doc.mimeType.includes("pdf")) {
      return indexScannedPdf(documentId, workspaceId, fileBuffer, doc.originalFilename);
    }
    return indexImage(documentId, workspaceId, fileBuffer, doc.originalFilename, doc.mimeType);
  }

  if (mediaType === "audio") {
    return indexAudio(documentId, workspaceId, fileBuffer, doc.originalFilename, doc.mimeType);
  }

  if (mediaType === "video") {
    return indexVideo(documentId, workspaceId, fileBuffer, doc.originalFilename, doc.mimeType);
  }

  throw new Error(`Unsupported media type for multimodal indexer: ${doc.mimeType}`);
}
