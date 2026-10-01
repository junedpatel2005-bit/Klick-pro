import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";
import { ensureWallet, creditWalletFromVerifiedProvider } from "@/lib/wallet-ledger";

const schema = z.object({ amount: z.number().int().positive().max(1_000_000) });

export async function POST(request: NextRequest) {
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

  const amountRupees = parsed.data.amount;
  let orderId = `quick_order_${Date.now()}`;

  // If Razorpay is configured, generate the actual Razorpay Order on Razorpay's API
  if (isRazorpayConfigured()) {
    try {
      const order = await createRazorpayOrder({
        amountRupees,
        receipt: `wtop_${session.userId}_${Date.now()}`.slice(0, 40),
        notes: { purpose: "quick_shortcut_top_up", clientId: String(session.userId) },
      });
      if (order?.orderId) {
        orderId = order.orderId;
      }
    } catch (err) {
      console.warn("Razorpay quick order creation warning:", err);
    }
  }

  const wallet = await ensureWallet(session.userId);
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Record pending transaction in database
  await db.walletTransaction.create({
    data: {
      walletId: wallet.id,
      amount: amountRupees,
      type: "WALLET_TOP_UP",
      status: "PENDING",
      description: `Wallet top-up (Shortcut): ${amountRupees}`,
      providerReference: orderId,
      idempotencyKey: `wallet-quick-${orderId}`,
    },
  });

  // Atomically claim transaction and credit the wallet balance
  await db.$transaction((tx) =>
    creditWalletFromVerifiedProvider(tx, {
      userId: session.userId,
      amount: amountRupees,
      providerReference: orderId,
      providerPaymentId: paymentId,
    }),
  );

  const updatedWallet = await db.wallet.findUnique({
    where: { id: wallet.id },
    select: { balance: true },
  });

  return NextResponse.json({
    ok: true,
    amount: amountRupees,
    orderId,
    paymentId,
    newBalance: updatedWallet?.balance ?? 0,
  });
}

