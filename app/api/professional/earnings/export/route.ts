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

async function getProfessional(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL") return null;
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, firstName: true, lastName: true, isActive: true },
    });
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

type EarningsRow = {
  id: number;
  kind: "Earning" | "Payout";
  referenceNumber: string;
  projectTitle: string;
  milestoneTitle: string;
  clientOrDestination: string;
  grossAmount: string;
  commissionAmount: string;
  netAmount: string;
  status: string;
  createdAt: Date;
};

const columns: ReportColumn<EarningsRow>[] = [
  { key: "referenceNumber", header: "Ref #", width: 1.5, format: (row) => row.referenceNumber },
  { key: "kind", header: "Type", width: 1, format: (row) => row.kind },
  { key: "projectTitle", header: "Project Title", width: 2.2, format: (row) => row.projectTitle },
  { key: "milestoneTitle", header: "Milestone", width: 1.8, format: (row) => row.milestoneTitle },
  {
    key: "clientOrDestination",
    header: "Counterparty / Account",
    width: 1.6,
    format: (row) => row.clientOrDestination,
  },
  {
    key: "grossAmount",
    header: "Gross (INR)",
    width: 1.3,
    align: "right",
    format: (row) => row.grossAmount,
  },
  {
    key: "commissionAmount",
    header: "Commission",
    width: 1.2,
    align: "right",
    format: (row) => row.commissionAmount,
  },
  {
    key: "netAmount",
    header: "Net Earned",
    width: 1.3,
    align: "right",
    format: (row) => row.netAmount,
  },
  { key: "status", header: "Status", width: 1.1, format: (row) => row.status },
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
  const user = await getProfessional(request);
  if (!user)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  try {
    const isSingleSelected =
      reportRequest.scope === "selected" && reportRequest.ids && reportRequest.ids.length === 1;

    // Single item selected -> Render full InvoiceDocument voucher PDF!
    if (isSingleSelected && reportRequest.ids?.[0] !== undefined) {
      const selectedId = reportRequest.ids[0];
      const receiptData = await fetchPaymentReceiptData(selectedId, {
        userId: user.id,
        role: "PROFESSIONAL",
      });

      if (receiptData) {
        const buffer = await renderReportPdf(
          createElement(InvoiceDocument, receiptData) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        return pdfResponse(buffer, `klick-pro-payout-${receiptData.invoiceNumber}.pdf`);
      }
    }

    const selectedOnly = reportRequest.scope === "selected";
    const ids = reportRequest.ids ?? [];

    const [transactions, withdrawals] = await Promise.all([
      db.projectTransaction.findMany({
        where: {
          professionalId: user.id,
          ...(selectedOnly ? { id: { in: ids } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      }),
      db.projectWithdrawal.findMany({
        where: {
          professionalId: user.id,
          ...(selectedOnly ? { id: { in: ids } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      }),
    ]);

    const firstTx = transactions[0];
    if (transactions.length === 1 && withdrawals.length === 0 && firstTx) {
      const receiptData = await fetchPaymentReceiptData(firstTx.id, {
        userId: user.id,
        role: "PROFESSIONAL",
      });
      if (receiptData) {
        const buffer = await renderReportPdf(
          createElement(InvoiceDocument, receiptData) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        return pdfResponse(buffer, `klick-pro-payout-${receiptData.invoiceNumber}.pdf`);
      }
    }

    // Load related projects, milestones, clients, and payments
    const trackingIds = [...new Set(transactions.map((t) => t.trackingId))];
    const milestoneIds = [
      ...new Set(transactions.map((t) => t.milestoneId).filter((id): id is number => id !== null)),
    ];
    const clientIds = [...new Set(transactions.map((t) => t.clientId))];

    const [trackings, milestones, clients, payments] = await Promise.all([
      db.projectTracking.findMany({
        where: { id: { in: trackingIds } },
        include: { job: { select: { id: true, title: true } } },
      }),
      db.projectMilestone.findMany({
        where: { id: { in: milestoneIds } },
        select: { id: true, title: true, amount: true },
      }),
      db.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, firstName: true, lastName: true },
      }),
      db.payment.findMany({
        where: { milestoneId: { in: milestoneIds } },
        select: {
          id: true,
          milestoneId: true,
          amount: true,
          baseAmount: true,
          commissionAmount: true,
          professionalPayoutAmount: true,
          provider: true,
        },
      }),
    ]);

    const trackingMap = new Map(trackings.map((t) => [t.id, t]));
    const milestoneMap = new Map(milestones.map((m) => [m.id, m]));
    const clientMap = new Map(clients.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));
    const paymentMap = new Map(payments.map((p) => [p.milestoneId, p]));

    const transactionRows: EarningsRow[] = transactions.map((item) => {
      const tracking = trackingMap.get(item.trackingId);
      const milestone = item.milestoneId ? milestoneMap.get(item.milestoneId) : null;
      const clientName = clientMap.get(item.clientId) ?? "Client";
      const payment = item.milestoneId ? paymentMap.get(item.milestoneId) : null;

      const gross = payment?.baseAmount ?? item.amount;
      const commission = payment?.commissionAmount ?? Math.round(item.amount * 0.1);
      const net = payment?.professionalPayoutAmount ?? item.amount - commission;

      return {
        id: item.id,
        kind: "Earning" as const,
        referenceNumber: `EARN-${item.id}`,
        projectTitle: tracking?.job.title ?? `Job #${item.trackingId}`,
        milestoneTitle: milestone?.title ?? item.description,
        clientOrDestination: clientName,
        grossAmount: money(gross),
        commissionAmount: money(commission),
        netAmount: money(net),
        status: item.status,
        createdAt: item.createdAt,
      };
    });

    const withdrawalRows: EarningsRow[] = withdrawals.map((item) => ({
      id: item.id,
      kind: "Payout" as const,
      referenceNumber: `WDR-${item.id}`,
      projectTitle: "Bank Withdrawal",
      milestoneTitle: item.destinationLabel ?? "Direct Bank Transfer",
      clientOrDestination: item.destinationLabel ?? "Bank Account",
      grossAmount: money(item.amount),
      commissionAmount: "INR 0",
      netAmount: money(item.amount),
      status: item.status,
      createdAt: item.createdAt,
    }));

    const rows: EarningsRow[] = [...transactionRows, ...withdrawalRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const buffer = await renderReportPdf(
      ReportDocument({
        title: "Earnings & Payout Statements",
        subtitle: "Professional Workspace — Milestone Clearances & Disbursements Ledger",
        generatedFor: `${user.firstName} ${user.lastName}`,
        filterSummary:
          reportRequest.scope === "selected" ? `${rows.length} selected` : `${rows.length} total`,
        columns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      }),
    );

    return pdfResponse(buffer, `professional-earnings-${reportRequest.scope}.pdf`);
  } catch (error) {
    logServerError("report.export.failed", error, {
      report: "professional-earnings",
      userId: user.id,
    });
    return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  }
}
