import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel } from "@/lib/db/models";
import { storage } from "@/lib/storage";
import { extractDocumentContent } from "@/lib/documents/extractor";
import { generateOnboardingSuggestion } from "@/lib/documents/onboarding";
import { logActivity } from "@/lib/workspace/auth";
import { detectMediaType } from "@/lib/multimodal/multimodalIndexer";

// ─── Allowed types ────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  // Documents
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "application/csv",
  // Images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  // Audio
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/webm",
  "audio/m4a",
  "audio/mpga",
  // Video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  "video/ogg",
]);

const ALLOWED_EXTENSIONS = new Set([
  // Documents
  "pdf", "docx", "txt", "csv", "md",
  // Images
  "png", "jpg", "jpeg", "webp",
  // Audio
  "mp3", "wav", "ogg", "m4a", "mpga",
  // Video
  "mp4", "webm", "mov", "avi", "mpeg", "mpg",
]);

// ─── File-size limits ──────────────────────────────────────────────────────────

const MAX_DOCUMENT_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "25", 10);
const MAX_IMAGE_MB = parseInt(process.env.MAX_IMAGE_SIZE_MB || "10", 10);
const MAX_AUDIO_MB = parseInt(process.env.MAX_AUDIO_SIZE_MB || "25", 10);
const MAX_VIDEO_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || "200", 10);

function getMaxBytes(mediaType: string): number {
  switch (mediaType) {
    case "image": return MAX_IMAGE_MB * 1024 * 1024;
    case "audio": return MAX_AUDIO_MB * 1024 * 1024;
    case "video": return MAX_VIDEO_MB * 1024 * 1024;
    default: return MAX_DOCUMENT_MB * 1024 * 1024;
  }
}

function getMaxMb(mediaType: string): number {
  switch (mediaType) {
    case "image": return MAX_IMAGE_MB;
    case "audio": return MAX_AUDIO_MB;
    case "video": return MAX_VIDEO_MB;
    default: return MAX_DOCUMENT_MB;
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized: Please sign in to upload files" },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const purpose = (formData.get("purpose") as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json(
        { error: "No file was provided in the upload request" },
        { status: 400 }
      );
    }

    const filename = file.name;
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || "application/octet-stream";

    const isAllowedExt = ALLOWED_EXTENSIONS.has(extension);
    const isAllowedMime = ALLOWED_MIME_TYPES.has(mimeType);

    if (!isAllowedExt && !isAllowedMime) {
      return NextResponse.json(
        {
          error: `Unsupported file format (.${extension}). WorkMate AI supports PDF, DOCX, TXT, CSV, PNG, JPG, WEBP, MP3, WAV, MP4, WEBM, MOV.`,
        },
        { status: 400 }
      );
    }

    const mediaType = detectMediaType(mimeType, filename);
    const maxBytes = getMaxBytes(mediaType);

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File size exceeds the ${mediaType} limit of ${getMaxMb(mediaType)} MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Store file
    const uploadResult = await storage.uploadFile({
      workspaceId: session.workspaceId,
      filename,
      mimeType,
      buffer,
    });

    // Extract text preview for documents (skip for binary media)
    let extractedTextPreview: string | null = null;
    let pageCount = 1;
    let onboardingSuggestion = null;

    if (mediaType === "document") {
      try {
        const extracted = await extractDocumentContent(buffer, mimeType, filename);
        extractedTextPreview =
          extracted.text.length > 5000
            ? `${extracted.text.substring(0, 5000)}...`
            : extracted.text;
        pageCount = extracted.pageCount;

        onboardingSuggestion = await generateOnboardingSuggestion(
          filename,
          extracted.text,
          purpose
        );
      } catch (extractErr: any) {
        // If text extraction fails, fall through — the document is stored;
        // OCR will be attempted during indexing.
        console.warn(`[Upload] Text extraction failed for ${filename}: ${extractErr.message}`);
      }
    }

    await connectToDatabase();

    const newDoc = await DocumentModel.create({
      workspaceId: session.workspaceId,
      uploadedByUserId: session.userId,
      originalFilename: filename,
      mimeType,
      fileSize: uploadResult.fileSize,
      storageKey: uploadResult.storageKey,
      processingStatus: "PENDING",
      mediaType,
      purpose,
      extractedText: extractedTextPreview,
      pageCount,
      chunkCount: 0,
      onboardingSuggestion,
    });

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "DOCUMENT_UPLOADED",
      resourceType: "DOCUMENT",
      resourceId: newDoc.id,
      metadata: {
        filename,
        fileSize: uploadResult.fileSize,
        mediaType,
        pageCount,
        hasPurpose: Boolean(purpose),
      },
    });

    return NextResponse.json(
      {
        message: `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully`,
        document: {
          id: newDoc.id,
          originalFilename: newDoc.originalFilename,
          mimeType: newDoc.mimeType,
          fileSize: newDoc.fileSize,
          pageCount: newDoc.pageCount,
          processingStatus: newDoc.processingStatus,
          mediaType: newDoc.mediaType,
          purpose: newDoc.purpose,
          createdAt: newDoc.createdAt,
          onboardingSuggestion: newDoc.onboardingSuggestion,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error occurred while processing upload" },
      { status: 500 }
    );
  }
}
