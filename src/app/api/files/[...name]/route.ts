import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";

/**
 * DELETE /api/files/[...name]
 * Directly implements Section 3.2 Delete endpoint.
 * Deletes object from GCS bucket.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ name: string[] }> }
) {
  try {
    const { name: nameParts } = await context.params;
    const rawName = nameParts.join("/");

    let file = bucket.file("uploads/" + rawName);
    let [exists] = await file.exists();

    if (!exists) {
      file = bucket.file(rawName);
      [exists] = await file.exists();
    }

    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    await file.delete();
    return NextResponse.json({ deleted: rawName });
  } catch (err: any) {
    console.error("[DELETE /api/files/[...name]] Delete failed:", err);
    return NextResponse.json(
      { error: "Delete failed", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/files/[...name]
 * Retrieves file from GCS or returns signed URL / preview.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ name: string[] }> }
) {
  try {
    const { name: nameParts } = await context.params;
    const rawName = nameParts.join("/");

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

    const filename = rawName.split("/").pop() || "file";
    const contentType = metadata.contentType || "application/octet-stream";

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(fileBuffer.length),
      },
    });
  } catch (err: any) {
    console.error("[GET /api/files/[...name]] Failed:", err);
    return NextResponse.json(
      { error: "Failed to retrieve file", details: err.message },
      { status: 500 }
    );
  }
}
