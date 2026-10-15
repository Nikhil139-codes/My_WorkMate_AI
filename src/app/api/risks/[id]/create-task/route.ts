import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ProjectRisk } from "@/lib/db/models/ProjectRisk";
import { Task } from "@/lib/db/models/Task";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(
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

    const risk = await ProjectRisk.findOne({
      _id: id,
      workspaceId: session.workspaceId,
    });

    if (!risk) {
      return NextResponse.json(
        { error: "Risk record not found or access denied" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const title = String(body.title || `Mitigate: ${risk.title}`).trim();
    const description = String(
      body.description || `Follow-up mitigation task generated for risk "${risk.title}". Evidence: ${risk.evidence}`
    ).trim();

    let priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "HIGH";
    if (risk.severity === "CRITICAL") priority = "URGENT";
    else if (risk.severity === "HIGH") priority = "HIGH";
    else if (risk.severity === "MEDIUM") priority = "MEDIUM";
    else priority = "LOW";

    let dueDate: Date | null = null;
    if (body.dueDate) {
      const parsed = new Date(body.dueDate);
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    } else {
      // Default to 3 days ahead for critical/high, 7 days for medium
      const offsetDays = priority === "URGENT" || priority === "HIGH" ? 3 : 7;
      dueDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    }

    const newTask: any = await Task.create({
      workspaceId: session.workspaceId,
      title,
      description,
      status: "TODO",
      priority,
      owner: body.owner ? String(body.owner).trim() : null,
      dueDate,
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
      sourceExcerpt: risk.evidence || null,
      isExplicitCommitment: true,
    });

    // Update risk status and history
    risk.status = "MITIGATING";
    risk.history.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action: "MITIGATION_ADDED",
      details: `Created mitigation task "${title}" (Task ID: ${newTask.id || newTask._id}).`,
      timestamp: new Date(),
      userId: session.userId,
    });
    await risk.save();

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "TASK_CREATED_FROM_RISK",
      resourceType: "TASK",
      resourceId: newTask.id || newTask._id,
      metadata: { riskId: risk.id, riskTitle: risk.title, taskTitle: title },
    });

    return NextResponse.json({
      success: true,
      task: newTask,
      risk,
    });
  } catch (error: any) {
    console.error("Create task from risk error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create follow-up task from risk" },
      { status: 500 }
    );
  }
}
