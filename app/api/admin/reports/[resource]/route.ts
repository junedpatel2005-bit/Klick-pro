import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument } from "@/lib/reports/pdf/ReportDocument";
import { JobDossierDocument } from "@/lib/reports/pdf/JobDossierDocument";
import { InvoiceDocument } from "@/lib/reports/pdf/InvoiceDocument";
import { fetchJobDossierData } from "@/lib/reports/pdf/job-dossier-builder";
import { fetchPaymentReceiptData } from "@/lib/reports/pdf/payment-receipt-builder";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import type { ReportColumn, ReportOrientation, ReportPageSize } from "@/lib/reports/pdf/types";

export const runtime = "nodejs";

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
  id: number;
  username?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  daysActive: number;
  jobsCount: number;
  walletBalance: number;
  totalTopUp: number;
  totalWithdrawals: number;
};

function getUserColumns(isAllClients: boolean, isAllPros: boolean): ReportColumn<UserRow>[] {
  const activityHeader = isAllClients
    ? "Jobs Posted"
    : isAllPros
      ? "Proposals / Bids"
      : "Jobs / Bids";

  return [
    {
      key: "name",
      header: isAllClients
        ? "Client / Identity"
        : isAllPros
          ? "Professional / Identity"
          : "User / Identity",
      width: 2.3,
      format: (row) =>
        `#USR-${row.id} · ${row.firstName} ${row.lastName}${row.username ? ` (@${row.username})` : ""}${row.phone ? ` · ${row.phone}` : ` · ${row.email}`}`,
    },
    { key: "role", header: "Role", width: 1, format: (row) => row.role },
    {
      key: "status",
      header: "Status",
      width: 1,
      format: (row) => (row.isActive ? "Active" : "Suspended"),
    },
    {
      key: "verified",
      header: "KYC",
      width: 0.9,
      format: (row) => (row.isVerified ? "Verified" : "Unverified"),
    },
    {
      key: "daysActive",
      header: "Days Active",
      width: 1.1,
      align: "right",
      format: (row) => `${row.daysActive} d`,
    },
    {
      key: "jobs",
      header: activityHeader,
      width: 1.2,
      align: "right",
      format: (row) =>
        isAllClients
          ? `${row.jobsCount} posted`
          : isAllPros
            ? `${row.jobsCount} bids`
            : row.role === "CLIENT"
              ? `${row.jobsCount} jobs`
              : `${row.jobsCount} bids`,
    },
    {
      key: "topup",
      header: "Total Top-Up",
      width: 1.3,
      align: "right",
      format: (row) => `₹${row.totalTopUp.toLocaleString("en-IN")}`,
    },
    {
      key: "withdrawn",
      header: "Withdrawals",
      width: 1.3,
      align: "right",
      format: (row) => `₹${row.totalWithdrawals.toLocaleString("en-IN")}`,
    },
    {
      key: "balance",
      header: "Wallet Bal",
      width: 1.2,
      align: "right",
      format: (row) => `₹${row.walletBalance.toLocaleString("en-IN")}`,
    },
    {
      key: "joined",
      header: "Registered",
      width: 1.2,
      format: (row) => row.createdAt.toLocaleDateString("en-IN"),
    },
  ];
}

type JobRow = {
  id: number;
  title: string | null;
  clientName: string;
  category: string | null;
  status: string;
  budget: string;
  workMode: string;
  createdAt: Date;
};

type FinanceRow = {
  id: number;
  referenceNumber: string;
  kind: "Payment" | "Payout";
  type: string;
  amount: number;
  currency: string;
  status: string;
  party: string;
  createdAt: Date;
};

const jobColumns: ReportColumn<JobRow>[] = [
  {
    key: "title",
    header: "Project Title",
    width: 2.8,
    format: (row) => `#JOB-${row.id} · ${row.title ?? "Untitled"}`,
  },
  { key: "client", header: "Client", width: 1.8, format: (row) => row.clientName },
  { key: "category", header: "Category", width: 1.4, format: (row) => row.category ?? "General" },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  {
    key: "budget",
    header: "Budget Value",
    width: 1.5,
    align: "right",
    format: (row) => row.budget,
  },
  { key: "workMode", header: "Work Mode", width: 1.2, format: (row) => row.workMode },
  {
    key: "createdAt",
    header: "Created",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

const financeColumns: ReportColumn<FinanceRow>[] = [
  { key: "referenceNumber", header: "Ref #", width: 1.5, format: (row) => row.referenceNumber },
  { key: "kind", header: "Kind", width: 1, format: (row) => row.kind },
  { key: "type", header: "Flow Type", width: 1.6, format: (row) => row.type },
  {
    key: "amount",
    header: "Amount",
    width: 1.4,
    align: "right",
    format: (row) => `INR ${row.amount.toLocaleString("en-IN")} ${row.currency}`,
  },
  { key: "status", header: "Status", width: 1.2, format: (row) => row.status },
  { key: "party", header: "Parties Involved", width: 2.8, format: (row) => row.party },
  {
    key: "createdAt",
    header: "Date",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const reportRequest = parseReportRequest(await request.json().catch(() => null));
    if (!reportRequest)
      return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
    const { resource } = await params;
    const selectedOnly = reportRequest.scope === "selected";
    const ids = reportRequest.ids ?? [];

    // Single Job Dossier PDF for Admin
    if (resource === "jobs" && selectedOnly && ids.length === 1 && ids[0] !== undefined) {
      const jobId = ids[0];
      const dossierData = await fetchJobDossierData(jobId, {
        userId: session.userId,
        role: "ADMIN",
      });
      if (dossierData) {
        const buffer = await renderReportPdf(
          createElement(JobDossierDocument, { data: dossierData }) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        return pdfResponse(buffer, `admin-job-${jobId}-full-dossier.pdf`);
      }
    }

    // Single Finance Voucher PDF for Admin
    if (resource === "finance" && selectedOnly && ids.length === 1 && ids[0] !== undefined) {
      const paymentId = ids[0];
      const receiptData = await fetchPaymentReceiptData(paymentId, {
        userId: session.userId,
        role: "ADMIN",
      });
      if (receiptData) {
        const buffer = await renderReportPdf(
          createElement(InvoiceDocument, receiptData) as unknown as Parameters<
            typeof renderReportPdf
          >[0],
        );
        return pdfResponse(buffer, `admin-voucher-${receiptData.invoiceNumber}.pdf`);
      }
    }

    let title: string;
    let subtitle: string;
    let downloadFilename = `klick-pro-admin-${resource}-report.pdf`;
    let document: ReturnType<typeof ReportDocument>;

    if (resource === "users") {
      const rawUsers = await db.user.findMany({
        where: selectedOnly ? { id: { in: ids } } : {},
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          isVerified: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const [jobCounts, proposalCounts, wallets, topupSums, withdrawalSums] =
        await Promise.all([
          db.clientJob
            .groupBy({
              by: ["userId"],
              _count: { id: true },
            })
            .catch(() => [] as Array<{ userId: number; _count: { id: number } }>),
          db.projectRequest
            .groupBy({
              by: ["professionalId"],
              _count: { id: true },
            })
            .catch(() => [] as Array<{ professionalId: number; _count: { id: number } }>),
          db.wallet
            .findMany({
              select: { id: true, userId: true, balance: true },
            })
            .catch(() => [] as Array<{ id: number; userId: number; balance: number }>),
          db.walletTransaction
            .groupBy({
              by: ["walletId"],
              where: { type: "WALLET_TOP_UP", status: "COMPLETED" },
              _sum: { amount: true },
            })
            .catch(() => [] as Array<{ walletId: number; _sum: { amount: number | null } }>),
          db.projectWithdrawal
            .groupBy({
              by: ["professionalId"],
              where: { status: { in: ["COMPLETED", "PAID", "PROCESSED"] } },
              _sum: { amount: true },
            })
            .catch(() => [] as Array<{ professionalId: number; _sum: { amount: number | null } }>),
        ]);

      const jobCountMap = new Map(jobCounts.map((j) => [j.userId, j._count.id]));
      const proposalCountMap = new Map(proposalCounts.map((p) => [p.professionalId, p._count.id]));
      const walletByUserId = new Map(wallets.map((w) => [w.userId, w]));
      const topupByWalletId = new Map(topupSums.map((t) => [t.walletId, t._sum.amount ?? 0]));
      const withdrawalByProId = new Map(
        withdrawalSums.map((w) => [w.professionalId, w._sum.amount ?? 0]),
      );

      const isAllClients = rawUsers.length > 0 && rawUsers.every((u) => u.role === "CLIENT");
      const isAllPros = rawUsers.length > 0 && rawUsers.every((u) => u.role === "PROFESSIONAL");

      const users: UserRow[] = rawUsers.map((u) => {
        const wallet = walletByUserId.get(u.id);
        const walletBalance = wallet ? wallet.balance : 0;
        const totalTopUp = wallet ? (topupByWalletId.get(wallet.id) ?? 0) : 0;
        const totalWithdrawals = withdrawalByProId.get(u.id) ?? 0;
        const jobsCount =
          u.role === "CLIENT" ? (jobCountMap.get(u.id) ?? 0) : (proposalCountMap.get(u.id) ?? 0);
        const daysActive = Math.max(
          1,
          Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
        );

        return {
          id: u.id,
          username: u.username ?? null,
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          email: u.email ?? "",
          phone: u.phone ?? null,
          role: u.role,
          isActive: u.isActive,
          isVerified: u.isVerified,
          createdAt: u.createdAt,
          daysActive,
          jobsCount,
          walletBalance,
          totalTopUp,
          totalWithdrawals,
        };
      });

      if (isAllClients) {
        title = "Klick-Pro Admin — Client Compliance & Operations Audit";
        subtitle = "Executive Oversight — Registered Client Accounts & Job Volume";
      } else if (isAllPros) {
        title = "Klick-Pro Admin — Professional Compliance & Earnings Audit";
        subtitle = "Executive Oversight — Verified Service Professionals & Payout Activity";
      } else {
        title = "Klick-Pro Admin — Platform Accounts & Compliance Audit";
        subtitle = "Executive Oversight — Registered Client & Professional Accounts";
      }

      const columns = getUserColumns(isAllClients, isAllPros);
      document = buildDocument(title, subtitle, columns, users, reportRequest, selectedOnly);

      if (selectedOnly && rawUsers.length === 1 && rawUsers[0]) {
        const u = rawUsers[0];
        const uname = (u.username || `${u.firstName}-${u.lastName}`)
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_");
        downloadFilename = `klick-pro-admin-${uname}-report.pdf`;
      } else if (isAllClients) {
        downloadFilename = `klick-pro-admin-clients-report.pdf`;
      } else if (isAllPros) {
        downloadFilename = `klick-pro-admin-professionals-report.pdf`;
      } else {
        downloadFilename = `klick-pro-admin-users-report.pdf`;
      }
    } else if (resource === "jobs") {
      const jobs = await db.clientJob.findMany({
        where: selectedOnly ? { id: { in: ids } } : {},
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const firstJob = jobs[0];
      if (jobs.length === 1 && firstJob) {
        const dossierData = await fetchJobDossierData(firstJob.id, {
          userId: session.userId,
          role: "ADMIN",
        });
        if (dossierData) {
          const buffer = await renderReportPdf(
            createElement(JobDossierDocument, { data: dossierData }) as unknown as Parameters<
              typeof renderReportPdf
            >[0],
          );
          return pdfResponse(buffer, `admin-job-${firstJob.id}-dossier.pdf`);
        }
      }

      const rows: JobRow[] = jobs.map((job) => {
        const budgetStr =
          job.timingType === "HOURLY"
            ? `INR ${job.hourlyRate?.toLocaleString("en-IN") ?? 0}/hr`
            : job.budgetMin && job.budgetMax
              ? `INR ${job.budgetMin.toLocaleString("en-IN")} – ${job.budgetMax.toLocaleString("en-IN")}`
              : `INR ${(job.budgetMax || job.budgetMin || 0).toLocaleString("en-IN")}`;

        return {
          id: job.id,
          title: job.title,
          clientName: job.user
            ? `${job.user.firstName ?? ""} ${job.user.lastName ?? ""}`.trim() || "Client"
            : "Client",
          category: job.category,
          status: job.status,
          budget: budgetStr,
          workMode: job.workMode,
          createdAt: job.createdAt,
        };
      });
      title = "Marketplace Jobs & Projects Audit";
      subtitle = "Admin Oversight — Active Listings & Operational Engagements";
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

      const firstTx = transactions[0];
      if (transactions.length === 1 && withdrawals.length === 0 && firstTx) {
        const receiptData = await fetchPaymentReceiptData(firstTx.id, {
          userId: session.userId,
          role: "ADMIN",
        });
        if (receiptData) {
          const buffer = await renderReportPdf(
            createElement(InvoiceDocument, receiptData) as unknown as Parameters<
              typeof renderReportPdf
            >[0],
          );
          return pdfResponse(buffer, `admin-voucher-${receiptData.invoiceNumber}.pdf`);
        }
      }

      const userIds = [
        ...new Set(
          [
            ...transactions.flatMap((item) => [item.clientId, item.professionalId]),
            ...withdrawals.map((item) => item.professionalId),
          ].filter((id): id is number => typeof id === "number" && id > 0),
        ),
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
          id: item.id,
          referenceNumber: `TXN-${item.id}`,
          kind: "Payment" as const,
          type: item.type,
          amount: item.amount,
          currency: item.currency,
          status: item.status,
          party: `Client: ${names.get(item.clientId) ?? `#${item.clientId}`} · Pro: ${names.get(item.professionalId) ?? `#${item.professionalId}`}`,
          createdAt: item.createdAt,
        })),
        ...withdrawals.map((item) => ({
          id: item.id,
          referenceNumber: `WDR-${item.id}`,
          kind: "Payout" as const,
          type: "Withdrawal",
          amount: item.amount,
          currency: item.currency,
          status: item.status,
          party: `Professional: ${names.get(item.professionalId) ?? `#${item.professionalId}`}`,
          createdAt: item.createdAt,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      title = "Financial Transactions & Disbursements Audit";
      subtitle = "Admin Oversight — Inbound Payments, Retained Margins & Outbound Payouts";
      document = buildDocument(title, subtitle, financeColumns, rows, reportRequest, selectedOnly);
    } else {
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    }

    const buffer = await renderReportPdf(document);
    return pdfResponse(buffer, downloadFilename);
  } catch (error) {
    console.error("Admin report export failed:", error);
    return NextResponse.json(
      { error: "The report could not be generated. Please try again." },
      { status: 500 },
    );
  }
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
    orientation: reportRequest.orientation ?? "landscape",
  });
}
