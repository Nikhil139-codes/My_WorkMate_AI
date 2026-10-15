import { NextRequest, NextResponse } from "next/server";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User, Workspace, WorkspaceMembership } from "@/lib/db/models";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    await connectToDatabase();

    const user = await User.findOne({ email });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const membership = await WorkspaceMembership.findOne({ userId: user.id });
    if (!membership) {
      return NextResponse.json(
        { error: "No workspace associated with this user account" },
        { status: 403 }
      );
    }

    const workspace = await Workspace.findOne({ _id: membership.workspaceId });
    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found for this account" },
        { status: 404 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      role: membership.role,
    });

    await logActivity({
      workspaceId: workspace.id,
      userId: user.id,
      action: "USER_LOGGED_IN",
      resourceType: "USER",
      resourceId: user.id,
    });

    const response = NextResponse.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        role: membership.role,
      },
    });

    response.cookies.set(
      SESSION_COOKIE_OPTIONS.name,
      token,
      SESSION_COOKIE_OPTIONS
    );

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    );
  }
}
