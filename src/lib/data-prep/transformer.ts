import { ICleaningPlanStep } from "@/lib/db/models/CleaningJob";

export interface TransformationResult {
  cleanedRows: Record<string, any>[];
  cleanedColumns: string[];
  appliedSteps: ICleaningPlanStep[];
  metrics: {
    beforeRowCount: number;
    afterRowCount: number;
    rowsRemovedCount: number;
    cellsModifiedCount: number;
  };
}

/**
 * Standardizes a date value into YYYY-MM-DD
 */
function normalizeDateValue(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).trim();
  const dmMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmMatch) {
    const p1 = parseInt(dmMatch[1], 10);
    const p2 = parseInt(dmMatch[2], 10);
    const y = parseInt(dmMatch[3], 10);
    if (p1 > 12 && p2 <= 12) {
      return `${y}-${String(p2).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
    }
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return str;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Converts text into Title Case
 */
function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}

/**
 * Deterministic Server-Side Transformation Engine
 * Strictly applies only approved, allowlisted operations.
 */
export function applyDataTransformations(
  initialRows: Record<string, any>[],
  initialColumns: string[],
  planSteps: ICleaningPlanStep[]
): TransformationResult {
  // Deep clone data to guarantee idempotency and original dataset immutability
  let rows: Record<string, any>[] = initialRows.map((r) => ({ ...r }));
  let columns: string[] = [...initialColumns];
  const appliedSteps: ICleaningPlanStep[] = [];
  let cellsModifiedCount = 0;
  const beforeRowCount = rows.length;

  for (const step of planSteps) {
    if (!step.approved) {
      appliedSteps.push({ ...step, status: "REJECTED", affectedRowsCount: 0 });
      continue;
    }

    let affectedCount = 0;

    try {
      switch (step.operation) {
        // 1. Remove Duplicates
        case "remove_duplicates": {
          const scope = step.params?.scope;
          const targetCols = Array.isArray(scope) && scope.length > 0 ? scope : columns;
          const seen = new Set<string>();
          const deduped: Record<string, any>[] = [];

          for (const r of rows) {
            const hash = targetCols.map((c) => String(r[c] ?? "")).join("|~|");
            if (!seen.has(hash)) {
              seen.add(hash);
              deduped.push(r);
            } else {
              affectedCount++;
            }
          }
          rows = deduped;
          break;
        }

        // 2. Trim Whitespace
        case "trim_whitespace": {
          const colScope = step.column
            ? [step.column]
            : step.params?.scope && Array.isArray(step.params.scope)
            ? step.params.scope
            : columns;

          for (const r of rows) {
            let rowModified = false;
            for (const c of colScope) {
              if (typeof r[c] === "string") {
                const trimmed = r[c].trim();
                if (trimmed !== r[c]) {
                  r[c] = trimmed;
                  cellsModifiedCount++;
                  rowModified = true;
                }
              }
            }
            if (rowModified) affectedCount++;
          }
          break;
        }

        // 3. Standardize Text Casing
        case "standardize_text": {
          const casing = String(step.params?.casing || "lowercase").toLowerCase();
          const targetCol = step.column;
          if (!targetCol || !columns.includes(targetCol)) break;

          for (const r of rows) {
            if (typeof r[targetCol] === "string") {
              const orig = r[targetCol];
              let transformed = orig;
              if (casing === "uppercase") transformed = orig.toUpperCase();
              else if (casing === "titlecase") transformed = toTitleCase(orig);
              else transformed = orig.toLowerCase();

              if (transformed !== orig) {
                r[targetCol] = transformed;
                cellsModifiedCount++;
                affectedCount++;
              }
            }
          }
          break;
        }

        // 4. Standardize Dates
        case "standardize_dates": {
          const targetCol = step.column;
          if (!targetCol || !columns.includes(targetCol)) break;

          for (const r of rows) {
            const orig = r[targetCol];
            if (orig !== null && orig !== undefined && orig !== "") {
              const standardized = normalizeDateValue(orig);
              if (standardized !== null && standardized !== String(orig)) {
                r[targetCol] = standardized;
                cellsModifiedCount++;
                affectedCount++;
              }
            }
          }
          break;
        }

        // 5. Rename Column
        case "rename_column": {
          const oldName = step.column;
          const newName = String(step.params?.newColumnName || "").trim();

          if (oldName && newName && columns.includes(oldName) && oldName !== newName) {
            columns = columns.map((c) => (c === oldName ? newName : c));
            for (const r of rows) {
              if (Object.prototype.hasOwnProperty.call(r, oldName)) {
                r[newName] = r[oldName];
                delete r[oldName];
                affectedCount++;
              }
            }
            cellsModifiedCount += affectedCount;
          }
          break;
        }

        // 6. Drop Column
        case "drop_column": {
          const colToDrop = step.column;
          if (colToDrop && columns.includes(colToDrop)) {
            columns = columns.filter((c) => c !== colToDrop);
            for (const r of rows) {
              if (Object.prototype.hasOwnProperty.call(r, colToDrop)) {
                delete r[colToDrop];
                affectedCount++;
              }
            }
            cellsModifiedCount += affectedCount;
          }
          break;
        }

        // 7. Fill Missing Values
        case "fill_missing": {
          const targetCol = step.column;
          if (!targetCol || !columns.includes(targetCol)) break;
          const strategy = String(step.params?.strategy || "constant").toLowerCase();
          let fillVal = step.params?.value;

          // Compute mean/median/mode if requested
          if (strategy === "mean" || strategy === "median") {
            const numbers = rows
              .map((r) => r[targetCol])
              .filter((v) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v)))
              .map(Number)
              .sort((a, b) => a - b);

            if (numbers.length > 0) {
              if (strategy === "mean") {
                const sum = numbers.reduce((a, b) => a + b, 0);
                fillVal = Math.round((sum / numbers.length) * 100) / 100;
              } else {
                const mid = Math.floor(numbers.length / 2);
                fillVal = numbers.length % 2 !== 0 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
              }
            } else {
              fillVal = 0;
            }
          } else if (strategy === "mode") {
            const freq = new Map<any, number>();
            for (const r of rows) {
              const v = r[targetCol];
              if (v !== null && v !== undefined && v !== "") {
                freq.set(v, (freq.get(v) || 0) + 1);
              }
            }
            let maxCount = 0;
            let bestVal: any = "Unknown";
            for (const [val, count] of freq.entries()) {
              if (count > maxCount) {
                maxCount = count;
                bestVal = val;
              }
            }
            fillVal = bestVal;
          } else if (fillVal === undefined) {
            fillVal = "Unknown";
          }

          for (const r of rows) {
            const v = r[targetCol];
            if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
              r[targetCol] = fillVal;
              cellsModifiedCount++;
              affectedCount++;
            }
          }
          break;
        }

        // 8. Drop Missing Rows
        case "drop_missing_rows": {
          const targetCol = step.column;
          const threshold = step.params?.threshold || "any";

          const filtered = rows.filter((r) => {
            if (targetCol) {
              const v = r[targetCol];
              const isMissing = v === null || v === undefined || (typeof v === "string" && v.trim() === "");
              return !isMissing;
            }
            if (threshold === "all") {
              // Only drop if ALL values are missing
              return columns.some((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== "");
            }
            // Drop if ANY value is missing
            return columns.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== "");
          });

          affectedCount = rows.length - filtered.length;
          rows = filtered;
          break;
        }

        // 9. Replace Values (Harmonize Inconsistent Categories)
        case "replace_values": {
          const targetCol = step.column;
          const mapping = step.params?.mapping as Record<string, any>;
          if (!targetCol || !columns.includes(targetCol) || !mapping) break;

          for (const r of rows) {
            const current = String(r[targetCol] ?? "").trim();
            if (Object.prototype.hasOwnProperty.call(mapping, current)) {
              r[targetCol] = mapping[current];
              cellsModifiedCount++;
              affectedCount++;
            }
          }
          break;
        }

        // 10. Filter Rows
        case "filter_rows": {
          const targetCol = step.column;
          const op = String(step.params?.operator || "equals");
          const targetVal = step.params?.value;
          if (!targetCol || !columns.includes(targetCol)) break;

          const filtered = rows.filter((r) => {
            const v = r[targetCol];
            switch (op) {
              case "equals":
                return String(v).toLowerCase() === String(targetVal).toLowerCase();
              case "not_equals":
                return String(v).toLowerCase() !== String(targetVal).toLowerCase();
              case "contains":
                return String(v).toLowerCase().includes(String(targetVal).toLowerCase());
              case "greater_than":
                return Number(v) > Number(targetVal);
              case "less_than":
                return Number(v) < Number(targetVal);
              default:
                return true;
            }
          });

          affectedCount = rows.length - filtered.length;
          rows = filtered;
          break;
        }

        // 11. Handle Outliers (IQR Capping)
        case "handle_outliers": {
          const targetCol = step.column;
          if (!targetCol || !columns.includes(targetCol)) break;

          const nums = rows
            .map((r) => r[targetCol])
            .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
            .map(Number)
            .sort((a, b) => a - b);

          if (nums.length >= 8) {
            const q1 = nums[Math.floor(nums.length * 0.25)];
            const q3 = nums[Math.floor(nums.length * 0.75)];
            const iqr = q3 - q1;
            const lowerBound = q1 - 1.5 * iqr;
            const upperBound = q3 + 1.5 * iqr;

            for (const r of rows) {
              const v = Number(r[targetCol]);
              if (!isNaN(v)) {
                if (v < lowerBound) {
                  r[targetCol] = Math.round(lowerBound * 100) / 100;
                  cellsModifiedCount++;
                  affectedCount++;
                } else if (v > upperBound) {
                  r[targetCol] = Math.round(upperBound * 100) / 100;
                  cellsModifiedCount++;
                  affectedCount++;
                }
              }
            }
          }
          break;
        }

        default:
          console.warn(`[Safe Transformer] Skipped unhandled operation: ${step.operation}`);
      }

      appliedSteps.push({
        ...step,
        status: "APPLIED",
        affectedRowsCount: affectedCount,
      });
    } catch (err: any) {
      console.error(`Transformation error on step "${step.operation}":`, err);
      appliedSteps.push({
        ...step,
        status: "FAILED",
        error: err.message || "Execution error",
      });
    }
  }

  const afterRowCount = rows.length;

  return {
    cleanedRows: rows,
    cleanedColumns: columns,
    appliedSteps,
    metrics: {
      beforeRowCount,
      afterRowCount,
      rowsRemovedCount: Math.max(0, beforeRowCount - afterRowCount),
      cellsModifiedCount,
    },
  };
}
