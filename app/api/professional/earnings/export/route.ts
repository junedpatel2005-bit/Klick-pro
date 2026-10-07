import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import { logServerError } from "@/lib/server-logger";
import type { ReportColumn } from "@/lib/reports/pdf/types";

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
  kind: "Earning" | "Payout";
  description: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
};

const columns: ReportColumn<EarningsRow>[] = [
  { key: "kind", header: "Kind", width: 1, format: (row) => row.kind },
  { key: "description", header: "Description", width: 2.6, format: (row) => row.description },
  {
    key: "amount",
    header: "Amount",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.amount.toLocaleString("en-US")} ${row.currency}`,
  },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  {
    key: "createdAt",
    header: "Date",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-US"),
  },
];

export async function POST(request: NextRequest) {
  const user = await getProfessional(request);
  if (!user)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  try {
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

    const rows: EarningsRow[] = [
      ...transactions.map((item) => ({
        kind: "Earning" as const,
        description: item.description,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        createdAt: item.createdAt,
      })),
      ...withdrawals.map((item) => ({
        kind: "Payout" as const,
        description: item.destinationLabel ?? "Withdrawal",
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const buffer = await renderReportPdf(
      ReportDocument({
        title: "My earnings",
        subtitle: "Professional workspace — earnings and payouts",
        generatedFor: `${user.firstName} ${user.lastName}`,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        columns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: reportRequest.orientation,
      }),
    );

    return pdfResponse(buffer, `my-earnings-${reportRequest.scope}.pdf`);
  } catch (error) {
    logServerError("report.export.failed", error, {
      report: "professional-earnings",
      userId: user.id,
    });
    return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  }
}
