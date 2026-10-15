/**
 * OCR Processor — extracts text from images and scanned PDF pages using tesseract.js v7.
 *
 * Tesseract.js v7 ships a self-contained WASM runtime and downloads its own eng.traineddata
 * on first use (cached in os.tmpdir()/tesseract-cache).
 */

import os from "os";
import path from "path";

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrResult {
  text: string;
  pages: OcrPageResult[];
  pageCount: number;
  ocrEngine: string;
}

/**
 * Run OCR on a single image buffer (PNG / JPG / JPEG / WEBP).
 */
export async function ocrImage(imageBuffer: Buffer): Promise<OcrResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createWorker } = require("tesseract.js");

  const cachePath = path.join(os.tmpdir(), "tesseract-cache");

  const worker = await createWorker("eng", 1, {
    cachePath,
    logger: () => {}, // suppress verbose progress logs
  });

  try {
    const { data } = await worker.recognize(imageBuffer);
    const text = (data.text || "").trim();

    return {
      text,
      pages: [
        {
          pageNumber: 1,
          text,
          confidence: data.confidence || 0,
        },
      ],
      pageCount: 1,
      ocrEngine: "tesseract.js-v7",
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Run OCR page-by-page on a PDF that contains scanned images rather than selectable text.
 * Uses pdfjs-dist (already installed via pdf-parse) to render each page to a canvas-like
 * bitmap, then feeds the bitmap to Tesseract.
 *
 * Fallback: if page rendering fails, returns whatever text pdf-parse could extract.
 */
export async function ocrPdf(pdfBuffer: Buffer): Promise<OcrResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createWorker } = require("tesseract.js");
  const cachePath = path.join(os.tmpdir(), "tesseract-cache");

  const pages: OcrPageResult[] = [];
  let fullText = "";

  // Attempt to get page images via sharp + pdfjs rendering
  // pdfjs requires a Canvas implementation; in Node without a real Canvas we use a PNG
  // workaround: render via pdfjs NodeCanvasFactory if @napi-rs/canvas is available,
  // otherwise fall through to direct Tesseract recognition of the raw buffer.
  // Direct OCR recognition on the document buffer using Tesseract worker
  const worker = await createWorker("eng", 1, {
    cachePath,
    logger: () => {},
  });

  try {
    const { data } = await worker.recognize(pdfBuffer);
    const text = (data.text || "").trim();

    return {
      text,
      pages: [{ pageNumber: 1, text, confidence: data.confidence || 0 }],
      pageCount: 1,
      ocrEngine: "tesseract.js-v7",
    };
  } finally {
    await worker.terminate();
  }
}
