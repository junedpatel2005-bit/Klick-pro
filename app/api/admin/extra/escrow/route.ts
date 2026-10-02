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
    const payments = await db.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        client: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        professional: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        job: {
          select: { id: true, title: true },
        },
        milestone: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    const trackingIds = payments
      .map((p) => p.projectTrackingId)
      .filter((id): id is number => typeof id === "number");

    const disputes =
      trackingIds.length > 0
        ? await db.projectDispute.findMany({
            where: { trackingId: { in: trackingIds }, status: "OPEN" },
            select: { id: true, trackingId: true, status: true },
          })
        : [];
    const disputeMap = new Map(disputes.map((d) => [d.trackingId, d]));

    const now = Date.now();

    const records = payments.map((p) => {
      const ageDays = Math.floor((now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const dispute = p.projectTrackingId ? disputeMap.get(p.projectTrackingId) : null;
      const isDisputed = Boolean(dispute);

      return {
        id: p.id,
        trackingId: p.projectTrackingId ?? 0,
        jobId: p.job?.id ?? null,
        jobTitle:
          p.job?.title ??
          (p.milestone?.title ? `Milestone: ${p.milestone.title}` : `Payment #${p.id}`),
        milestoneId: p.milestoneId ?? 0,
        amount: p.amount,
        status: p.status,
        clientName: p.client
          ? `${p.client.firstName} ${p.client.lastName}`.trim()
          : "Unknown Client",
        clientEmail: p.client?.email ?? "",
        professionalName: p.professional
          ? `${p.professional.firstName} ${p.professional.lastName}`.trim()
          : "Unassigned Pro",
        professionalEmail: p.professional?.email ?? "",
        ageDays,
        isStuck: ageDays > 14 && p.status === "FUNDED",
        isDisputed,
        disputeId: dispute?.id ?? null,
        createdAt: p.createdAt,
      };
    });

    let filtered = records;
    if (statusFilter === "HELD") {
      filtered = filtered.filter((r) => r.status === "FUNDED");
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
          r.clientName.toLowerCase().includes(query) ||
          r.professionalName.toLowerCase().includes(query),
      );
    }

    const totalEscrowHeld = records
      .filter((r) => r.status === "FUNDED")
      .reduce((sum, r) => sum + r.amount, 0);

    const totalDisputedEscrow = records
      .filter((r) => r.status === "FUNDED" && r.isDisputed)
      .reduce((sum, r) => sum + r.amount, 0);

    const stuckContractsCount = records.filter((r) => r.isStuck).length;
    const activeContractsCount = records.filter((r) => r.status === "FUNDED").length;

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
