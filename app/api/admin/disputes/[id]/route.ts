import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { notifyDisputeDecided, notifyDisputeResolved } from "@/lib/marketplace-notifications";
import {
  calculateMilestoneMoney,
  fundMilestoneFromWallet,
  refundDisputeToClient,
  releaseDisputeToProfessional,
  releaseMilestoneToProfessional,
  settlePartialDispute,
} from "@/lib/wallet-ledger";
import { emitRealtimeProjectUpdate } from "@/lib/realtime";

async function getAdminSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

const patchSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "WAITING_RESPONSE", "UNDER_ADMIN_REVIEW"]).optional(),
  decision: z.enum(["CLIENT_WINS", "PROFESSIONAL_WINS", "PARTIAL_SETTLEMENT"]).optional(),
  clientAction: z.enum(["REVISION", "REFUND"]).optional(),
  reason: z.string().trim().max(4000).optional(),
  refundAmount: z.number().int().min(0).optional(),
  payoutAmount: z.number().int().min(0).optional(),
  milestoneId: z.number().int().positive().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminSession = await getAdminSession(request);
  if (!adminSession) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { id } = await params;
  const disputeId = Number(id);
  if (!Number.isInteger(disputeId) || disputeId < 1)
    return NextResponse.json({ error: "Invalid dispute ID." }, { status: 400 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid dispute update." }, { status: 400 });

  try {
    const dispute = await db.projectDispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) return NextResponse.json({ error: "Dispute not found." }, { status: 404 });

    const tracking = await db.projectTracking.findUnique({
      where: { id: dispute.trackingId },
      select: { id: true, jobId: true },
    });
    const job = tracking
      ? await db.clientJob.findUnique({ where: { id: tracking.jobId }, select: { title: true } })
      : null;

    const { decision, reason, refundAmount, payoutAmount, milestoneId } = parsed.data;

    if (decision) {
      if (dispute.status === "RESOLVED")
        return NextResponse.json(
          { error: "This dispute has already been resolved." },
          { status: 409 },
        );

      // Find candidate milestone and payment associated with the project/dispute
      let targetMilestoneId = milestoneId ?? dispute.milestoneId;
      if (!targetMilestoneId) {
        const candidateMilestone = await db.projectMilestone.findFirst({
          where: {
            trackingId: dispute.trackingId,
            status: { in: ["AWAITING_CLIENT_REVIEW", "IN_PROGRESS", "REVISION_REQUESTED"] },
          },
          orderBy: { id: "asc" },
        });
        if (candidateMilestone) {
          targetMilestoneId = candidateMilestone.id;
        } else {
          const firstUnfinished = await db.projectMilestone.findFirst({
            where: {
              trackingId: dispute.trackingId,
              status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
            },
            orderBy: { id: "asc" },
          });
          if (firstUnfinished) {
            targetMilestoneId = firstUnfinished.id;
          }
        }
      }

      const milestone = targetMilestoneId
        ? await db.projectMilestone.findUnique({
            where: { id: targetMilestoneId },
          })
        : null;

      const payment = targetMilestoneId
        ? await db.payment.findFirst({
            where: {
              projectTrackingId: dispute.trackingId,
              milestoneId: targetMilestoneId,
            },
          })
        : await db.payment.findFirst({
            where: {
              projectTrackingId: dispute.trackingId,
              status: { in: ["FUNDED", "PENDING"] },
            },
            orderBy: { createdAt: "desc" },
          });

      const isFunded = payment?.status === "FUNDED";
      const escrowBalance = isFunded ? (payment?.amount ?? 0) : 0;

      if (decision === "PARTIAL_SETTLEMENT") {
        if (!isFunded) {
          return NextResponse.json(
            { error: "Cannot execute partial escrow settlement on an unfunded milestone." },
            { status: 400 },
          );
        }
        const requestedTotal = (refundAmount ?? 0) + (payoutAmount ?? 0);
        if (requestedTotal > escrowBalance) {
          return NextResponse.json(
            {
              error: `Total split (₹${requestedTotal.toLocaleString("en-IN")}) exceeds the funded escrow amount (₹${escrowBalance.toLocaleString("en-IN")}).`,
            },
            { status: 400 },
          );
        }
      }

      const updatedDispute = await db.$transaction(async (tx) => {
        if (decision === "CLIENT_WINS") {
          const isRevision =
            parsed.data.clientAction === "REVISION" ||
            (!parsed.data.clientAction &&
              ["QUALITY_OF_WORK", "MISSED_DEADLINE", "SCOPE_DISAGREEMENT", "POOR_QUALITY"].includes(
                dispute.issueType,
              ) &&
              (!refundAmount || refundAmount === 0));

          let finalRefund = 0;

          if (isRevision && targetMilestoneId) {
            // Client won work dispute: professional is instructed to revise and deliver updated work
            await tx.projectMilestone.update({
              where: { id: targetMilestoneId },
              data: { status: "REVISION_REQUESTED" },
            });
            await tx.projectTracking.update({
              where: { id: dispute.trackingId },
              data: {
                status: "IN_PROGRESS",
                currentStage: "Revision Required from Professional",
              },
            });
            await tx.projectTimelineEvent.create({
              data: {
                trackingId: dispute.trackingId,
                actorId: adminSession.userId,
                actorRole: "ADMIN",
                milestoneId: targetMilestoneId,
                type: "REVISION_REQUESTED",
                title: "Dispute decided · Professional Revision Required",
                description: `Admin decided case #${disputeId} in favor of client. Professional must submit revised deliverables for milestone #${targetMilestoneId}.${reason ? ` Instructions: ${reason}` : ""}`,
              },
            });
          } else {
            // Refund flow: return escrow to client wallet and cancel milestone
            finalRefund = isFunded
              ? refundAmount != null && refundAmount > 0
                ? Math.min(refundAmount, escrowBalance)
                : escrowBalance
              : 0;

            if (finalRefund > 0) {
              await refundDisputeToClient(tx, {
                disputeId,
                paymentId: payment?.id,
                clientId: dispute.clientId,
                amount: finalRefund,
                reason: reason || "Dispute decided in favor of client (Full Refund)",
              });
            }

            if (payment) {
              await tx.payment.update({
                where: { id: payment.id },
                data: { status: isFunded ? "REFUNDED" : "CANCELLED" },
              });
            }

            if (targetMilestoneId) {
              await tx.projectMilestone.update({
                where: { id: targetMilestoneId },
                data: { status: "CANCELLED" },
              });

              const nextMilestone = await tx.projectMilestone.findFirst({
                where: {
                  trackingId: dispute.trackingId,
                  id: { not: targetMilestoneId },
                  status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
                },
                orderBy: { id: "asc" },
              });
              if (nextMilestone) {
                await tx.projectMilestone.update({
                  where: { id: nextMilestone.id },
                  data: { status: "IN_PROGRESS" },
                });
                await tx.projectTracking.update({
                  where: { id: dispute.trackingId },
                  data: { status: "IN_PROGRESS", currentStage: nextMilestone.title },
                });
              }
            }

            await tx.projectTimelineEvent.create({
              data: {
                trackingId: dispute.trackingId,
                actorId: adminSession.userId,
                actorRole: "ADMIN",
                type: "DISPUTE_RESOLVED",
                title: "Dispute decided · Client Wins (Refund Issued)",
                description: `Admin decided case #${disputeId} in favor of client. Refund: ₹${finalRefund.toLocaleString("en-IN")}.${reason ? ` Note: ${reason}` : ""}`,
              },
            });
          }

          const record = await tx.projectDispute.update({
            where: { id: disputeId },
            data: {
              status: "RESOLVED",
              decision: "CLIENT_WINS",
              decisionReason:
                reason ||
                (isRevision
                  ? "Admin decided in favor of client. Professional instructed to submit required revisions."
                  : isFunded
                    ? "Admin decided in favor of client. Full escrow refund issued."
                    : "Admin decided in favor of client. Unfunded milestone cancelled."),
              refundAmount: isRevision ? 0 : finalRefund,
              payoutAmount: 0,
              decisionAt: new Date(),
              decidedBy: adminSession.userId,
            },
          });

          return record;
        } else if (decision === "PROFESSIONAL_WINS") {
          const defaultPayout =
            payment?.professionalPayoutAmount || payment?.baseAmount || escrowBalance;
          let finalPayout = isFunded
            ? payoutAmount != null && payoutAmount > 0
              ? Math.min(payoutAmount, defaultPayout)
              : defaultPayout
            : 0;

          let resolvedPayment = payment;
          let milestoneFullyPaid = isFunded && finalPayout > 0;

          if (finalPayout > 0 && isFunded) {
            await releaseDisputeToProfessional(tx, {
              disputeId,
              paymentId: payment?.id,
              professionalId: dispute.professionalId,
              amount: finalPayout,
              reason: reason || "Dispute decided in favor of professional (Payment Released)",
            });
            if (resolvedPayment) {
              resolvedPayment = await tx.payment.update({
                where: { id: resolvedPayment.id },
                data: {
                  status: "COMPLETED",
                  professionalPayoutAmount: finalPayout,
                  capturedAt: resolvedPayment.capturedAt || new Date(),
                },
              });
            }
          } else if (targetMilestoneId && milestone && !isFunded) {
            // Milestone is NOT funded! Check if client has sufficient wallet balance to pay professional immediately
            const money = calculateMilestoneMoney(milestone.amount);
            const clientWallet = await tx.wallet.findUnique({
              where: { userId: dispute.clientId },
            });
            if (clientWallet && clientWallet.balance >= money.clientChargeAmount) {
              resolvedPayment = await tx.payment.upsert({
                where: { milestoneId: milestone.id },
                create: {
                  clientId: dispute.clientId,
                  professionalId: dispute.professionalId,
                  jobId: tracking?.jobId,
                  amount: money.clientChargeAmount,
                  baseAmount: money.baseAmount,
                  clientFeeAmount: money.clientFeeAmount,
                  professionalPayoutAmount: money.professionalPayoutAmount,
                  adminNetAmount: money.adminNetAmount,
                  commissionAmount: money.baseAmount - money.professionalPayoutAmount,
                  currency: "INR",
                  provider: "wallet",
                  projectTrackingId: dispute.trackingId,
                  milestoneId: milestone.id,
                  status: "PENDING",
                  capturedAt: new Date(),
                  idempotencyKey: `dispute-${disputeId}-milestone-${milestone.id}`,
                },
                update: {},
              });
              await fundMilestoneFromWallet(tx, {
                paymentId: resolvedPayment.id,
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                baseAmount: milestone.amount,
                milestoneId: milestone.id,
              });
              await releaseMilestoneToProfessional(tx, {
                paymentId: resolvedPayment.id,
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                baseAmount: milestone.amount,
                milestoneId: milestone.id,
              });
              resolvedPayment = await tx.payment.update({
                where: { id: resolvedPayment.id },
                data: {
                  status: "COMPLETED",
                  capturedAt: new Date(),
                },
              });
              finalPayout = money.professionalPayoutAmount;
              milestoneFullyPaid = true;
            } else {
              // Client does not have sufficient wallet balance yet.
              // Keep milestone payable (AWAITING_CLIENT_REVIEW) so client is prompted with the payment popup
              finalPayout = money.professionalPayoutAmount;
              milestoneFullyPaid = false;
            }
          }

          if (resolvedPayment && milestoneFullyPaid) {
            await tx.invoice.upsert({
              where: { paymentId: resolvedPayment.id },
              create: {
                invoiceNumber: `INV-${new Date().getFullYear()}-${String(resolvedPayment.id).padStart(6, "0")}`,
                paymentId: resolvedPayment.id,
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                amount: resolvedPayment.amount,
                commissionAmount: resolvedPayment.commissionAmount ?? 0,
                netAmount: finalPayout,
                currency: "INR",
              },
              update: {
                netAmount: finalPayout,
              },
            });
          }

          if (targetMilestoneId) {
            if (milestoneFullyPaid) {
              // Only mark approved and advance if payment was actually completed
              await tx.projectMilestone.update({
                where: { id: targetMilestoneId },
                data: { status: "APPROVED", approvedAt: new Date() },
              });

              const nextMilestone = await tx.projectMilestone.findFirst({
                where: {
                  trackingId: dispute.trackingId,
                  id: { not: targetMilestoneId },
                  status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
                },
                orderBy: { id: "asc" },
              });
              if (nextMilestone) {
                await tx.projectMilestone.update({
                  where: { id: nextMilestone.id },
                  data: { status: "IN_PROGRESS" },
                });
                await tx.projectTracking.update({
                  where: { id: dispute.trackingId },
                  data: { status: "IN_PROGRESS", currentStage: nextMilestone.title },
                });
              } else {
                const remainingUnapproved = await tx.projectMilestone.count({
                  where: {
                    trackingId: dispute.trackingId,
                    status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
                  },
                });
                if (remainingUnapproved === 0) {
                  await tx.projectTracking.update({
                    where: { id: dispute.trackingId },
                    data: { currentStage: null },
                  });
                }
              }
            } else {
              // Payment is still required from client.
              // Put milestone in AWAITING_CLIENT_REVIEW so client can pay using the milestone payment popup
              await tx.projectMilestone.update({
                where: { id: targetMilestoneId },
                data: { status: "AWAITING_CLIENT_REVIEW" },
              });
              await tx.projectTracking.update({
                where: { id: dispute.trackingId },
                data: { status: "IN_PROGRESS", currentStage: milestone?.title ?? null },
              });
            }
          }

          if (finalPayout > 0) {
            await tx.projectTransaction.create({
              data: {
                trackingId: dispute.trackingId,
                milestoneId: targetMilestoneId ?? null,
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                amount: resolvedPayment?.amount ?? finalPayout,
                currency: "INR",
                type: "DISPUTE_PAYOUT",
                status: "COMPLETED",
                description: `Dispute #${disputeId} resolved: Payment of ₹${finalPayout.toLocaleString("en-IN")} released to professional${milestone ? ` for milestone "${milestone.title}"` : ""}`,
              },
            });
          }

          const record = await tx.projectDispute.update({
            where: { id: disputeId },
            data: {
              status: "RESOLVED",
              decision: "PROFESSIONAL_WINS",
              decisionReason:
                reason ||
                (isFunded
                  ? "Admin decided in favor of professional. Payment released."
                  : "Admin decided in favor of professional. Milestone approved."),
              refundAmount: 0,
              payoutAmount: finalPayout,
              decisionAt: new Date(),
              decidedBy: adminSession.userId,
            },
          });

          await tx.projectTimelineEvent.create({
            data: {
              trackingId: dispute.trackingId,
              actorId: adminSession.userId,
              actorRole: "ADMIN",
              type: "DISPUTE_RESOLVED",
              title: "Dispute decided · Professional Wins",
              description: isFunded
                ? `Admin decided case #${disputeId} in favor of professional. Payout released: ₹${finalPayout.toLocaleString("en-IN")}.${reason ? ` Note: ${reason}` : ""}`
                : `Admin decided case #${disputeId} in favor of professional. Milestone approved.${reason ? ` Note: ${reason}` : ""}`,
            },
          });

          return record;
        } else {
          // PARTIAL_SETTLEMENT
          const finalRefund = refundAmount ?? 0;
          const finalPayout = payoutAmount ?? 0;

          await settlePartialDispute(tx, {
            disputeId,
            paymentId: payment?.id,
            clientId: dispute.clientId,
            professionalId: dispute.professionalId,
            refundAmount: finalRefund,
            payoutAmount: finalPayout,
            reason: reason || "Admin partial dispute settlement",
          });

          let resolvedPayment = payment;
          if (resolvedPayment) {
            resolvedPayment = await tx.payment.update({
              where: { id: resolvedPayment.id },
              data: {
                status: "COMPLETED",
                professionalPayoutAmount: finalPayout,
                capturedAt: resolvedPayment.capturedAt || new Date(),
              },
            });
          } else if (targetMilestoneId && milestone && finalPayout > 0) {
            resolvedPayment = await tx.payment.create({
              data: {
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                jobId: tracking?.jobId,
                amount: milestone.amount,
                baseAmount: milestone.amount,
                clientFeeAmount: 0,
                professionalPayoutAmount: finalPayout,
                adminNetAmount: 0,
                commissionAmount: 0,
                currency: "INR",
                provider: "wallet",
                projectTrackingId: dispute.trackingId,
                milestoneId: milestone.id,
                status: "COMPLETED",
                capturedAt: new Date(),
                idempotencyKey: `dispute-${disputeId}-milestone-${milestone.id}`,
              },
            });
          }

          if (resolvedPayment) {
            await tx.invoice.upsert({
              where: { paymentId: resolvedPayment.id },
              create: {
                invoiceNumber: `INV-${new Date().getFullYear()}-${String(resolvedPayment.id).padStart(6, "0")}`,
                paymentId: resolvedPayment.id,
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                amount: resolvedPayment.amount,
                commissionAmount: resolvedPayment.commissionAmount ?? 0,
                netAmount: finalPayout,
                currency: "INR",
              },
              update: {
                netAmount: finalPayout,
              },
            });
          }

          if (targetMilestoneId) {
            await tx.projectMilestone.update({
              where: { id: targetMilestoneId },
              data: { status: "APPROVED", approvedAt: new Date() },
            });

            const nextMilestone = await tx.projectMilestone.findFirst({
              where: {
                trackingId: dispute.trackingId,
                id: { not: targetMilestoneId },
                status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
              },
              orderBy: { id: "asc" },
            });
            if (nextMilestone) {
              await tx.projectMilestone.update({
                where: { id: nextMilestone.id },
                data: { status: "IN_PROGRESS" },
              });
              await tx.projectTracking.update({
                where: { id: dispute.trackingId },
                data: { status: "IN_PROGRESS", currentStage: nextMilestone.title },
              });
            } else {
              const remainingUnapproved = await tx.projectMilestone.count({
                where: {
                  trackingId: dispute.trackingId,
                  status: { notIn: ["APPROVED", "COMPLETED", "CANCELLED"] },
                },
              });
              if (remainingUnapproved === 0) {
                await tx.projectTracking.update({
                  where: { id: dispute.trackingId },
                  data: { currentStage: null },
                });
              }
            }
          }

          if (finalPayout > 0) {
            await tx.projectTransaction.create({
              data: {
                trackingId: dispute.trackingId,
                milestoneId: targetMilestoneId ?? null,
                clientId: dispute.clientId,
                professionalId: dispute.professionalId,
                amount: resolvedPayment?.amount ?? finalPayout,
                currency: "INR",
                type: "DISPUTE_PAYOUT",
                status: "COMPLETED",
                description: `Dispute #${disputeId} partial settlement: ₹${finalPayout.toLocaleString("en-IN")} released to professional${milestone ? ` for milestone "${milestone.title}"` : ""}`,
              },
            });
          }

          const record = await tx.projectDispute.update({
            where: { id: disputeId },
            data: {
              status: "RESOLVED",
              decision: "PARTIAL_SETTLEMENT",
              decisionReason: reason || "Partial settlement split executed by admin.",
              refundAmount: finalRefund,
              payoutAmount: finalPayout,
              decisionAt: new Date(),
              decidedBy: adminSession.userId,
            },
          });

          await tx.projectTimelineEvent.create({
            data: {
              trackingId: dispute.trackingId,
              actorId: adminSession.userId,
              actorRole: "ADMIN",
              type: "DISPUTE_RESOLVED",
              title: "Dispute decided · Partial Settlement",
              description: `Admin settled case #${disputeId}: ₹${finalRefund.toLocaleString("en-IN")} refunded to client, ₹${finalPayout.toLocaleString("en-IN")} released to professional.${reason ? ` Note: ${reason}` : ""}`,
            },
          });

          return record;
        }
      });

      await notifyDisputeDecided({
        disputeId,
        trackingId: dispute.trackingId,
        jobTitle: job?.title ?? null,
        clientId: dispute.clientId,
        professionalId: dispute.professionalId,
        decision,
        refundAmount: updatedDispute.refundAmount ?? 0,
        payoutAmount: updatedDispute.payoutAmount ?? 0,
        reason: updatedDispute.decisionReason ?? undefined,
      });

      emitRealtimeProjectUpdate([dispute.clientId, dispute.professionalId], {
        projectId: dispute.trackingId,
      });
      return NextResponse.json({ dispute: updatedDispute });
    }

    // Status toggle without decision (e.g. reopen or status change)
    const nextStatus = parsed.data.status ?? "RESOLVED";
    const updated = await db.projectDispute.update({
      where: { id: disputeId },
      data: { status: nextStatus },
    });

    await notifyDisputeResolved({
      trackingId: dispute.trackingId,
      jobTitle: job?.title ?? null,
      status: nextStatus === "RESOLVED" ? "RESOLVED" : "OPEN",
      clientId: dispute.clientId,
      professionalId: dispute.professionalId,
    });

    emitRealtimeProjectUpdate([dispute.clientId, dispute.professionalId], {
      projectId: dispute.trackingId,
    });
    return NextResponse.json({ dispute: updated });
  } catch (error) {
    console.error("admin.dispute.adjudicate.failed", error);
    return NextResponse.json({ error: "Unable to update dispute." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminSession = await getAdminSession(request);
  if (!adminSession) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

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

  const [
    client,
    professional,
    job,
    milestones,
    paid,
    payments,
    disputeCount,
    workUploads,
    clientWallet,
  ] = await Promise.all([
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
          select: {
            id: true,
            title: true,
            amount: true,
            status: true,
            dueDate: true,
            description: true,
            submittedAt: true,
            approvedAt: true,
          },
        })
      : Promise.resolve([]),
    tracking
      ? db.projectTransaction.aggregate({
          where: { trackingId: tracking.id, status: "COMPLETED" },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    tracking
      ? db.payment.findMany({
          where: { projectTrackingId: tracking.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            baseAmount: true,
            professionalPayoutAmount: true,
            status: true,
            milestoneId: true,
            provider: true,
            capturedAt: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    db.projectDispute.count({
      where: { trackingId: dispute.trackingId },
    }),
    tracking
      ? db.projectWorkUpload.findMany({
          where: { trackingId: tracking.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            milestoneId: true,
            roundNumber: true,
            title: true,
            note: true,
            fileName: true,
            fileUrl: true,
            filesJson: true,
            createdAt: true,
            status: true,
          },
        })
      : Promise.resolve([]),
    db.wallet.findUnique({
      where: { userId: dispute.clientId },
      select: { balance: true },
    }),
  ]);

  const approvedMilestones = milestones.filter((item) => item.status === "APPROVED");
  const completedMilestones = approvedMilestones.length;
  const milestoneTotal = milestones.reduce((total, item) => total + item.amount, 0);
  const approvedTotal = approvedMilestones.reduce((total, item) => total + item.amount, 0);
  const paidAmount = paid._sum.amount ?? 0;
  const inEscrow = payments
    .filter((p) => p.status === "FUNDED")
    .reduce((sum, p) => sum + p.amount, 0);

  let evidence: {
    id?: number;
    name: string;
    url: string;
    mimeType?: string;
    sizeBytes?: number;
  }[] = [];
  try {
    if (dispute.attachmentsJson) evidence = JSON.parse(dispute.attachmentsJson);
  } catch (err) {
    void err;
  }

  let responseEvidence: {
    id?: number;
    name: string;
    url: string;
    mimeType?: string;
    sizeBytes?: number;
  }[] = [];
  try {
    if (dispute.responseAttachmentsJson)
      responseEvidence = JSON.parse(dispute.responseAttachmentsJson);
  } catch (err) {
    void err;
  }

  const clientFullName = client ? `${client.firstName} ${client.lastName}`.trim() : "Client";
  const professionalFullName = professional
    ? `${professional.firstName} ${professional.lastName}`.trim()
    : "Professional";
  const formattedMessages = messages.map((m) => ({
    ...m,
    senderName:
      m.senderRole === "ADMIN"
        ? "Klick-Pro Dispute Team (Admin)"
        : m.senderId === dispute.clientId || m.senderRole === "CLIENT"
          ? clientFullName
          : professionalFullName,
  }));

  return NextResponse.json({
    dispute: {
      ...dispute,
      evidence,
      responseEvidence,
    },
    disputeCount,
    disputeLimit: 3,
    messages: formattedMessages,
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
    payments,
    workUploads,
    clientWalletBalance: clientWallet?.balance ?? 0,
    milestoneSummary: { completed: completedMilestones, total: milestones.length },
    financial: {
      milestoneTotal,
      paidAmount,
      inEscrow,
      remainingAmount: Math.max(milestoneTotal - paidAmount, 0),
      approvedTotal,
      unpaidApproved: Math.max(approvedTotal - paidAmount, 0),
    },
  });
}
