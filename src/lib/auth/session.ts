import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  role: string;
}

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "workmate_auth_token";
const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "workmate_ai_super_secret_jwt_encryption_key_32_bytes_min"
);

export async function createSessionToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      workspaceId: payload.workspaceId as string,
      workspaceName: payload.workspaceName as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};
