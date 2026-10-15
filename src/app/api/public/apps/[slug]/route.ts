import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MicroApp } from "@/lib/db/models/MicroApp";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;

  if (!slug) {
    return NextResponse.json({ error: "Slug required" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const app = await MicroApp.findOne({ slug: slug.toLowerCase() });

    if (!app) {
      return NextResponse.json({ error: "Micro-App not found" }, { status: 404 });
    }

    // Check expiry
    const now = new Date();
    if (app.settings.expiresAt && app.settings.expiresAt < now) {
      if (app.status === "published") {
        app.status = "expired";
        await app.save();
      }
      return NextResponse.json({
        expired: true,
        title: app.title,
        message: "This disposable micro-app has expired and is no longer accepting submissions.",
      });
    }

    if (app.status !== "published") {
      return NextResponse.json({
        unavailable: true,
        status: app.status,
        title: app.title,
        message:
          app.status === "draft"
            ? "This micro-app is currently in draft mode and has not yet been published."
            : "This micro-app is inactive.",
      });
    }

    return NextResponse.json({
      app: {
        id: app.id,
        title: app.title,
        description: app.description,
        slug: app.slug,
        category: app.category,
        theme: app.theme,
        fields: app.fields,
        settings: {
          submitButtonText: app.settings.submitButtonText,
          successMessage: app.settings.successMessage,
          expiresAt: app.settings.expiresAt,
        },
      },
    });
  } catch (error: any) {
    console.error("Public fetch app error:", error);
    return NextResponse.json(
      { error: "Failed to load micro-app" },
      { status: 500 }
    );
  }
}
