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

const payloadSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  payload: z.object({ payment: z.object({ entity: paymentEntitySchema }).optional() }).optional(),
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

          if (payload.event === "payment.captured") {
            if (walletTx.status === "PENDING") {
              await tx.wallet.update({
                where: { id: walletTx.walletId },
                data: { balance: { increment: walletTx.amount } },
              });
              await tx.walletTransaction.update({
                where: { id: walletTx.id },
                data: {
                  status: "COMPLETED",
                  description: `Wallet funded via Razorpay (${entity.id ?? entity.order_id})`,
                },
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
