import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import {
  createRazorpayPaymentTransfer,
  isRazorpayRouteConfigured,
  verifyRazorpayLinkedAccount,
} from "@/lib/razorpay";

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
  if (!withdrawal) return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
  if (withdrawal.status !== "PENDING")
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
  // Re-verify the destination immediately before sending money. A professional
  // can change their saved account at any time, and a stale or unowned id must
  // never be paid out.
  const accountCheck = await verifyRazorpayLinkedAccount(professional.razorpayAccountId);
  if (!accountCheck.ok) {
    const message =
      accountCheck.reason === "not_found"
        ? "The professional's Razorpay linked account no longer exists on our account."
        : accountCheck.reason === "inactive"
          ? "The professional's Razorpay linked account is not activated."
          : "Razorpay could not verify the payout account. Try again shortly.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Phase 1: deduct the funds and claim the row, entirely BEFORE any money
  // moves. Doing this first means an insufficient balance or a lost race fails
  // while the Razorpay balance is still untouched.
  try {
    await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: withdrawal.professionalId },
      });
      if (
        !wallet ||
        wallet.balance < withdrawal.amount ||
        wallet.pendingBalance < withdrawal.amount
      )
        throw new Error("Professional wallet reservation is no longer available.");

      const claimed = await tx.projectWithdrawal.updateMany({
        where: { id: withdrawal.id, status: "PENDING" },
        data: { status: "PROCESSING", paymentId: payment.id },
      });
      if (claimed.count !== 1) throw new Error("Withdrawal is already being processed.");

      // pendingBalance was reserved when the withdrawal was requested, so the
      // reservation is consumed here; balance is what actually leaves.
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: withdrawal.amount },
          pendingBalance: { decrement: withdrawal.amount },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve payout funds.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Phase 2: move the money. The funds are already deducted, so a failure here
  // has to put them back.
  let transferId: string;
  try {
    const created = await createRazorpayPaymentTransfer({
      paymentId: payment.razorpayPaymentId,
      accountId: accountCheck.accountId,
      amountRupees: withdrawal.amount,
      referenceId: String(withdrawal.id),
    });
    // Null means Route payouts are not configured, which is already rejected
    // above. Treat it as a failure rather than recording a null transfer id.
    if (!created) throw new Error("Razorpay transfer could not be created.");
    transferId = created;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay transfer failed.";
    await db.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { userId: withdrawal.professionalId },
        data: { balance: { increment: withdrawal.amount } },
      });
      await tx.projectWithdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "FAILED", failureReason: message },
      });
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Phase 3: record the transfer. If this write fails the row stays PROCESSING
  // for reconciliation, which is recoverable, rather than being marked FAILED
  // after the money has already left.
  const updated = await db.projectWithdrawal.update({
    where: { id: withdrawal.id },
    data: {
      providerTransferId: transferId,
      status: "COMPLETED",
      processedAt: new Date(),
      failureReason: null,
    },
  });
  return NextResponse.json({ withdrawal: updated });
}
