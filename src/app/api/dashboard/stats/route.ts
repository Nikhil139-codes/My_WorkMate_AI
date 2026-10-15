import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  Document,
  Task,
  Workflow,
  ActivityLog,
  AIConversation,
  WorkspaceMembership,
  User,
} from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspaceId = session.workspaceId;

    await connectToDatabase();

    // Real database counts from MongoDB collections
    const [
      documentsCount,
      activeTasksCount,
      completedWorkflowsCount,
      rawRecentActivities,
      upcomingTasks,
      conversationsCount,
      membersCount,
    ] = await Promise.all([
      Document.countDocuments({ workspaceId }),
      Task.countDocuments({
        workspaceId,
        status: { $in: ["TODO", "IN_PROGRESS"] },
      }),
      Workflow.countDocuments({
        workspaceId,
        status: "COMPLETED",
      }),
      ActivityLog.find({ workspaceId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Task.find({
        workspaceId,
        status: { $in: ["TODO", "IN_PROGRESS"] },
      })
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(4)
        .lean(),
      AIConversation.countDocuments({ workspaceId }),
      WorkspaceMembership.countDocuments({ workspaceId }),
    ]);

    // Resolve user names for recent activity items
    const userIds = rawRecentActivities
      .map((a: any) => a.userId)
      .filter((uid: any): uid is string => Boolean(uid));

    const users = userIds.length > 0
      ? await User.find({ _id: { $in: userIds } }, "name email").lean()
      : [];
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    const recentActivities = rawRecentActivities.map((act: any) => {
      let meta = act.metadata;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch {
          // Keep raw string if not JSON
        }
      }

      return {
        id: act._id.toString(),
        action: act.action,
        resourceType: act.resourceType,
        userName:
          act.userId && userMap.get(act.userId)
            ? userMap.get(act.userId)!.name
            : "System",
        createdAt: act.createdAt,
        metadata: meta,
      };
    });

    return NextResponse.json({
      workspace: {
        id: session.workspaceId,
        name: session.workspaceName,
        role: session.role,
        membersCount,
      },
      metrics: {
        documentsCount,
        activeTasksCount,
        completedWorkflowsCount,
        conversationsCount,
        // No fake numbers; 0 indicates no workflow events recorded yet
        estimatedTimeSavedMinutes: 0,
      },
      recentActivities,
      upcomingTasks: upcomingTasks.map((t: any) => ({
        id: t._id.toString(),
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Failed to load workspace statistics" },
      { status: 500 }
    );
  }
}
