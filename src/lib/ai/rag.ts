import { retrieveRelevantChunks, RetrievedChunk } from "./embeddings";
import { Document as DocumentModel, IDocument } from "@/lib/db/models";
import { indexDocument } from "@/lib/documents/indexer";
import { sendGroqChat, ChatMessage, DEFAULT_GROQ_MODEL } from "./groq";

export interface GroundedCitation {
  documentId: string;
  documentName: string;
  /** Page number (for documents) */
  pageNumber: number;
  chunkIndex: number;
  excerpt: string;
  /** Modality of the cited chunk */
  modality: "text" | "ocr" | "audio_transcript" | "video_visual" | "video_transcript";
  /** Timestamp start in seconds (audio / video) */
  timestampStart?: number;
  /** Timestamp end in seconds (audio / video) */
  timestampEnd?: number;
  /** Human-readable timestamp range "MM:SS – MM:SS" */
  formattedTimestamp?: string;
  /** Media type of the source document */
  mediaType?: string;
}

export interface GroundedAnswerResult {
  answer: string;
  citations: GroundedCitation[];
  chunksRetrieved: number;
  model: string;
  isGrounded: boolean;
}

export interface GroundedQueryOptions {
  workspaceId: string;
  query: string;
  documentIds?: string[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function answerGroundedQuery(
  options: GroundedQueryOptions
): Promise<GroundedAnswerResult> {
  const { workspaceId, query, documentIds, conversationHistory = [] } = options;

  // 1. Ensure any targeted or pending documents are indexed so questions are answered immediately
  if (documentIds && documentIds.length > 0) {
    const unindexedDocs = await DocumentModel.find({
      _id: { $in: documentIds },
      workspaceId,
      $or: [{ processingStatus: "PENDING" }, { chunkCount: 0 }],
    });

    for (const d of unindexedDocs) {
      try {
        const mt = (d as any).mediaType || "document";
        if (mt === "image" || mt === "audio" || mt === "video") {
          const { indexMultimodalDocument } = await import(
            "@/lib/multimodal/multimodalIndexer"
          );
          await indexMultimodalDocument((d as any)._id.toString(), workspaceId);
        } else {
          await indexDocument((d as any)._id.toString(), workspaceId);
        }
      } catch (err) {
        console.warn(`Auto-indexing document ${d.originalFilename} failed:`, err);
      }
    }
  } else {
    const readyCount = await DocumentModel.countDocuments({
      workspaceId,
      processingStatus: "READY",
      chunkCount: { $gt: 0 },
    });

    if (readyCount === 0) {
      const pendingDocs = await DocumentModel.find({
        workspaceId,
        processingStatus: "PENDING",
      }).limit(3);

      for (const d of pendingDocs) {
        try {
          const mt = (d as any).mediaType || "document";
          if (mt === "image" || mt === "audio" || mt === "video") {
            const { indexMultimodalDocument } = await import(
              "@/lib/multimodal/multimodalIndexer"
            );
            await indexMultimodalDocument((d as any)._id.toString(), workspaceId);
          } else {
            await indexDocument((d as any)._id.toString(), workspaceId);
          }
        } catch (err) {
          console.warn(`Auto-indexing pending document ${d.originalFilename} failed:`, err);
        }
      }
    }
  }

  // 2. Retrieve most relevant chunks across authorized workspace documents
  const relevantChunks = await retrieveRelevantChunks({
    workspaceId,
    query,
    documentIds,
    limit: 8,
    minScore: 0.0,
  });

  // 3. If no chunks found
  if (!relevantChunks || relevantChunks.length === 0) {
    const totalDocs = await DocumentModel.countDocuments({ workspaceId });
    if (totalDocs === 0) {
      return {
        answer:
          "There are currently no files in your workspace. Please upload PDF, DOCX, TXT, CSV, images, audio, or video files in the Document Intelligence section first.",
        citations: [],
        chunksRetrieved: 0,
        model: "workmate-grounding-engine",
        isGrounded: false,
      };
    }

    return {
      answer:
        "Based on the documents in your workspace, I could not find information answering your question. Please verify that the relevant file is uploaded, fully indexed, and contains details regarding your inquiry.",
      citations: [],
      chunksRetrieved: 0,
      model: "workmate-grounding-engine",
      isGrounded: false,
    };
  }

  // 4. Resolve document titles and media types
  const uniqueDocIds = Array.from(new Set(relevantChunks.map((c) => c.documentId)));
  const docs = await DocumentModel.find({
    _id: { $in: uniqueDocIds },
    workspaceId,
  })
    .select("_id originalFilename mediaType")
    .lean();

  const docMap = new Map<string, { name: string; mediaType: string }>();
  for (const d of docs as unknown as IDocument[]) {
    docMap.set((d as any)._id.toString(), {
      name: d.originalFilename,
      mediaType: (d as any).mediaType || "document",
    });
  }

  // 5. Build citations array with timestamp and modality info
  const citations: GroundedCitation[] = relevantChunks.map((chunk) => {
    const docInfo = docMap.get(chunk.documentId) || {
      name: "Untitled Document",
      mediaType: "document",
    };
    const modality = (chunk.metadata as any)?.modality || "text";

    return {
      documentId: chunk.documentId,
      documentName: docInfo.name,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      excerpt:
        chunk.content.length > 220
          ? `${chunk.content.substring(0, 217)}...`
          : chunk.content,
      modality: modality as GroundedCitation["modality"],
      timestampStart: (chunk.metadata as any)?.timestampStart,
      timestampEnd: (chunk.metadata as any)?.timestampEnd,
      formattedTimestamp: (chunk.metadata as any)?.formattedTimestamp,
      mediaType: docInfo.mediaType,
    };
  });

  // 6. Construct Grounded System Prompt & Context Block
  const contextSections = relevantChunks
    .map((chunk, idx) => {
      const docInfo = docMap.get(chunk.documentId) || {
        name: "Document",
        mediaType: "document",
      };
      const chunkMeta = chunk.metadata as any;
      const modality: string = chunkMeta?.modality || "text";
      const formattedTs: string | undefined = chunkMeta?.formattedTimestamp;

      // Build source label based on modality
      let sourceLabel = `Source: "${docInfo.name}"`;
      if (modality === "audio_transcript" || modality === "video_transcript") {
        sourceLabel += formattedTs
          ? `, Timestamp: ${formattedTs}`
          : `, Audio Transcript`;
      } else if (modality === "video_visual") {
        sourceLabel += formattedTs
          ? `, Visual Frame at: ${formattedTs}`
          : `, Visual Frame`;
      } else if (modality === "ocr") {
        sourceLabel += `, Page: ${chunk.pageNumber} [OCR]`;
      } else {
        sourceLabel += `, Page: ${chunk.pageNumber}`;
      }

      return `[Excerpt ${idx + 1}] ${sourceLabel}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are WorkMate AI's Enterprise Knowledge & Document Intelligence Agent.
Your responsibility is to answer the user's question grounded STRICTLY and EXCLUSIVELY in the verified excerpts provided below.
The knowledge base includes text documents, OCR-extracted images, audio transcripts, and video content.

CRITICAL INSTRUCTIONS:
1. Answer using ONLY facts explicitly present in the provided context excerpts.
2. If the context does not contain the answer, say: "Based on the provided documents, I could not find information regarding this question."
3. Do NOT extrapolate, speculate, or incorporate outside knowledge not stated in the excerpts.
4. For every assertion or factual statement, cite your source using the appropriate format:
   - Text/OCR documents: [Source: <filename>, Page: <pageNumber>]
   - Audio transcripts: [Source: <filename>, Timestamp: <MM:SS – MM:SS>]
   - Video transcripts: [Source: <filename>, Timestamp: <MM:SS – MM:SS>]
   - Video visual frames: [Source: <filename>, Visual Frame: <MM:SS>]
5. Present answers clearly with bullet points or structured headings where appropriate.
6. Do not wrap citations in ** or other bold markers.

VERIFIED KNOWLEDGE CONTEXT:
==================================================
${contextSections}
==================================================`;

  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-4),
    { role: "user", content: query },
  ];

  const aiResult = await sendGroqChat({
    messages: chatMessages,
    model: DEFAULT_GROQ_MODEL,
    temperature: 0.1,
    maxTokens: 2048,
  });

  return {
    answer: aiResult.content,
    citations,
    chunksRetrieved: relevantChunks.length,
    model: aiResult.model,
    isGrounded: true,
  };
}
