import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ensureWallet } from "@/lib/wallet-ledger";
import { Prisma } from "@/generated/prisma/client";

async function sessionFrom(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}
export async function GET(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const wallet = await ensureWallet(session.userId);
  const transactions = await db.walletTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const earned = await db.walletTransaction.aggregate({
    where: { walletId: wallet.id, type: "MILESTONE_EARNING", status: "COMPLETED" },
    _sum: { amount: true },
  });
  const commission = await db.payment.aggregate({
    where: { professionalId: session.userId, status: "COMPLETED" },
    _sum: { commissionAmount: true },
  });
  const canWithdraw = session.role === "PROFESSIONAL" || session.role === "CLIENT";
  const withdrawals = canWithdraw ? wallet.pendingBalance : 0;
  const withdrawalHistory = canWithdraw
    ? await db.projectWithdrawal.findMany({
        where: { professionalId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const available = canWithdraw ? Math.max(0, wallet.balance - withdrawals) : wallet.balance;
  return NextResponse.json({
    wallet,
    total: earned._sum.amount ?? 0,
    grossTotal: earned._sum.amount ?? 0,
    commission: commission?._sum.commissionAmount ?? 0,
    available,
    reserved: withdrawals,
    withdrawals: withdrawalHistory,
    transactions,
  });
}
export async function POST(request: NextRequest) {
  const session = await sessionFrom(request);
  if (!session || (session.role !== "PROFESSIONAL" && session.role !== "CLIENT"))
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  const parsed = z
    .object({
      amount: z.number().int().positive(),
      destinationType: z.enum(["BANK", "CARD", "UPI"]).default("BANK"),
      destinationLabel: z.string().trim().min(2).max(120),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid withdrawal amount and payout destination." },
      { status: 400 },
    );
  const wallet = await ensureWallet(session.userId);
  let withdrawal;
  try {
    withdrawal = await db.$transaction(async (tx) => {
      const reserved = await tx.$executeRaw(
        Prisma.sql`UPDATE "Wallet"
          SET "pendingBalance" = "pendingBalance" + ${parsed.data.amount}
          WHERE "id" = ${wallet.id}
            AND "balance" - "pendingBalance" >= ${parsed.data.amount}`,
      );
      if (reserved !== 1) throw new Error("Withdrawal amount exceeds your available balance.");
      return tx.projectWithdrawal.create({
        data: {
          professionalId: session.userId,
          amount: parsed.data.amount,
          destinationType: parsed.data.destinationType,
          destinationLabel: parsed.data.destinationLabel,
          status: "PENDING",
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Withdrawal amount exceeds your available balance."
    )
      return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  return NextResponse.json({ withdrawal }, { status: 201 });
}
