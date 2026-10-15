import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ProjectRisk } from "@/lib/db/models/ProjectRisk";
import { syncWorkspaceRisks } from "@/lib/risks/riskEngine";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get("status"); // "ALL", "ACTIVE", "ACKNOWLEDGED", "RESOLVED"
    const severityParam = searchParams.get("severity"); // "ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"
    const categoryParam = searchParams.get("category");
    const query = searchParams.get("query") || "";

    // Sync risks for this workspace
    const summary = await syncWorkspaceRisks(session.workspaceId);

    // Apply filters
    let risks = await ProjectRisk.find({ workspaceId: session.workspaceId }).sort({
      score: -1,
      createdAt: -1,
    });

    if (statusParam && statusParam !== "ALL") {
      if (statusParam === "ACTIVE") {
        risks = risks.filter((r) => r.status !== "RESOLVED");
      } else {
        risks = risks.filter((r) => r.status === statusParam);
      }
    }

    if (severityParam && severityParam !== "ALL") {
      risks = risks.filter((r) => r.severity === severityParam);
    }

    if (categoryParam && categoryParam !== "ALL") {
      risks = risks.filter((r) => r.category === categoryParam);
    }

    if (query) {
      const q = query.toLowerCase();
      risks = risks.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.contributingFactors.some((f) => f.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({
      summary: {
        overallScore: summary.overallScore,
        healthLevel: summary.healthLevel,
        totalRisks: summary.totalRisks,
        criticalCount: summary.criticalCount,
        highCount: summary.highCount,
        mediumCount: summary.mediumCount,
        lowCount: summary.lowCount,
        acknowledgedCount: summary.acknowledgedCount,
        resolvedCount: summary.resolvedCount,
        evaluatedAt: summary.evaluatedAt,
      },
      risks: risks.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        severity: r.severity,
        score: r.score,
        contributingFactors: r.contributingFactors,
        evidence: r.evidence,
        affectedTaskIds: r.affectedTaskIds,
        affectedMeetingIds: r.affectedMeetingIds,
        status: r.status,
        mitigationNotes: r.mitigationNotes || [],
        history: r.history || [],
        lastEvaluatedAt: r.lastEvaluatedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("List risks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load project risks" },
      { status: 500 }
    );
  }
}
