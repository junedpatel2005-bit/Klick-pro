import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateMilestoneMoney,
  db,
  fundMilestoneFromWallet,
  releaseMilestoneToProfessional,
} from "@/lib/wallet-ledger";
import { getPlatformCommissionRate } from "@/lib/platform-settings";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyMilestonePayoutApproved } from "@/lib/marketplace-notifications";
import { emitRealtimeProjectUpdate } from "@/lib/realtime";

const schema = z.object({ paymentId: z.number().int().positive() });

async function isAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "A valid payment is required." }, { status: 400 });

  const payment = await db.payment.findUnique({
    where: { id: parsed.data.paymentId },
    select: {
      id: true,
      clientId: true,
      professionalId: true,
      projectTrackingId: true,
      milestoneId: true,
      status: true,
    },
  });
  const milestone = payment?.milestoneId
    ? await db.projectMilestone.findUnique({ where: { id: payment.milestoneId } })
    : null;
  if (
    !payment ||
    !["FUNDED", "AWAITING_ADMIN_APPROVAL"].includes(payment.status) ||
    !payment.projectTrackingId ||
    !milestone ||
    !["AWAITING_ADMIN_APPROVAL", "APPROVED", "COMPLETED"].includes(milestone.status)
  )
    return NextResponse.json(
      { error: "This payment is not waiting for admin payout approval." },
      { status: 409 },
    );

  try {
    const result = await db.$transaction(
      async (tx) => {
        const claim = await tx.payment.updateMany({
          where: { id: payment.id, status: { in: ["FUNDED", "AWAITING_ADMIN_APPROVAL"] } },
          data: { status: "PAYOUT_PROCESSING" },
        });
        if (claim.count !== 1) throw new Error("This payout is already being processed.");

        const commissionRate = await getPlatformCommissionRate();

        // If not already funded (Auto-Pay was OFF), cut from client wallet now!
        if (payment.status === "AWAITING_ADMIN_APPROVAL") {
          const clientWallet = await tx.wallet.findUnique({
            where: { userId: payment.clientId },
            select: { balance: true },
          });
          const neededMoney = calculateMilestoneMoney(milestone.amount, commissionRate);
          if (!clientWallet || clientWallet.balance < neededMoney.clientChargeAmount) {
            throw new Error(
              "Client has insufficient wallet balance to complete this milestone payout.",
            );
          }
          await fundMilestoneFromWallet(tx, {
            paymentId: payment.id,
            clientId: payment.clientId,
            professionalId: payment.professionalId,
            baseAmount: milestone.amount,
            milestoneId: milestone.id,
            customCommissionRate: commissionRate,
          });
        }

        // Add to professional wallet (admin keeps commission cut)!
        const money = await releaseMilestoneToProfessional(tx, {
          paymentId: payment.id,
          clientId: payment.clientId,
          professionalId: payment.professionalId,
          baseAmount: milestone.amount,
          milestoneId: milestone.id,
          customCommissionRate: commissionRate,
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            capturedAt: new Date(),
            professionalPayoutAmount: money.professionalPayoutAmount,
            commissionAmount: money.professionalFeeAmount,
            adminNetAmount: money.adminNetAmount,
          },
        });
        await tx.projectMilestone.update({
          where: { id: milestone.id },
          data: { status: "APPROVED", approvedAt: new Date() },
        });
        await tx.projectTransaction.updateMany({
          where: {
            trackingId: payment.projectTrackingId!,
            milestoneId: milestone.id,
            type: { in: ["WALLET_MILESTONE_FUNDED", "WALLET_MILESTONE_PENDING_APPROVAL"] },
          },
          data: {
            status: "COMPLETED",
            description: `Milestone payout approved: ${milestone.title}`,
          },
        });
        await tx.projectTransaction.updateMany({
          where: {
            trackingId: payment.projectTrackingId!,
            milestoneId: milestone.id,
            type: "PLATFORM_COMMISSION",
          },
          data: {
            status: "COMPLETED",
          },
        });

        const next = await tx.projectMilestone.findFirst({
          where: {
            trackingId: payment.projectTrackingId!,
            id: { not: milestone.id },
            status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
          },
          orderBy: [{ id: "asc" }],
        });
        if (next) {
          await tx.projectMilestone.update({
            where: { id: next.id },
            data: { status: "IN_PROGRESS" },
          });
          await tx.projectTracking.update({
            where: { id: payment.projectTrackingId! },
            data: { status: "IN_PROGRESS", currentStage: next.title },
          });
        } else {
          const remainingUnapproved = await tx.projectMilestone.count({
            where: {
              trackingId: payment.projectTrackingId!,
              status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
            },
          });
          if (remainingUnapproved === 0) {
            await tx.projectTracking.update({
              where: { id: payment.projectTrackingId! },
              data: { currentStage: null },
            });
          }
        }
        return money;
      },
      { maxWait: 10000, timeout: 30000 },
    );
    await notifyMilestonePayoutApproved({
      projectId: payment.projectTrackingId,
      milestoneTitle: milestone.title,
      payoutAmount: result.professionalPayoutAmount,
      platformEarnings: result.adminNetAmount,
      clientId: payment.clientId,
      professionalId: payment.professionalId,
    });
    if (payment.projectTrackingId) {
      emitRealtimeProjectUpdate([payment.clientId, payment.professionalId], {
        projectId: payment.projectTrackingId,
      });
    }
    return NextResponse.json({
      ok: true,
      paidToProfessional: result.professionalPayoutAmount,
      platformEarnings: result.adminNetAmount,
      status: "COMPLETED",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Client has insufficient wallet balance"))
      return NextResponse.json({ error: error.message }, { status: 402 });
    if (error instanceof Error && error.message === "Insufficient wallet balance.")
      return NextResponse.json(
        { error: "The admin wallet does not have enough balance for this payout." },
        { status: 402 },
      );
    if (error instanceof Error && error.message.includes("already being processed"))
      return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Admin milestone payout failed", error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "Payout could not be completed.",
      },
      { status: 500 },
    );
  }
}
