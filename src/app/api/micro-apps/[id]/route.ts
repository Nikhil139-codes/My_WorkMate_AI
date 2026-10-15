import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MicroApp } from "@/lib/db/models/MicroApp";
import { validateAndSanitizeSpec } from "@/lib/micro-apps/specGenerator";
import { logActivity } from "@/lib/workspace/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await connectToDatabase();

    const app = await MicroApp.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    }).lean();

    if (!app) {
      return NextResponse.json({ error: "Micro-App not found" }, { status: 404 });
    }

    return NextResponse.json({
      app: {
        id: (app as any)._id.toString(),
        title: (app as any).title,
        description: (app as any).description,
        slug: (app as any).slug,
        status: (app as any).status,
        category: (app as any).category,
        theme: (app as any).theme,
        fields: (app as any).fields,
        settings: (app as any).settings,
        submissionsCount: (app as any).submissionsCount || 0,
        createdAt: (app as any).createdAt,
        updatedAt: (app as any).updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Get micro-app error:", error);
    return NextResponse.json(
      { error: "Failed to fetch micro-app" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const app = await MicroApp.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!app) {
      return NextResponse.json({ error: "Micro-App not found" }, { status: 404 });
    }

    // Status transition: draft -> published -> expired -> archived
    if (body.status && ["draft", "published", "expired", "archived"].includes(body.status)) {
      app.status = body.status;
    }

    // Update expiration
    if (body.settings?.expiresAt !== undefined) {
      app.settings.expiresAt = body.settings.expiresAt ? new Date(body.settings.expiresAt) : null;
    } else if (body.expiryOption) {
      const now = Date.now();
      switch (body.expiryOption) {
        case "1h":
          app.settings.expiresAt = new Date(now + 1 * 60 * 60 * 1000);
          break;
        case "24h":
          app.settings.expiresAt = new Date(now + 24 * 60 * 60 * 1000);
          break;
        case "7d":
          app.settings.expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          app.settings.expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
          break;
        case "never":
          app.settings.expiresAt = null;
          break;
      }
    }

    // Update fields or full spec if provided
    if (body.fields && Array.isArray(body.fields)) {
      const sanitized = validateAndSanitizeSpec({
        title: body.title || app.title,
        description: body.description || app.description,
        category: body.category || app.category,
        theme: body.theme || app.theme,
        fields: body.fields,
        settings: {
          ...app.settings,
          ...(body.settings || {}),
        },
      });

      app.title = sanitized.title;
      app.description = sanitized.description;
      app.fields = sanitized.fields;
      app.theme = sanitized.theme;
      app.settings.submitButtonText = sanitized.settings.submitButtonText;
      app.settings.successMessage = sanitized.settings.successMessage;
      app.settings.allowMultipleSubmissions = sanitized.settings.allowMultipleSubmissions;
    } else {
      if (body.title) app.title = String(body.title).trim().slice(0, 100);
      if (body.description !== undefined) app.description = String(body.description).trim().slice(0, 500);
    }

    await app.save();

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MICRO_APP_UPDATED",
      resourceType: "APP",
      resourceId: app.id,
      metadata: {
        title: app.title,
        status: app.status,
      },
    });

    return NextResponse.json({
      success: true,
      app: {
        id: app.id,
        title: app.title,
        description: app.description,
        slug: app.slug,
        status: app.status,
        fields: app.fields,
        settings: app.settings,
        updatedAt: app.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Update micro-app error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update micro-app" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await connectToDatabase();

    const app = await MicroApp.findOneAndDelete({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!app) {
      return NextResponse.json({ error: "Micro-App not found" }, { status: 404 });
    }

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MICRO_APP_DELETED",
      resourceType: "APP",
      resourceId: id,
      metadata: { title: app.title, slug: app.slug },
    });

    return NextResponse.json({ success: true, message: "Micro-App deleted" });
  } catch (error: any) {
    console.error("Delete micro-app error:", error);
    return NextResponse.json(
      { error: "Failed to delete micro-app" },
      { status: 500 }
    );
  }
}
