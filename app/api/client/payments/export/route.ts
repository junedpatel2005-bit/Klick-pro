import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import { logServerError } from "@/lib/server-logger";
import type { ReportColumn } from "@/lib/reports/pdf/types";

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
  description: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  createdAt: Date;
};

const columns: ReportColumn<PaymentRow>[] = [
  { key: "description", header: "Description", width: 2.6, format: (row) => row.description },
  { key: "type", header: "Type", width: 1.3, format: (row) => row.type },
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
  const user = await getClient(request);
  if (!user) return NextResponse.json({ error: "Client sign-in is required." }, { status: 401 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });

  try {
    const payments = await db.projectTransaction.findMany({
      where: {
        clientId: user.id,
        ...(reportRequest.scope === "selected" ? { id: { in: reportRequest.ids ?? [] } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: reportRequest.scope === "selected" ? undefined : 500,
    });

    const buffer = await renderReportPdf(
      ReportDocument({
        title: "My payments",
        subtitle: "Client workspace — payments to professionals",
        generatedFor: `${user.firstName} ${user.lastName}`,
        filterSummary:
          reportRequest.scope === "selected"
            ? `${payments.length} selected`
            : `${payments.length} total`,
        columns,
        rows: payments,
        pageSize: reportRequest.pageSize,
        orientation: reportRequest.orientation,
      }),
    );

    return pdfResponse(buffer, `my-payments-${reportRequest.scope}.pdf`);
  } catch (error) {
    logServerError("report.export.failed", error, { report: "client-payments", userId: user.id });
    return NextResponse.json({ error: "The report could not be generated." }, { status: 500 });
  }
}
