import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ProjectRisk } from "@/lib/db/models/ProjectRisk";
import { generateGroqRiskRecommendations } from "@/lib/risks/riskEngine";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const risks = await ProjectRisk.find({
      workspaceId: session.workspaceId,
      status: { $ne: "RESOLVED" },
    }).sort({ score: -1 }).limit(10);

    const recommendations = await generateGroqRiskRecommendations(risks);

    return NextResponse.json({
      success: true,
      recommendations,
      disclaimer: "AI recommendations are advisory suggestions to support decision making. All task assignments, status changes, and deadline adjustments require human confirmation.",
    });
  } catch (error: any) {
    console.error("Get recommendations error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate risk recommendations" },
      { status: 500 }
    );
  }
}
