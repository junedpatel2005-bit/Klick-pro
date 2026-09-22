import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { calculateMilestoneMoney, fundMilestoneFromWallet } from "@/lib/wallet-ledger";
import { notifyDisputeResolved, notifyMilestoneFunded } from "@/lib/marketplace-notifications";
import { emitAdminEvent, emitRealtimeProjectUpdate } from "@/lib/realtime";

const schema = z.object({
  projectId: z.number().int().positive(),
  milestoneId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });
  }
  if (session.role !== "CLIENT")
    return NextResponse.json({ error: "Client access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid milestone payment request." }, { status: 400 });
  const project = await db.projectTracking.findFirst({
    where: { id: parsed.data.projectId, clientId: session.userId },
    include: { job: { select: { title: true } } },
  });
  const milestone = project
    ? await db.projectMilestone.findFirst({
        where: {
          id: parsed.data.milestoneId,
          trackingId: project.id,
          status: { in: ["AWAITING_CLIENT_REVIEW", "REVISION_REQUESTED", "IN_PROGRESS"] },
        },
      })
    : null;
  if (!project || !milestone)
    return NextResponse.json(
      { error: "This milestone is not ready for payment." },
      { status: 409 },
    );
  const money = calculateMilestoneMoney(milestone.amount);
  try {
    const result = await db.$transaction(
      async (tx) => {
        // Claim the review state inside the transaction so two approval clicks
        // cannot settle the same milestone twice.
        const claim = await tx.projectMilestone.updateMany({
          where: {
            id: milestone.id,
            trackingId: project.id,
            status: { in: ["AWAITING_CLIENT_REVIEW", "REVISION_REQUESTED", "IN_PROGRESS"] },
          },
          data: { status: "PAYMENT_PROCESSING" },
        });
        if (claim.count !== 1)
          throw new Error("This milestone is already being paid or is no longer payable.");

        const payment = await tx.payment.upsert({
          where: { milestoneId: milestone.id },
          create: {
            clientId: project.clientId,
            professionalId: project.professionalId,
            jobId: project.jobId,
            amount: money.clientChargeAmount,
            baseAmount: money.baseAmount,
            clientFeeAmount: money.clientFeeAmount,
            professionalPayoutAmount: money.professionalPayoutAmount,
            adminNetAmount: money.adminNetAmount,
            commissionAmount: money.baseAmount - money.professionalPayoutAmount,
            currency: "INR",
            provider: "wallet",
            projectTrackingId: project.id,
            milestoneId: milestone.id,
            status: "PENDING",
            capturedAt: new Date(),
            idempotencyKey: `wallet-milestone-${milestone.id}`,
          },
          update: {},
        });
        if (payment.status === "COMPLETED" || payment.status === "FUNDED")
          throw new Error("This milestone has already been funded.");
        await fundMilestoneFromWallet(tx, {
          paymentId: payment.id,
          clientId: project.clientId,
          professionalId: project.professionalId,
          baseAmount: milestone.amount,
          milestoneId: milestone.id,
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "FUNDED", capturedAt: new Date() },
        });
        await tx.invoice.upsert({
          where: { paymentId: payment.id },
          create: {
            invoiceNumber: `INV-${new Date().getFullYear()}-${String(payment.id).padStart(6, "0")}`,
            paymentId: payment.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            amount: money.clientChargeAmount,
            commissionAmount: money.adminNetAmount,
            netAmount: money.professionalPayoutAmount,
            currency: "INR",
          },
          update: {},
        });
        await tx.projectMilestone.update({
          where: { id: milestone.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });

        // Automatically start the next upcoming milestone so work can continue seamlessly
        const nextMilestone = await tx.projectMilestone.findFirst({
          where: { trackingId: project.id, status: "UPCOMING" },
          orderBy: { id: "asc" },
        });
        if (nextMilestone) {
          await tx.projectMilestone.update({
            where: { id: nextMilestone.id },
            data: { status: "IN_PROGRESS" },
          });
          await tx.projectTracking.update({
            where: { id: project.id },
            data: { status: "IN_PROGRESS", currentStage: nextMilestone.title },
          });
        }

        await tx.projectTransaction.create({
          data: {
            trackingId: project.id,
            milestoneId: milestone.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            amount: milestone.amount,
            currency: "INR",
            type: "WALLET_MILESTONE_FUNDED",
            status: "FUNDED",
            description: `Milestone funded and completed: ${milestone.title}`,
          },
        });

        // Automatically resolve any active disputes for this contract upon client milestone payment
        const activeDisputes = await tx.projectDispute.findMany({
          where: {
            trackingId: project.id,
            status: { not: "RESOLVED" },
          },
        });

        for (const activeDispute of activeDisputes) {
          await tx.projectDispute.update({
            where: { id: activeDispute.id },
            data: {
              status: "RESOLVED",
              respondentAction: "ACCEPTED",
              decision: "MUTUAL_SETTLEMENT",
              decisionReason: `Client completed payment of ₹${milestone.amount.toLocaleString("en-IN")} for milestone "${milestone.title}". Dispute automatically resolved and closed.`,
              decisionAt: new Date(),
              decidedBy: session.userId,
              payoutAmount: milestone.amount,
              refundAmount: 0,
            },
          });

          await tx.projectTimelineEvent.create({
            data: {
              trackingId: project.id,
              actorId: session.userId,
              actorRole: "CLIENT",
              milestoneId: milestone.id,
              type: "DISPUTE_RESOLVED",
              title: "Dispute closed · Payment received",
              description: `Dispute #${activeDispute.id} was automatically closed after client completed payment of ₹${milestone.amount.toLocaleString("en-IN")} for milestone "${milestone.title}".`,
            },
          });
        }

        const clientWallet = await tx.wallet.findUnique({
          where: { userId: project.clientId },
          select: { balance: true },
        });
        return {
          remainingBalance: clientWallet?.balance ?? 0,
          resolvedDisputes: activeDisputes.map((d) => ({ id: d.id })),
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );

    if (result.resolvedDisputes.length > 0) {
      void notifyDisputeResolved({
        trackingId: project.id,
        jobTitle: project.job?.title ?? null,
        status: "RESOLVED",
        clientId: project.clientId,
        professionalId: project.professionalId,
      }).catch(() => undefined);

      for (const d of result.resolvedDisputes) {
        emitAdminEvent("dispute:update", {
          disputeId: d.id,
          projectId: project.id,
          status: "RESOLVED",
        });
      }
    }

    void notifyMilestoneFunded({
      projectId: project.id,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      amount: money.baseAmount,
      clientId: project.clientId,
      professionalId: project.professionalId,
    }).catch(() => undefined);
    emitRealtimeProjectUpdate([project.clientId, project.professionalId], {
      projectId: project.id,
    });
    return NextResponse.json({
      ok: true,
      charged: money.clientChargeAmount,
      milestoneAmount: money.baseAmount,
      professionalReceives: money.baseAmount,
      remainingBalance: result.remainingBalance,
      status: "APPROVED",
      disputeResolved: result.resolvedDisputes.length > 0,
      message:
        result.resolvedDisputes.length > 0
          ? `Milestone paid with ₹${money.baseAmount.toLocaleString("en-IN")}. Dispute was automatically resolved and next stage started.`
          : `Milestone paid with ₹${money.baseAmount.toLocaleString("en-IN")}. Milestone completed and next stage started.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient wallet balance.")
      return NextResponse.json(
        {
          error: `Add at least ₹${money.clientChargeAmount.toLocaleString()} to your wallet before paying this milestone.`,
        },
        { status: 402 },
      );
    if (
      error instanceof Error &&
      (error.message.includes("already being paid") ||
        error.message.includes("already been paid") ||
        error.message.includes("already been funded"))
    )
      return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Wallet milestone settlement failed", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "Milestone payment could not be completed.",
      },
      { status: 500 },
    );
  }
}
