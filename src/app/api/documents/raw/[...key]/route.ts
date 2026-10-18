import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/lib/storage";

/**
 * GET /api/documents/raw/[...key]
 * Securely serves raw document/media assets from the configured storage provider (Local or GCS).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key: keyParts } = await context.params;
    const storageKey = keyParts.join("/");

    // Enforce workspace isolation: storage key must start with the user's workspaceId
    if (!storageKey.startsWith(session.workspaceId)) {
      return NextResponse.json(
        { error: "Forbidden: Access to resources outside workspace is not permitted" },
        { status: 403 }
      );
    }

    const fileBuffer = await storage.getFile(storageKey);
    if (!fileBuffer) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    const filename = storageKey.split("/").pop() || "download";
    const ext = filename.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";

    if (ext === "pdf") contentType = "application/pdf";
    else if (ext === "csv") contentType = "text/csv";
    else if (ext === "png") contentType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "webp") contentType = "image/webp";
    else if (ext === "mp3") contentType = "audio/mpeg";
    else if (ext === "wav") contentType = "audio/wav";
    else if (ext === "mp4") contentType = "video/mp4";
    else if (ext === "webm") contentType = "video/webm";
    else if (ext === "docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/documents/raw] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
