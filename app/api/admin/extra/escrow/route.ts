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
  const statusFilter = searchParams.get("status") || "ALL";
  const query = searchParams.get("query")?.toLowerCase() || "";

  try {
    // Query all original milestones and open disputes
    const [milestones, openDisputes] = await Promise.all([
      db.projectMilestone.findMany({
        orderBy: { createdAt: "desc" },
        take: 150,
        include: {
          tracking: {
            include: {
              job: {
                select: { id: true, title: true },
              },
            },
          },
          payment: {
            select: { id: true, status: true, amount: true, createdAt: true },
          },
        },
      }),
      db.projectDispute.findMany({
        where: { status: "OPEN" },
        select: { id: true, trackingId: true, milestoneId: true },
      }),
    ]);

    const userIds = Array.from(new Set(milestones.flatMap((m) => [m.clientId, m.professionalId])));

    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const now = Date.now();

    const records = milestones.map((m) => {
      const client = userMap.get(m.clientId);
      const pro = userMap.get(m.professionalId);
      const openDispute = openDisputes.find(
        (d) => d.trackingId === m.trackingId && (d.milestoneId === m.id || d.milestoneId === null),
      );
      const isDisputed = Boolean(openDispute);
      const ageDays = Math.floor((now - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      // Determine escrow state
      let escrowStatus = "HELD";
      if (m.status === "APPROVED" || m.payment?.status === "COMPLETED") {
        escrowStatus = "COMPLETED";
      } else if (isDisputed) {
        escrowStatus = "DISPUTED";
      } else if (m.status === "IN_PROGRESS" || m.status === "AWAITING_CLIENT_REVIEW") {
        escrowStatus = "FUNDED";
      } else {
        escrowStatus = "UPCOMING";
      }

      return {
        id: m.id,
        trackingId: m.trackingId,
        jobId: m.tracking.job.id,
        jobTitle: m.tracking.job.title || `Milestone: ${m.title}`,
        milestoneId: m.id,
        milestoneTitle: m.title,
        amount: m.amount,
        status: escrowStatus,
        rawStatus: m.status,
        clientName: client ? `${client.firstName} ${client.lastName}`.trim() : "Unknown Client",
        clientEmail: client?.email ?? "",
        professionalName: pro ? `${pro.firstName} ${pro.lastName}`.trim() : "Unassigned Pro",
        professionalEmail: pro?.email ?? "",
        ageDays,
        isStuck: ageDays > 14 && (escrowStatus === "FUNDED" || escrowStatus === "HELD"),
        isDisputed,
        disputeId: openDispute?.id ?? null,
        createdAt: m.createdAt,
      };
    });

    let filtered = records;
    if (statusFilter === "HELD") {
      filtered = filtered.filter(
        (r) => r.status === "FUNDED" || r.status === "HELD" || r.status === "UPCOMING",
      );
    } else if (statusFilter === "STUCK") {
      filtered = filtered.filter((r) => r.isStuck);
    } else if (statusFilter === "DISPUTED") {
      filtered = filtered.filter((r) => r.isDisputed);
    } else if (statusFilter === "RELEASED") {
      filtered = filtered.filter((r) => r.status === "COMPLETED");
    }

    if (query) {
      filtered = filtered.filter(
        (r) =>
          r.jobTitle.toLowerCase().includes(query) ||
          r.milestoneTitle.toLowerCase().includes(query) ||
          r.clientName.toLowerCase().includes(query) ||
          r.professionalName.toLowerCase().includes(query),
      );
    }

    const totalEscrowHeld = records
      .filter((r) => r.status === "FUNDED" || r.status === "HELD")
      .reduce((sum, r) => sum + r.amount, 0);

    const totalDisputedEscrow = records
      .filter((r) => r.isDisputed)
      .reduce((sum, r) => sum + r.amount, 0);

    const stuckContractsCount = records.filter((r) => r.isStuck).length;
    const activeContractsCount = records.filter(
      (r) => r.status === "FUNDED" || r.status === "HELD",
    ).length;

    return NextResponse.json({
      records: filtered,
      stats: {
        totalEscrowHeld,
        totalDisputedEscrow,
        activeContractsCount,
        stuckContractsCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch escrow ledger:", error);
    return NextResponse.json({ error: "Failed to load escrow ledger" }, { status: 500 });
  }
}
