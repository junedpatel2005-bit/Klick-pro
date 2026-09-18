import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { createRazorpayPaymentTransfer, isRazorpayRouteConfigured } from "@/lib/razorpay";

const bodySchema = z.object({
  withdrawalId: z.number().int().positive(),
  paymentId: z.number().int().positive(),
});

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
  if (!isRazorpayRouteConfigured())
    return NextResponse.json({ error: "Razorpay Route payouts are not enabled." }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Withdrawal and captured payment are required." },
      { status: 400 },
    );
  const withdrawal = await db.projectWithdrawal.findUnique({
    where: { id: parsed.data.withdrawalId },
  });
  const payment = await db.payment.findUnique({ where: { id: parsed.data.paymentId } });
  if (!withdrawal || withdrawal.status !== "PENDING")
    return NextResponse.json({ error: "Withdrawal is no longer pending." }, { status: 409 });
  if (
    !payment ||
    payment.status !== "COMPLETED" ||
    payment.professionalId !== withdrawal.professionalId ||
    !payment.razorpayPaymentId
  )
    return NextResponse.json(
      { error: "Select a captured Razorpay payment for this professional." },
      { status: 400 },
    );
  const professional = await db.user.findUnique({
    where: { id: withdrawal.professionalId },
    select: { razorpayAccountId: true },
  });
  if (!professional?.razorpayAccountId)
    return NextResponse.json(
      { error: "Professional has not saved a Razorpay Route linked account." },
      { status: 400 },
    );
  try {
    const transferId = await createRazorpayPaymentTransfer({
      paymentId: payment.razorpayPaymentId,
      accountId: professional.razorpayAccountId,
      amountRupees: withdrawal.amount,
      referenceId: String(withdrawal.id),
    });
    const updated = await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.professionalId } });
      if (
        !wallet ||
        wallet.balance < withdrawal.amount ||
        wallet.pendingBalance < withdrawal.amount
      )
        throw new Error("Professional wallet reservation is no longer available.");
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: withdrawal.amount },
          pendingBalance: { decrement: withdrawal.amount },
        },
      });
      return tx.projectWithdrawal.update({
        where: { id: withdrawal.id },
        data: {
          paymentId: payment.id,
          providerTransferId: transferId,
          status: "COMPLETED",
          processedAt: new Date(),
          failureReason: null,
        },
      });
    });
    return NextResponse.json({ withdrawal: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay transfer failed.";
    await db.$transaction(async (tx) => {
      await tx.projectWithdrawal.update({
        where: { id: withdrawal.id },
        data: { paymentId: payment.id, status: "FAILED", failureReason: message },
      });
      await tx.wallet.updateMany({
        where: { userId: withdrawal.professionalId, pendingBalance: { gte: withdrawal.amount } },
        data: { pendingBalance: { decrement: withdrawal.amount } },
      });
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
