import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ProjectRisk } from "@/lib/db/models/ProjectRisk";
import { logActivity } from "@/lib/workspace/auth";

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

    return NextResponse.json({ risk });
  } catch (error: any) {
    console.error("Get risk error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve risk" },
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
    const now = new Date();

    // 1. Update Status (ACKNOWLEDGED, RESOLVED, MITIGATING)
    if (body.status && ["ACKNOWLEDGED", "RESOLVED", "MITIGATING", "IDENTIFIED"].includes(body.status)) {
      const prevStatus = risk.status;
      risk.status = body.status;

      if (body.status === "ACKNOWLEDGED") {
        risk.acknowledgedByUserId = session.userId;
        risk.acknowledgedAt = now;
        risk.history.push({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: "ACKNOWLEDGED",
          details: `Risk acknowledged by ${session.email || session.name || "member"}.`,
          timestamp: now,
          userId: session.userId,
        });
      } else if (body.status === "RESOLVED") {
        risk.resolvedByUserId = session.userId;
        risk.resolvedAt = now;
        risk.history.push({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action: "RESOLVED",
          details: `Risk marked as resolved by ${session.email || session.name || "member"}.`,
          timestamp: now,
          userId: session.userId,
        });
      }
    }

    // 2. Add Mitigation Note
    if (body.mitigationNote && String(body.mitigationNote).trim()) {
      const noteText = String(body.mitigationNote).trim();
      const newNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        note: noteText,
        authorName: session.email || session.name || "Workspace Member",
        createdAt: now,
      };

      risk.mitigationNotes.push(newNote);

      if (risk.status === "IDENTIFIED") {
        risk.status = "MITIGATING";
      }

      risk.history.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action: "MITIGATION_ADDED",
        details: `Mitigation note added: "${noteText.slice(0, 100)}${noteText.length > 100 ? "..." : ""}"`,
        timestamp: now,
        userId: session.userId,
      });
    }

    await risk.save();

    await logActivity({
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: "PROJECT_RISK_UPDATED",
      resourceType: "PROJECT_RISK",
      resourceId: risk.id,
      metadata: { title: risk.title, status: risk.status },
    });

    return NextResponse.json({ success: true, risk });
  } catch (error: any) {
    console.error("Update risk error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update risk" },
      { status: 500 }
    );
  }
}
