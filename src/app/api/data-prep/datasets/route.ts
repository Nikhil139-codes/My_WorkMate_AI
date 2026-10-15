import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Dataset } from "@/lib/db/models/Dataset";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    const query: Record<string, any> = {
      workspaceId: session.workspaceId,
    };

    if (search) {
      query.originalFilename = { $regex: search, $options: "i" };
    }

    const [total, datasets, statsAgg] = await Promise.all([
      Dataset.countDocuments(query),
      Dataset.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Dataset.aggregate([
        { $match: { workspaceId: session.workspaceId } },
        {
          $group: {
            _id: null,
            totalRows: { $sum: "$rowCount" },
            cleanedCount: {
              $sum: { $cond: [{ $eq: ["$status", "CLEANED"] }, 1, 0] },
            },
            avgQualityScore: { $avg: "$profilingReport.qualityScore" },
          },
        },
      ]),
    ]);

    const stats = {
      totalDatasets: total,
      totalRows: statsAgg[0]?.totalRows || 0,
      cleanedCount: statsAgg[0]?.cleanedCount || 0,
      avgQualityScore: Math.round(statsAgg[0]?.avgQualityScore || 0),
    };

    return NextResponse.json({
      datasets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error("List datasets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace datasets" },
      { status: 500 }
    );
  }
}
