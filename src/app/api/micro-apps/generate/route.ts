import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { generateAppSpecification } from "@/lib/micro-apps/specGenerator";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return NextResponse.json(
      { error: "Please provide a valid prompt describing the micro-app you need." },
      { status: 400 }
    );
  }

  try {
    const spec = await generateAppSpecification(prompt.trim());
    return NextResponse.json({
      success: true,
      specification: spec,
    });
  } catch (error: any) {
    console.error("Micro-App generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate micro-app specification" },
      { status: 500 }
    );
  }
}
