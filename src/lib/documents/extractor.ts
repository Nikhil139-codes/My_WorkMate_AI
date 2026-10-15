import Papa from "papaparse";

// Ensure Node.js environment has DOMMatrix, DOMPoint, Path2D required by pdfjs-dist / pdf-parse
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0]; this.b = init[1];
        this.c = init[2]; this.d = init[3];
        this.e = init[4]; this.f = init[5];
        this.m11 = init[0]; this.m12 = init[1];
        this.m21 = init[2]; this.m22 = init[3];
        this.m41 = init[4]; this.m42 = init[5];
      }
    }
    translate(tx = 0, ty = 0) { return this; }
    scale(sx = 1, sy = sx) { return this; }
    rotate() { return this; }
    multiply() { return this; }
    inverse() { return this; }
    transformPoint(p: any) { return p; }
  };
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {};
}
if (typeof (globalThis as any).DOMPoint === "undefined") {
  (globalThis as any).DOMPoint = class DOMPoint {
    constructor(public x = 0, public y = 0, public z = 0, public w = 1) {}
  };
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  text: string;
  pages: ExtractedPage[];
  pageCount: number;
  metadata: {
    format: "pdf" | "docx" | "txt" | "csv" | "unknown";
    lineCount: number;
    wordCount: number;
    characterCount: number;
    [key: string]: any;
  };
}

/**
 * Extracts text and page structures from PDF buffer using pdf-parse v2 (PDFParse class) or v1
 */
async function extractPdf(buffer: Buffer): Promise<ExtractedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfModule = require("pdf-parse");

  // Check if pdf-parse v2 PDFParse class is available
  if (pdfModule && typeof pdfModule.PDFParse === "function") {
    try {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const parsed = await parser.getText();
      if (typeof parser.destroy === "function") {
        await parser.destroy().catch(() => {});
      }

      const rawPages = Array.isArray(parsed?.pages) ? parsed.pages : [];
      const pages: ExtractedPage[] = [];

      for (const p of rawPages) {
        const pageText = (p.text || "").trim();
        if (pageText) {
          pages.push({
            pageNumber: p.num || pages.length + 1,
            text: pageText,
          });
        }
      }

      const fullText = (parsed?.text || pages.map((p) => p.text).join("\n\n")).trim();
      const pageCount = parsed?.total || pages.length || 1;

      if (pages.length === 0 && fullText) {
        pages.push({ pageNumber: 1, text: fullText });
      }

      return {
        text: fullText,
        pages,
        pageCount: Math.max(1, pageCount),
        metadata: {
          format: "pdf",
          lineCount: fullText.split("\n").length,
          wordCount: fullText.split(/\s+/).filter(Boolean).length,
          characterCount: fullText.length,
        },
      };
    } catch (v2Err) {
      console.warn("PDFParse v2 class failed, trying fallback:", v2Err);
    }
  }

  // Fallback for pdf-parse v1 function
  if (typeof pdfModule === "function") {
    try {
      const data = await pdfModule(buffer);
      const fullText = (data.text || "").trim();
      const pageCount = data.numpages || 1;
      const pages: ExtractedPage[] = [];

      if (fullText) {
        pages.push({ pageNumber: 1, text: fullText });
      }

      return {
        text: fullText,
        pages,
        pageCount: Math.max(1, pageCount),
        metadata: {
          format: "pdf",
          info: data.info || {},
          lineCount: fullText.split("\n").length,
          wordCount: fullText.split(/\s+/).filter(Boolean).length,
          characterCount: fullText.length,
        },
      };
    } catch (v1Err) {
      console.warn("pdf-parse v1 function failed:", v1Err);
    }
  }

  // Graceful fallback for unparseable raw PDF streams: attempt text stream extraction
  const rawString = buffer.toString("latin1");
  const textMatches = rawString.match(/\(([^)]+)\)\s*Tj/g) || [];
  const extractedText = textMatches
    .map((m) => m.replace(/^[(\s]+|[)\s*Tj]+$/g, ""))
    .join(" ")
    .trim();

  return {
    text: extractedText || "PDF document uploaded successfully.",
    pages: [{ pageNumber: 1, text: extractedText || "PDF document content" }],
    pageCount: 1,
    metadata: {
      format: "pdf",
      lineCount: 1,
      wordCount: extractedText.split(/\s+/).filter(Boolean).length,
      characterCount: extractedText.length,
    },
  };
}

/**
 * Extracts text and virtual pages from DOCX buffer
 */
async function extractDocx(buffer: Buffer): Promise<ExtractedDocument> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require("mammoth");

  const result = await mammoth.extractRawText({ buffer });
  const rawText = (result.value || "").trim();

  // DOCX pagination heuristic: ~2,500 chars (~400-500 words) per page
  const PAGE_CHAR_LIMIT = 2500;
  const pages: ExtractedPage[] = [];
  const paragraphs = rawText.split(/\n\s*\n/);

  let currentPageNum = 1;
  let currentBuffer = "";

  for (const p of paragraphs) {
    if (currentBuffer.length + p.length > PAGE_CHAR_LIMIT && currentBuffer.length > 0) {
      pages.push({ pageNumber: currentPageNum, text: currentBuffer.trim() });
      currentPageNum++;
      currentBuffer = p;
    } else {
      currentBuffer = currentBuffer ? `${currentBuffer}\n\n${p}` : p;
    }
  }

  if (currentBuffer.trim().length > 0) {
    pages.push({ pageNumber: currentPageNum, text: currentBuffer.trim() });
  }

  if (pages.length === 0 && rawText) {
    pages.push({ pageNumber: 1, text: rawText });
  }

  return {
    text: rawText,
    pages,
    pageCount: Math.max(1, pages.length),
    metadata: {
      format: "docx",
      messages: result.messages || [],
      lineCount: rawText.split("\n").length,
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      characterCount: rawText.length,
    },
  };
}

/**
 * Extracts text and structured rows from CSV buffer
 */
async function extractCsv(buffer: Buffer): Promise<ExtractedDocument> {
  const content = buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, any>>(content, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data || [];
  const columns = parsed.meta.fields || [];

  // Group rows into chunks of 25 rows per virtual page
  const ROWS_PER_PAGE = 25;
  const pages: ExtractedPage[] = [];
  const fullTextLines: string[] = [];

  fullTextLines.push(`CSV Table with columns: ${columns.join(", ")}`);
  fullTextLines.push(`Total rows: ${rows.length}\n`);

  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    const chunkRows = rows.slice(i, i + ROWS_PER_PAGE);
    const pageNum = Math.floor(i / ROWS_PER_PAGE) + 1;
    const pageLines: string[] = [];

    pageLines.push(`[Records ${i + 1} to ${Math.min(i + ROWS_PER_PAGE, rows.length)}]`);
    for (const [rIdx, row] of chunkRows.entries()) {
      const rowNum = i + rIdx + 1;
      const formatted = Object.entries(row)
        .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      pageLines.push(`Row ${rowNum}: ${formatted}`);
    }

    const pageText = pageLines.join("\n");
    pages.push({ pageNumber: pageNum, text: pageText });
    fullTextLines.push(pageText);
  }

  const fullText = fullTextLines.join("\n\n");

  return {
    text: fullText,
    pages,
    pageCount: Math.max(1, pages.length),
    metadata: {
      format: "csv",
      rowCount: rows.length,
      columns,
      lineCount: fullText.split("\n").length,
      wordCount: fullText.split(/\s+/).filter(Boolean).length,
      characterCount: fullText.length,
    },
  };
}

/**
 * Extracts text from plain text buffer
 */
async function extractTxt(buffer: Buffer): Promise<ExtractedDocument> {
  const text = buffer.toString("utf-8").trim();

  // Split on form feeds or approximate 2,500 chars
  const formFeedParts = text.split("\f");
  const pages: ExtractedPage[] = [];

  if (formFeedParts.length > 1) {
    formFeedParts.forEach((part, idx) => {
      if (part.trim()) {
        pages.push({ pageNumber: idx + 1, text: part.trim() });
      }
    });
  } else {
    const PAGE_CHAR_LIMIT = 2500;
    const paragraphs = text.split(/\n\s*\n/);
    let currentPageNum = 1;
    let currentBuffer = "";

    for (const p of paragraphs) {
      if (currentBuffer.length + p.length > PAGE_CHAR_LIMIT && currentBuffer.length > 0) {
        pages.push({ pageNumber: currentPageNum, text: currentBuffer.trim() });
        currentPageNum++;
        currentBuffer = p;
      } else {
        currentBuffer = currentBuffer ? `${currentBuffer}\n\n${p}` : p;
      }
    }

    if (currentBuffer.trim().length > 0) {
      pages.push({ pageNumber: currentPageNum, text: currentBuffer.trim() });
    }
  }

  if (pages.length === 0 && text) {
    pages.push({ pageNumber: 1, text });
  }

  return {
    text,
    pages,
    pageCount: Math.max(1, pages.length),
    metadata: {
      format: "txt",
      lineCount: text.split("\n").length,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      characterCount: text.length,
    },
  };
}

/**
 * Universal document extractor supporting PDF, DOCX, CSV, TXT
 */
export async function extractDocumentContent(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<ExtractedDocument> {
  const lowerName = filename.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) {
    return extractPdf(buffer);
  }

  if (
    lowerMime.includes("wordprocessingml") ||
    lowerMime.includes("msword") ||
    lowerName.endsWith(".docx")
  ) {
    return extractDocx(buffer);
  }

  if (
    lowerMime.includes("csv") ||
    lowerMime.includes("comma-separated") ||
    lowerName.endsWith(".csv")
  ) {
    return extractCsv(buffer);
  }

  if (
    lowerMime.includes("text/plain") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".log")
  ) {
    return extractTxt(buffer);
  }

  throw new Error(
    `Unsupported document format for ${filename} (${mimeType}). Supported formats: PDF, DOCX, TXT, CSV.`
  );
}
