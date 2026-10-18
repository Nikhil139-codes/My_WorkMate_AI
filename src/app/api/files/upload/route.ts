import { NextRequest, NextResponse } from "next/server";
import { bucket } from "@/lib/storage";

/**
 * POST /api/files/upload
 * Directly implements Section 3.2 Upload endpoint.
 * Accepts form-data with field name 'file'.
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
    console.error("[POST /api/files/upload] Upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
