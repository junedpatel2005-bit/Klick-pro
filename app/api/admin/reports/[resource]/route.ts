import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import type { ReportColumn, ReportOrientation, ReportPageSize } from "@/lib/reports/pdf/types";

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

type UserRow = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
};

type JobRow = {
  title: string | null;
  clientName: string;
  category: string | null;
  status: string;
  createdAt: Date;
};

type FinanceRow = {
  kind: "Payment" | "Payout";
  type: string;
  amount: number;
  currency: string;
  status: string;
  party: string;
  createdAt: Date;
};

const userColumns: ReportColumn<UserRow>[] = [
  { key: "name", header: "Name", width: 2, format: (row) => `${row.firstName} ${row.lastName}` },
  { key: "email", header: "Email", width: 2.4, format: (row) => row.email },
  { key: "role", header: "Role", width: 1.2, format: (row) => row.role },
  { key: "active", header: "Active", width: 1, format: (row) => (row.isActive ? "Yes" : "No") },
  {
    key: "verified",
    header: "Verified",
    width: 1,
    format: (row) => (row.isVerified ? "Yes" : "No"),
  },
  {
    key: "joined",
    header: "Joined",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-US"),
  },
];

const jobColumns: ReportColumn<JobRow>[] = [
  { key: "title", header: "Title", width: 2.6, format: (row) => row.title ?? "Untitled job" },
  { key: "client", header: "Client", width: 1.8, format: (row) => row.clientName },
  { key: "category", header: "Category", width: 1.4, format: (row) => row.category ?? "General" },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  {
    key: "createdAt",
    header: "Created",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-US"),
  },
];

const financeColumns: ReportColumn<FinanceRow>[] = [
  { key: "kind", header: "Kind", width: 1, format: (row) => row.kind },
  { key: "type", header: "Type", width: 1.6, format: (row) => row.type },
  {
    key: "amount",
    header: "Amount",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.amount.toLocaleString("en-US")} ${row.currency}`,
  },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  { key: "party", header: "Parties", width: 2.2, format: (row) => row.party },
  {
    key: "createdAt",
    header: "Date",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-US"),
  },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const reportRequest = parseReportRequest(await request.json().catch(() => null));
  if (!reportRequest)
    return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  const { resource } = await params;
  const selectedOnly = reportRequest.scope === "selected";
  const ids = reportRequest.ids ?? [];

  let title: string;
  let subtitle: string;
  let document: ReturnType<typeof ReportDocument>;

  if (resource === "users") {
    const users = await db.user.findMany({
      where: {
        role: { in: ["CLIENT", "PROFESSIONAL"] },
        ...(selectedOnly ? { id: { in: ids } } : {}),
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: selectedOnly ? undefined : 500,
    });
    title = "Users & professionals";
    subtitle = "Admin module — platform accounts";
    document = buildDocument(title, subtitle, userColumns, users, reportRequest, selectedOnly);
  } else if (resource === "jobs") {
    const jobs = await db.clientJob.findMany({
      where: selectedOnly ? { id: { in: ids } } : {},
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: selectedOnly ? undefined : 500,
    });
    const rows: JobRow[] = jobs.map((job) => ({
      title: job.title,
      clientName: `${job.user.firstName} ${job.user.lastName}`.trim(),
      category: job.category,
      status: job.status,
      createdAt: job.createdAt,
    }));
    title = "Jobs & projects";
    subtitle = "Admin module — marketplace operations";
    document = buildDocument(title, subtitle, jobColumns, rows, reportRequest, selectedOnly);
  } else if (resource === "finance") {
    const [transactions, withdrawals] = await Promise.all([
      db.projectTransaction.findMany({
        where: selectedOnly ? { id: { in: ids } } : {},
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      }),
      db.projectWithdrawal.findMany({
        where: selectedOnly ? { id: { in: ids } } : {},
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      }),
    ]);
    const userIds = [
      ...new Set([
        ...transactions.flatMap((item) => [item.clientId, item.professionalId]),
        ...withdrawals.map((item) => item.professionalId),
      ]),
    ];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const names = new Map(
      users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]),
    );
    const rows: FinanceRow[] = [
      ...transactions.map((item) => ({
        kind: "Payment" as const,
        type: item.type,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        party: `Client: ${names.get(item.clientId) ?? `#${item.clientId}`} · Professional: ${names.get(item.professionalId) ?? `#${item.professionalId}`}`,
        createdAt: item.createdAt,
      })),
      ...withdrawals.map((item) => ({
        kind: "Payout" as const,
        type: "Withdrawal",
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        party: `Professional: ${names.get(item.professionalId) ?? `#${item.professionalId}`}`,
        createdAt: item.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    title = "Finance & payments";
    subtitle = "Admin module — payments and payouts";
    document = buildDocument(title, subtitle, financeColumns, rows, reportRequest, selectedOnly);
  } else {
    return NextResponse.json({ error: "Unknown report." }, { status: 404 });
  }

  const buffer = await renderReportPdf(document);
  return pdfResponse(buffer, `${resource}-report-${reportRequest.scope}.pdf`);
}

function buildDocument<T>(
  title: string,
  subtitle: string,
  columns: ReportColumn<T>[],
  rows: T[],
  reportRequest: {
    scope: "all" | "selected";
    pageSize?: ReportPageSize;
    orientation?: ReportOrientation;
  },
  selectedOnly: boolean,
) {
  return ReportDocument({
    title,
    subtitle,
    filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
    columns,
    rows,
    pageSize: reportRequest.pageSize,
    orientation: reportRequest.orientation,
  });
}
