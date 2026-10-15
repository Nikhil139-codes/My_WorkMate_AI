import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MicroApp } from "@/lib/db/models/MicroApp";
import { MicroAppSubmission } from "@/lib/db/models/MicroAppSubmission";
import { serializeSubmissionsToCSV } from "@/lib/micro-apps/validator";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;

  try {
    await connectToDatabase();

    const app = await MicroApp.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    }).lean();

    if (!app) {
      return new NextResponse("Micro-App not found", { status: 404 });
    }

    const submissions = await MicroAppSubmission.find({
      appId: id,
      workspaceId: session.workspaceId,
    })
      .sort({ submittedAt: -1 })
      .lean();

    const formattedSubs = submissions.map((s: any) => ({
      id: s._id.toString(),
      submittedAt: s.submittedAt,
      data: s.data,
    }));

    const csvContent = serializeSubmissionsToCSV((app as any).fields, formattedSubs);
    const filename = `${((app as any).slug || "micro-app")}-submissions.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Export submissions CSV error:", error);
    return new NextResponse("Failed to export submissions", { status: 500 });
  }
}
