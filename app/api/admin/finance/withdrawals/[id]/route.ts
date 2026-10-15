import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

async function isAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return false;
  try {
    return (await verifySession(token)).role === "ADMIN";
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  status: z.enum(["PROCESSING", "COMPLETED", "FAILED"]),
  failureReason: z.string().trim().max(300).optional(),
  utr: z.string().trim().max(100).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0)
    return NextResponse.json({ error: "Invalid withdrawal id." }, { status: 400 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
  const withdrawal = await db.projectWithdrawal.findUnique({ where: { id } });
  if (!withdrawal || (withdrawal.status !== "PENDING" && withdrawal.status !== "PROCESSING"))
    return NextResponse.json(
      { error: "Only pending or processing withdrawal requests can be updated." },
      { status: 409 },
    );
  try {
    const updated = await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.professionalId } });
      if (!wallet) throw new Error("Professional wallet not found.");

      const targetUser = await tx.user.findUnique({
        where: { id: withdrawal.professionalId },
        select: { role: true },
      });
      const earningsHref =
        targetUser?.role === "CLIENT" ? "/client/earnings" : "/professional/earnings";

      if (parsed.data.status === "COMPLETED") {
        const settled = await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            balance: { gte: withdrawal.amount },
            pendingBalance: { gte: withdrawal.amount },
          },
          data: {
            balance: { decrement: withdrawal.amount },
            pendingBalance: { decrement: withdrawal.amount },
          },
        });
        if (settled.count !== 1)
          throw new Error("Professional wallet reservation is no longer available.");

        // Record transaction ledger row
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -withdrawal.amount,
            type: "WITHDRAWAL",
            status: "COMPLETED",
            description: `Withdrawal of ₹${withdrawal.amount.toLocaleString(
              "en-IN",
            )} approved & paid by Admin (${withdrawal.destinationType || "BANK"})`,
            idempotencyKey: `payout-${withdrawal.id}`,
            metadataJson: JSON.stringify({
              withdrawalId: withdrawal.id,
              destinationType: withdrawal.destinationType,
              destinationLabel: withdrawal.destinationLabel,
              utr: parsed.data.utr ?? withdrawal.utr,
            }),
          },
        });

        // Notify user
        await tx.userNotification.create({
          data: {
            userId: withdrawal.professionalId,
            type: "PAYOUT_COMPLETED",
            title: "Withdrawal Approved & Paid",
            description: `Your withdrawal request of ₹${withdrawal.amount.toLocaleString(
              "en-IN",
            )} has been approved and paid by Admin. Money is in your bank account!`,
            href: earningsHref,
          },
        });
      } else if (parsed.data.status === "PROCESSING") {
        // Payout approved and dispatched to bank
        await tx.userNotification.create({
          data: {
            userId: withdrawal.professionalId,
            type: "PAYOUT_PROCESSING",
            title: "Withdrawal Approved by Admin",
            description: `Your withdrawal request of ₹${withdrawal.amount.toLocaleString(
              "en-IN",
            )} was approved by Admin. Payout transfer is in progress — please wait for money in your bank.`,
            href: earningsHref,
          },
        });
      } else {
        // FAILED: unreserve pending balance
        await tx.wallet.updateMany({
          where: { id: wallet.id, pendingBalance: { gte: withdrawal.amount } },
          data: { pendingBalance: { decrement: withdrawal.amount } },
        });

        // Notify user about rejection
        await tx.userNotification.create({
          data: {
            userId: withdrawal.professionalId,
            type: "PAYOUT_FAILED",
            title: "Withdrawal Request Rejected",
            description: `Your withdrawal request of ₹${withdrawal.amount.toLocaleString(
              "en-IN",
            )} was rejected: ${
              parsed.data.failureReason ?? "Rejected by admin."
            }. Reserved funds have been restored to your wallet balance.`,
            href: earningsHref,
          },
        });
      }

      return tx.projectWithdrawal.update({
        where: { id },
        data: {
          status: parsed.data.status,
          processedAt: new Date(),
          failureReason:
            parsed.data.status === "FAILED"
              ? (parsed.data.failureReason ?? "Rejected by admin.")
              : null,
          utr: parsed.data.utr ?? undefined,
        },
      });
    });
    return NextResponse.json({ withdrawal: updated });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Professional wallet reservation is no longer available."
    )
      return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
