import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { calculateMilestoneMoney, fundMilestoneFromWallet } from "@/lib/wallet-ledger";
import { notifyMilestoneFunded } from "@/lib/marketplace-notifications";
import { emitRealtimeProjectUpdate } from "@/lib/realtime";

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
  });
  const milestone = project
    ? await db.projectMilestone.findFirst({
        where: {
          id: parsed.data.milestoneId,
          trackingId: project.id,
          status: "AWAITING_CLIENT_REVIEW",
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
            status: "AWAITING_CLIENT_REVIEW",
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
        if (payment.status === "COMPLETED")
          throw new Error("This milestone has already been paid.");
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
          data: { status: "AWAITING_ADMIN_APPROVAL" },
        });
        await tx.projectTransaction.create({
          data: {
            trackingId: project.id,
            milestoneId: milestone.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            amount: milestone.amount,
            currency: "INR",
            type: "WALLET_MILESTONE_FUNDED",
            status: "PENDING_ADMIN_PAYOUT",
            description: `Client-funded milestone awaiting admin payout approval: ${milestone.title}`,
          },
        });
        const clientWallet = await tx.wallet.findUnique({
          where: { userId: project.clientId },
          select: { balance: true },
        });
        return { remainingBalance: clientWallet?.balance ?? 0 };
      },
      { maxWait: 10000, timeout: 30000 },
    );
    await notifyMilestoneFunded({
      projectId: project.id,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      amount: money.baseAmount,
      clientId: project.clientId,
      professionalId: project.professionalId,
    });
    emitRealtimeProjectUpdate([project.clientId, project.professionalId], {
      projectId: project.id,
    });
    return NextResponse.json({
      ok: true,
      charged: money.clientChargeAmount,
      professionalReceives: money.professionalPayoutAmount,
      adminReceives: money.clientChargeAmount,
      platformEarnings: money.adminNetAmount,
      remainingBalance: result.remainingBalance,
      status: "FUNDED",
      message: "Payment received. Professional payout is waiting for admin approval.",
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
      (error.message.includes("already being paid") || error.message.includes("already been paid"))
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
