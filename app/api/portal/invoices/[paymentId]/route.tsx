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
  const isClientView = session.userId === payment.clientId;
  const isProfessionalView = session.userId === payment.professionalId;
  const visibleAmounts = isClientView
    ? {
        gross: payment.amount,
        fee: payment.clientFeeAmount,
        net: payment.baseAmount,
        grossLabel: "Total charged",
        feeLabel: "Client service fee",
        netLabel: "Milestone amount",
        lineDescription: "Milestone payment plus client service fee",
        note: "This client receipt shows the agreed milestone amount and the service fee charged to the client wallet.",
      }
    : isProfessionalView
      ? {
          gross: payment.baseAmount,
          fee: payment.commissionAmount,
          net: payment.professionalPayoutAmount,
          grossLabel: "Client milestone payment",
          feeLabel: "Platform commission",
          netLabel: "Net earnings",
          lineDescription: "Agreed milestone amount paid by the client",
          note: "This professional payout statement shows the agreed milestone amount, platform commission, and net earnings credited after admin approval.",
        }
      : {
          gross: payment.amount,
          fee: payment.adminNetAmount,
          net: payment.professionalPayoutAmount,
          grossLabel: "Client charge",
          feeLabel: "Platform earnings",
          netLabel: "Professional payout",
          lineDescription: "Full platform settlement",
          note: "This administrative settlement shows the client charge, retained platform earnings, and professional payout.",
        };
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
      grossAmount={visibleAmounts.gross}
      commissionAmount={visibleAmounts.fee}
      netAmount={visibleAmounts.net}
      grossLabel={visibleAmounts.grossLabel}
      feeLabel={visibleAmounts.feeLabel}
      netLabel={visibleAmounts.netLabel}
      lineDescription={visibleAmounts.lineDescription}
      note={visibleAmounts.note}
      currency={invoice.currency}
      paymentReference={payment.razorpayPaymentId ?? payment.providerReference}
    />,
  );
  return pdfResponse(buffer, `${invoice.invoiceNumber}.pdf`);
}
