import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel } from "@/lib/db/models";
import { generateOnboardingSuggestion } from "@/lib/documents/onboarding";
import { storage } from "@/lib/storage";
import { extractDocumentContent } from "@/lib/documents/extractor";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional
  }

  const purpose = body.purpose || undefined;

  try {
    await connectToDatabase();

    const doc = await DocumentModel.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    let sampleText = doc.extractedText || "";

    // If no extracted text cached, load from storage
    if (!sampleText && doc.storageKey) {
      const buffer = await storage.getFile(doc.storageKey);
      if (buffer) {
        const extracted = await extractDocumentContent(
          buffer,
          doc.mimeType,
          doc.originalFilename
        );
        sampleText = extracted.text;
      }
    }

    const suggestion = await generateOnboardingSuggestion(
      doc.originalFilename,
      sampleText,
      purpose || doc.purpose
    );

    doc.onboardingSuggestion = suggestion;
    if (purpose) {
      doc.purpose = purpose;
    }
    await doc.save();

    return NextResponse.json({
      message: "AI onboarding proposal generated successfully",
      suggestion,
    });
  } catch (error: any) {
    console.error("AI onboarding suggestion error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI onboarding proposal" },
      { status: 500 }
    );
  }
}
