import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Task } from "@/lib/db/models/Task";
import { logActivity } from "@/lib/workspace/auth";

function buildIdQuery(id: string): any {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return {
      $or: [{ _id: id }, { _id: new mongoose.Types.ObjectId(id) }],
    };
  }
  return { _id: id };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();

    const task: any = await Task.findOne({
      ...buildIdQuery(id),
      workspaceId: session.workspaceId,
    }).lean();

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    const normalizedTask = {
      ...task,
      id: task._id ? task._id.toString() : String(task.id || ""),
      owner: task.owner || null,
    };

    return NextResponse.json({ task: normalizedTask });
  } catch (error: any) {
    console.error("Get task error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();

    const body = await req.json();
    const updateFields: Record<string, any> = {};

    if (body.title !== undefined) {
      updateFields.title = String(body.title).trim();
    }
    if (body.description !== undefined) {
      updateFields.description = body.description ? String(body.description).trim() : null;
    }
    if (body.status !== undefined) {
      const s = String(body.status).toUpperCase();
      if (["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"].includes(s)) {
        updateFields.status = s;
      }
    }
    if (body.priority !== undefined) {
      const p = String(body.priority).toUpperCase();
      if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(p)) {
        updateFields.priority = p;
      }
    }
    if (body.owner !== undefined) {
      const raw = body.owner ? String(body.owner).trim() : "";
      updateFields.owner = raw && !/^(unassigned|unknown|none)$/i.test(raw) ? raw : null;
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate) {
        const parsed = new Date(body.dueDate);
        updateFields.dueDate = !isNaN(parsed.getTime()) ? parsed : null;
      } else {
        updateFields.dueDate = null;
      }
    }
    if (Array.isArray(body.dependencies)) {
      updateFields.dependencies = body.dependencies
        .map(String)
        .map((d: string) => d.trim())
        .filter(Boolean);
    }

    const updatedTask: any = await Task.findOneAndUpdate(
      {
        ...buildIdQuery(id),
        workspaceId: session.workspaceId,
      },
      { $set: updateFields },
      { new: true, runValidators: false, lean: true }
    );

    if (!updatedTask) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    const normalizedTask = {
      ...updatedTask,
      id: updatedTask._id ? updatedTask._id.toString() : String(updatedTask.id || ""),
      owner: updatedTask.owner || null,
    };

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "TASK_UPDATED",
      resourceType: "TASK",
      resourceId: normalizedTask.id,
      metadata: { title: normalizedTask.title, status: normalizedTask.status, owner: normalizedTask.owner },
    });

    return NextResponse.json({ success: true, task: normalizedTask });
  } catch (error: any) {
    console.error("Update task error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await connectToDatabase();

    const task: any = await Task.findOneAndDelete({
      ...buildIdQuery(id),
      workspaceId: session.workspaceId,
    }).lean();

    if (!task) {
      return NextResponse.json(
        { error: "Task not found or access denied" },
        { status: 404 }
      );
    }

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "TASK_DELETED",
      resourceType: "TASK",
      resourceId: id,
      metadata: { title: task.title },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete task error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
