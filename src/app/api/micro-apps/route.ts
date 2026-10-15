import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MicroApp } from "@/lib/db/models/MicroApp";
import { generateAppSlug, validateAndSanitizeSpec } from "@/lib/micro-apps/specGenerator";
import { logActivity } from "@/lib/workspace/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  try {
    await connectToDatabase();

    // Auto-expire apps that passed their expiration timestamp
    const now = new Date();
    await MicroApp.updateMany(
      {
        workspaceId: session.workspaceId,
        status: "published",
        "settings.expiresAt": { $ne: null, $lt: now },
      },
      { $set: { status: "expired" } }
    );

    const query: Record<string, any> = { workspaceId: session.workspaceId };

    if (status && ["draft", "published", "expired", "archived"].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const apps = await MicroApp.find(query).sort({ createdAt: -1 }).lean();

    const counts = await MicroApp.aggregate([
      { $match: { workspaceId: session.workspaceId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const stats = {
      total: apps.length,
      published: 0,
      draft: 0,
      expired: 0,
      archived: 0,
      totalSubmissions: 0,
    };

    for (const c of counts) {
      const s = String(c._id);
      if (s === "published") stats.published = c.count;
      if (s === "draft") stats.draft = c.count;
      if (s === "expired") stats.expired = c.count;
      if (s === "archived") stats.archived = c.count;
    }

    stats.totalSubmissions = apps.reduce((acc, a: any) => acc + (a.submissionsCount || 0), 0);

    return NextResponse.json({
      apps: apps.map((a: any) => ({
        id: a._id.toString(),
        title: a.title,
        description: a.description,
        slug: a.slug,
        status: a.status,
        category: a.category,
        theme: a.theme,
        fieldsCount: a.fields?.length || 0,
        fields: a.fields,
        settings: a.settings,
        submissionsCount: a.submissionsCount || 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      stats,
    });
  } catch (error: any) {
    console.error("List micro-apps error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list micro-apps" },
      { status: 500 }
    );
  }
}

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

  try {
    await connectToDatabase();

    // Validate and sanitize the specification
    const sanitized = validateAndSanitizeSpec(body);

    const slug = body.slug ? generateAppSlug(body.slug) : generateAppSlug(sanitized.title);

    let expiresAt: Date | null = null;
    if (body.settings?.expiresAt) {
      expiresAt = new Date(body.settings.expiresAt);
    } else if (body.expiryOption) {
      const now = Date.now();
      switch (body.expiryOption) {
        case "1h":
          expiresAt = new Date(now + 1 * 60 * 60 * 1000);
          break;
        case "24h":
          expiresAt = new Date(now + 24 * 60 * 60 * 1000);
          break;
        case "7d":
          expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000);
          break;
        case "never":
        default:
          expiresAt = null;
          break;
      }
    } else if (sanitized.settings?.suggestedExpiryHours) {
      expiresAt = new Date(Date.now() + sanitized.settings.suggestedExpiryHours * 60 * 60 * 1000);
    }

    const app = await MicroApp.create({
      workspaceId: session.workspaceId,
      createdByUserId: session.userId,
      title: sanitized.title,
      description: sanitized.description,
      slug,
      status: body.publishImmediately ? "published" : "draft",
      category: sanitized.category,
      theme: sanitized.theme,
      fields: sanitized.fields,
      settings: {
        ...sanitized.settings,
        expiresAt,
      },
      submissionsCount: 0,
    });

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "MICRO_APP_CREATED",
      resourceType: "APP",
      resourceId: app.id,
      metadata: {
        title: app.title,
        slug: app.slug,
        fieldsCount: app.fields.length,
        status: app.status,
      },
    });

    return NextResponse.json(
      {
        success: true,
        app: {
          id: app.id,
          title: app.title,
          description: app.description,
          slug: app.slug,
          status: app.status,
          category: app.category,
          theme: app.theme,
          fields: app.fields,
          settings: app.settings,
          createdAt: app.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create micro-app error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create micro-app" },
      { status: 400 }
    );
  }
}
