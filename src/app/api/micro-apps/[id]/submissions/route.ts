import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MicroApp } from "@/lib/db/models/MicroApp";
import { MicroAppSubmission } from "@/lib/db/models/MicroAppSubmission";

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

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const [total, submissions] = await Promise.all([
      MicroAppSubmission.countDocuments({ appId: id, workspaceId: session.workspaceId }),
      MicroAppSubmission.find({ appId: id, workspaceId: session.workspaceId })
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({
      app: {
        id: (app as any)._id.toString(),
        title: (app as any).title,
        fields: (app as any).fields,
        status: (app as any).status,
        submissionsCount: total,
      },
      submissions: submissions.map((s: any) => ({
        id: s._id.toString(),
        submittedAt: s.submittedAt,
        data: s.data,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Fetch submissions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
