import { getSessionUser, SessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { WorkspaceMembership, ActivityLog } from "@/lib/db/models";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: Please log in to continue") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden: You do not have access to this workspace") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}

export async function verifyWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<{ hasAccess: boolean; role?: string }> {
  try {
    await connectToDatabase();
    const membership = await WorkspaceMembership.findOne({
      workspaceId,
      userId,
    }).lean();

    if (!membership) {
      return { hasAccess: false };
    }

    return { hasAccess: true, role: membership.role };
  } catch {
    return { hasAccess: false };
  }
}

export async function logActivity(params: {
  workspaceId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await connectToDatabase();
    await ActivityLog.create({
      workspaceId: params.workspaceId,
      userId: params.userId || null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      metadata: params.metadata || null,
    });
  } catch (error) {
    // Best-effort audit logging; avoid failing primary transaction if log fails
    console.warn("Failed to create activity log in MongoDB:", error);
  }
}
