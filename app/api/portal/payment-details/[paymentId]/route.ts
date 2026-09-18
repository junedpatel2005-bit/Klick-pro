import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }
  const paymentId = Number((await params).paymentId);
  if (!Number.isInteger(paymentId) || paymentId < 1)
    return NextResponse.json({ error: "Invalid payment ID." }, { status: 400 });
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  if (
    session.role !== "ADMIN" &&
    session.userId !== payment.clientId &&
    session.userId !== payment.professionalId
  )
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const milestone = payment.milestoneId
    ? await db.projectMilestone.findUnique({
        where: { id: payment.milestoneId },
        select: { id: true, title: true, amount: true },
      })
    : null;
  return NextResponse.json({
    id: payment.id,
    amount: payment.amount,
    baseAmount: payment.baseAmount,
    clientFeeAmount: payment.clientFeeAmount,
    professionalPayoutAmount: payment.professionalPayoutAmount,
    adminNetAmount: payment.adminNetAmount,
    commissionAmount: payment.commissionAmount,
    currency: payment.currency,
    provider: payment.provider,
    status: payment.status,
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId,
    failureReason: payment.failureReason,
    createdAt: payment.createdAt,
    capturedAt: payment.capturedAt,
    milestone,
  });
}
