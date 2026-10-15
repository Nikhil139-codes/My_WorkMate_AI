import { sendGroqChat } from "@/lib/ai/groq";
import { IMicroAppField } from "@/lib/db/models/MicroApp";

export const ALLOWED_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "number",
  "select",
  "checkbox",
  "multiselect",
  "date",
  "rating",
] as const;

export type AllowedFieldType = (typeof ALLOWED_FIELD_TYPES)[number];

export interface GeneratedAppSpec {
  title: string;
  description: string;
  category: "survey" | "feedback" | "registration" | "request" | "tracker" | "custom";
  theme: {
    primaryColor: string;
    backgroundColor: string;
    layout: "card" | "full";
  };
  fields: IMicroAppField[];
  settings: {
    submitButtonText: string;
    successMessage: string;
    allowMultipleSubmissions: boolean;
    requireAuth: boolean;
    suggestedExpiryHours?: number;
  };
}

/**
 * Generate a slug from title and short random id
 */
export function generateAppSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${base || "app"}-${randomSuffix}`;
}

/**
 * Sanitize text to prevent HTML injection in preview/render
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

/**
 * Validates and strictly sanitizes an AI-generated or user-provided app specification.
 * Throws an error if unsupported component types or illegal patterns are found.
 */
export function validateAndSanitizeSpec(spec: any): GeneratedAppSpec {
  if (!spec || typeof spec !== "object") {
    throw new Error("Invalid app specification payload: must be an object.");
  }

  const title = sanitizeText(String(spec.title || "Untitled Micro-App")).slice(0, 100);
  const description = sanitizeText(String(spec.description || "")).slice(0, 500);

  const validCategories = ["survey", "feedback", "registration", "request", "tracker", "custom"];
  const category = validCategories.includes(spec.category) ? spec.category : "custom";

  if (!Array.isArray(spec.fields) || spec.fields.length === 0) {
    throw new Error("App specification must define at least one field.");
  }

  if (spec.fields.length > 25) {
    throw new Error("App specification cannot exceed 25 fields.");
  }

  const seenIds = new Set<string>();
  const sanitizedFields: IMicroAppField[] = spec.fields.map((f: any, idx: number) => {
    let rawId = String(f.id || `fld_${idx + 1}`)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .slice(0, 32);

    if (seenIds.has(rawId) || !rawId) {
      rawId = `fld_${idx + 1}_${Math.random().toString(36).substring(2, 5)}`;
    }
    seenIds.add(rawId);

    const rawType = String(f.type || "text").toLowerCase() as AllowedFieldType;
    if (!ALLOWED_FIELD_TYPES.includes(rawType)) {
      throw new Error(
        `Security validation failed: Field "${f.label || rawId}" has unsupported or disallowed component type "${f.type}".`
      );
    }

    const label = sanitizeText(String(f.label || `Field ${idx + 1}`)).slice(0, 100);
    const placeholder = f.placeholder ? sanitizeText(String(f.placeholder)).slice(0, 100) : "";
    const helpText = f.helpText ? sanitizeText(String(f.helpText)).slice(0, 200) : "";
    const required = Boolean(f.required);

    let options: string[] | undefined = undefined;
    if (["select", "multiselect"].includes(rawType)) {
      if (Array.isArray(f.options) && f.options.length > 0) {
        options = f.options.map((opt: any) => sanitizeText(String(opt)).slice(0, 60)).slice(0, 20);
      } else {
        options = ["Option 1", "Option 2", "Option 3"];
      }
    }

    let validation: any = undefined;
    if (f.validation && typeof f.validation === "object") {
      validation = {};
      if (typeof f.validation.min === "number") validation.min = f.validation.min;
      if (typeof f.validation.max === "number") validation.max = f.validation.max;
      if (typeof f.validation.minLength === "number") validation.minLength = Math.max(0, f.validation.minLength);
      if (typeof f.validation.maxLength === "number") validation.maxLength = Math.min(2000, f.validation.maxLength);
    }

    return {
      id: rawId,
      label,
      type: rawType,
      placeholder,
      helpText,
      required,
      options,
      validation,
      defaultValue: f.defaultValue,
    };
  });

  const primaryColor = /^#[0-9A-Fa-f]{6}$/.test(spec.theme?.primaryColor)
    ? spec.theme.primaryColor
    : "#4F46E5";

  return {
    title: title || "New Micro-App",
    description,
    category,
    theme: {
      primaryColor,
      backgroundColor: spec.theme?.backgroundColor || "#F8FAFC",
      layout: spec.theme?.layout === "full" ? "full" : "card",
    },
    fields: sanitizedFields,
    settings: {
      submitButtonText: sanitizeText(String(spec.settings?.submitButtonText || "Submit")).slice(0, 30),
      successMessage: sanitizeText(
        String(spec.settings?.successMessage || "Thank you! Your response has been recorded.")
      ).slice(0, 200),
      allowMultipleSubmissions: spec.settings?.allowMultipleSubmissions ?? true,
      requireAuth: Boolean(spec.settings?.requireAuth),
      suggestedExpiryHours:
        typeof spec.settings?.suggestedExpiryHours === "number"
          ? Math.max(1, Math.min(720, spec.settings.suggestedExpiryHours))
          : 168, // 7 days default
    },
  };
}

/**
 * Use Groq LLM to generate a structured micro-app specification from natural language.
 */
export async function generateAppSpecification(prompt: string): Promise<GeneratedAppSpec> {
  const systemPrompt = `You are WorkMate AI's Micro-App Architect.
Generate an interactive, safe mini-application specification from the user's description.

Allowed Field Types ONLY:
- "text": Single line text
- "textarea": Multiline text
- "email": Validated email address
- "number": Numeric input
- "select": Single selection dropdown (must provide 'options' array)
- "checkbox": Single boolean toggle
- "multiselect": Multiple choices from 'options' array
- "date": Date picker
- "rating": 1 to 5 star rating

CRITICAL SAFETY RULES:
1. Do NOT include arbitrary HTML, scripts, eval, or code.
2. Only use the allowed field types listed above.
3. Every field must have a distinct, snake_case 'id' (e.g., 'full_name', 'satisfaction_rating').
4. Return strictly a JSON object with this exact schema:
{
  "title": "Clean, descriptive app title",
  "description": "Short explanation of the form/app",
  "category": "survey" | "feedback" | "registration" | "request" | "tracker" | "custom",
  "theme": {
    "primaryColor": "#4F46E5",
    "backgroundColor": "#F8FAFC",
    "layout": "card"
  },
  "fields": [
    {
      "id": "field_name",
      "label": "Human Label",
      "type": "text" | "textarea" | "email" | "number" | "select" | "checkbox" | "multiselect" | "date" | "rating",
      "placeholder": "Helpful placeholder",
      "required": true,
      "helpText": "Optional guidance",
      "options": ["Option 1", "Option 2"] // only for select / multiselect
    }
  ],
  "settings": {
    "submitButtonText": "Submit Feedback",
    "successMessage": "Thank you! Your feedback has been recorded.",
    "allowMultipleSubmissions": true,
    "requireAuth": false,
    "suggestedExpiryHours": 168
  }
}
Return ONLY valid JSON without markdown tags or commentary.`;

  const userPrompt = `User Request: "${prompt}"

Generate the complete JSON micro-app specification:`;

  const response = await sendGroqChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  let rawJson: any;
  try {
    const cleaned = response.content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    rawJson = JSON.parse(cleaned);
  } catch (err: any) {
    throw new Error(`Failed to parse AI generated app specification: ${err.message}`);
  }

  return validateAndSanitizeSpec(rawJson);
}
