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
  const isAdmin = session.role === "ADMIN";
  const isClient = session.userId === payment.clientId;
  return NextResponse.json({
    id: payment.id,
    amount: isClient || isAdmin ? payment.amount : payment.baseAmount,
    baseAmount: payment.baseAmount,
    clientFeeAmount: isClient || isAdmin ? payment.clientFeeAmount : 0,
    professionalPayoutAmount:
      !isClient || isAdmin ? payment.professionalPayoutAmount : payment.baseAmount,
    adminNetAmount: isAdmin ? payment.adminNetAmount : 0,
    commissionAmount: !isClient || isAdmin ? payment.commissionAmount : 0,
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
