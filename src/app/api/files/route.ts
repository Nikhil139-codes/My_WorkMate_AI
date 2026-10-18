import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";

/**
 * GET /api/files
 * List files in the GCS bucket under 'uploads/' prefix (or custom prefix query param).
 * Directly implements Section 3.2 of the integration guide.
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const prefix = searchParams.get("prefix") ?? "uploads/";

    const [files] = await bucket.getFiles({ prefix });

    const fileList = files.map((f) => ({
      name: f.name,
      size: Number(f.metadata.size || 0),
      contentType: f.metadata.contentType || "application/octet-stream",
      updated: f.metadata.updated || "",
    }));

    return NextResponse.json(fileList);
  } catch (err: any) {
    console.error("[GET /api/files] List failed:", err);
    return NextResponse.json(
      { error: "List failed", details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/files
 * Uploads a file directly to the GCS bucket.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectName = "uploads/" + Date.now() + "-" + safeName;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await bucket.file(objectName).save(buffer, {
      contentType: file.type || "application/octet-stream",
      resumable: false,
    });

    return NextResponse.json({ name: objectName }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/files] Upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
