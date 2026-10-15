import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Document as DocumentModel, Task } from "@/lib/db/models";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { documentId, actionItems } = body;
  if (!documentId || !Array.isArray(actionItems) || actionItems.length === 0) {
    return NextResponse.json(
      { error: "documentId and an array of actionItems are required" },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const doc = await DocumentModel.findOne({
      _id: documentId,
      workspaceId: session.workspaceId,
    });

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    const taskDocs = actionItems.map((item: any) => {
      let priority = "MEDIUM";
      const p = String(item.priority || "").toUpperCase();
      if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p)) {
        priority = p;
      }

      let dueDate: Date | null = null;
      if (item.dueDate) {
        const parsed = new Date(item.dueDate);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        }
      }

      const rawOwner = item.owner ? String(item.owner).trim() : null;
      const cleanOwner = rawOwner && !/^(unknown|unassigned|none)$/i.test(rawOwner) ? rawOwner : null;

      return {
        workspaceId: session.workspaceId,
        title: String(item.task || "Meeting Action Item").trim(),
        description: `Action item assigned to ${cleanOwner || "Team"} during meeting "${doc.originalFilename}".${item.timestamp ? ` Timestamp: ${item.timestamp}.` : ""}`,
        status: "TODO",
        priority,
        owner: cleanOwner,
        dueDate,
        meetingId: doc.id || (doc._id ? doc._id.toString() : null),
        sourceExcerpt: item.context || (item.timestamp ? `Timestamp: ${item.timestamp}` : null),
      };
    });

    const created = await Task.insertMany(taskDocs);

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "TASKS_CREATED_FROM_MEETING",
      resourceType: "TASK",
      metadata: {
        documentId: doc.id,
        documentName: doc.originalFilename,
        count: created.length,
      },
    });

    return NextResponse.json({
      success: true,
      count: created.length,
      tasks: created.map((t) => ({
        id: t._id.toString(),
        title: t.title,
        priority: t.priority,
        status: t.status,
      })),
    });
  } catch (error: any) {
    console.error("Export action items error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export action items to tasks" },
      { status: 500 }
    );
  }
}
