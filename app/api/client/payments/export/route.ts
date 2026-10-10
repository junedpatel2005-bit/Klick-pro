import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { InvoiceDocument } from "@/lib/reports/pdf/InvoiceDocument";
import { fetchPaymentReceiptData } from "@/lib/reports/pdf/payment-receipt-builder";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import { logServerError } from "@/lib/server-logger";
import type { ReportColumn } from "@/lib/reports/pdf/types";

export const runtime = "nodejs";

async function getClient(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    if (session.role !== "CLIENT") return null;
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

type PaymentRow = {
  id: number;
  invoiceNumber: string;
  projectTitle: string;
  milestoneTitle: string;
  professionalName: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  status: string;
  paymentMethod: string;
  createdAt: Date;
};

const columns: ReportColumn<PaymentRow>[] = [
  { key: "invoiceNumber", header: "Invoice #", width: 1.6, format: (row) => row.invoiceNumber },
  { key: "projectTitle", header: "Project Title", width: 2.4, format: (row) => row.projectTitle },
  { key: "milestoneTitle", header: "Milestone", width: 1.8, format: (row) => row.milestoneTitle },
  {
    key: "professionalName",
    header: "Professional",
    width: 1.6,
    format: (row) => row.professionalName,
  },
  {
    key: "grossAmount",
    header: "Amount Paid",
    width: 1.6,
    align: "right",
    format: (row) => row.grossAmount,
  },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  {
    key: "createdAt",
    header: "Date",
    width: 1.2,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

function money(value: number | null | undefined) {
  if (value == null) return "—";
  return `INR ${value.toLocaleString("en-IN")}`;
}

export async function POST(request: NextRequest) {
  const user = await getClient(request);
  if (!user) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  try {
    const isSingleSelected =
      reportRequest.scope === "selected" && reportRequest.ids && reportRequest.ids.length === 1;

    if (isSingleSelected && reportRequest.ids?.[0]) {
      const selectedId = reportRequest.ids[0];
      const receiptData = await fetchPaymentReceiptData(selectedId, {
        userId: user.id,
        role: "CLIENT",
      });

      if (receiptData) {
        const buffer = await renderReportPdf(
          createElement(InvoiceDocument, receiptData) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        const safeJobName = (receiptData.jobTitle || "payment")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        return pdfResponse(buffer, `klick-pro-${safeJobName}-${receiptData.invoiceNumber}.pdf`);
      }
    }

    const transactions = await db.projectTransaction.findMany({
      where: {
        clientId: user.id,
        ...(reportRequest.scope === "selected" ? { id: { in: reportRequest.ids ?? [] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: reportRequest.scope === "selected" ? undefined : 500,
    });

    const firstTx = transactions[0];
    if (transactions.length === 1 && firstTx) {
      const receiptData = await fetchPaymentReceiptData(firstTx.id, {
        userId: user.id,
        role: "CLIENT",
      });
      if (receiptData) {
        const buffer = await renderReportPdf(
          createElement(InvoiceDocument, receiptData) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        const safeJobName = (receiptData.jobTitle || "payment")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        return pdfResponse(buffer, `klick-pro-${safeJobName}-${receiptData.invoiceNumber}.pdf`);
      }
    }

    // Load related projects, milestones, professionals, and payments
    const trackingIds = [...new Set(transactions.map((t) => t.trackingId))];
    const milestoneIds = [
      ...new Set(transactions.map((t) => t.milestoneId).filter((id): id is number => id !== null)),
    ];
    const proIds = [...new Set(transactions.map((t) => t.professionalId))];

    const [trackings, milestones, pros, payments] = await Promise.all([
      db.projectTracking.findMany({
        where: { id: { in: trackingIds } },
        include: { job: { select: { id: true, title: true } } },
      }),
      db.projectMilestone.findMany({
        where: { id: { in: milestoneIds } },
        select: { id: true, title: true, amount: true },
      }),
      db.user.findMany({
        where: { id: { in: proIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      db.payment.findMany({
        where: { milestoneId: { in: milestoneIds } },
        select: {
          id: true,
          milestoneId: true,
          amount: true,
          baseAmount: true,
          clientFeeAmount: true,
          provider: true,
          razorpayPaymentId: true,
        },
      }),
    ]);

    const trackingMap = new Map(trackings.map((t) => [t.id, t]));
    const milestoneMap = new Map(milestones.map((m) => [m.id, m]));
    const proMap = new Map(pros.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]));
    const paymentMap = new Map(payments.map((p) => [p.milestoneId, p]));

    const rows: PaymentRow[] = transactions.map((t) => {
      const tracking = trackingMap.get(t.trackingId);
      const milestone = t.milestoneId ? milestoneMap.get(t.milestoneId) : null;
      const proName = proMap.get(t.professionalId) ?? "Professional";
      const payment = t.milestoneId ? paymentMap.get(t.milestoneId) : null;

      const gross = payment?.amount ?? t.amount;
      const fee = payment?.clientFeeAmount ?? Math.round(t.amount * 0.1);
      const net = payment?.baseAmount ?? t.amount;

      return {
        id: t.id,
        invoiceNumber: `INV-${new Date(t.createdAt).getFullYear()}-${String(payment?.id || t.id).padStart(6, "0")}`,
        projectTitle: tracking?.job.title ?? `Project #${t.trackingId}`,
        milestoneTitle: milestone?.title ?? t.description,
        professionalName: proName,
        grossAmount: money(gross),
        feeAmount: money(fee),
        netAmount: money(net),
        status: t.status,
        paymentMethod: payment?.provider ?? "Escrow",
        createdAt: t.createdAt,
      };
    });

    const buffer = await renderReportPdf(
      ReportDocument({
        title: "Disbursements & Payment Ledger",
        subtitle: "Client Workspace — Milestone Settlements & Platform Receipts",
        generatedFor: `${user.firstName} ${user.lastName}`,
        filterSummary:
          reportRequest.scope === "selected"
            ? `${transactions.length} selected`
            : `${transactions.length} total`,
        columns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      }),
    );

    return pdfResponse(buffer, `client-payments-${reportRequest.scope}.pdf`);
  } catch (error) {
    logServerError("report.export.failed", error, { report: "client-payments", userId: user.id });
    return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  }
}
