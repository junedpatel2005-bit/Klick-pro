import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { isRazorpayConfigured, verifyRazorpayPaymentSignature } from "@/lib/razorpay";
import { creditWalletFromVerifiedProvider } from "@/lib/wallet-ledger";

const schema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  if (!isRazorpayConfigured())
    return NextResponse.json({ error: "Online payments are not configured." }, { status: 503 });
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }
  if (session.role !== "CLIENT")
    return NextResponse.json({ error: "Client access required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    !verifyRazorpayPaymentSignature(
      parsed.data.razorpayOrderId,
      parsed.data.razorpayPaymentId,
      parsed.data.razorpaySignature,
    )
  )
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  const transaction = await db.walletTransaction.findUnique({
    where: { providerReference: parsed.data.razorpayOrderId },
    include: { wallet: true },
  });
  if (!transaction || transaction.wallet.userId !== session.userId)
    return NextResponse.json({ error: "Wallet top-up not found." }, { status: 404 });
  if (transaction.status === "COMPLETED")
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  await db.$transaction((tx) =>
    creditWalletFromVerifiedProvider(tx, {
      userId: session.userId,
      amount: transaction.amount,
      providerReference: parsed.data.razorpayOrderId,
      providerPaymentId: parsed.data.razorpayPaymentId,
    }),
  );
  return NextResponse.json({ ok: true, amount: transaction.amount });
}
