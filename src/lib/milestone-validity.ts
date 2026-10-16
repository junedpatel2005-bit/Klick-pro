import "server-only";
import { db } from "@/lib/db";
import {
  calculateMilestoneMoney,
  fundMilestoneFromWallet,
  releaseMilestoneToProfessional,
} from "@/lib/wallet-ledger";
import { getPlatformCommissionRate } from "@/lib/platform-settings";
import { notifyMilestonePayoutApproved } from "@/lib/marketplace-notifications";
import { emitRealtimeProjectUpdate } from "@/lib/realtime";

/**
 * Checks for any milestones whose validity period has elapsed (now >= releaseAt),
 * verifies no active dispute is pending, and automatically releases funds to the professional.
 */
export async function processMilestoneValidityReleases(trackingId?: number) {
  try {
    const now = new Date();
    const candidateMilestones = await db.projectMilestone.findMany({
      where: {
        ...(trackingId ? { trackingId } : {}),
        validityDays: { gt: 0 },
        releaseAt: { lte: now },
        autoReleaseStatus: { in: ["PENDING", "PAUSED_DISPUTE"] },
      },
      include: {
        tracking: {
          select: {
            id: true,
            clientId: true,
            professionalId: true,
            job: { select: { title: true } },
          },
        },
        payment: true,
      },
      orderBy: { releaseAt: "asc" },
      take: 50,
    });

    if (candidateMilestones.length === 0) return { processed: 0 };

    let processedCount = 0;

    for (const milestone of candidateMilestones) {
      // 1. Check for any open/unresolved disputes on this project or milestone
      const openDispute = await db.projectDispute.findFirst({
        where: {
          trackingId: milestone.trackingId,
          status: { notIn: ["RESOLVED", "CLOSED"] },
          OR: [
            { milestoneId: milestone.id },
            { milestoneId: null },
          ],
        },
      });

      if (openDispute) {
        // A dispute is open! Stop payment release and do NOT debit client wallet until dispute is resolved.
        if (milestone.autoReleaseStatus !== "PAUSED_DISPUTE") {
          await db.projectMilestone.update({
            where: { id: milestone.id },
            data: { autoReleaseStatus: "PAUSED_DISPUTE" },
          }).catch(() => {});
        }
        continue;
      } else if (milestone.autoReleaseStatus === "PAUSED_DISPUTE") {
        // Dispute was resolved/closed! Reset milestone autoReleaseStatus to PENDING
        await db.projectMilestone.update({
          where: { id: milestone.id },
          data: { autoReleaseStatus: "PENDING" },
        }).catch(() => {});
        milestone.autoReleaseStatus = "PENDING";
      }

      // 2. Perform release in an isolated transaction
      try {
        const released = await db.$transaction(async (tx) => {
          const claim = await tx.projectMilestone.updateMany({
            where: {
              id: milestone.id,
              autoReleaseStatus: { in: ["PENDING", "PAUSED_DISPUTE"] },
            },
            data: {
              autoReleaseStatus: "PROCESSING",
            },
          });

          if (claim.count !== 1) return null;

          const payment = milestone.payment;
          if (payment && payment.provider === "wallet" && payment.status !== "COMPLETED") {
            const commissionRate = await getPlatformCommissionRate();
            const money = calculateMilestoneMoney(milestone.amount, commissionRate);

            // Step 1: If not already held in escrow, debit from client wallet (no negative overdraft)
            if (payment.status !== "FUNDED") {
              await fundMilestoneFromWallet(tx, {
                paymentId: payment.id,
                clientId: milestone.clientId,
                professionalId: milestone.professionalId,
                baseAmount: milestone.amount,
                milestoneId: milestone.id,
                customCommissionRate: commissionRate,
                allowNegativeBalance: false,
              });
            }

            // Step 2: Release from platform escrow to professional wallet
            await releaseMilestoneToProfessional(tx, {
              paymentId: payment.id,
              clientId: milestone.clientId,
              professionalId: milestone.professionalId,
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
          }

          await tx.projectMilestone.update({
            where: { id: milestone.id },
            data: {
              autoReleaseStatus: "RELEASED",
              status: "APPROVED",
            },
          });

          await tx.projectTransaction.create({
            data: {
              trackingId: milestone.trackingId,
              milestoneId: milestone.id,
              clientId: milestone.clientId,
              professionalId: milestone.professionalId,
              amount: milestone.amount,
              currency: "INR",
              type: "WALLET_MILESTONE_RELEASED",
              status: "COMPLETED",
              description: `Milestone validity period ended (${milestone.validityDays} days). Auto-released: ${milestone.title}`,
            },
          });

          await tx.projectTimelineEvent.create({
            data: {
              trackingId: milestone.trackingId,
              actorId: milestone.professionalId,
              actorRole: "SYSTEM",
              type: "MILESTONE_PAID",
              title: "Milestone payment released",
              description: `Funds for milestone "${milestone.title}" have been automatically released to the professional following the ${milestone.validityDays}-day inspection validity period.`,
            },
          });

          return true;
        });

        if (released) {
          processedCount++;

          // Send notification to professional
          try {
            await notifyMilestonePayoutApproved({
              professionalId: milestone.professionalId,
              clientId: milestone.clientId,
              projectId: milestone.trackingId,
              milestoneTitle: milestone.title,
              payoutAmount: milestone.payment?.professionalPayoutAmount ?? milestone.amount,
              platformEarnings: milestone.payment?.commissionAmount ?? 0,
              jobTitle: milestone.tracking.job.title ?? undefined,
            });
          } catch (notifErr) {
            console.error("Failed to send milestone release notification:", notifErr);
          }

          // Emit realtime project update
          emitRealtimeProjectUpdate([milestone.clientId, milestone.professionalId], {
            projectId: milestone.trackingId,
          });
        }
      } catch (itemErr) {
        console.error(`Failed to release milestone #${milestone.id}:`, itemErr);
        // Reset from PROCESSING back to PENDING if failed
        await db.projectMilestone.updateMany({
          where: { id: milestone.id, autoReleaseStatus: "PROCESSING" },
          data: { autoReleaseStatus: "PENDING" },
        }).catch(() => {});
      }
    }

    return { processed: processedCount };
  } catch (error) {
    console.error("Error running processMilestoneValidityReleases:", error);
    return { processed: 0, error };
  }
}
