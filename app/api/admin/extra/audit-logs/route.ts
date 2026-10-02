import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";

async function verifyAdmin(request: NextRequest) {
  if (!ENABLE_ADMIN_EXTRA_SECTION) return null;
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const actionFilter = searchParams.get("action");
  const query = searchParams.get("query")?.toLowerCase() || "";

  try {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
    });

    let filtered = logs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorName: log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`.trim()
        : "System / Automated",
      actorEmail: log.actor?.email ?? "system@klick-pro.com",
      actorRole: log.actor?.role ?? "SYSTEM",
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }));

    if (actionFilter && actionFilter !== "ALL") {
      filtered = filtered.filter((l) =>
        l.action.toLowerCase().includes(actionFilter.toLowerCase()),
      );
    }

    if (query) {
      filtered = filtered.filter(
        (l) =>
          l.action.toLowerCase().includes(query) ||
          l.actorName.toLowerCase().includes(query) ||
          l.actorEmail.toLowerCase().includes(query) ||
          l.entityType.toLowerCase().includes(query) ||
          l.entityId.toLowerCase().includes(query),
      );
    }

    const uniqueActors = new Set(logs.map((l) => l.actorId).filter(Boolean)).size;
    const actionsCountMap: Record<string, number> = {};
    for (const log of logs) {
      actionsCountMap[log.action] = (actionsCountMap[log.action] || 0) + 1;
    }

    return NextResponse.json({
      logs: filtered,
      stats: {
        total: logs.length,
        uniqueActors,
        actionsBreakdown: actionsCountMap,
      },
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to load audit logs" }, { status: 500 });
  }
}
