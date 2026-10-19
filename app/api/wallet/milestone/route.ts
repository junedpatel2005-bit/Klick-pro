import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  calculateMilestoneMoney,
  fundMilestoneFromWallet,
  releaseMilestoneToProfessional,
} from "@/lib/wallet-ledger";
import { getPlatformCommissionRate, isAutopayEnabled } from "@/lib/platform-settings";
import {
  notifyDisputeResolved,
  notifyMilestoneFunded,
  notifyMilestonePayoutApproved,
} from "@/lib/marketplace-notifications";
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
  if (!project) {
    return NextResponse.json({ error: "Project tracking record not found." }, { status: 404 });
  }

  const rawMilestone = await db.projectMilestone.findFirst({
    where: {
      id: parsed.data.milestoneId,
      trackingId: project.id,
    },
  });

  if (!rawMilestone) {
    return NextResponse.json({ error: "Milestone record not found." }, { status: 404 });
  }

  const existingPayment = await db.payment.findFirst({
    where: { milestoneId: rawMilestone.id },
  });

  // Idempotency: If this milestone was already funded into escrow or completed, return 200 OK
  if (
    existingPayment?.status === "COMPLETED" ||
    existingPayment?.status === "FUNDED" ||
    existingPayment?.status === "AWAITING_ADMIN_APPROVAL"
  ) {
    return NextResponse.json({
      ok: true,
      alreadyProcessed: true,
      milestoneAmount: rawMilestone.amount,
      status: rawMilestone.status,
      message: "Milestone has already been approved and funded in escrow.",
    });
  }

  const milestone =
    ["AWAITING_CLIENT_REVIEW", "REVISION_REQUESTED", "IN_PROGRESS", "APPROVED"].includes(rawMilestone.status)
      ? rawMilestone
      : null;

  if (!milestone)
    return NextResponse.json(
      { error: "This milestone is not ready for payment." },
      { status: 409 },
    );
  const commissionRate = await getPlatformCommissionRate();
  const money = calculateMilestoneMoney(milestone.amount, commissionRate);
  try {
    const result = await db.$transaction(
      async (tx) => {
        // Claim the review state inside the transaction so two approval clicks
        // cannot settle the same milestone twice.
        const claim = await tx.projectMilestone.updateMany({
          where: {
            id: milestone.id,
            trackingId: project.id,
            status: { in: ["AWAITING_CLIENT_REVIEW", "REVISION_REQUESTED", "IN_PROGRESS", "APPROVED"] },
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
            commissionAmount: money.professionalFeeAmount,
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
        if (
          payment.status === "COMPLETED" ||
          payment.status === "FUNDED" ||
          payment.status === "AWAITING_ADMIN_APPROVAL"
        )
          throw new Error("This milestone is already being processed or has already been funded.");

        const autopay = await isAutopayEnabled();
        const hasValidityHold = (milestone.validityDays ?? 0) > 0;
        let releaseAtDate: Date | null = null;

        if (hasValidityHold) {
          // Validity Hold (e.g. 3, 5, or 7 days):
          // Verify client has sufficient balance and lock funds into Platform Escrow.
          // Funds remain safely in escrow during the inspection period.
          // If no dispute is opened within validityDays, funds are auto-released to the professional.
          const clientWallet = await tx.wallet.findUnique({
            where: { userId: project.clientId },
            select: { balance: true },
          });
          if (!clientWallet || clientWallet.balance < money.clientChargeAmount) {
            throw new Error(
              `Insufficient wallet balance. You need ₹${money.clientChargeAmount.toLocaleString("en-IN")} to fund escrow for this milestone.`,
            );
          }

          await fundMilestoneFromWallet(tx, {
            paymentId: payment.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            baseAmount: milestone.amount,
            milestoneId: milestone.id,
            customCommissionRate: commissionRate,
            allowNegativeBalance: false,
          });

          releaseAtDate = new Date(Date.now() + (milestone.validityDays ?? 0) * 86400000);
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "FUNDED",
              capturedAt: new Date(),
              professionalPayoutAmount: money.professionalPayoutAmount,
              commissionAmount: money.professionalFeeAmount,
              adminNetAmount: money.adminNetAmount,
            },
          });
          await tx.projectMilestone.update({
            where: { id: milestone.id },
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
              releaseAt: releaseAtDate,
              autoReleaseStatus: "PENDING",
            },
          });
          await tx.projectTimelineEvent.create({
            data: {
              trackingId: project.id,
              actorRole: "CLIENT",
              actorId: project.clientId,
              type: "MILESTONE_APPROVED",
              title: `Milestone approved (${milestone.validityDays}-day inspection period)`,
              description: `Client approved "${milestone.title}". Funds (₹${money.clientChargeAmount.toLocaleString("en-IN")}) held safely in platform escrow during the ${milestone.validityDays}-day inspection period. Payment will be released to the professional after ${milestone.validityDays} days if no dispute is opened.`,
            },
          });

          // Automatically start the next upcoming milestone so work can continue seamlessly
          const nextMilestone = await tx.projectMilestone.findFirst({
            where: {
              trackingId: project.id,
              id: { not: milestone.id },
              status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
            },
            orderBy: [{ id: "asc" }],
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
          } else {
            const remainingUnapproved = await tx.projectMilestone.count({
              where: {
                trackingId: project.id,
                status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
              },
            });
            if (remainingUnapproved === 0) {
              await tx.projectTracking.update({
                where: { id: project.id },
                data: { status: "IN_PROGRESS", currentStage: null },
              });
            }
          }
        } else if (autopay) {
          // Instant Auto-Pay (Validity: None / 0 days):
          // Verify balance first, debit into escrow, and release to professional immediately
          const clientWallet = await tx.wallet.findUnique({
            where: { userId: project.clientId },
            select: { balance: true },
          });
          if (!clientWallet || clientWallet.balance < money.clientChargeAmount) {
            throw new Error(
              `Insufficient wallet balance. You need ₹${money.clientChargeAmount.toLocaleString("en-IN")} to approve this milestone.`,
            );
          }

          // Debit from client wallet into platform escrow
          await fundMilestoneFromWallet(tx, {
            paymentId: payment.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
            baseAmount: milestone.amount,
            milestoneId: milestone.id,
            customCommissionRate: commissionRate,
            allowNegativeBalance: false,
          });

          // Immediately credit to professional wallet directly
          await releaseMilestoneToProfessional(tx, {
            paymentId: payment.id,
            clientId: project.clientId,
            professionalId: project.professionalId,
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
            data: {
              status: "APPROVED",
              approvedAt: new Date(),
              autoReleaseStatus: "RELEASED",
            },
          });

          // Automatically start the next upcoming milestone so work can continue seamlessly
          const nextMilestone = await tx.projectMilestone.findFirst({
            where: {
              trackingId: project.id,
              id: { not: milestone.id },
              status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
            },
            orderBy: [{ id: "asc" }],
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
          } else {
            const remainingUnapproved = await tx.projectMilestone.count({
              where: {
                trackingId: project.id,
                status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
              },
            });
            if (remainingUnapproved === 0) {
              await tx.projectTracking.update({
                where: { id: project.id },
                data: { status: "IN_PROGRESS", currentStage: null },
              });
            }
          }
        } else {
          // When Auto-Pay is OFF:
          // Verify client has sufficient wallet balance, but do NOT cut from client yet!
          // Put in AWAITING_ADMIN_APPROVAL status so admin can review.
          // When admin clicks "Approve" at the earning/finance page, it will cut from client and add to professional!
          const clientWallet = await tx.wallet.findUnique({
            where: { userId: project.clientId },
            select: { balance: true },
          });
          if (!clientWallet || clientWallet.balance < money.clientChargeAmount) {
            throw new Error("Insufficient wallet balance.");
          }
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: "AWAITING_ADMIN_APPROVAL",
              professionalPayoutAmount: money.professionalPayoutAmount,
              commissionAmount: money.professionalFeeAmount,
              adminNetAmount: money.adminNetAmount,
            },
          });
          await tx.projectMilestone.update({
            where: { id: milestone.id },
            data: { status: "AWAITING_ADMIN_APPROVAL" },
          });
        }

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

        if (hasValidityHold) {
          // Validity Hold: payment will be deducted and recorded upon validity completion
          await tx.projectTransaction.create({
            data: {
              trackingId: project.id,
              milestoneId: milestone.id,
              clientId: project.clientId,
              professionalId: project.professionalId,
              amount: milestone.amount,
              currency: "INR",
              type: "WALLET_MILESTONE_PENDING_APPROVAL",
              status: "PENDING",
              description: `Milestone approved (${milestone.validityDays}-day inspection period): ${milestone.title}`,
            },
          });
        } else {
          // 1. Entry 1: Milestone money transaction
          await tx.projectTransaction.create({
            data: {
              trackingId: project.id,
              milestoneId: milestone.id,
              clientId: project.clientId,
              professionalId: project.professionalId,
              amount: milestone.amount,
              currency: "INR",
              type: autopay ? "WALLET_MILESTONE_COMPLETED" : "WALLET_MILESTONE_PENDING_APPROVAL",
              status: autopay ? "COMPLETED" : "PENDING",
              description: autopay
                ? `Milestone payment: ${milestone.title}`
                : `Milestone payment (pending approval): ${milestone.title}`,
            },
          });

          // 2. Entry 2: Platform commission transaction
          const feeAmount = money.professionalFeeAmount || money.clientFeeAmount;
          if (feeAmount > 0) {
            await tx.projectTransaction.create({
              data: {
                trackingId: project.id,
                milestoneId: milestone.id,
                clientId: project.clientId,
                professionalId: project.professionalId,
                amount: feeAmount,
                currency: "INR",
                type: "PLATFORM_COMMISSION",
                status: autopay ? "COMPLETED" : "PENDING",
                description: `Platform commission (${Math.round(commissionRate * 100)}%): ${milestone.title}`,
              },
            });
          }
        }

        // Disputes are never settled by paying a milestone. Paying one milestone
        // must not let the client close every open dispute on the project with a
        // settlement attributed to themselves and no ledger entries backing it.
        const openDisputes = await tx.projectDispute.count({
          where: { trackingId: project.id, status: { not: "RESOLVED" } },
        });

        const clientWallet = await tx.wallet.findUnique({
          where: { userId: project.clientId },
          select: { balance: true },
        });
        return {
          remainingBalance: clientWallet?.balance ?? 0,
          openDisputes,
          autopay,
          hasValidityHold,
          validityDays: milestone.validityDays ?? 0,
        };
      },
      { maxWait: 10000, timeout: 30000 },
    );

    if (result.hasValidityHold) {
      void notifyMilestoneFunded({
        projectId: project.id,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        amount: money.baseAmount,
        clientId: project.clientId,
        professionalId: project.professionalId,
      }).catch(() => undefined);
    } else if (result.autopay) {
      void notifyMilestonePayoutApproved({
        projectId: project.id,
        milestoneTitle: milestone.title,
        payoutAmount: money.professionalPayoutAmount,
        platformEarnings: money.adminNetAmount,
        clientId: project.clientId,
        professionalId: project.professionalId,
      }).catch(() => undefined);
    } else {
      void notifyMilestoneFunded({
        projectId: project.id,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        amount: money.baseAmount,
        clientId: project.clientId,
        professionalId: project.professionalId,
      }).catch(() => undefined);
    }

    emitRealtimeProjectUpdate([project.clientId, project.professionalId], {
      projectId: project.id,
    });
    return NextResponse.json({
      ok: true,
      charged: result.hasValidityHold ? 0 : money.clientChargeAmount,
      milestoneAmount: money.baseAmount,
      professionalReceives: money.professionalPayoutAmount,
      remainingBalance: result.remainingBalance,
      status: "APPROVED",
      autopay: result.autopay,
      hasValidityHold: result.hasValidityHold,
      validityDays: result.validityDays,
      disputeOpen: result.openDisputes > 0,
      message:
        result.openDisputes > 0
          ? `Milestone approved with ₹${money.baseAmount.toLocaleString("en-IN")}. ${result.openDisputes} dispute${result.openDisputes === 1 ? " is" : "s are"} still open and must be settled by an admin.`
          : result.hasValidityHold
            ? `Milestone approved with ${result.validityDays}-day inspection period. No money has been deducted from your wallet today. ₹${money.baseAmount.toLocaleString("en-IN")} will be automatically deducted and paid to the professional after ${result.validityDays} days if no dispute is opened.`
            : result.autopay
              ? `Milestone paid with ₹${money.baseAmount.toLocaleString("en-IN")}. ₹${money.professionalPayoutAmount.toLocaleString("en-IN")} was instantly credited to the professional.`
              : `Milestone paid with ₹${money.baseAmount.toLocaleString("en-IN")}. Funds held in escrow awaiting admin release.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Insufficient wallet balance.")
      return NextResponse.json(
        {
          error: `Money was not in wallet. This milestone payment is remaining, please add money to your wallet.`,
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
