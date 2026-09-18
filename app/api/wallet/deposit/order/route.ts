import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { createRazorpayOrder, isRazorpayConfigured, razorpayConfig } from "@/lib/razorpay";
import { ensureWallet } from "@/lib/wallet-ledger";

const schema = z.object({ amount: z.number().int().positive().max(1_000_000) });

export async function POST(request: NextRequest) {
  if (!isRazorpayConfigured())
    return NextResponse.json(
      { error: "Online wallet funding is not configured." },
      { status: 503 },
    );
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }
  if (session.role !== "CLIENT")
    return NextResponse.json({ error: "Only clients can fund a wallet." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  const order = await createRazorpayOrder({
    amountRupees: parsed.data.amount,
    receipt: `servio_wallet_${session.userId}_${Date.now()}`,
    notes: { purpose: "wallet_top_up", clientId: String(session.userId) },
  });
  if (!order)
    return NextResponse.json({ error: "Unable to create wallet top-up." }, { status: 503 });
  const wallet = await ensureWallet(session.userId);
  const transaction = await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: parsed.data.amount,
      type: "WALLET_TOP_UP",
      status: "PENDING",
      description: `Wallet top-up: ${parsed.data.amount}`,
      providerReference: order.orderId,
      idempotencyKey: `wallet-topup-${order.orderId}`,
    },
  });
  return NextResponse.json({
    enabled: true,
    keyId: razorpayConfig().keyId,
    orderId: order.orderId,
    amount: transaction.amount * 100,
    currency: "INR",
  });
}
