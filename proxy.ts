import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionToken, sessionCookie } from "@/lib/session-token";

function isTrustedStateChangingRequest(request: NextRequest) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  if (origin === request.nextUrl.origin) return true;

  const appUrl = process.env.APP_URL;
  return appUrl ? origin === appUrl : false;
}

function isAuthenticatedPage(pathname: string) {
  const protectedPrefixes = [
    "/dashboard",
    "/discover",
    "/messages",
    "/my-jobs",
    "/post-job",
    "/reports",
    "/earnings",
    "/notifications",
    "/professional",
    "/professional-profile",
    "/professional-home/dashboard",
    "/client-profile",
    "/my-info",
    "/project",
    "/reviews",
  ];

  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Adds a correlation id that API handlers can include in structured server logs
 * and clients can provide when reporting a failed request.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/") && !isTrustedStateChangingRequest(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isAdminRoute = pathname.startsWith("/admin");

  // Optimistic check only: the JWT signature is verified here, never the
  // database. Revocation, account status and email verification are enforced
  // by the layouts and route handlers that call verifySession().
  const token = request.cookies.get(sessionCookie)?.value;
  const session = token ? await decodeSessionToken(token) : null;

  // Every /admin/* page (besides the login screen itself) requires an ADMIN session.
  if (isAdminRoute && pathname !== "/admin/login") {
    if (session?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // Guard protected client/professional pages
  if (!isApiRoute && isAuthenticatedPage(pathname)) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // The email-verification gate lives in app/(portal)/layout.tsx, which has the
  // full session row. It cannot run here: emailVerifiedAt is not in the JWT.

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  // Lets server layouts know the current path (app/admin/layout.tsx uses it to
  // skip its guard on the login screen).
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
