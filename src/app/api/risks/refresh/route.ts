import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { syncWorkspaceRisks } from "@/lib/risks/riskEngine";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncWorkspaceRisks(session.workspaceId);

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "PROJECT_RISKS_EVALUATED",
      resourceType: "WORKSPACE",
      metadata: {
        overallScore: summary.overallScore,
        healthLevel: summary.healthLevel,
        activeRisksCount: summary.totalRisks - summary.resolvedCount,
      },
    });

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    console.error("Refresh risks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh project risks" },
      { status: 500 }
    );
  }
}
