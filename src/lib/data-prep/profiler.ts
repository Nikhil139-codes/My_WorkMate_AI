import { IDatasetColumn, IDataQualityIssue, IDataProfilingReport } from "@/lib/db/models/Dataset";

export interface ColumnProfile {
  name: string;
  inferredType: "string" | "number" | "date" | "boolean" | "category" | "unknown";
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  sampleValues: string[];
  stats?: {
    min?: number | string;
    max?: number | string;
    mean?: number;
    median?: number;
    outlierCount?: number;
  };
}

/**
 * Checks if a string looks like a standard date
 */
function isDateString(value: any): boolean {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value !== "string" && typeof value !== "number") return false;
  const str = String(value).trim();
  if (str.length < 6 || str.length > 35) return false;
  // Match common date patterns (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, Month DD YYYY)
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(str)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(str)) return true;
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/.test(str)) return true;
  const d = new Date(str);
  return !isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100;
}

/**
 * Deterministic statistical dataset profiler
 */
export function profileDataset(
  rows: Record<string, any>[],
  columns: string[]
): {
  columns: IDatasetColumn[];
  profilingReport: IDataProfilingReport;
} {
  const totalRows = rows.length;
  const totalColumns = columns.length;
  const issues: IDataQualityIssue[] = [];

  if (totalRows === 0 || totalColumns === 0) {
    return {
      columns: [],
      profilingReport: {
        qualityScore: 100,
        totalRows: 0,
        totalColumns: 0,
        duplicateRowsCount: 0,
        missingCellsCount: 0,
        totalCellsCount: 0,
        issues: [],
        summary: "Empty dataset uploaded.",
      },
    };
  }

  // 1. Detect Duplicate Rows
  const rowHashes = new Set<string>();
  let duplicateRowsCount = 0;
  for (const r of rows) {
    const serialized = columns.map((col) => String(r[col] ?? "")).join("|~|");
    if (rowHashes.has(serialized)) {
      duplicateRowsCount++;
    } else {
      rowHashes.add(serialized);
    }
  }

  if (duplicateRowsCount > 0) {
    issues.push({
      id: "issue-duplicate-rows",
      type: "duplicates",
      severity: duplicateRowsCount > totalRows * 0.1 ? "high" : "medium",
      affectedCount: duplicateRowsCount,
      description: `Detected ${duplicateRowsCount} duplicate row${duplicateRowsCount > 1 ? "s" : ""} across all columns.`,
      recommendedAction: "Remove duplicate records to prevent skewed metrics and data redundancy.",
    });
  }

  // 2. Profile each column
  let totalMissingCells = 0;
  const datasetColumns: IDatasetColumn[] = [];

  for (const col of columns) {
    let nullCount = 0;
    const values: any[] = [];
    const nonNullValues: any[] = [];
    const sampleSet = new Set<string>();

    for (const r of rows) {
      const val = r[col];
      values.push(val);
      if (val === null || val === undefined || (typeof val === "string" && val.trim() === "")) {
        nullCount++;
      } else {
        nonNullValues.push(val);
        if (sampleSet.size < 5) {
          sampleSet.add(String(val).substring(0, 50));
        }
      }
    }

    totalMissingCells += nullCount;
    const nullPercentage = Math.round((nullCount / totalRows) * 100);

    // Missing Values Issue
    if (nullCount > 0) {
      issues.push({
        id: `issue-missing-${col}`,
        type: "missing_values",
        severity: nullPercentage > 30 ? "high" : nullPercentage > 5 ? "medium" : "low",
        column: col,
        affectedCount: nullCount,
        description: `Column "${col}" has ${nullCount} missing value${nullCount > 1 ? "s" : ""} (${nullPercentage}% of records).`,
        recommendedAction:
          nullPercentage > 80
            ? `Consider dropping column "${col}" due to high sparsity, or impute with default values.`
            : `Impute missing values in "${col}" using constant placeholder, median/mean, or drop sparse rows.`,
      });
    }

    // Type Inference
    let inferredType: IDatasetColumn["inferredType"] = "string";
    const sampleCount = nonNullValues.length;

    if (sampleCount > 0) {
      const numericCount = nonNullValues.filter((v) => typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")).length;
      const dateCount = nonNullValues.filter(isDateString).length;
      const boolCount = nonNullValues.filter((v) => typeof v === "boolean" || ["true", "false", "yes", "no"].includes(String(v).toLowerCase().trim())).length;

      if (numericCount / sampleCount >= 0.85) {
        inferredType = "number";
      } else if (dateCount / sampleCount >= 0.8) {
        inferredType = "date";
      } else if (boolCount / sampleCount >= 0.9) {
        inferredType = "boolean";
      } else {
        const uniqueValues = new Set(nonNullValues.map(String));
        const isLowCardinality =
          sampleCount <= 10
            ? uniqueValues.size < sampleCount
            : uniqueValues.size <= Math.min(30, Math.floor(sampleCount * 0.25));

        if (isLowCardinality) {
          inferredType = "category";
        } else {
          inferredType = "string";
        }
      }
    }

    // Check Inconsistent Date Formats
    if (inferredType === "date") {
      const formatPatterns = new Set<string>();
      for (const val of nonNullValues) {
        const str = String(val).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) formatPatterns.add("YYYY-MM-DD");
        else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) formatPatterns.add("MM/DD/YYYY");
        else if (/^\d{1,2}-\d{1,2}-\d{4}/.test(str)) formatPatterns.add("DD-MM-YYYY");
        else formatPatterns.add("OTHER_DATE");
      }

      if (formatPatterns.size > 1) {
        issues.push({
          id: `issue-date-format-${col}`,
          type: "inconsistent_date",
          severity: "medium",
          column: col,
          affectedCount: nonNullValues.length,
          description: `Column "${col}" contains mixed date formats (${Array.from(formatPatterns).join(", ")}).`,
          recommendedAction: `Standardize all dates in "${col}" into consistent ISO format (YYYY-MM-DD).`,
        });
      }
    }

    // Check Inconsistent Categories (Casing / Whitespace variations)
    if (inferredType === "category" || inferredType === "string") {
      const rawCategories = new Map<string, Set<string>>(); // lowercase -> set of actual representations
      for (const val of nonNullValues) {
        const str = String(val).trim();
        const lower = str.toLowerCase();
        if (!rawCategories.has(lower)) rawCategories.set(lower, new Set());
        rawCategories.get(lower)!.add(str);
      }

      const inconsistentCategories: string[] = [];
      for (const [, set] of rawCategories.entries()) {
        if (set.size > 1) {
          inconsistentCategories.push(Array.from(set).join(" / "));
        }
      }

      if (inconsistentCategories.length > 0) {
        issues.push({
          id: `issue-category-${col}`,
          type: "inconsistent_category",
          severity: "medium",
          column: col,
          affectedCount: inconsistentCategories.length,
          description: `Column "${col}" has inconsistent casing or category labels: ${inconsistentCategories.slice(0, 3).join(", ")}.`,
          recommendedAction: `Normalize casing and harmonize variations in "${col}".`,
        });
      }
    }

    // Check Outliers for Numeric Columns
    if (inferredType === "number" && nonNullValues.length >= 8) {
      const numVals = nonNullValues.map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
      if (numVals.length >= 8) {
        const q1Index = Math.floor(numVals.length * 0.25);
        const q3Index = Math.floor(numVals.length * 0.75);
        const q1 = numVals[q1Index];
        const q3 = numVals[q3Index];
        const iqr = q3 - q1;

        if (iqr > 0) {
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;
          const outliers = numVals.filter((v) => v < lowerBound || v > upperBound);

          if (outliers.length > 0) {
            issues.push({
              id: `issue-outlier-${col}`,
              type: "outliers",
              severity: "low",
              column: col,
              affectedCount: outliers.length,
              description: `Column "${col}" has ${outliers.length} potential numeric outlier${outliers.length > 1 ? "s" : ""} (values < ${Math.round(lowerBound)} or > ${Math.round(upperBound)}).`,
              recommendedAction: `Inspect extreme values in "${col}" or cap them within normal IQR boundaries.`,
            });
          }
        }
      }
    }

    // Check Column Naming Hygiene
    if (/[\s\W]/.test(col) || col.trim() !== col) {
      issues.push({
        id: `issue-colname-${col}`,
        type: "column_naming",
        severity: "low",
        column: col,
        affectedCount: 1,
        description: `Column header "${col}" contains spaces or non-standard characters.`,
        recommendedAction: `Clean column header "${col}" to snake_case or standard alphanumeric.`,
      });
    }

    const uniqueSet = new Set(values.map(String));
    datasetColumns.push({
      name: col,
      inferredType,
      nullCount,
      uniqueCount: uniqueSet.size,
      sampleValues: Array.from(sampleSet),
    });
  }

  // Calculate Overall Data Quality Score
  const totalCells = totalRows * totalColumns;
  const missingPenalty = totalCells > 0 ? (totalMissingCells / totalCells) * 40 : 0;
  const duplicatePenalty = totalRows > 0 ? (duplicateRowsCount / totalRows) * 30 : 0;
  const issuePenalty = Math.min(30, issues.length * 4);

  const rawScore = Math.max(10, Math.min(100, Math.round(100 - (missingPenalty + duplicatePenalty + issuePenalty))));

  const summary = `Analyzed ${totalRows} rows and ${totalColumns} columns. Detected ${duplicateRowsCount} duplicates, ${totalMissingCells} missing cells across ${issues.length} detected quality issues. Quality Score: ${rawScore}/100.`;

  return {
    columns: datasetColumns,
    profilingReport: {
      qualityScore: rawScore,
      totalRows,
      totalColumns,
      duplicateRowsCount,
      missingCellsCount: totalMissingCells,
      totalCellsCount: totalCells,
      issues,
      summary,
    },
  };
}

/**
 * Creates a sanitized, privacy-safe summary for Groq AI
 * (Never sends raw data rows or potential PII)
 */
export function buildPrivacySafeProfilingSummary(
  filename: string,
  columns: IDatasetColumn[],
  report: IDataProfilingReport
): string {
  const columnSummaries = columns.map(
    (c) =>
      `- "${c.name}" (type: ${c.inferredType}, nulls: ${c.nullCount}, samples: ${c.sampleValues.slice(0, 3).map((s) => `"${s}"`).join(", ")})`
  );

  const issueSummaries = report.issues.map(
    (i) =>
      `- [${i.severity.toUpperCase()}] ${i.type}: ${i.description} (Suggested: ${i.recommendedAction})`
  );

  return `Dataset: "${filename}"
Rows: ${report.totalRows}, Columns: ${report.totalColumns}
Quality Score: ${report.qualityScore}/100
Duplicate Rows: ${report.duplicateRowsCount}
Missing Cells: ${report.missingCellsCount}

Columns:
${columnSummaries.join("\n")}

Detected Quality Issues:
${issueSummaries.length > 0 ? issueSummaries.join("\n") : "No critical issues detected."}`;
}
