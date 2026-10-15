import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Task, ITask } from "@/lib/db/models/Task";
import { logActivity } from "@/lib/workspace/auth";

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const priorityParam = searchParams.get("priority");
    const ownerParam = searchParams.get("owner");
    const query = searchParams.get("query") || "";

    const now = new Date();

    // Query all tasks for this workspace to compute statistics & dependency status
    const allWorkspaceTasks: any[] = await Task.find({
      workspaceId: session.workspaceId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Map tasks by ID and title for dependency resolution
    const taskMap = new Map<string, any>();
    allWorkspaceTasks.forEach((t) => {
      const tid = t._id ? t._id.toString() : String(t.id || "");
      taskMap.set(tid, t);
      if (t.id) taskMap.set(String(t.id), t);
      if (t.title) taskMap.set(String(t.title).toLowerCase().trim(), t);
    });

    // Helper to evaluate unresolved dependencies
    const checkUnresolvedDependencies = (dependencies: string[] = []): string[] => {
      if (!dependencies || dependencies.length === 0) return [];
      const unresolved: string[] = [];
      dependencies.forEach((dep) => {
        const found = taskMap.get(dep) || taskMap.get(dep.toLowerCase().trim());
        if (!found || found.status !== "COMPLETED") {
          unresolved.push(dep);
        }
      });
      return unresolved;
    };

    // Calculate metrics
    let totalCount = allWorkspaceTasks.length;
    let todoCount = 0;
    let inProgressCount = 0;
    let blockedCount = 0;
    let completedCount = 0;
    let overdueCount = 0;

    allWorkspaceTasks.forEach((t) => {
      if (t.status === "TODO") todoCount++;
      else if (t.status === "IN_PROGRESS") inProgressCount++;
      else if (t.status === "BLOCKED") blockedCount++;
      else if (t.status === "COMPLETED") completedCount++;

      if (t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now) {
        overdueCount++;
      }
    });

    // Filter tasks for the view
    let filteredTasks = allWorkspaceTasks;

    if (statusParam && statusParam !== "ALL") {
      if (statusParam === "OVERDUE") {
        filteredTasks = filteredTasks.filter(
          (t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now
        );
      } else {
        filteredTasks = filteredTasks.filter((t) => t.status === statusParam);
      }
    }

    if (priorityParam && priorityParam !== "ALL") {
      filteredTasks = filteredTasks.filter((t) => t.priority === priorityParam);
    }

    if (ownerParam && ownerParam !== "ALL") {
      if (ownerParam === "UNASSIGNED") {
        filteredTasks = filteredTasks.filter((t) => !t.owner || /^(unknown|unassigned|none)$/i.test(t.owner));
      } else {
        filteredTasks = filteredTasks.filter(
          (t) => t.owner && t.owner.toLowerCase().includes(ownerParam.toLowerCase())
        );
      }
    }

    if (query) {
      const q = query.toLowerCase();
      filteredTasks = filteredTasks.filter(
        (t) =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.owner && t.owner.toLowerCase().includes(q))
      );
    }

    const tasksPayload = filteredTasks.map((t) => {
      const isOverdue = Boolean(t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < now);
      const unresolvedDependencies = checkUnresolvedDependencies(t.dependencies);
      const taskId = t._id ? t._id.toString() : String(t.id || "");
      const rawOwner = t.owner ? String(t.owner).trim() : null;
      const cleanOwner = rawOwner && !/^(unknown|unassigned|none)$/i.test(rawOwner) ? rawOwner : null;

      return {
        id: taskId,
        title: t.title,
        description: t.description || null,
        status: t.status,
        priority: t.priority,
        owner: cleanOwner,
        dueDate: t.dueDate || null,
        isOverdue,
        dependencies: t.dependencies || [],
        unresolvedDependencies,
        hasUnresolvedDependencies: unresolvedDependencies.length > 0,
        meetingId: t.meetingId || null,
        sourceExcerpt: t.sourceExcerpt || null,
        isExplicitCommitment: Boolean(t.isExplicitCommitment),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      };
    });

    return NextResponse.json({
      tasks: tasksPayload,
      stats: {
        total: totalCount,
        todo: todoCount,
        inProgress: inProgressCount,
        blocked: blockedCount,
        completed: completedCount,
        overdue: overdueCount,
      },
    });
  } catch (error: any) {
    console.error("List tasks error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "MEDIUM";
    if (["LOW", "MEDIUM", "HIGH", "URGENT"].includes(String(body.priority).toUpperCase())) {
      priority = String(body.priority).toUpperCase() as any;
    }

    let status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" = "TODO";
    if (["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETED"].includes(String(body.status).toUpperCase())) {
      status = String(body.status).toUpperCase() as any;
    }

    let dueDate: Date | null = null;
    if (body.dueDate) {
      const parsed = new Date(body.dueDate);
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    }

    const dependencies = Array.isArray(body.dependencies)
      ? body.dependencies.map(String).map((d: string) => d.trim()).filter(Boolean)
      : [];

    const rawOwner = body.owner ? String(body.owner).trim() : null;
    const cleanOwner = rawOwner && !/^(unknown|unassigned|none)$/i.test(rawOwner) ? rawOwner : null;

    const task: any = await Task.create({
      workspaceId: session.workspaceId,
      title,
      description: body.description ? String(body.description).trim() : null,
      status,
      priority,
      owner: cleanOwner,
      dueDate,
      dependencies,
      sourceExcerpt: body.sourceExcerpt ? String(body.sourceExcerpt).trim() : null,
      isExplicitCommitment: Boolean(body.isExplicitCommitment),
    });

    const normalizedTask = {
      id: task._id ? task._id.toString() : String(task.id || ""),
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      owner: task.owner || null,
      dueDate: task.dueDate,
      dependencies: task.dependencies,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "TASK_CREATED",
      resourceType: "TASK",
      resourceId: normalizedTask.id,
      metadata: { title: task.title, priority: task.priority, owner: cleanOwner },
    });

    return NextResponse.json({ success: true, task: normalizedTask });
  } catch (error: any) {
    console.error("Create task error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
