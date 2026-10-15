import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MicroApp } from "@/lib/db/models/MicroApp";
import { MicroAppSubmission } from "@/lib/db/models/MicroAppSubmission";
import { validateSubmission } from "@/lib/micro-apps/validator";
import crypto from "crypto";

// In-memory rate limiting map: ipHash -> timestamps[]
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ipHash: string, maxRequests = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ipHash) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(ipHash, validTimestamps);
  return true;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  // Compute IP hash for anonymous rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);

  if (!checkRateLimit(ipHash)) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const app = await MicroApp.findOne({ slug: slug.toLowerCase() });

    if (!app) {
      return NextResponse.json({ error: "Micro-App not found" }, { status: 404 });
    }

    // Expiry check
    const now = new Date();
    if (app.settings.expiresAt && app.settings.expiresAt < now) {
      if (app.status === "published") {
        app.status = "expired";
        await app.save();
      }
      return NextResponse.json(
        { error: "This micro-app has expired and is no longer accepting responses." },
        { status: 410 }
      );
    }

    if (app.status !== "published") {
      return NextResponse.json(
        { error: "This micro-app is not currently published." },
        { status: 403 }
      );
    }

    // Validate fields against schema
    const validation = validateSubmission(app, body.data || body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed. Please correct the highlighted fields.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Persist submission
    const submission = await MicroAppSubmission.create({
      appId: app.id,
      workspaceId: app.workspaceId,
      data: validation.sanitizedData,
      submittedAt: new Date(),
      ipHash,
      userAgent: req.headers.get("user-agent") || undefined,
      retentionStatus: "active",
    });

    // Increment submissions count on app
    app.submissionsCount = (app.submissionsCount || 0) + 1;
    await app.save();

    return NextResponse.json(
      {
        success: true,
        submissionId: submission.id,
        message: app.settings.successMessage || "Thank you! Your submission has been recorded.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Public submission error:", error);
    return NextResponse.json(
      { error: "Failed to record submission. Please try again." },
      { status: 500 }
    );
  }
}
