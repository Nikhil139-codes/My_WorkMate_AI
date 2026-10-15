import Groq from "groq-sdk";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  response_format?: { type: "json_object" | "text" };
}

export interface GroqChatResult {
  content: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export class GroqServiceError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = "GROQ_ERROR") {
    super(message);
    this.name = "GroqServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Strip surrounding quotes in case the env value was accidentally quoted
const RAW_GROQ_MODEL = (process.env.GROQ_MODEL || "openai/gpt-oss-120b")
  .trim()
  .replace(/^["']|["']$/g, "");

export const DEFAULT_GROQ_MODEL = RAW_GROQ_MODEL || "openai/gpt-oss-120b";
export const FALLBACK_GROQ_MODEL = "openai/gpt-oss-20b";


const DEFAULT_SYSTEM_PROMPT =
  "You are WorkMate AI, an intelligent enterprise workspace assistant. " +
  "You help users synthesize knowledge, write professional correspondence, brainstorm, analyze data, and clarify workflows. " +
  "Provide direct, high-value, structured answers.";

export function isGroqConfigured(): boolean {
  const key = process.env.GROQ_API_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes("your-key-here"));
}

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new GroqServiceError(
      "Gemini API key is not configured. Please add GROQ_API_KEY to your environment variables or .env file.",
      503,
      "GROQ_KEY_MISSING"
    );
  }
  return new Groq({ apiKey });
}

export async function sendGroqChat(
  options: GroqChatOptions
): Promise<GroqChatResult> {
  const client = getGroqClient();
  // Clean up model name (remove accidental quotes)
  const selectedModel = (options.model || DEFAULT_GROQ_MODEL)
    .trim()
    .replace(/^["']|["']$/g, "");
  const timeoutMs = options.timeoutMs || 60000;

  /**
   * CRITICAL: Preserve caller-provided system messages.
   * The RAG engine sends its own detailed system prompt containing document excerpts.
   * If we override it, all document context is lost and the AI answers from general knowledge.
   *
   * Rules:
   * - If messages already contain a system message → use them as-is.
   * - If no system message is present → inject the default WorkMate AI persona.
   */
  const hasSystemMessage = options.messages.some((m) => m.role === "system");
  const finalMessages: ChatMessage[] = hasSystemMessage
    ? options.messages
    : [{ role: "system", content: DEFAULT_SYSTEM_PROMPT }, ...options.messages];

  const attemptChat = async (model: string): Promise<GroqChatResult> => {
    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

      const completion = await client.chat.completions.create(
        {
          model,
          messages: finalMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options.temperature ?? 0.7,
          max_completion_tokens: options.maxTokens ?? 2048,
          response_format: options.response_format,
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutHandle);

      const choice = completion.choices[0];
      const text = choice?.message?.content || "";

      return {
        content: text,
        model: completion.model || model,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      };
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        throw new GroqServiceError(
          "Request to Gemini API timed out. Please try again.",
          504,
          "GROQ_TIMEOUT"
        );
      }

      const status = err?.status || err?.statusCode || 500;
      const errorMessage =
        err?.message || "Unknown error communicating with Gemini API";

      if (status === 401 || errorMessage.toLowerCase().includes("api key")) {
        throw new GroqServiceError(
          "Invalid or unauthorized Gemini API key.",
          401,
          "GROQ_INVALID_KEY"
        );
      }

      if (
        status === 429 ||
        errorMessage.toLowerCase().includes("rate limit")
      ) {
        throw new GroqServiceError(
          "Groq rate limit reached. Please wait a moment before sending another query.",
          429,
          "GROQ_RATE_LIMITED"
        );
      }

      // Model not found on Groq — retry with known-good fallback once
      if (
        status === 404 ||
        errorMessage.toLowerCase().includes("model") ||
        errorMessage.toLowerCase().includes("not found")
      ) {
        if (model === FALLBACK_GROQ_MODEL) {
          throw new GroqServiceError(
            `Both primary model "${selectedModel}" and fallback model "${FALLBACK_GROQ_MODEL}" are unavailable on Groq. Please check your GROQ_MODEL setting.`,
            400,
            "GROQ_INVALID_MODEL"
          );
        }
        console.warn(
          `[WorkMate AI] Model "${model}" not found on Groq. Retrying with fallback "${FALLBACK_GROQ_MODEL}"...`
        );
        return attemptChat(FALLBACK_GROQ_MODEL);
      }

      throw new GroqServiceError(
        `Groq AI provider error: ${errorMessage.replace(
          /Bearer\s+[a-zA-Z0-9_\-]+/gi,
          "[REDACTED]"
        )}`,
        status,
        "GROQ_API_ERROR"
      );
    }
  };

  return attemptChat(selectedModel);
}
