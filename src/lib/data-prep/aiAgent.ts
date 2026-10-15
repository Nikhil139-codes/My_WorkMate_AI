import { sendGroqChat, isGroqConfigured } from "@/lib/ai/groq";
import { ICleaningPlanStep } from "@/lib/db/models/CleaningJob";
import { IDataProfilingReport, IDatasetColumn } from "@/lib/db/models/Dataset";
import { buildPrivacySafeProfilingSummary } from "./profiler";

export const ALLOWED_OPERATIONS = new Set([
  "remove_duplicates",
  "trim_whitespace",
  "standardize_text",
  "standardize_dates",
  "rename_column",
  "drop_column",
  "fill_missing",
  "drop_missing_rows",
  "replace_values",
  "filter_rows",
  "handle_outliers",
]);

/**
 * Validates that an operation and its parameters conform strictly to the safe allowlist
 */
export function validateCleaningPlanStep(step: any, existingColumns: string[]): ICleaningPlanStep | null {
  if (!step || typeof step !== "object") return null;
  const operation = String(step.operation || "").toLowerCase().trim();

  if (!ALLOWED_OPERATIONS.has(operation)) {
    console.warn(`[Safe Transformer] Disallowed operation rejected: ${operation}`);
    return null;
  }

  const column = step.column ? String(step.column).trim() : undefined;
  const description = String(step.description || `Apply ${operation}`);
  const impact = String(step.impact || "Modifies data deterministically");
  const params = typeof step.params === "object" && step.params !== null ? step.params : {};

  return {
    id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    operation: operation as ICleaningPlanStep["operation"],
    column: column && (existingColumns.includes(column) || operation === "rename_column") ? column : undefined,
    params,
    description,
    impact,
    approved: step.approved !== false,
    status: "PENDING",
    affectedRowsCount: 0,
  };
}

/**
 * Heuristic fallback cleaning plan generator if Groq is not configured or offline
 */
export function generateHeuristicCleaningPlan(
  columns: IDatasetColumn[],
  report: IDataProfilingReport,
  userPrompt?: string | null
): { reasoning: string; plan: ICleaningPlanStep[] } {
  const plan: ICleaningPlanStep[] = [];
  const colNames = columns.map((c) => c.name);

  // 1. Check duplicate rows
  if (report.duplicateRowsCount > 0) {
    plan.push({
      id: `step-${Date.now()}-dup`,
      operation: "remove_duplicates",
      params: { scope: "all" },
      description: `Remove ${report.duplicateRowsCount} duplicate records`,
      impact: `Will eliminate ${report.duplicateRowsCount} duplicate rows while preserving the first unique occurrence.`,
      approved: true,
      status: "PENDING",
    });
  }

  // 2. Trim whitespace across text columns
  plan.push({
    id: `step-${Date.now()}-trim`,
    operation: "trim_whitespace",
    params: { scope: "all_text_columns" },
    description: "Trim leading and trailing whitespace across text fields",
    impact: "Removes invisible whitespace and accidental indentation from all string cells.",
    approved: true,
    status: "PENDING",
  });

  // 3. Normalize Date formats
  for (const col of columns) {
    if (col.inferredType === "date") {
      plan.push({
        id: `step-${Date.now()}-date-${col.name}`,
        operation: "standardize_dates",
        column: col.name,
        params: { targetFormat: "YYYY-MM-DD" },
        description: `Standardize dates in "${col.name}" to ISO (YYYY-MM-DD)`,
        impact: `Parses multi-format date entries into standard YYYY-MM-DD.`,
        approved: true,
        status: "PENDING",
      });
    }
  }

  // 4. Fill missing values for sparse columns
  for (const col of columns) {
    if (col.nullCount > 0 && col.nullCount < report.totalRows) {
      const isNum = col.inferredType === "number";
      plan.push({
        id: `step-${Date.now()}-null-${col.name}`,
        operation: "fill_missing",
        column: col.name,
        params: {
          strategy: isNum ? "median" : "constant",
          value: isNum ? undefined : "Unknown",
        },
        description: isNum
          ? `Fill missing values in "${col.name}" with median`
          : `Fill missing values in "${col.name}" with "Unknown"`,
        impact: `Imputes ${col.nullCount} missing cells without deleting rows.`,
        approved: true,
        status: "PENDING",
      });
    }
  }

  return {
    reasoning: userPrompt
      ? `Generated automated cleaning steps addressing detected quality defects along with your requirements: "${userPrompt}".`
      : "Automated rule-based cleaning plan generated from dataset profiling diagnostics.",
    plan,
  };
}

/**
 * AI Data Cleaning Agent Powered by Gemini API
 */
export async function generateAICleaningPlan(
  filename: string,
  columns: IDatasetColumn[],
  report: IDataProfilingReport,
  userPrompt?: string | null
): Promise<{ reasoning: string; plan: ICleaningPlanStep[] }> {
  const colNames = columns.map((c) => c.name);

  if (!isGroqConfigured()) {
    return generateHeuristicCleaningPlan(columns, report, userPrompt);
  }

  const datasetSummary = buildPrivacySafeProfilingSummary(filename, columns, report);

  const prompt = `You are WorkMate AI's Enterprise Data Preparation & Cleaning Agent.
Your role is to formulate a structured, safe, deterministic data cleaning plan based on dataset profiling and user instructions.

DATASET PROFILE SUMMARY:
${datasetSummary}

USER'S CLEANING INSTRUCTIONS:
"${userPrompt || "Clean and standardize this dataset to maximize data quality and eliminate duplicates, missing values, and formatting defects."}"

ALLOWED TRANSFORMATION OPERATIONS (You must ONLY select from this strict allowlist):
- "remove_duplicates": Deduplicate rows. Params: {"scope": "all" | string[]}
- "trim_whitespace": Trim string spaces. Params: {"scope": "all_text_columns" | string[]}
- "standardize_text": Case formatting. Params: {"casing": "lowercase" | "uppercase" | "titlecase"}
- "standardize_dates": Convert dates to YYYY-MM-DD. Params: {"targetFormat": "YYYY-MM-DD"}
- "rename_column": Rename column. Params: {"newColumnName": string}
- "drop_column": Delete column.
- "fill_missing": Fill nulls. Params: {"strategy": "constant" | "mean" | "median" | "mode", "value"?: any}
- "drop_missing_rows": Drop sparse rows. Params: {"threshold": "any" | "all"}
- "replace_values": Map inconsistent categories. Params: {"mapping": Record<string, string>}
- "filter_rows": Simple filter. Params: {"operator": "equals" | "not_equals" | "contains" | "greater_than" | "less_than", "value": any}
- "handle_outliers": Cap extreme numbers. Params: {"method": "iqr_cap"}

CRITICAL SAFETY RULES:
1. ONLY propose operations from the allowed list above. Never propose arbitrary code, scripts, or formulas.
2. NEVER silently delete rows unless explicitly instructed or handling confirmed duplicates.
3. Explain the exact impact and benefit of each transformation.
4. If the user specifies particular columns or fixes, prioritize their instructions.

Respond ONLY with a valid JSON object matching this schema:
{
  "reasoning": string, // 1-2 sentence executive summary of the cleaning strategy
  "plan": [
    {
      "operation": string, // Must be from allowlist
      "column"?: string, // Name of the target column if column-specific
      "params": object, // Parameters matching operation requirements
      "description": string, // Action summary
      "impact": string // Clear explanation of effect on records
    }
  ]
}

No markdown wrappers or commentary outside JSON.`;

  try {
    const aiResponse = await sendGroqChat({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxTokens: 1500,
    });

    let rawJson = aiResponse.content.trim();
    if (rawJson.startsWith("```")) {
      rawJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(rawJson);
    const candidatePlan = Array.isArray(parsed.plan) ? parsed.plan : [];

    // Filter and sanitize every step against our allowlist
    const validatedSteps: ICleaningPlanStep[] = [];
    for (const step of candidatePlan) {
      const valid = validateCleaningPlanStep(step, colNames);
      if (valid) {
        validatedSteps.push(valid);
      }
    }

    if (validatedSteps.length === 0) {
      return generateHeuristicCleaningPlan(columns, report, userPrompt);
    }

    return {
      reasoning: String(parsed.reasoning || "Cleaning plan formulated based on profiling analysis and user requirements."),
      plan: validatedSteps,
    };
  } catch (error) {
    console.warn("Groq AI cleaning plan generation failed, falling back to heuristics:", error);
    return generateHeuristicCleaningPlan(columns, report, userPrompt);
  }
}
