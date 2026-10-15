import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session,
  });
}
