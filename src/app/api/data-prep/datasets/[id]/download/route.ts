import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Dataset } from "@/lib/db/models/Dataset";
import { storage } from "@/lib/storage";
import { parseDatasetFile, serializeToCsv, serializeToXlsx } from "@/lib/data-prep/parser";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get("type") === "cleaned" ? "cleaned" : "original";
  const requestedFormat = searchParams.get("format")?.toLowerCase();

  try {
    await connectToDatabase();

    const dataset = await Dataset.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const storageKey = type === "cleaned" ? dataset.cleanedStorageKey : dataset.storageKey;
    if (!storageKey) {
      return NextResponse.json(
        { error: `${type === "cleaned" ? "Cleaned" : "Original"} file not available for download` },
        { status: 404 }
      );
    }

    const fileBuffer = await storage.getFile(storageKey);
    if (!fileBuffer) {
      return NextResponse.json(
        { error: "File binary not found in storage" },
        { status: 404 }
      );
    }

    // Determine target format and convert on the fly if needed
    const baseName = dataset.originalFilename.replace(/\.[^/.]+$/, "");
    let outputBuffer = fileBuffer;
    let outputFilename = type === "cleaned" ? `cleaned_${baseName}` : baseName;
    let contentType = dataset.mimeType;

    if (requestedFormat === "csv" && dataset.format !== "csv") {
      const parsed = parseDatasetFile(fileBuffer, dataset.originalFilename);
      outputBuffer = serializeToCsv(parsed.rows, parsed.columns);
      outputFilename = `${outputFilename}.csv`;
      contentType = "text/csv";
    } else if (requestedFormat === "xlsx" && dataset.format !== "xlsx") {
      const parsed = parseDatasetFile(fileBuffer, dataset.originalFilename);
      outputBuffer = serializeToXlsx(parsed.rows);
      outputFilename = `${outputFilename}.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      const ext = dataset.format === "xlsx" ? "xlsx" : "csv";
      outputFilename = `${outputFilename}.${ext}`;
    }

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(outputFilename)}"`,
        "Content-Length": outputBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Dataset download error:", error);
    return NextResponse.json(
      { error: "Failed to download dataset file" },
      { status: 500 }
    );
  }
}
