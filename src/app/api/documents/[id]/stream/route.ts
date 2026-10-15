/**
 * Media streaming endpoint with HTTP Range request support.
 *
 * GET /api/documents/[id]/stream
 *
 * Streams the raw media file from storage with proper HTTP 206 Partial Content
 * support so browser <video> and <audio> elements can seek without downloading
 * the entire file.
 *
 * Security:
 * - Requires authenticated session
 * - Enforces workspace isolation (document must belong to user's workspace)
 * - Only serves image, audio, and video files (documents use /download)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel } from "@/lib/db/models";
import { storage } from "@/lib/storage";

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

    const doc = await DocumentModel.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    }).lean();

    if (!doc) {
      return new NextResponse("Not found", { status: 404 });
    }

    const fileBuffer = await storage.getFile((doc as any).storageKey);
    if (!fileBuffer) {
      return new NextResponse("File not found in storage", { status: 404 });
    }

    const mimeType = (doc as any).mimeType || "application/octet-stream";
    const totalBytes = fileBuffer.length;
    const rangeHeader = req.headers.get("range");

    if (!rangeHeader) {
      // Return full file
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(totalBytes),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Parse Range header: "bytes=START-END"
    const rangeMatch = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!rangeMatch) {
      return new NextResponse("Invalid Range header", {
        status: 416,
        headers: { "Content-Range": `bytes */${totalBytes}` },
      });
    }

    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];

    let start = startStr ? parseInt(startStr, 10) : 0;
    let end = endStr ? parseInt(endStr, 10) : totalBytes - 1;

    // Clamp
    start = Math.max(0, Math.min(start, totalBytes - 1));
    end = Math.max(start, Math.min(end, totalBytes - 1));

    const chunkLength = end - start + 1;
    const chunk = fileBuffer.slice(start, end + 1);

    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": mimeType,
        "Content-Range": `bytes ${start}-${end}/${totalBytes}`,
        "Content-Length": String(chunkLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[stream] Error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
