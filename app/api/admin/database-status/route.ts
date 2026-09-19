import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Executes a minimal query so the result reflects an actual database connection. */
export async function GET(request: NextRequest) {
  // Admin-only in every environment. The guard used to apply only in production,
  // which left the endpoint open in dev and on every preview build.
  // For an unauthenticated local check, use `npx tsx scripts/project-db-check.ts`.
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

  const startedAt = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      connected: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    // The caller is an authenticated admin, so the reason is safe to surface —
    // "not connected" with no detail made this endpoint near-useless for triage.
    return NextResponse.json(
      {
        connected: false,
        checkedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 503 },
    );
  }
}
