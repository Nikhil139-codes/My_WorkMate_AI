import { ExtractedPage } from "./extractor";

export interface ChunkingOptions {
  chunkSize?: number; // Target chunk size in characters (default: 600)
  chunkOverlap?: number; // Overlap in characters (default: 100)
  strategy?: "paragraph-semantic" | "page-level" | "tabular-fixed" | string;
}

export interface DocumentChunkData {
  chunkIndex: number;
  content: string;
  pageNumber: number;
  tokenCount: number;
}

/**
 * Approximate token count (~4 characters per English token)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

/**
 * Splits text within a single page into overlapping chunks respecting natural punctuation boundaries
 */
function splitPageText(
  text: string,
  pageNumber: number,
  chunkSize: number,
  chunkOverlap: number,
  startingIndex: number
): { chunks: DocumentChunkData[]; nextIndex: number } {
  const clean = text.trim();
  if (!clean) return { chunks: [], nextIndex: startingIndex };

  // If text is smaller than chunk size, return as a single chunk
  if (clean.length <= chunkSize) {
    return {
      chunks: [
        {
          chunkIndex: startingIndex,
          content: clean,
          pageNumber,
          tokenCount: estimateTokenCount(clean),
        },
      ],
      nextIndex: startingIndex + 1,
    };
  }

  const chunks: DocumentChunkData[] = [];
  let currentPos = 0;
  let currentIndex = startingIndex;

  while (currentPos < clean.length) {
    let endPos = currentPos + chunkSize;

    if (endPos >= clean.length) {
      endPos = clean.length;
    } else {
      // Find the most natural breaking boundary before endPos
      const searchWindow = clean.substring(
        Math.max(currentPos + Math.floor(chunkSize * 0.5), endPos - 120),
        Math.min(clean.length, endPos + 60)
      );

      // Prioritize paragraph break, then sentence break, then newline, then whitespace
      const paragraphMatch = searchWindow.lastIndexOf("\n\n");
      const sentenceMatch = searchWindow.search(/[.!?]\s+[A-Z0-9]/);
      const newlineMatch = searchWindow.lastIndexOf("\n");
      const spaceMatch = searchWindow.lastIndexOf(" ");

      const windowOffset = Math.max(currentPos + Math.floor(chunkSize * 0.5), endPos - 120);

      if (paragraphMatch !== -1) {
        endPos = windowOffset + paragraphMatch + 2;
      } else if (sentenceMatch !== -1) {
        endPos = windowOffset + sentenceMatch + 2;
      } else if (newlineMatch !== -1) {
        endPos = windowOffset + newlineMatch + 1;
      } else if (spaceMatch !== -1) {
        endPos = windowOffset + spaceMatch + 1;
      }
    }

    const chunkContent = clean.substring(currentPos, endPos).trim();
    if (chunkContent.length > 20) {
      chunks.push({
        chunkIndex: currentIndex++,
        content: chunkContent,
        pageNumber,
        tokenCount: estimateTokenCount(chunkContent),
      });
    }

    if (endPos >= clean.length) break;

    // Advance position with overlap
    const step = Math.max(1, endPos - currentPos - chunkOverlap);
    currentPos += step;
  }

  return { chunks, nextIndex: currentIndex };
}

/**
 * Main chunking pipeline preserving page metadata across the document
 */
export function chunkDocumentPages(
  pages: ExtractedPage[],
  options: ChunkingOptions = {}
): DocumentChunkData[] {
  const chunkSize = options.chunkSize || 600;
  const chunkOverlap = Math.min(options.chunkOverlap || 100, Math.floor(chunkSize * 0.4));

  const allChunks: DocumentChunkData[] = [];
  let globalChunkIndex = 0;

  for (const page of pages) {
    const { chunks, nextIndex } = splitPageText(
      page.text,
      page.pageNumber,
      chunkSize,
      chunkOverlap,
      globalChunkIndex
    );
    allChunks.push(...chunks);
    globalChunkIndex = nextIndex;
  }

  // Safety: if document produced no chunks (e.g. empty pages), ensure at least 1 chunk if any text exists
  if (allChunks.length === 0 && pages.length > 0) {
    const combined = pages.map((p) => p.text).join("\n").trim();
    if (combined) {
      allChunks.push({
        chunkIndex: 0,
        content: combined.substring(0, 1000),
        pageNumber: 1,
        tokenCount: estimateTokenCount(combined.substring(0, 1000)),
      });
    }
  }

  return allChunks;
}
