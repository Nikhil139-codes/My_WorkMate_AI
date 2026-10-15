import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "workmate_auth_token";
const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || "workmate_ai_super_secret_jwt_encryption_key_32_bytes_min"
);

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/knowledge",
  "/documents",
  "/data-preparation",
  "/meetings",
  "/micro-apps",
  "/workflows",
  "/analytics",
  "/settings",
];

const AUTH_PREFIXES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, SECRET_KEY);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Redirect root path to dashboard or login
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = isAuthenticated ? "/dashboard" : "/login";
    return NextResponse.redirect(url);
  }

  // If user is trying to access protected route without auth, redirect to /login
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtectedRoute && !isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // If user is logged in and visits /login or /register, redirect to /dashboard
  const isAuthRoute = AUTH_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isAuthRoute && isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/knowledge/:path*",
    "/documents/:path*",
    "/data-preparation/:path*",
    "/meetings/:path*",
    "/micro-apps/:path*",
    "/workflows/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
