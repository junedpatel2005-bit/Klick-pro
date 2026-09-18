import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyDisputeResolved } from "@/lib/marketplace-notifications";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const { id } = await params;
  const disputeId = Number(id);
  if (!Number.isInteger(disputeId) || disputeId < 1)
    return NextResponse.json({ error: "Invalid dispute ID." }, { status: 400 });
  const parsed = z
    .object({ status: z.enum(["OPEN", "RESOLVED"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid dispute update." }, { status: 400 });
  try {
    const dispute = await db.projectDispute.update({
      where: { id: disputeId },
      data: { status: parsed.data.status },
      select: { id: true, status: true, trackingId: true, clientId: true, professionalId: true },
    });
    const tracking = await db.projectTracking.findUnique({
      where: { id: dispute.trackingId },
      select: { jobId: true },
    });
    const job = tracking
      ? await db.clientJob.findUnique({ where: { id: tracking.jobId }, select: { title: true } })
      : null;
    await notifyDisputeResolved({
      trackingId: dispute.trackingId,
      jobTitle: job?.title ?? null,
      status: parsed.data.status,
      clientId: dispute.clientId,
      professionalId: dispute.professionalId,
    });
    return NextResponse.json({ dispute });
  } catch {
    return NextResponse.json({ error: "Unable to update dispute." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { id } = await params;
  const disputeId = Number(id);
  if (!Number.isInteger(disputeId) || disputeId < 1)
    return NextResponse.json({ error: "Invalid dispute ID." }, { status: 400 });

  const dispute = await db.projectDispute.findUnique({
    where: { id: disputeId },
  });
  if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });

  const messages = await db.projectDisputeMessage.findMany({
    where: { disputeId },
    orderBy: { createdAt: "asc" },
  });

  const tracking = await db.projectTracking.findUnique({ where: { id: dispute.trackingId } });

  const [client, professional, job, milestones, paid] = await Promise.all([
    db.user.findUnique({
      where: { id: dispute.clientId },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    db.user.findUnique({
      where: { id: dispute.professionalId },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    tracking
      ? db.clientJob.findUnique({
          where: { id: tracking.jobId },
          select: { id: true, title: true },
        })
      : Promise.resolve(null),
    tracking
      ? db.projectMilestone.findMany({
          where: { trackingId: tracking.id },
          orderBy: { createdAt: "asc" },
          select: { id: true, title: true, amount: true, status: true, dueDate: true },
        })
      : Promise.resolve([]),
    tracking
      ? db.projectTransaction.aggregate({
          where: { trackingId: tracking.id, status: "COMPLETED" },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const approvedMilestones = milestones.filter((item) => item.status === "APPROVED");
  const completedMilestones = approvedMilestones.length;
  const milestoneTotal = milestones.reduce((total, item) => total + item.amount, 0);
  const approvedTotal = approvedMilestones.reduce((total, item) => total + item.amount, 0);
  const paidAmount = paid._sum.amount ?? 0;

  return NextResponse.json({
    dispute,
    messages,
    client,
    professional,
    job,
    project: tracking
      ? {
          id: tracking.id,
          status: tracking.status,
          progress: tracking.progress,
          currentStage: tracking.currentStage,
          startedAt: tracking.startedAt,
          completedAt: tracking.completedAt,
        }
      : null,
    milestones,
    milestoneSummary: { completed: completedMilestones, total: milestones.length },
    financial: {
      milestoneTotal,
      paidAmount,
      remainingAmount: Math.max(milestoneTotal - paidAmount, 0),
      approvedTotal,
      unpaidApproved: Math.max(approvedTotal - paidAmount, 0),
    },
  });
}
