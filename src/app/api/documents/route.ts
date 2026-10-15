import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel } from "@/lib/db/models";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    await connectToDatabase();

    const query: Record<string, any> = {
      workspaceId: session.workspaceId,
    };

    const mediaType = searchParams.get("mediaType")?.trim() || "";
    if (mediaType) {
      if (mediaType === "meeting" || mediaType === "av") {
        query.mediaType = { $in: ["audio", "video"] };
      } else {
        query.mediaType = mediaType;
      }
    }

    if (status && ["PENDING", "PROCESSING", "READY", "FAILED"].includes(status)) {
      query.processingStatus = status;
    }

    if (search) {
      query.originalFilename = { $regex: search, $options: "i" };
    }

    const [total, documents, statusCounts] = await Promise.all([
      DocumentModel.countDocuments(query),
      DocumentModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-extractedText")
        .lean(),
      DocumentModel.aggregate([
        { $match: { workspaceId: session.workspaceId } },
        { $group: { _id: "$processingStatus", count: { $sum: 1 } } },
      ]),
    ]);

    const stats = {
      total: 0,
      ready: 0,
      pending: 0,
      processing: 0,
      failed: 0,
    };

    for (const item of statusCounts) {
      const s = String(item._id).toLowerCase();
      if (s === "ready") stats.ready = item.count;
      else if (s === "pending") stats.pending = item.count;
      else if (s === "processing") stats.processing = item.count;
      else if (s === "failed") stats.failed = item.count;
      stats.total += item.count;
    }

    const formattedDocs = (documents as any[]).map((d) => ({
      id: d._id.toString(),
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      fileSize: d.fileSize,
      pageCount: d.pageCount || 1,
      chunkCount: d.chunkCount || 0,
      processingStatus: d.processingStatus,
      mediaType: d.mediaType || "document",
      transcription: d.transcription,
      mediaMetadata: d.mediaMetadata,
      meetingSynthesis: d.meetingSynthesis,
      purpose: d.purpose,
      onboardingConfig: d.onboardingConfig,
      onboardingSuggestion: d.onboardingSuggestion,
      failureReason: d.failureReason,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    return NextResponse.json({
      documents: formattedDocs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error("List documents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch workspace documents" },
      { status: 500 }
    );
  }
}
