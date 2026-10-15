import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedDataset {
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
  totalColumns: number;
}

/**
 * Parses raw CSV buffer into structured headers and records
 */
export function parseCsv(buffer: Buffer): ParsedDataset {
  const content = buffer.toString("utf-8");
  const parsed = Papa.parse<Record<string, any>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: true, // Auto-converts numbers and booleans
  });

  const columns = (parsed.meta.fields || []).map((col) => col.trim()).filter(Boolean);
  const rawRows = parsed.data || [];

  // Filter out completely blank rows
  const cleanRows = rawRows.filter((row) => {
    return Object.values(row).some((val) => val !== null && val !== undefined && String(val).trim() !== "");
  });

  return {
    columns,
    rows: cleanRows,
    totalRows: cleanRows.length,
    totalColumns: columns.length,
  };
}

/**
 * Parses raw XLSX/XLS buffer into structured headers and records
 */
export function parseXlsx(buffer: Buffer): ParsedDataset {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel workbook contains no sheets");
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error("Unable to read default sheet in Excel workbook");
  }

  // Convert to JSON with header row
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    raw: false, // Formats dates and numbers nicely
    defval: null,
  });

  if (rawRows.length === 0) {
    return {
      columns: [],
      rows: [],
      totalRows: 0,
      totalColumns: 0,
    };
  }

  // Collect columns from first row + all keys found
  const colSet = new Set<string>();
  for (const r of rawRows) {
    for (const key of Object.keys(r)) {
      if (key && key.trim()) colSet.add(key.trim());
    }
  }
  const columns = Array.from(colSet);

  return {
    columns,
    rows: rawRows,
    totalRows: rawRows.length,
    totalColumns: columns.length,
  };
}

/**
 * Universal dataset parser for CSV and XLSX formats
 */
export function parseDatasetFile(buffer: Buffer, filename: string, mimeType?: string): ParsedDataset {
  const lowerName = filename.toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls") || lowerMime.includes("spreadsheet") || lowerMime.includes("excel")) {
    return parseXlsx(buffer);
  }

  if (lowerName.endsWith(".csv") || lowerMime.includes("csv") || lowerMime.includes("text/plain")) {
    return parseCsv(buffer);
  }

  // Fallback heuristic based on magic bytes (PK for zip/xlsx, else text)
  if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return parseXlsx(buffer);
  }

  return parseCsv(buffer);
}

/**
 * Converts array of row records to CSV Buffer
 */
export function serializeToCsv(rows: Record<string, any>[], columns?: string[]): Buffer {
  const csvString = Papa.unparse(rows, {
    columns: columns && columns.length > 0 ? columns : undefined,
    header: true,
  });
  return Buffer.from(csvString, "utf-8");
}

/**
 * Converts array of row records to XLSX Buffer
 */
export function serializeToXlsx(rows: Record<string, any>[], sheetName = "Cleaned_Data"): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(xlsxBuffer);
}
