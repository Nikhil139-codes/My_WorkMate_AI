import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User, Workspace, WorkspaceMembership } from "@/lib/db/models";
import { logActivity } from "@/lib/workspace/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, password, workspaceName } = parseResult.data;

    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create user in Users collection
    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    // Create workspace in Workspaces collection
    const workspace = await Workspace.create({
      name: workspaceName,
    });

    // Create owner membership in WorkspaceMemberships collection
    const membership = await WorkspaceMembership.create({
      userId: user.id,
      workspaceId: workspace.id,
      role: "OWNER",
    });

    // Create session token
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      role: membership.role,
    });

    // Log registration activity
    await logActivity({
      workspaceId: workspace.id,
      userId: user.id,
      action: "USER_REGISTERED",
      resourceType: "WORKSPACE",
      resourceId: workspace.id,
      metadata: { workspaceName: workspace.name },
    });

    const response = NextResponse.json(
      {
        message: "Registration successful",
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
      },
      { status: 201 }
    );

    // Set HTTP-only secure cookie
    response.cookies.set(
      SESSION_COOKIE_OPTIONS.name,
      token,
      SESSION_COOKIE_OPTIONS
    );

    return response;
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
