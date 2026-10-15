import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db/mongodb";
import { isGroqConfigured, DEFAULT_GROQ_MODEL } from "@/lib/ai/groq";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbStatus = await checkDatabaseConnection();
  const groqConfigured = isGroqConfigured();

  const isHealthy = dbStatus.connected && groqConfigured;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        application: {
          status: "online",
          version: "1.0.0-phase1",
          environment: process.env.NODE_ENV || "development",
        },
        database: {
          type: "MongoDB",
          status: dbStatus.connected ? "connected" : "disconnected",
          latencyMs: dbStatus.latencyMs,
          error: dbStatus.connected ? undefined : dbStatus.error,
        },
        aiProvider: {
          provider: "Groq",
          status: groqConfigured ? "configured" : "missing_api_key",
          defaultModel: DEFAULT_GROQ_MODEL,
        },
      },
    },
    { status: dbStatus.connected ? 200 : 503 }
  );
}
