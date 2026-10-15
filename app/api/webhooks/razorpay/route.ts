import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isRazorpayWebhookConfigured, verifyRazorpayWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

const paymentEntitySchema = z.object({
  id: z.string().min(1).optional(),
  order_id: z.string().min(1).optional(),
  status: z.string().optional(),
  error_description: z.string().max(500).optional(),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

const payoutEntitySchema = z.object({
  id: z.string().min(1).optional(),
  fund_account_id: z.string().optional(),
  status: z.string().optional(),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  mode: z.string().optional(),
  reference_id: z.string().optional(),
  utr: z.string().optional(),
  failure_reason: z.string().optional(),
  error_description: z.string().optional(),
});

const payloadSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payload: z
    .object({
      payment: z.object({ entity: paymentEntitySchema }).optional(),
      payout: z.object({ entity: payoutEntitySchema }).optional(),
    })
    .optional(),
});

const retryableStatuses = ["RECEIVED", "FAILED"];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Webhook processing failed.";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Razorpay-Signature");
  if (!isRazorpayWebhookConfigured() || !verifyRazorpayWebhookSignature(rawBody, signature))
    return NextResponse.json({ error: "Invalid Razorpay webhook." }, { status: 401 });
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    // Persist receipt outside the processing transaction so a rollback retains a
    // retryable event. ON CONFLICT also handles simultaneous first deliveries.
    await db.razorpayWebhookEvent.createMany({
      data: {
        eventId: payload.id,
        eventName: payload.event,
        payloadJson: rawBody,
        processingStatus: "RECEIVED",
      },
      skipDuplicates: true,
    });
    const existing = await db.razorpayWebhookEvent.findUnique({
      where: { eventId: payload.id },
      select: { processingStatus: true, processingStartedAt: true },
    });
    if (existing?.processingStatus === "PROCESSED") return NextResponse.json({ received: true });
    if (
      existing?.processingStatus === "PROCESSING" &&
      existing.processingStartedAt &&
      Date.now() - existing.processingStartedAt.getTime() < 5 * 60 * 1000
    )
      return NextResponse.json({ received: true, processing: true });
    if (existing?.processingStatus === "PROCESSING") {
      await db.razorpayWebhookEvent.updateMany({
        where: {
          eventId: payload.id,
          processingStatus: "PROCESSING",
          processingStartedAt: existing.processingStartedAt,
        },
        data: { processingStatus: "RECEIVED", processingStartedAt: null },
      });
    }

    await db.$transaction(async (tx) => {
      const claim = await tx.razorpayWebhookEvent.updateMany({
        where: { eventId: payload.id, processingStatus: { in: retryableStatuses } },
        data: {
          processingStatus: "PROCESSING",
          processingAttempts: { increment: 1 },
          processingStartedAt: new Date(),
          lastError: null,
        },
      });
      if (claim.count !== 1) return;

      const entity = payload.payload?.payment?.entity;
      if (entity?.order_id) {
        const payment = await tx.payment.findUnique({
          where: { razorpayOrderId: entity.order_id },
          select: { id: true, status: true, razorpayPaymentId: true, amount: true, currency: true },
        });
        const walletTx = !payment
          ? await tx.walletTransaction.findUnique({
              where: { providerReference: entity.order_id },
              select: { id: true, walletId: true, amount: true, status: true },
            })
          : null;

        if (!payment && !walletTx) {
          throw new Error("Razorpay order is not linked to a local payment or wallet transaction.");
        }

        if (payment) {
          if (entity.id && payment.razorpayPaymentId && entity.id !== payment.razorpayPaymentId)
            throw new Error("Razorpay payment does not match the local payment.");
          if (entity.amount !== undefined && entity.amount !== payment.amount * 100)
            throw new Error("Razorpay amount does not match the local payment.");
          if (entity.currency && entity.currency !== payment.currency)
            throw new Error("Razorpay currency does not match the local payment.");

          if (payload.event === "payment.captured") {
            await tx.payment.updateMany({
              where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
              data: { status: "COMPLETED", capturedAt: new Date(), razorpayPaymentId: entity.id },
            });
          }
          if (payload.event === "payment.failed") {
            await tx.payment.updateMany({
              where: { id: payment.id, status: "PENDING" },
              data: {
                status: "FAILED",
                failureReason: entity.error_description ?? "Payment failed.",
              },
            });
          }
        }

        if (walletTx) {
          if (entity.amount !== undefined && entity.amount !== walletTx.amount * 100)
            throw new Error("Razorpay amount does not match the local wallet transaction.");
          if (entity.currency && entity.currency !== "INR")
            throw new Error("Razorpay currency does not match the local wallet transaction.");

          if (payload.event === "payment.captured") {
            const claimed = await tx.walletTransaction.updateMany({
              where: { id: walletTx.id, status: { in: ["PENDING", "FAILED"] } },
              data: {
                status: "COMPLETED",
                description: `Wallet funded via Razorpay (${entity.id ?? entity.order_id})`,
                metadataJson: JSON.stringify({ providerPaymentId: entity.id }),
              },
            });
            if (claimed.count === 1) {
              await tx.wallet.update({
                where: { id: walletTx.walletId },
                data: { balance: { increment: walletTx.amount } },
              });
            }
          }
          if (payload.event === "payment.failed") {
            await tx.walletTransaction.updateMany({
              where: { id: walletTx.id, status: "PENDING" },
              data: {
                status: "FAILED",
                metadataJson: JSON.stringify({
                  reason: entity.error_description ?? "Payment failed.",
                }),
              },
            });
          }
        }
      }

      const payoutEntity = payload.payload?.payout?.entity;
      if (payoutEntity?.id) {
        const withdrawal = await tx.projectWithdrawal.findFirst({
          where: {
            OR: [
              { providerTransferId: payoutEntity.id },
              ...(payoutEntity.reference_id
                ? [{ providerTransferId: payoutEntity.reference_id }]
                : []),
            ],
          },
        });

        if (withdrawal) {
          if (payload.event === "payout.processed") {
            await tx.projectWithdrawal.update({
              where: { id: withdrawal.id },
              data: {
                status: "COMPLETED",
                utr: payoutEntity.utr ?? withdrawal.utr,
                payoutMode: payoutEntity.mode ?? withdrawal.payoutMode,
                processedAt: new Date(),
                failureReason: null,
              },
            });
            await tx.walletTransaction.updateMany({
              where: { idempotencyKey: `payout-${withdrawal.id}`, status: { in: ["PENDING", "PROCESSING"] } },
              data: { status: "COMPLETED", providerReference: payoutEntity.id },
            });
          } else if (payload.event === "payout.failed") {
            const failReason =
              payoutEntity.failure_reason ??
              payoutEntity.error_description ??
              "Payout failed on banking rails.";
            // If funds were deducted while processing, restore balance
            if (withdrawal.status === "PROCESSING") {
              await tx.wallet.update({
                where: { userId: withdrawal.professionalId },
                data: { balance: { increment: withdrawal.amount } },
              });
            }
            await tx.projectWithdrawal.update({
              where: { id: withdrawal.id },
              data: {
                status: "FAILED",
                failureReason: failReason,
              },
            });
            await tx.walletTransaction.updateMany({
              where: { idempotencyKey: `payout-${withdrawal.id}` },
              data: { status: "FAILED" },
            });
            const targetUser = await tx.user.findUnique({
              where: { id: withdrawal.professionalId },
              select: { role: true },
            });
            const earningsHref =
              targetUser?.role === "CLIENT" ? "/client/earnings" : "/professional/earnings";

            await tx.userNotification.create({
              data: {
                userId: withdrawal.professionalId,
                type: "PAYOUT_FAILED",
                title: "Withdrawal Failed - Balance Restored",
                description: `Your withdrawal of ₹${withdrawal.amount.toLocaleString("en-IN")} failed (${failReason}). Your wallet balance has been restored.`,
                href: earningsHref,
              },
            });
          } else if (payload.event === "payout.reversed") {
            const failReason =
              payoutEntity.failure_reason ??
              payoutEntity.error_description ??
              "Payout reversed by beneficiary bank / NPCI.";
            // If the withdrawal was completed earlier, refund balance to user
            if (withdrawal.status === "COMPLETED") {
              await tx.wallet.update({
                where: { userId: withdrawal.professionalId },
                data: { balance: { increment: withdrawal.amount } },
              });
              const userWallet = await tx.wallet.findUnique({
                where: { userId: withdrawal.professionalId },
              });
              if (userWallet) {
                await tx.walletTransaction.create({
                  data: {
                    walletId: userWallet.id,
                    amount: withdrawal.amount,
                    type: "REFUND",
                    status: "COMPLETED",
                    description: `Refund: Payout reversed by bank rails (Withdrawal #${withdrawal.id})`,
                    idempotencyKey: `reversal-${withdrawal.id}-${payload.id}`,
                    providerReference: payoutEntity.id,
                    metadataJson: JSON.stringify({
                      payoutId: payoutEntity.id,
                      reason: failReason,
                      reversedAt: new Date().toISOString(),
                    }),
                  },
                });
              }
            }
            await tx.projectWithdrawal.update({
              where: { id: withdrawal.id },
              data: {
                status: "REVERSED",
                failureReason: failReason,
              },
            });

            const targetUser = await tx.user.findUnique({
              where: { id: withdrawal.professionalId },
              select: { role: true },
            });
            const earningsHref =
              targetUser?.role === "CLIENT" ? "/client/earnings" : "/professional/earnings";

            await tx.userNotification.create({
              data: {
                userId: withdrawal.professionalId,
                type: "PAYOUT_REVERSED",
                title: "Withdrawal Reversed - Balance Refunded",
                description: `Your payout of ₹${withdrawal.amount.toLocaleString("en-IN")} was reversed by the banking network (${failReason}). The amount has been credited back to your wallet.`,
                href: earningsHref,
              },
            });
          }
        }
      }

      await tx.razorpayWebhookEvent.update({
        where: { eventId: payload.id },
        data: {
          processingStatus: "PROCESSED",
          processedAt: new Date(),
          processingStartedAt: null,
          lastError: null,
        },
      });
    });
  } catch (error) {
    await db.razorpayWebhookEvent.updateMany({
      where: { eventId: payload.id, processingStatus: { in: ["RECEIVED", "FAILED"] } },
      data: {
        processingStatus: "FAILED",
        processingStartedAt: null,
        lastError: errorMessage(error),
      },
    });
    console.error("webhooks.razorpay.failed", { eventId: payload.id, error: errorMessage(error) });
    return NextResponse.json({ error: "Unable to process Razorpay webhook." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
