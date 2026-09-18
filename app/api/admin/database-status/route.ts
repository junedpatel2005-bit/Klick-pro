import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Executes a minimal query so the result reflects an actual database connection. */
export async function GET(request: NextRequest) {
  // Local development should be easy to verify without creating an admin session.
  // Production retains the admin-only guard because this endpoint reports service health.
  if (process.env.NODE_ENV === "production") {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
      const { role } = await verifySession(token);
      if (role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      connected: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch {
    return NextResponse.json(
      { connected: false, checkedAt: new Date().toISOString() },
      { status: 503 },
    );
  }
}
