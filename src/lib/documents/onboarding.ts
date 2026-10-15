import { sendGroqChat, isGroqConfigured } from "@/lib/ai/groq";
import { z } from "zod";

export interface OnboardingSuggestion {
  documentType: string;
  department: string;
  chunkingStrategy: "paragraph-semantic" | "page-level" | "tabular-fixed";
  chunkSize: number;
  chunkOverlap: number;
  sensitivityLabel: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  validationRules: string[];
  suggestedTags: string[];
  summary: string;
  reasoning: string;
}

export const onboardingApprovalSchema = z.object({
  documentType: z.string().min(1).max(100).default("General Document"),
  department: z.string().min(1).max(100).default("General"),
  chunkingStrategy: z.enum(["paragraph-semantic", "page-level", "tabular-fixed"]).default("paragraph-semantic"),
  chunkSize: z.number().int().min(100).max(4000).default(600),
  chunkOverlap: z.number().int().min(0).max(1000).default(100),
  sensitivityLabel: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).default("INTERNAL"),
  validationRules: z.array(z.string().max(200)).default([]),
  tags: z.array(z.string().max(50)).default([]),
  summary: z.string().max(1000).optional(),
});

export type OnboardingApprovalInput = z.infer<typeof onboardingApprovalSchema>;

/**
 * Generates heuristic fallback proposal if Groq is not configured
 */
function generateFallbackSuggestion(
  filename: string,
  purpose?: string | null
): OnboardingSuggestion {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let docType = "General Document";
  let strategy: "paragraph-semantic" | "page-level" | "tabular-fixed" = "paragraph-semantic";
  let sensitivity: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" = "INTERNAL";
  const tags: string[] = [ext.toUpperCase()];

  if (ext === "csv") {
    docType = "Tabular Dataset";
    strategy = "tabular-fixed";
  } else if (filename.toLowerCase().includes("invoice") || filename.toLowerCase().includes("budget") || filename.toLowerCase().includes("finance")) {
    docType = "Financial Record";
    sensitivity = "CONFIDENTIAL";
    tags.push("Finance");
  } else if (filename.toLowerCase().includes("contract") || filename.toLowerCase().includes("agreement") || filename.toLowerCase().includes("nda")) {
    docType = "Legal Agreement";
    sensitivity = "RESTRICTED";
    tags.push("Legal");
  } else if (filename.toLowerCase().includes("policy") || filename.toLowerCase().includes("handbook")) {
    docType = "Company Policy";
    tags.push("HR", "Governance");
  }

  return {
    documentType: docType,
    department: tags[1] || "Operations",
    chunkingStrategy: strategy,
    chunkSize: strategy === "tabular-fixed" ? 800 : 600,
    chunkOverlap: 100,
    sensitivityLabel: sensitivity,
    validationRules: [
      "Verify source origin before publishing",
      "Retain document revision history",
    ],
    suggestedTags: tags,
    summary: purpose
      ? `Uploaded for purpose: "${purpose}". Document format is ${ext.toUpperCase()}.`
      : `Document ${filename} analyzed and pre-configured for workspace indexing.`,
    reasoning: "Rule-based analysis derived from file type, naming patterns, and declared user purpose.",
  };
}

/**
 * Uses Groq API to analyze document content, purpose, and recommend onboarding configuration
 */
export async function generateOnboardingSuggestion(
  filename: string,
  sampleText: string,
  purpose?: string | null
): Promise<OnboardingSuggestion> {
  if (!isGroqConfigured()) {
    return generateFallbackSuggestion(filename, purpose);
  }

  const excerpt = sampleText.substring(0, 3500);

  const prompt = `You are the WorkMate AI Document Onboarding Agent.
Analyze this document to recommend optimal enterprise ingestion and RAG parameters.

Document Filename: "${filename}"
User-Stated Purpose: "${purpose || "General organizational knowledge"}"
Document Sample Excerpt:
"""
${excerpt}
"""

Respond ONLY with a valid JSON object matching this exact schema:
{
  "documentType": string, // e.g. "Financial Report", "Contract", "Technical Specification", "HR Policy", "Meeting Minutes"
  "department": string, // e.g. "Finance", "Legal", "Engineering", "HR", "Operations"
  "chunkingStrategy": "paragraph-semantic" | "page-level" | "tabular-fixed",
  "chunkSize": number, // Recommended chunk character length between 400 and 1200
  "chunkOverlap": number, // Recommended overlap between 50 and 200
  "sensitivityLabel": "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED",
  "validationRules": string[], // List of 2-4 validation rules (e.g. "Mask PII before export", "Verify signer signatures")
  "suggestedTags": string[], // 3-6 relevant tags
  "summary": string, // 2-3 sentence executive summary of the content
  "reasoning": string // 1-2 sentence explanation of why this chunking & sensitivity was chosen
}

Strict requirements: Return raw JSON only, without markdown backticks or commentary.`;

  try {
    const aiResponse = await sendGroqChat({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      maxTokens: 1024,
    });

    let rawJson = aiResponse.content.trim();
    // Strip markdown code fences if model returned them
    if (rawJson.startsWith("```")) {
      rawJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(rawJson);

    return {
      documentType: String(parsed.documentType || "General Document"),
      department: String(parsed.department || "General"),
      chunkingStrategy:
        ["paragraph-semantic", "page-level", "tabular-fixed"].includes(parsed.chunkingStrategy)
          ? parsed.chunkingStrategy
          : "paragraph-semantic",
      chunkSize: Math.max(200, Math.min(2000, Number(parsed.chunkSize) || 600)),
      chunkOverlap: Math.max(0, Math.min(500, Number(parsed.chunkOverlap) || 100)),
      sensitivityLabel:
        ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"].includes(parsed.sensitivityLabel)
          ? parsed.sensitivityLabel
          : "INTERNAL",
      validationRules: Array.isArray(parsed.validationRules)
        ? parsed.validationRules.map(String)
        : ["Validate document integrity"],
      suggestedTags: Array.isArray(parsed.suggestedTags)
        ? parsed.suggestedTags.map(String)
        : [filename.split(".").pop()?.toUpperCase() || "DOC"],
      summary: String(parsed.summary || `Document ${filename}`),
      reasoning: String(parsed.reasoning || "Configured based on content semantics."),
    };
  } catch (error) {
    console.warn("AI Onboarding Agent prompt failed or returned invalid JSON, using fallback:", error);
    return generateFallbackSuggestion(filename, purpose);
  }
}
