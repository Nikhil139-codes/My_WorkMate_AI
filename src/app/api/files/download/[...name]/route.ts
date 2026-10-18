import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";

/**
 * GET /api/files/download/[...name]
 * Directly implements Section 3.2 Download endpoint.
 * Streams object from GCS bucket with Content-Disposition header.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ name: string[] }> }
) {
  try {
    const { name: nameParts } = await context.params;
    const rawName = nameParts.join("/");

    // Check with 'uploads/' prefix, or as rawName directly
    let file = bucket.file("uploads/" + rawName);
    let [exists] = await file.exists();

    if (!exists) {
      file = bucket.file(rawName);
      [exists] = await file.exists();
    }

    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const [fileBuffer] = await file.download();

    const filename = rawName.split("/").pop() || "download";
    const contentType = metadata.contentType || "application/octet-stream";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/files/download] Download failed:", err);
    return NextResponse.json(
      { error: "Download failed", details: err.message },
      { status: 500 }
    );
  }
}
