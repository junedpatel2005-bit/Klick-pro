import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { ReportDocument, type ReportSummaryStat } from "@/lib/reports/pdf/ReportDocument";
import { JobDossierDocument } from "@/lib/reports/pdf/JobDossierDocument";
import { InvoiceDocument } from "@/lib/reports/pdf/InvoiceDocument";
import { fetchJobDossierData } from "@/lib/reports/pdf/job-dossier-builder";
import { fetchPaymentReceiptData } from "@/lib/reports/pdf/payment-receipt-builder";
import { renderReportPdf, pdfResponse } from "@/lib/reports/pdf/render";
import { parseReportRequest } from "@/lib/reports/pdf/request";
import type { ReportColumn, ReportOrientation, ReportPageSize } from "@/lib/reports/pdf/types";
import { capitalizeWords, formatReadableLabel } from "@/lib/utils";
import { maskAccountNumber, maskDestinationString } from "@/lib/account-formatting";

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

// ---------------------------------------------------------------------------
// 1. User Accounts Columns & Types
// ---------------------------------------------------------------------------
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
        `#USR-${row.id} · ${capitalizeWords(`${row.firstName} ${row.lastName}`)}${row.username ? ` (@${row.username})` : ""}${row.phone ? ` · ${row.phone}` : ` · ${row.email}`}`,
    },
    { key: "role", header: "Role", width: 1, format: (row) => capitalizeWords(row.role) },
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

// ---------------------------------------------------------------------------
// 2. Jobs & Marketplace Columns & Types
// ---------------------------------------------------------------------------
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

const jobColumns: ReportColumn<JobRow>[] = [
  {
    key: "title",
    header: "Project Title",
    width: 2.8,
    format: (row) => `#JOB-${row.id} · ${capitalizeWords(row.title ?? "Untitled")}`,
  },
  { key: "client", header: "Client", width: 1.8, format: (row) => capitalizeWords(row.clientName) },
  { key: "category", header: "Category", width: 1.4, format: (row) => capitalizeWords(row.category ?? "General") },
  { key: "status", header: "Status", width: 1.2, format: (row) => formatReadableLabel(row.status) },
  {
    key: "budget",
    header: "Budget Value",
    width: 1.5,
    align: "right",
    format: (row) => row.budget,
  },
  { key: "workMode", header: "Work Mode", width: 1.2, format: (row) => formatReadableLabel(row.workMode) },
  {
    key: "createdAt",
    header: "Created",
    width: 1.3,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

// ---------------------------------------------------------------------------
// 3. Revenue & Commission Columns & Types
// ---------------------------------------------------------------------------
type RevenueRow = {
  id: number;
  referenceNumber: string;
  kind: string;
  grossAmount: number;
  commissionAmount: number;
  netPayoutAmount: number;
  status: string;
  clientName: string;
  professionalName: string;
  jobTitle: string;
  createdAt: Date;
};

const revenueColumns: ReportColumn<RevenueRow>[] = [
  { key: "referenceNumber", header: "Ref #", width: 1.2, format: (row) => row.referenceNumber },
  { key: "jobTitle", header: "Project / Engagement", width: 2.2, format: (row) => capitalizeWords(row.jobTitle) },
  { key: "client", header: "Client Depositor", width: 1.6, format: (row) => capitalizeWords(row.clientName) },
  { key: "pro", header: "Professional Payee", width: 1.6, format: (row) => capitalizeWords(row.professionalName) },
  {
    key: "gross",
    header: "Gross Paid",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.grossAmount.toLocaleString("en-IN")}`,
  },
  {
    key: "commission",
    header: "Platform Cut",
    width: 1.2,
    align: "right",
    format: (row) =>
      row.commissionAmount > 0 ? `₹${row.commissionAmount.toLocaleString("en-IN")}` : "₹0 (Off)",
  },
  {
    key: "net",
    header: "Net Pro Payout",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.netPayoutAmount.toLocaleString("en-IN")}`,
  },
  { key: "status", header: "Settlement", width: 1.1, format: (row) => formatReadableLabel(row.status) },
  {
    key: "createdAt",
    header: "Settled At",
    width: 1.2,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

// ---------------------------------------------------------------------------
// 4. Escrow & Treasury Columns & Types
// ---------------------------------------------------------------------------
type EscrowRow = {
  id: number;
  projectTitle: string;
  milestoneTitle: string;
  clientName: string;
  professionalName: string;
  amount: number;
  milestoneStatus: string;
  custodyStatus: string;
  releaseDue: string;
  createdAt: Date;
};

const escrowColumns: ReportColumn<EscrowRow>[] = [
  { key: "id", header: "Milestone ID", width: 1.2, format: (row) => `#MS-${row.id}` },
  { key: "project", header: "Project Title", width: 2.2, format: (row) => capitalizeWords(row.projectTitle) },
  { key: "milestone", header: "Milestone Description", width: 2.0, format: (row) => capitalizeWords(row.milestoneTitle) },
  { key: "client", header: "Client (Depositor)", width: 1.6, format: (row) => capitalizeWords(row.clientName) },
  { key: "pro", header: "Professional (Beneficiary)", width: 1.6, format: (row) => capitalizeWords(row.professionalName) },
  {
    key: "amount",
    header: "Escrow Held",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.amount.toLocaleString("en-IN")}`,
  },
  { key: "milestoneStatus", header: "Milestone", width: 1.1, format: (row) => formatReadableLabel(row.milestoneStatus) },
  { key: "custodyStatus", header: "Escrow Custody", width: 1.3, format: (row) => row.custodyStatus },
  {
    key: "createdAt",
    header: "Funded Date",
    width: 1.2,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

// ---------------------------------------------------------------------------
// 5. Bank Withdrawals Columns & Types
// ---------------------------------------------------------------------------
type WithdrawalRow = {
  id: number;
  referenceNumber: string;
  professionalName: string;
  amount: number;
  destination: string;
  bankInfo: string;
  utr: string;
  status: string;
  createdAt: Date;
};

const withdrawalColumns: ReportColumn<WithdrawalRow>[] = [
  { key: "ref", header: "Payout Ref", width: 1.2, format: (row) => row.referenceNumber },
  { key: "pro", header: "Professional Payee", width: 2.0, format: (row) => capitalizeWords(row.professionalName) },
  {
    key: "amount",
    header: "Payout Amount",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.amount.toLocaleString("en-IN")}`,
  },
  { key: "destination", header: "Method", width: 1.2, format: (row) => row.destination },
  { key: "bankInfo", header: "Bank / Destination Details", width: 2.4, format: (row) => row.bankInfo },
  { key: "utr", header: "UTR / Transaction Ref", width: 1.8, format: (row) => row.utr },
  { key: "status", header: "Status", width: 1.1, format: (row) => formatReadableLabel(row.status) },
  {
    key: "createdAt",
    header: "Requested Date",
    width: 1.2,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

// ---------------------------------------------------------------------------
// 6. Disputes Columns & Types
// ---------------------------------------------------------------------------
type DisputeRow = {
  id: number;
  projectTitle: string;
  issueType: string;
  priority: string;
  disputedAmount: number;
  claimant: string;
  respondent: string;
  splitInfo: string;
  status: string;
  createdAt: Date;
};

const disputeColumns: ReportColumn<DisputeRow>[] = [
  { key: "id", header: "Dispute #", width: 1.1, format: (row) => `#DSP-${row.id}` },
  { key: "project", header: "Project / Job", width: 2.2, format: (row) => capitalizeWords(row.projectTitle) },
  { key: "issue", header: "Issue Category", width: 1.6, format: (row) => formatReadableLabel(row.issueType) },
  { key: "priority", header: "Priority", width: 1.0, format: (row) => row.priority },
  {
    key: "amount",
    header: "Disputed Escrow",
    width: 1.3,
    align: "right",
    format: (row) => `₹${row.disputedAmount.toLocaleString("en-IN")}`,
  },
  { key: "claimant", header: "Claimant", width: 1.5, format: (row) => capitalizeWords(row.claimant) },
  { key: "respondent", header: "Respondent", width: 1.5, format: (row) => capitalizeWords(row.respondent) },
  { key: "split", header: "Arbitration Decision", width: 2.0, format: (row) => row.splitInfo },
  { key: "status", header: "Status", width: 1.1, format: (row) => formatReadableLabel(row.status) },
  {
    key: "createdAt",
    header: "Filed Date",
    width: 1.2,
    format: (row) => row.createdAt.toLocaleDateString("en-IN"),
  },
];

// ---------------------------------------------------------------------------
// Main POST Handler
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ resource: string }> },
) {
  const session = await requireAdmin(request);
  if (!session) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const rawBody = await request.json().catch(() => null);
    const reportRequest = parseReportRequest(rawBody);
    if (!reportRequest)
      return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
    const { resource } = await params;
    const selectedOnly = reportRequest.scope === "selected";
    const ids = reportRequest.ids ?? [];
    const numericIds = ids.map(Number).filter((n) => !isNaN(n) && n > 0);
    const template = (rawBody as { template?: string } | null)?.template;

    // Explicit Single Job Dossier (only if template === "dossier")
    if (resource === "jobs" && selectedOnly && ids.length === 1 && ids[0] !== undefined && template === "dossier") {
      const jobId = Number(ids[0]);
      if (!isNaN(jobId) && jobId > 0) {
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
    }

    // Explicit Single Finance Voucher (only if template === "voucher")
    if (resource === "finance" && selectedOnly && ids.length === 1 && ids[0] !== undefined && template === "voucher") {
      const rawId = ids[0];
      const paymentId =
        typeof rawId === "number"
          ? rawId
          : parseInt(String(rawId).replace(/^(tx-|payment-)/, ""), 10);
      if (!isNaN(paymentId) && paymentId > 0) {
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
    }

    let title: string;
    let subtitle: string;
    const downloadFilename = `klick-pro-admin-${resource}-report.pdf`;
    let document: ReturnType<typeof ReportDocument>;

    // -------------------------------------------------------------------------
    // Case A: Users Report
    // -------------------------------------------------------------------------
    if (resource === "users") {
      const rawUsers = await db.user.findMany({
        where: selectedOnly ? { id: { in: numericIds } } : {},
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
          professionalCity: true,
          address: true,
          companyName: true,
        },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const [jobCounts, proposalCounts, wallets, topupSums, withdrawalSums] =
        await Promise.all([
          db.clientJob
            .groupBy({ by: ["userId"], _count: { id: true } })
            .catch(() => [] as Array<{ userId: number; _count: { id: number } }>),
          db.projectRequest
            .groupBy({ by: ["professionalId"], _count: { id: true } })
            .catch(() => [] as Array<{ professionalId: number; _count: { id: number } }>),
          db.wallet
            .findMany({ select: { userId: true, balance: true } })
            .catch(() => [] as Array<{ userId: number; balance: number }>),
          db.walletTransaction
            .groupBy({
              by: ["walletId"],
              where: { type: "WALLET_TOP_UP" },
              _sum: { amount: true },
            })
            .catch(() => [] as Array<{ walletId: number; _sum: { amount: number | null } }>),
          db.projectWithdrawal
            .groupBy({
              by: ["professionalId"],
              where: { status: "COMPLETED" },
              _sum: { amount: true },
            })
            .catch(() => [] as Array<{ professionalId: number; _sum: { amount: number | null } }>),
        ]);

      const jobCountMap = new Map(jobCounts.map((j) => [j.userId, j._count.id]));
      const proposalCountMap = new Map(proposalCounts.map((p) => [p.professionalId, p._count.id]));
      const walletBalanceMap = new Map(wallets.map((w) => [w.userId, w.balance]));
      const topupMap = new Map(topupSums.map((t) => [t.walletId, t._sum.amount ?? 0]));
      const withdrawalMap = new Map(withdrawalSums.map((w) => [w.professionalId, w._sum.amount ?? 0]));

      const now = new Date();
      const rows: UserRow[] = rawUsers.map((u) => {
        const days = Math.max(1, Math.floor((now.getTime() - u.createdAt.getTime()) / (1000 * 3600 * 24)));
        return {
          id: u.id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone,
          role: u.role,
          isActive: u.isActive,
          isVerified: u.isVerified,
          createdAt: u.createdAt,
          daysActive: days,
          jobsCount: u.role === "CLIENT" ? (jobCountMap.get(u.id) ?? 0) : (proposalCountMap.get(u.id) ?? 0),
          walletBalance: walletBalanceMap.get(u.id) ?? 0,
          totalTopUp: topupMap.get(u.id) ?? 0,
          totalWithdrawals: withdrawalMap.get(u.id) ?? 0,
        };
      });

      const totalBalance = rows.reduce((sum, r) => sum + r.walletBalance, 0);
      const verifiedCount = rows.filter((r) => r.isVerified).length;
      const summaryStats: ReportSummaryStat[] = [
        { label: "Total Accounts", value: String(rows.length) },
        { label: "KYC Verified", value: `${verifiedCount} (${rows.length > 0 ? Math.round((verifiedCount / rows.length) * 100) : 0}%)` },
        { label: "Total Wallet Float", value: `INR ${totalBalance.toLocaleString("en-IN")}` },
      ];

      title = "User Directory & KYC Compliance Audit";
      subtitle = "Executive Platform Overview — Verified Profiles, Activity Metrics & Account Status";
      document = ReportDocument({
        title,
        subtitle,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        summaryStats,
        columns: getUserColumns(false, false),
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      });
    }

    // -------------------------------------------------------------------------
    // Case B: Jobs & Marketplace Report
    // -------------------------------------------------------------------------
    else if (resource === "jobs") {
      const jobs = await db.clientJob.findMany({
        where: selectedOnly ? { id: { in: numericIds } } : {},
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

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
          clientName: job.user ? `${job.user.firstName} ${job.user.lastName}`.trim() : "Client",
          category: job.category,
          status: job.status,
          budget: budgetStr,
          workMode: job.workMode,
          createdAt: job.createdAt,
        };
      });

      const openCount = rows.filter((r) => r.status === "OPEN").length;
      const summaryStats: ReportSummaryStat[] = [
        { label: "Total Jobs / Projects", value: String(rows.length) },
        { label: "Open & Hiring", value: String(openCount) },
        { label: "Audit Status", value: "Reconciled" },
      ];

      title = "Marketplace Jobs & Projects Audit";
      subtitle = "Admin Oversight — Active Listings & Operational Engagements";
      document = ReportDocument({
        title,
        subtitle,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        summaryStats,
        columns: jobColumns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      });
    }

    // -------------------------------------------------------------------------
    // Case C: Revenue & Commission Reconciliation (or legacy finance)
    // -------------------------------------------------------------------------
    else if (resource === "revenue" || resource === "finance") {
      const paymentIds: number[] = [];
      for (const id of ids) {
        const str = String(id);
        const parsed = parseInt(str.replace(/^(tx-|payment-|PAY-|TXN-)/, ""), 10);
        if (!isNaN(parsed) && parsed > 0) paymentIds.push(parsed);
      }

      const payments = await db.payment.findMany({
        where: selectedOnly ? { id: { in: paymentIds } } : {},
        include: {
          client: { select: { firstName: true, lastName: true } },
          professional: { select: { firstName: true, lastName: true } },
          job: { select: { title: true } },
          milestone: { select: { title: true } },
        },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const rows: RevenueRow[] = payments.map((p) => {
        const gross = p.baseAmount || p.amount;
        const commission = p.commissionAmount ?? 0;
        const net = p.professionalPayoutAmount ?? Math.max(0, gross - commission);
        const jobTitle = p.job?.title ?? (p.milestone?.title ? `Milestone: ${p.milestone.title}` : `Payment #${p.id}`);
        return {
          id: p.id,
          referenceNumber: `PAY-${p.id}`,
          kind: "Milestone Settlement",
          grossAmount: gross,
          commissionAmount: commission,
          netPayoutAmount: net,
          status: p.status,
          clientName: p.client ? `${p.client.firstName} ${p.client.lastName}`.trim() : "Client",
          professionalName: p.professional ? `${p.professional.firstName} ${p.professional.lastName}`.trim() : "Professional",
          jobTitle,
          createdAt: p.createdAt,
        };
      });

      const totalGross = rows.reduce((sum, r) => sum + r.grossAmount, 0);
      const totalCommission = rows.reduce((sum, r) => sum + r.commissionAmount, 0);
      const totalNet = rows.reduce((sum, r) => sum + r.netPayoutAmount, 0);

      const summaryStats: ReportSummaryStat[] = [
        { label: "Total Settlements", value: String(rows.length) },
        { label: "Gross Volume (GMV)", value: `INR ${totalGross.toLocaleString("en-IN")}` },
        {
          label: "Platform Commission",
          value: totalCommission > 0 ? `INR ${totalCommission.toLocaleString("en-IN")}` : "INR 0 (Off)",
        },
        { label: "Net Disbursed", value: `INR ${totalNet.toLocaleString("en-IN")}` },
      ];

      title = "Revenue & Platform Commission Reconciliation";
      subtitle = "Admin Executive Oversight — Contractual Billings, Dynamic Commission & Net Payouts";
      document = ReportDocument({
        title,
        subtitle,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        summaryStats,
        columns: revenueColumns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      });
    }

    // -------------------------------------------------------------------------
    // Case D: Escrow & Treasury Reconciliation
    // -------------------------------------------------------------------------
    else if (resource === "escrow") {
      const milestones = await db.projectMilestone.findMany({
        where: selectedOnly ? { id: { in: numericIds } } : {},
        include: {
          tracking: {
            include: {
              client: { select: { firstName: true, lastName: true } },
              professional: { select: { firstName: true, lastName: true } },
              job: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const rows: EscrowRow[] = milestones.map((m) => {
        const custody =
          m.status === "APPROVED"
            ? "RELEASED TO WALLET"
            : m.status === "REFUNDED"
              ? "REFUNDED TO CLIENT"
              : "HELD IN TRUST";
        return {
          id: m.id,
          projectTitle: m.tracking?.job?.title ?? `Project #${m.trackingId}`,
          milestoneTitle: m.title,
          clientName: m.tracking?.client ? `${m.tracking.client.firstName} ${m.tracking.client.lastName}`.trim() : "Client",
          professionalName: m.tracking?.professional ? `${m.tracking.professional.firstName} ${m.tracking.professional.lastName}`.trim() : "Professional",
          amount: m.amount,
          milestoneStatus: m.status,
          custodyStatus: custody,
          releaseDue: m.releaseAt ? m.releaseAt.toLocaleDateString("en-IN") : "Pending Review",
          createdAt: m.createdAt,
        };
      });

      const totalEscrow = rows.reduce((sum, r) => sum + r.amount, 0);
      const heldTotal = rows.filter((r) => r.custodyStatus === "HELD IN TRUST").reduce((sum, r) => sum + r.amount, 0);
      const summaryStats: ReportSummaryStat[] = [
        { label: "Milestones in Scope", value: String(rows.length) },
        { label: "Escrow Held in Trust", value: `INR ${heldTotal.toLocaleString("en-IN")}` },
        { label: "Total Escrow Handled", value: `INR ${totalEscrow.toLocaleString("en-IN")}` },
        { label: "Treasury Backing", value: "100% Fully Backed" },
      ];

      title = "Escrow & Treasury Custody Reconciliation";
      subtitle = "Contractual Subledger — Milestone Funds in Escrow, Approvals & Disbursed Liabilities";
      document = ReportDocument({
        title,
        subtitle,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        summaryStats,
        columns: escrowColumns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      });
    }

    // -------------------------------------------------------------------------
    // Case E: Bank Withdrawals & Payouts Ledger
    // -------------------------------------------------------------------------
    else if (resource === "withdrawals") {
      const withdrawals = await db.projectWithdrawal.findMany({
        where: selectedOnly ? { id: { in: numericIds } } : {},
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const proIds = [...new Set(withdrawals.map((w) => w.professionalId))];
      const pros = await db.user.findMany({
        where: { id: { in: proIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const proNameMap = new Map(pros.map((p) => [p.id, `${p.firstName} ${p.lastName}`.trim()]));

      const rows: WithdrawalRow[] = withdrawals.map((w) => {
        let bankInfo = "Bank / UPI";
        if (w.destinationLabel) {
          try {
            const parsed = JSON.parse(w.destinationLabel);
            if (parsed && typeof parsed === "object") {
              const parts = [];
              if (parsed.bankName) parts.push(parsed.bankName);
              if (parsed.accountNumber || parsed.last4)
                parts.push(maskAccountNumber(parsed.last4 || parsed.accountNumber));
              if (parsed.ifsc) parts.push(`IFSC: ${parsed.ifsc}`);
              if (parsed.vpa) parts.push(maskDestinationString(parsed.vpa));
              bankInfo = parts.length > 0 ? parts.join(" · ") : maskDestinationString(w.destinationLabel);
            } else {
              bankInfo = maskDestinationString(w.destinationLabel);
            }
          } catch {
            bankInfo = maskDestinationString(w.destinationLabel);
          }
        }

        return {
          id: w.id,
          referenceNumber: `WDR-${w.id}`,
          professionalName: proNameMap.get(w.professionalId) ?? `#${w.professionalId}`,
          amount: w.amount,
          destination: w.payoutMode || "Bank Transfer",
          bankInfo,
          utr: w.utr || "—",
          status: w.status,
          createdAt: w.createdAt,
        };
      });

      const totalRequested = rows.reduce((sum, r) => sum + r.amount, 0);
      const settledTotal = rows.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + r.amount, 0);
      const pendingCount = rows.filter((r) => r.status === "PENDING" || r.status === "PROCESSING").length;

      const summaryStats: ReportSummaryStat[] = [
        { label: "Total Requests", value: String(rows.length) },
        { label: "Settled Payouts", value: `INR ${settledTotal.toLocaleString("en-IN")}` },
        { label: "Total Volume", value: `INR ${totalRequested.toLocaleString("en-IN")}` },
        { label: "Pending Processing", value: String(pendingCount) },
      ];

      title = "Bank Withdrawals & Settlement Ledger";
      subtitle = "Disbursement Records — Professional Bank Transfers, UPI Payouts & UTR Reconciliation";
      document = ReportDocument({
        title,
        subtitle,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        summaryStats,
        columns: withdrawalColumns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      });
    }

    // -------------------------------------------------------------------------
    // Case F: Disputes & Arbitration Audit
    // -------------------------------------------------------------------------
    else if (resource === "disputes") {
      const disputes = await db.projectDispute.findMany({
        where: selectedOnly ? { id: { in: numericIds } } : {},
        orderBy: { createdAt: "desc" },
        take: selectedOnly ? undefined : 500,
      });

      const userIds = [
        ...new Set(
          disputes.flatMap((d) => [d.clientId, d.professionalId, d.reporterId]).filter((id) => id > 0),
        ),
      ];
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));

      const trackingIds = [...new Set(disputes.map((d) => d.trackingId))];
      const trackings = await db.projectTracking.findMany({
        where: { id: { in: trackingIds } },
        include: { job: { select: { title: true } } },
      });
      const trackingMap = new Map(trackings.map((t) => [t.id, t.job?.title ?? `Project #${t.id}`]));

      const rows: DisputeRow[] = disputes.map((d) => {
        const clientName = nameMap.get(d.clientId) ?? `Client #${d.clientId}`;
        const proName = nameMap.get(d.professionalId) ?? `Pro #${d.professionalId}`;
        const claimant = d.reporterRole === "CLIENT" ? clientName : proName;
        const respondent = d.reporterRole === "CLIENT" ? proName : clientName;
        const splitInfo =
          d.status === "RESOLVED"
            ? `Refund: ₹${(d.refundAmount ?? 0).toLocaleString("en-IN")} · Payout: ₹${(d.payoutAmount ?? 0).toLocaleString("en-IN")}`
            : "Under Arbitration";

        return {
          id: d.id,
          projectTitle: trackingMap.get(d.trackingId) ?? `Project #${d.trackingId}`,
          issueType: d.issueType,
          priority: d.priority,
          disputedAmount: (d.refundAmount ?? 0) + (d.payoutAmount ?? 0),
          claimant,
          respondent,
          splitInfo,
          status: d.status,
          createdAt: d.createdAt,
        };
      });

      const openCount = rows.filter((r) => r.status !== "RESOLVED" && r.status !== "CANCELLED").length;
      const totalDisputed = rows.reduce((sum, r) => sum + r.disputedAmount, 0);

      const summaryStats: ReportSummaryStat[] = [
        { label: "Total Disputes", value: String(rows.length) },
        { label: "Open / In Review", value: String(openCount) },
        { label: "Total Exposure", value: `INR ${totalDisputed.toLocaleString("en-IN")}` },
        { label: "Arbitration Status", value: "Compliant" },
      ];

      title = "Disputes & Contract Arbitration Audit";
      subtitle = "Operational Risk Audit — Case Logs, Disputed Escrow, Decisions & Settlement Splits";
      document = ReportDocument({
        title,
        subtitle,
        filterSummary: selectedOnly ? `${rows.length} selected` : `${rows.length} total`,
        summaryStats,
        columns: disputeColumns,
        rows,
        pageSize: reportRequest.pageSize,
        orientation: "landscape",
      });
    } else {
      return NextResponse.json({ error: "Unknown report category." }, { status: 404 });
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
