"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  ArrowDownToLine,
  RefreshCw,
  LayoutGrid,
  List,
  CalendarDays,
  ExternalLink,
  FileDown,
  Briefcase,
  RotateCcw,
  ShieldCheck,
  Percent,
  FileSpreadsheet,
  Wallet,
} from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { SelectableReportTable, type ReportTableColumn } from "@/components/reports/SelectableReportTable";
import { downloadCsvFile } from "@/lib/reports/csv/export-csv";
import {
  DateRangeFilter,
  type DatePreset,
  isWithinCustomDateRange,
} from "@/components/reports/DateRangeFilter";
import { AdminPagination } from "@/components/admin/AdminPagination";
import {
  formatReadableLabel,
  capitalizeWords,
  capitalizeFirst,
  formatProjectPdfFilename,
  formatCurrencyNoZero,
  formatCountNoZero,
  formatPercentageNoZero,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------
type RunningProject = {
  id: number;
  jobId?: number;
  jobTitle: string | null;
  clientName: string | null;
  status: string;
  acceptedAt: string;
  deadline: string | null;
  budget: number | null;
  timingType: string;
  progress: number;
};

type EarningsItem = {
  id: number;
  amount: number;
  currency: string;
  status: string;
  description: string;
  createdAt: string;
  trackingId?: number;
  invoicePaymentId?: number | null;
  invoiceNumber?: string;
  projectTitle?: string;
  clientName?: string;
  milestoneTitle?: string;
  paymentMethod?: string;
  razorpayPaymentId?: string | null;
  baseAmount?: number;
  feeAmount?: number;
  netAmount?: number;
};

type WithdrawalRecord = {
  id: number;
  amount: number;
  currency?: string;
  status: string;
  payoutRail?: string;
  destinationLabel?: string;
  referenceNumber?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt?: string;
};

type WalletData = {
  wallet?: { balance: number; currency: string; pendingBalance: number };
  available?: number;
  reserved?: number;
  grossTotal?: number;
  earned?: number;
  commission?: number;
  withdrawals?: WithdrawalRecord[];
  commissionEnabled?: boolean;
  commissionRate?: number;
};

type ProfessionalTab = "projects" | "transactions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function displayStatus(status: string) {
  if (!status) return "—";
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadgeClass(status: string) {
  const normalized = (status || "").toUpperCase();
  if (
    normalized.includes("COMPLETED") ||
    normalized.includes("PAID") ||
    normalized.includes("SETTLED") ||
    normalized === "APPROVED"
  ) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  }
  if (
    normalized.includes("RUNNING") ||
    normalized.includes("IN_PROGRESS") ||
    normalized.includes("FUNDED")
  ) {
    return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
  }
  if (
    normalized.includes("PENDING") ||
    normalized.includes("AWAITING") ||
    normalized.includes("PROCESSING")
  ) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  }
  if (
    normalized.includes("FAILED") ||
    normalized.includes("REJECTED") ||
    normalized.includes("CANCELLED")
  ) {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
  }
  return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
}

function formatDateSafely(
  dateInput: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(
    "en-IN",
    options ?? { day: "2-digit", month: "short", year: "numeric" },
  );
}

// ===========================================================================
// MAIN COMPONENT: PROFESSIONAL REPORTS & AUDIT LEDGERS
// ===========================================================================
export default function ProfessionalReports() {
  const [tab, setTab] = useState<ProfessionalTab>("projects");
  const [projects, setProjects] = useState<RunningProject[]>([]);
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "boxes">("table");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const loadData = () => {
    setLoading(true);

    Promise.all([
      fetch("/api/v1/portal/professional-jobs", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch("/api/v1/portal/earnings", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch("/api/wallet", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ])
      .then(([jobsData, earningsData, walletRes]) => {
        if (jobsData) {
          const active: RunningProject[] = Array.isArray(jobsData.activeProjects)
            ? jobsData.activeProjects
            : [];
          const completed: RunningProject[] = Array.isArray(jobsData.completedProjects)
            ? (
                jobsData.completedProjects as Array<{
                  id: number;
                  jobId?: number;
                  jobTitle?: string | null;
                  clientName?: string | null;
                  completedAt?: string;
                  amount?: number;
                }>
              ).map((cp) => ({
                id: cp.id,
                jobId: cp.jobId,
                jobTitle: cp.jobTitle ?? `Job #${cp.jobId}`,
                clientName: cp.clientName ?? "Client",
                status: "COMPLETED",
                acceptedAt: cp.completedAt || new Date().toISOString(),
                deadline: null,
                budget: cp.amount ?? null,
                timingType: "FIXED",
                progress: 100,
              }))
            : [];
          const closed: RunningProject[] = Array.isArray(jobsData.closedProjects)
            ? (
                jobsData.closedProjects as Array<{
                  id: number;
                  jobId?: number;
                  jobTitle?: string | null;
                  clientName?: string | null;
                  updatedAt?: string;
                }>
              ).map((cl) => ({
                id: cl.id,
                jobId: cl.jobId,
                jobTitle: cl.jobTitle ?? `Job #${cl.jobId}`,
                clientName: cl.clientName ?? "Client",
                status: "CLOSED",
                acceptedAt: cl.updatedAt || new Date().toISOString(),
                deadline: null,
                budget: null,
                timingType: "FIXED",
                progress: 0,
              }))
            : [];
          setProjects([...active, ...completed, ...closed]);
        }

        if (Array.isArray(earningsData)) {
          setEarnings(earningsData);
        }

        if (walletRes && typeof walletRes === "object") {
          setWalletData(walletRes);
        }
      })
      .catch((err) => {
        console.error("Failed to load professional reports records:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(
    ["servio:project-update", "servio:proposal", "servio:notification"],
    loadData,
  );

  const handleTabChange = (newTab: ProfessionalTab) => {
    setTab(newTab);
    setSearch("");
    setStatusFilter("ALL");
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const isCommissionOn = walletData?.commissionEnabled ?? false;
  const commissionRate = walletData?.commissionRate ?? 0.1;

  // ---------------------------------------------------------------------------
  // FILTERED PROJECTS
  // ---------------------------------------------------------------------------
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        (project.jobTitle && project.jobTitle.toLowerCase().includes(q)) ||
        (project.clientName && project.clientName.toLowerCase().includes(q)) ||
        String(project.id).includes(q);

      const s = project.status.toUpperCase();
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "IN_PROGRESS" &&
          (s === "RUNNING" || s === "IN_PROGRESS" || s === "ACTIVE")) ||
        s === statusFilter.toUpperCase();

      const dateToCheck = project.acceptedAt || project.deadline;
      const matchesDate = isWithinCustomDateRange(dateToCheck, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [projects, search, statusFilter, datePreset, startDate, endDate]);

  const paginatedProjects = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [filteredProjects, page]);

  // Project KPIs (zeros suppressed with "—")
  const totalContractBudget = useMemo(() => {
    return filteredProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  }, [filteredProjects]);

  const activeProjectsCount = useMemo(() => {
    return filteredProjects.filter(
      (p) =>
        p.status === "RUNNING" ||
        p.status === "IN_PROGRESS" ||
        p.status === "ACTIVE",
    ).length;
  }, [filteredProjects]);

  const completedProjectsCount = useMemo(() => {
    return filteredProjects.filter((p) => p.status === "COMPLETED").length;
  }, [filteredProjects]);

  const avgProgress = useMemo(() => {
    if (filteredProjects.length === 0) return 0;
    const total = filteredProjects.reduce((sum, p) => sum + (p.progress || 0), 0);
    return Math.round(total / filteredProjects.length);
  }, [filteredProjects]);

  // ---------------------------------------------------------------------------
  // FILTERED TRANSACTIONS / EARNINGS
  // ---------------------------------------------------------------------------
  const filteredEarnings = useMemo(() => {
    return earnings.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.projectTitle && item.projectTitle.toLowerCase().includes(q)) ||
        (item.clientName && item.clientName.toLowerCase().includes(q)) ||
        (item.invoiceNumber && item.invoiceNumber.toLowerCase().includes(q)) ||
        String(item.id).includes(q);

      const s = item.status.toUpperCase();
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "PAID" && (s === "PAID" || s === "COMPLETED" || s === "SETTLED")) ||
        (statusFilter === "PENDING" && (s === "PENDING" || s === "AWAITING_ADMIN_APPROVAL"));

      const matchesDate = isWithinCustomDateRange(item.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [earnings, search, statusFilter, datePreset, startDate, endDate]);

  const paginatedEarnings = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEarnings.slice(start, start + PAGE_SIZE);
  }, [filteredEarnings, page]);

  // Transaction / Financial KPIs (zeros suppressed with "—")
  const metrics = useMemo(() => {
    const grossEarnings = filteredEarnings.reduce(
      (sum, item) => sum + (Number(item.baseAmount ?? item.amount) || 0),
      0,
    );

    const commissionDeducted = filteredEarnings.reduce(
      (sum, item) => sum + (Number(item.feeAmount) || 0),
      0,
    );

    const tdsDeducted = Math.round(grossEarnings * 0.01);

    const netEarningsCredited = filteredEarnings.reduce(
      (sum, item) => sum + (Number(item.netAmount ?? item.amount) || 0),
      0,
    );

    const walletAvailable = walletData?.available ?? walletData?.wallet?.balance ?? 0;

    return {
      grossEarnings,
      commissionDeducted,
      tdsDeducted,
      netEarningsCredited,
      walletAvailable,
    };
  }, [filteredEarnings, walletData]);

  // ---------------------------------------------------------------------------
  // PROJECT TABLE COLUMNS
  // ---------------------------------------------------------------------------
  const projectColumns: ReportTableColumn<RunningProject>[] = [
    {
      key: "id",
      header: "Ref #",
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
          #PRJ-{p.id}
        </span>
      ),
    },
    {
      key: "jobTitle",
      header: "Job Scope / Contract",
      render: (p) => (
        <div className="space-y-0.5 max-w-[240px]">
          <Link
            href={`/project/${p.id}/tracking`}
            className="font-semibold text-foreground hover:text-primary transition line-clamp-1 block text-xs"
          >
            {capitalizeWords(p.jobTitle || `Project #${p.id}`)}
          </Link>
          <span className="text-[11px] text-muted-foreground block truncate">
            Client: {capitalizeWords(p.clientName || "Verified Client")}
          </span>
        </div>
      ),
    },
    {
      key: "budget",
      header: "Contract Amount",
      align: "right",
      render: (p) => (
        <span className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
          {formatCurrencyNoZero(p.budget)}
        </span>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      align: "right",
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
          {formatPercentageNoZero(p.progress)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
            p.status,
          )}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {displayStatus(p.status)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Accepted Date",
      align: "right",
      render: (p) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateSafely(p.acceptedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <a
            href={`/api/portal/projects/${p.id}/export`}
            target="_blank"
            rel="noopener noreferrer"
            download={formatProjectPdfFilename(p.jobTitle, `project-${p.id}`)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition"
            title="Download official Project Dossier PDF"
          >
            <FileDown className="h-3 w-3 text-primary" />
            <span>PDF</span>
          </a>
          <button
            type="button"
            onClick={() => {
              downloadCsvFile({
                filename: `project-${p.id}-contract`,
                title: `Project Contract · #PRJ-${p.id}`,
                headers: [
                  "Project Ref",
                  "Job Scope",
                  "Client Name",
                  "Status",
                  "Contract Amount (INR)",
                  "Progress %",
                  "Target Deadline",
                  "Accepted Date",
                ],
                rows: [
                  [
                    `#PRJ-${p.id}`,
                    capitalizeWords(p.jobTitle || `Project #${p.id}`),
                    capitalizeWords(p.clientName || "Direct Client"),
                    displayStatus(p.status),
                    p.budget ?? "—",
                    `${p.progress}%`,
                    p.deadline ? formatDateSafely(p.deadline) : "Flexible",
                    formatDateSafely(p.acceptedAt),
                  ],
                ],
              });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            title="Export single project CSV"
          >
            <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>CSV</span>
          </button>
          <Link
            href={`/project/${p.id}/tracking`}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <span>Tracking</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // TRANSACTION / EARNING TABLE COLUMNS
  // ---------------------------------------------------------------------------
  const transactionColumns: ReportTableColumn<EarningsItem>[] = [
    {
      key: "invoiceNumber",
      header: "Ref / Voucher",
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
          {item.invoiceNumber || `#EARN-${item.id}`}
        </span>
      ),
    },
    {
      key: "date",
      header: "Disbursed Date",
      render: (item) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateSafely(item.createdAt)}
        </span>
      ),
    },
    {
      key: "description",
      header: "Particulars / Milestone",
      render: (item) => (
        <div className="space-y-0.5 max-w-[240px]">
          <div className="font-semibold text-foreground text-xs line-clamp-1">
            {capitalizeFirst(item.description || item.milestoneTitle || "Milestone Settlement")}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {capitalizeWords(item.projectTitle || `Project #${item.trackingId ?? item.id}`)}
          </div>
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (item) => (
        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          {capitalizeWords(item.clientName || "Direct Client")}
        </span>
      ),
    },
    {
      key: "gross",
      header: "Gross Amount",
      align: "right",
      render: (item) => (
        <span className="font-mono text-xs font-semibold text-foreground whitespace-nowrap">
          {formatCurrencyNoZero(Number(item.baseAmount ?? item.amount) || 0)}
        </span>
      ),
    },
    ...(isCommissionOn
      ? [
          {
            key: "commission" as const,
            header: "Commission",
            align: "right" as const,
            render: (item: EarningsItem) => (
              <span className="font-mono text-xs text-rose-600 dark:text-rose-400 whitespace-nowrap">
                {formatCurrencyNoZero(Number(item.feeAmount) || 0)}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "netAmount",
      header: "Net Credited",
      align: "right",
      render: (item) => (
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
          {formatCurrencyNoZero(Number(item.netAmount ?? item.amount) || 0)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
            item.status,
          )}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {displayStatus(item.status)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <a
            href={`/api/portal/invoices/${item.invoicePaymentId || item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition"
            title="Download official Payout Receipt PDF"
          >
            <FileDown className="h-3 w-3 text-primary" />
            <span>PDF</span>
          </a>
          <button
            type="button"
            onClick={() => {
              downloadCsvFile({
                filename: `earning-voucher-${item.id}`,
                title: `Earning Voucher · ${item.invoiceNumber || `#EARN-${item.id}`}`,
                headers: isCommissionOn
                  ? [
                      "Voucher #",
                      "Date",
                      "Milestone / Description",
                      "Project Title",
                      "Client Name",
                      "Gross Amount (INR)",
                      "Commission (INR)",
                      "Net Credited (INR)",
                      "Status",
                    ]
                  : [
                      "Voucher #",
                      "Date",
                      "Milestone / Description",
                      "Project Title",
                      "Client Name",
                      "Gross Amount (INR)",
                      "Net Credited (INR)",
                      "Status",
                    ],
                rows: [
                  isCommissionOn
                    ? [
                        item.invoiceNumber || `#EARN-${item.id}`,
                        formatDateSafely(item.createdAt),
                        capitalizeFirst(item.description || item.milestoneTitle || "Milestone Settlement"),
                        capitalizeWords(item.projectTitle || `Project #${item.trackingId ?? item.id}`),
                        capitalizeWords(item.clientName || "Direct Client"),
                        item.baseAmount ?? item.amount,
                        item.feeAmount ?? 0,
                        item.netAmount ?? item.amount,
                        capitalizeWords(item.status),
                      ]
                    : [
                        item.invoiceNumber || `#EARN-${item.id}`,
                        formatDateSafely(item.createdAt),
                        capitalizeFirst(item.description || item.milestoneTitle || "Milestone Settlement"),
                        capitalizeWords(item.projectTitle || `Project #${item.trackingId ?? item.id}`),
                        capitalizeWords(item.clientName || "Direct Client"),
                        item.baseAmount ?? item.amount,
                        item.netAmount ?? item.amount,
                        capitalizeWords(item.status),
                      ],
                ],
              });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            title="Export single earning CSV"
          >
            <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>CSV</span>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Admin-Style Header Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span>Professional Earnings & Audit Ledgers</span>
              <span className="text-primary/40">·</span>
              <span className="font-mono text-[11px] text-primary/80">IST (UTC+5:30)</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
              Reports & Earnings Statements
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Official audit statements of your milestone billings, platform commissions, Section 194-O statutory TDS
              deductions, and verified bank/UPI disbursements.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground hover:bg-muted transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : "text-muted-foreground"}`} />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

        {/* 2-Section Navigation Bar (Projects & Transactions) */}
        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => handleTabChange("projects")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "projects"
                ? "bg-foreground text-background shadow-xs font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            <span>Projects & Contracts</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("transactions")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
              tab === "transactions"
                ? "bg-foreground text-background shadow-xs font-bold"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <CircleDollarSign className="h-4 w-4" />
            <span>Transactions & Settlements</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: PROJECTS & CONTRACTS */}
      {/* ===================================================================== */}
      {tab === "projects" && (
        <div className="space-y-6">
          {/* 4 Executive KPI Cards with Skeletons */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Contracted Value</span>
                <CircleDollarSign className="h-4 w-4 text-primary" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatCurrencyNoZero(totalContractBudget)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Contractual value of projects</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Contracts</span>
                <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 sm:text-3xl truncate">
                  {formatCountNoZero(activeProjectsCount)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">In-progress professional deliverables</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed Contracts</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl truncate">
                  {formatCountNoZero(completedProjectsCount)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Successfully fulfilled engagements</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Delivery Rate</span>
                <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatPercentageNoZero(avgProgress)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Across all current milestone tracks</p>
            </div>
          </div>

          {/* Filter Bar and Action Controls */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search project title, client, ref..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>

              <DateRangeFilter
                preset={datePreset}
                onPresetChange={(p) => {
                  setDatePreset(p);
                  setPage(1);
                }}
                startDate={startDate}
                onStartDateChange={(s) => {
                  setStartDate(s);
                  setPage(1);
                }}
                endDate={endDate}
                onEndDateChange={(e) => {
                  setEndDate(e);
                  setPage(1);
                }}
              />

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-hidden"
              >
                <option value="ALL">All Contract Statuses</option>
                <option value="IN_PROGRESS">Active / In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CLOSED">Closed</option>
              </select>

              {/* View Toggle */}
              <div className="flex items-center border border-border rounded-xl p-0.5 bg-muted/40">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === "table" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                  title="Table View"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("boxes")}
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === "boxes" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>

              {(search || statusFilter !== "ALL" || datePreset !== "all") && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ExportMenu
                endpoint="/api/professional/jobs/export"
                selectedIds={filteredProjects.map((p) => p.id)}
                totalCount={filteredProjects.length}
                fileBaseName="professional-projects"
                buttonLabel="Export PDF"
                onExportCsv={() => {
                  downloadCsvFile({
                    filename: "professional-projects-statement",
                    title: "Professional Contracts Statement",
                    headers: [
                      "Project Ref",
                      "Job Scope",
                      "Client Name",
                      "Status",
                      "Contract Amount (INR)",
                      "Progress %",
                      "Target Deadline",
                      "Accepted Date",
                    ],
                    rows: filteredProjects.map((p) => [
                      `#PRJ-${p.id}`,
                      capitalizeWords(p.jobTitle || `Project #${p.id}`),
                      capitalizeWords(p.clientName || "Direct Client"),
                      displayStatus(p.status),
                      p.budget ?? "—",
                      `${p.progress}%`,
                      p.deadline ? formatDateSafely(p.deadline) : "Flexible",
                      formatDateSafely(p.acceptedAt),
                    ]),
                  });
                }}
              />
            </div>
          </div>

          {/* Dual View Display */}
          {viewMode === "boxes" ? (
            <div className="space-y-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
                      <div className="flex justify-between">
                        <div className="h-4 w-20 rounded bg-muted/60" />
                        <div className="h-4 w-16 rounded bg-muted/60" />
                      </div>
                      <div className="h-5 w-3/4 rounded bg-muted/60" />
                      <div className="h-3 w-1/2 rounded bg-muted/60" />
                      <div className="h-10 w-full rounded bg-muted/40" />
                    </div>
                  ))}
                </div>
              ) : paginatedProjects.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card py-12 text-center text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-foreground">No contracts found</p>
                  <p className="text-xs mt-1">Try clearing your filters or selecting a different date range.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedProjects.map((project) => {
                    const trackingHref = `/project/${project.id}/tracking`;
                    return (
                      <article
                        key={project.id}
                        className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/40"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                              #PRJ-{project.id}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                                project.status,
                              )}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {displayStatus(project.status)}
                            </span>
                          </div>

                          <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">
                            <Link href={trackingHref} className="hover:text-primary transition-colors">
                              {capitalizeWords(project.jobTitle) || `Project #${project.id}`}
                            </Link>
                          </h3>

                          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              Client:{" "}
                              <strong className="font-semibold text-foreground">
                                {capitalizeWords(project.clientName) || "Verified Client"}
                              </strong>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                              {project.deadline ? formatDateSafely(project.deadline) : "Flexible schedule"}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-3.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs">
                            <div className="flex items-center justify-between font-medium">
                              <span className="text-muted-foreground">Delivery Progress</span>
                              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                {formatPercentageNoZero(project.progress)}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-border flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Agreed Contract Value
                            </p>
                            <p className="font-mono text-sm font-bold text-foreground">
                              {formatCurrencyNoZero(project.budget)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/portal/projects/${project.id}/export`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={formatProjectPdfFilename(project.jobTitle, `project-${project.id}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted"
                              title="Download official Project Dossier PDF"
                            >
                              <FileDown className="h-3.5 w-3.5 text-primary" />
                              <span>PDF</span>
                            </a>
                            <Link
                              href={trackingHref}
                              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                            >
                              <span>Tracking</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <AdminPagination
                currentPage={page}
                totalItems={filteredProjects.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <SelectableReportTable
                loading={loading}
                rows={paginatedProjects}
                emptyMessage="No project records match the active filter criteria."
                selectable={false}
                rowLabel={(p) => p.jobTitle || String(p.id)}
                columns={projectColumns}
              />
              <AdminPagination
                currentPage={page}
                totalItems={filteredProjects.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: TRANSACTIONS & SETTLEMENTS */}
      {/* ===================================================================== */}
      {tab === "transactions" && (
        <div className="space-y-6">
          {/* 4 Executive KPI Cards with Skeletons */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Gross Milestone Earnings</span>
                <CircleDollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatCurrencyNoZero(metrics.grossEarnings)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Contractual milestone value earned</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isCommissionOn ? "Platform Commission" : "Net Credited"}
                </span>
                {isCommissionOn ? (
                  <Percent className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatCurrencyNoZero(
                    isCommissionOn ? metrics.commissionDeducted : metrics.netEarningsCredited,
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {isCommissionOn
                  ? `Service fee (${Math.round(commissionRate * 100)}%) retained`
                  : "100% credited · Zero commission"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Statutory TDS (Sec 194-O)</span>
                <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatCurrencyNoZero(metrics.tdsDeducted)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">1% participant withholding credit</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Wallet Available</span>
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-primary sm:text-3xl truncate">
                  {formatCurrencyNoZero(metrics.walletAvailable)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Ready for instant withdrawal</p>
            </div>
          </div>

          {/* Filter Bar and Action Controls */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search ref #, description, client, project..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground focus:border-primary focus:outline-hidden"
                />
              </div>

              <DateRangeFilter
                preset={datePreset}
                onPresetChange={(p) => {
                  setDatePreset(p);
                  setPage(1);
                }}
                startDate={startDate}
                onStartDateChange={(s) => {
                  setStartDate(s);
                  setPage(1);
                }}
                endDate={endDate}
                onEndDateChange={(e) => {
                  setEndDate(e);
                  setPage(1);
                }}
              />

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-hidden"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Settled / Paid</option>
                <option value="PENDING">Pending Approval</option>
              </select>

              {(search || statusFilter !== "ALL" || datePreset !== "all") && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ExportMenu
                endpoint="/api/professional/earnings/export"
                selectedIds={filteredEarnings.map((e) => e.id)}
                totalCount={filteredEarnings.length}
                fileBaseName="professional-transactions"
                buttonLabel="Export PDF"
                onExportCsv={() => {
                  downloadCsvFile({
                    filename: "professional-transactions-earnings-statement",
                    title: "Transactions & Earnings Statement",
                    headers: isCommissionOn
                      ? [
                          "Voucher #",
                          "Date",
                          "Milestone / Description",
                          "Project Title",
                          "Client Name",
                          "Gross Amount (INR)",
                          "Commission (INR)",
                          "Net Credited (INR)",
                          "Status",
                        ]
                      : [
                          "Voucher #",
                          "Date",
                          "Milestone / Description",
                          "Project Title",
                          "Client Name",
                          "Gross Amount (INR)",
                          "Net Credited (INR)",
                          "Status",
                        ],
                    rows: filteredEarnings.map((e) =>
                      isCommissionOn
                        ? [
                            e.invoiceNumber || `#EARN-${e.id}`,
                            formatDateSafely(e.createdAt),
                            capitalizeFirst(e.description || e.milestoneTitle || "Milestone Settlement"),
                            capitalizeWords(e.projectTitle || `Project #${e.trackingId ?? e.id}`),
                            capitalizeWords(e.clientName || "Direct Client"),
                            e.baseAmount ?? e.amount,
                            e.feeAmount ?? 0,
                            e.netAmount ?? e.amount,
                            capitalizeWords(e.status),
                          ]
                        : [
                            e.invoiceNumber || `#EARN-${e.id}`,
                            formatDateSafely(e.createdAt),
                            capitalizeFirst(e.description || e.milestoneTitle || "Milestone Settlement"),
                            capitalizeWords(e.projectTitle || `Project #${e.trackingId ?? e.id}`),
                            capitalizeWords(e.clientName || "Direct Client"),
                            e.baseAmount ?? e.amount,
                            e.netAmount ?? e.amount,
                            capitalizeWords(e.status),
                          ],
                    ),
                  });
                }}
              />
            </div>
          </div>

          {/* Transactions Table with Pagination */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <SelectableReportTable
              loading={loading}
              rows={paginatedEarnings}
              emptyMessage="No transaction records match the active filter criteria."
              selectable={false}
              rowLabel={(item) => String(item.id)}
              columns={transactionColumns}
            />
            <AdminPagination
              currentPage={page}
              totalItems={filteredEarnings.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
