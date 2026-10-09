import { NextResponse, type NextRequest } from "next/server";
import { decodeSessionToken, sessionCookie } from "@/lib/session-token";

function isTrustedStateChangingRequest(request: NextRequest) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return true;

  // External webhook callbacks (e.g. Razorpay, Persona) authenticate callers
  // via cryptographic signatures on the payload (HMAC), not browser Origin headers.
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  if (origin === request.nextUrl.origin) return true;

  const appUrl = process.env.APP_URL;
  if (appUrl && origin === appUrl) return true;

  try {
    const originHost = new URL(origin).host;
    const requestHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      request.nextUrl.host;
    if (originHost === requestHost) return true;
    if (
      (originHost.startsWith("localhost:") || originHost.startsWith("127.0.0.1:")) &&
      (requestHost.startsWith("localhost:") || requestHost.startsWith("127.0.0.1:"))
    ) {
      return true;
    }
  } catch {
    // Malformed origin URL or unparseable headers: reject state change
  }

  return false;
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
    "/verification",
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

  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-pathname", pathname);

  // Canonical rewrite for /api/v1/* calls to existing /api/* handlers
  // (except routes that physically exist under app/api/v1)
  if (pathname.startsWith("/api/v1/")) {
    const isDedicatedV1 =
      pathname.startsWith("/api/v1/linked-accounts") ||
      pathname.startsWith("/api/v1/messages") ||
      pathname.startsWith("/api/v1/professionals");

    if (!isDedicatedV1) {
      const rewrittenPath = pathname.replace(/^\/api\/v1\//, "/api/");
      const rewrittenUrl = new URL(rewrittenPath + request.nextUrl.search, request.url);
      requestHeaders.set("x-pathname", rewrittenPath);
      const rewriteResponse = NextResponse.rewrite(rewrittenUrl, {
        request: { headers: requestHeaders },
      });
      rewriteResponse.headers.set("x-request-id", requestId);
      return rewriteResponse;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
