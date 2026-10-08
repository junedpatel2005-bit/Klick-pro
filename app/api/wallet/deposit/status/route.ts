import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { fetchRazorpayOrderPayments, isRazorpayConfigured } from "@/lib/razorpay";
import { creditWalletFromVerifiedProvider } from "@/lib/wallet-ledger";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });

  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Order ID parameter is required." }, { status: 400 });
  }

  const transaction = await db.walletTransaction.findFirst({
    where: {
      providerReference: orderId,
      wallet: { userId: session.userId },
    },
    include: { wallet: true },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Wallet transaction not found." }, { status: 404 });
  }

  // Already completed in database
  if (transaction.status === "COMPLETED") {
    return NextResponse.json({
      status: "COMPLETED",
      amount: transaction.amount,
      alreadyCompleted: true,
    });
  }

  // If not completed, reconcile directly with Razorpay's API
  if (isRazorpayConfigured()) {
    try {
      const payments = await fetchRazorpayOrderPayments(orderId);
      const capturedPayment = payments.find(
        (p) =>
          p.status === "captured" && p.amount === transaction.amount * 100 && p.currency === "INR",
      );

      if (capturedPayment) {
        try {
          await db.$transaction((tx) =>
            creditWalletFromVerifiedProvider(tx, {
              userId: session.userId,
              amount: transaction.amount,
              providerReference: orderId,
              providerPaymentId: capturedPayment.id,
            }),
          );
          return NextResponse.json({
            status: "COMPLETED",
            amount: transaction.amount,
            reconciled: true,
          });
        } catch {
          // If concurrent request already claimed it, verify status
          const recheck = await db.walletTransaction.findUnique({
            where: { id: transaction.id },
          });
          if (recheck?.status === "COMPLETED") {
            return NextResponse.json({
              status: "COMPLETED",
              amount: transaction.amount,
              alreadyCompleted: true,
            });
          }
        }
      }
    } catch (err) {
      console.warn(
        "Status reconciliation warning:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return NextResponse.json({
    status: transaction.status,
    amount: transaction.amount,
  });
}
