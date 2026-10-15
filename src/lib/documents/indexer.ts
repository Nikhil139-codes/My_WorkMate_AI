import { Document as DocumentModel, DocumentChunk } from "@/lib/db/models";
import { storage } from "@/lib/storage";
import { extractDocumentContent } from "./extractor";
import { chunkDocumentPages } from "./chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { logActivity } from "@/lib/workspace/auth";

export interface IndexDocumentResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  pageCount: number;
  error?: string;
}

/**
 * Robust document indexing pipeline:
 * Extracts, chunks, embeds, and saves document chunks to MongoDB Atlas,
 * ensuring the document is 100% READY for RAG queries.
 */
export async function indexDocument(
  documentId: string,
  workspaceId: string,
  configOverride?: any
): Promise<IndexDocumentResult> {
  const doc = await DocumentModel.findOne({
    _id: documentId,
    workspaceId,
  });

  if (!doc) {
    throw new Error(`Document ${documentId} not found in workspace`);
  }

  try {
    doc.processingStatus = "PROCESSING";
    await doc.save();

    const fileBuffer = await storage.getFile(doc.storageKey);
    if (!fileBuffer) {
      throw new Error(`File binary not found at storage key: ${doc.storageKey}`);
    }

    // 1. Extract text and pages
    const extracted = await extractDocumentContent(
      fileBuffer,
      doc.mimeType,
      doc.originalFilename
    );

    // 2. Resolve configuration (override -> saved config -> suggestion -> defaults)
    const effectiveConfig =
      configOverride ||
      doc.onboardingConfig ||
      doc.onboardingSuggestion ||
      {};

    const chunkSize = Number(effectiveConfig.chunkSize) || 600;
    const chunkOverlap = Number(effectiveConfig.chunkOverlap) || 100;
    const strategy = effectiveConfig.chunkingStrategy || "paragraph-semantic";

    // 3. Segment into overlapping page-aware chunks
    const chunkData = chunkDocumentPages(extracted.pages, {
      chunkSize,
      chunkOverlap,
      strategy,
    });

    if (chunkData.length === 0) {
      throw new Error("Document content yielded 0 text chunks for indexing");
    }

    // 4. Generate 384-dimensional vector embeddings
    const chunkTexts = chunkData.map((c) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    // 5. Clear previous chunks if any existed
    await DocumentChunk.deleteMany({
      documentId,
      workspaceId,
    });

    // 6. Bulk insert chunks
    const chunkDocs = chunkData.map((c, idx) => ({
      documentId,
      workspaceId,
      chunkIndex: c.chunkIndex,
      content: c.content,
      pageNumber: c.pageNumber,
      tokenCount: c.tokenCount,
      embedding: embeddings[idx],
      metadata: {
        originalFilename: doc.originalFilename,
        documentType: effectiveConfig.documentType || "General Document",
        department: effectiveConfig.department || "Operations",
        sensitivityLabel: effectiveConfig.sensitivityLabel || "INTERNAL",
      },
    }));

    await DocumentChunk.insertMany(chunkDocs);

    // 7. Update document status to READY
    doc.processingStatus = "READY";
    doc.pageCount = extracted.pageCount;
    doc.chunkCount = chunkData.length;
    doc.failureReason = null;
    doc.extractedText =
      extracted.text.length > 5000
        ? `${extracted.text.substring(0, 5000)}...`
        : extracted.text;

    if (!doc.onboardingConfig) {
      doc.onboardingConfig = {
        documentType: effectiveConfig.documentType || "General Document",
        department: effectiveConfig.department || "Operations",
        chunkingStrategy: strategy,
        chunkSize,
        chunkOverlap,
        sensitivityLabel: effectiveConfig.sensitivityLabel || "INTERNAL",
        validationRules: effectiveConfig.validationRules || [],
        tags: effectiveConfig.suggestedTags || effectiveConfig.tags || [],
        summary: effectiveConfig.summary || `Indexed ${doc.originalFilename}`,
        approvedAt: new Date(),
      };
    }

    await doc.save();

    await logActivity({
      workspaceId,
      userId: doc.uploadedByUserId || "system",
      action: "DOCUMENT_INDEXED",
      resourceType: "DOCUMENT",
      resourceId: documentId,
      metadata: {
        filename: doc.originalFilename,
        chunksCount: chunkData.length,
      },
    });

    return {
      success: true,
      documentId,
      chunkCount: chunkData.length,
      pageCount: extracted.pageCount,
    };
  } catch (err: any) {
    doc.processingStatus = "FAILED";
    doc.failureReason = err.message || "Failed during indexing pipeline";
    await doc.save();
    throw err;
  }
}
