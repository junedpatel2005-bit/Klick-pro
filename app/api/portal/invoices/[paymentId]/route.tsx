import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { InvoiceDocument } from "@/lib/reports/pdf/InvoiceDocument";

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
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { milestone: { select: { title: true } } },
  });
  if (!payment || payment.status !== "COMPLETED")
    return NextResponse.json({ error: "Completed payment not found." }, { status: 404 });
  if (
    session.role !== "ADMIN" &&
    session.userId !== payment.clientId &&
    session.userId !== payment.professionalId
  )
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const invoice = await db.invoice.upsert({
    where: { paymentId: payment.id },
    create: {
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(payment.id).padStart(6, "0")}`,
      paymentId: payment.id,
      clientId: payment.clientId,
      professionalId: payment.professionalId,
      amount: payment.amount,
      commissionAmount: payment.adminNetAmount,
      netAmount: payment.professionalPayoutAmount,
      currency: payment.currency,
    },
    update: {},
  });
  const [client, professional] = await Promise.all([
    db.user.findUnique({
      where: { id: payment.clientId },
      select: { firstName: true, lastName: true, email: true, phone: true, address: true },
    }),
    db.user.findUnique({
      where: { id: payment.professionalId },
      select: { firstName: true, lastName: true, email: true, phone: true, address: true },
    }),
  ]);
  const buffer = await renderReportPdf(
    <InvoiceDocument
      invoiceNumber={invoice.invoiceNumber}
      issuedAt={invoice.issuedAt}
      status={payment.status === "COMPLETED" ? "Paid" : payment.status}
      description={payment.milestone?.title ?? "Marketplace milestone payment"}
      from={{ name: "Klick-Pro", tagline: "Trusted local services marketplace" }}
      billedTo={{
        name: `${client?.firstName ?? ""} ${client?.lastName ?? ""}`.trim(),
        email: client?.email,
        phone: client?.phone,
        address: client?.address,
      }}
      paidTo={{
        name: `${professional?.firstName ?? ""} ${professional?.lastName ?? ""}`.trim(),
        email: professional?.email,
        phone: professional?.phone,
        address: professional?.address,
      }}
      grossAmount={invoice.amount}
      commissionAmount={invoice.commissionAmount}
      netAmount={invoice.netAmount}
      currency={invoice.currency}
      paymentReference={payment.razorpayPaymentId ?? payment.providerReference}
    />,
  );
  return pdfResponse(buffer, `${invoice.invoiceNumber}.pdf`);
}
