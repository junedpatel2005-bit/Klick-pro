"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  ArrowDownToLine,
  TrendingUp,
  LayoutGrid,
  List,
  MapPin,
  CalendarDays,
  ExternalLink,
  FileDown,
  Briefcase,
  SlidersHorizontal,
  RotateCcw,
  Landmark,
  ShieldCheck,
  Scale,
  Receipt,
  Users,
  Percent,
  ArrowUpRight,
  CreditCard,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { SelectableReportTable, type ReportTableColumn } from "@/components/reports/SelectableReportTable";
import { downloadCsvFile } from "@/lib/reports/csv/export-csv";
import {
  ReportingPeriodSelector,
  getDefaultPeriodSelection,
} from "@/components/reports/ReportingPeriodSelector";
import {
  type PeriodSelection,
  isDateWithinPeriod,
  formatINR,
} from "@/lib/reports/financial-periods";
import {
  formatReadableLabel,
  capitalizeWords,
  capitalizeFirst,
  formatProjectPdfFilename,
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

type ProfessionalTab = "projects" | "payments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function displayStatus(status: string) {
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
// MAIN COMPONENT: PROFESSIONAL EARNINGS INTELLIGENCE WORKSPACE
// ===========================================================================
export default function ProfessionalReports() {
  const [tab, setTab] = useState<ProfessionalTab>("projects");
  const [period, setPeriod] = useState<PeriodSelection>(getDefaultPeriodSelection);

  const [projects, setProjects] = useState<RunningProject[]>([]);
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters for sub-views
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"boxes" | "table">("boxes");

  // Load all professional report datasets
  const loadData = () => {
    setLoading(true);
    setError("");

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
      .catch(() => {
        setError("Unable to load earnings reports. Please check connection and refresh.");
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

  // Filter items by Financial Reporting Period
  const periodFilteredEarnings = useMemo(() => {
    return earnings.filter((item) => isDateWithinPeriod(item.createdAt, period));
  }, [earnings, period]);

  const periodFilteredProjects = useMemo(() => {
    return projects.filter((project) =>
      isDateWithinPeriod(project.acceptedAt || project.deadline, period),
    );
  }, [projects, period]);

  const periodFilteredWithdrawals = useMemo(() => {
    const list = walletData?.withdrawals || [];
    return list.filter((w) => isDateWithinPeriod(w.createdAt, period));
  }, [walletData?.withdrawals, period]);

  // Executive KPI Calculations
  const metrics = useMemo(() => {
    // Contractual gross value earned in this period
    const grossEarnings = periodFilteredEarnings.reduce(
      (sum, item) => sum + (Number(item.baseAmount ?? item.amount) || 0),
      0,
    );

    // Platform commission deducted in this period
    const commissionDeducted = periodFilteredEarnings.reduce(
      (sum, item) => sum + (Number(item.feeAmount) || 0),
      0,
    );

    // Section 194-O statutory TDS (1% TDS on gross digital e-commerce participant payouts)
    const tdsDeducted = Math.round(grossEarnings * 0.01);

    // Net credited = gross - commission - tds
    const netEarningsCredited = periodFilteredEarnings.reduce(
      (sum, item) => sum + (Number(item.netAmount ?? item.amount) || 0),
      0,
    );

    // Total settled disbursements
    const settledWithdrawals = periodFilteredWithdrawals
      .filter((w) => w.status.toUpperCase() === "COMPLETED" || w.status.toUpperCase() === "SETTLED")
      .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

    const walletAvailable = walletData?.available ?? walletData?.wallet?.balance ?? 0;

    return {
      grossEarnings,
      commissionDeducted,
      tdsDeducted,
      netEarningsCredited,
      settledWithdrawals,
      walletAvailable,
    };
  }, [periodFilteredEarnings, periodFilteredWithdrawals, walletData]);

  // Search and status filtered earnings
  const displayEarnings = useMemo(() => {
    return periodFilteredEarnings.filter((item) => {
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

      return matchesSearch && matchesStatus;
    });
  }, [periodFilteredEarnings, search, statusFilter]);

  const isCommissionOn = walletData?.commissionEnabled ?? false;
  const commissionRate = walletData?.commissionRate ?? 0.1;

  // Search and status filtered projects
  const displayProjects = useMemo(() => {
    return periodFilteredProjects.filter((project) => {
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

      return matchesSearch && matchesStatus;
    });
  }, [periodFilteredProjects, search, statusFilter]);

  // Client Concentration aggregation
  const clientConcentration = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        grossEarned: number;
        netEarned: number;
        activeCount: number;
        completedCount: number;
        lastDate: string;
      }
    >();

    for (const item of periodFilteredEarnings) {
      const rawName = item.clientName || "Direct Client";
      const name = capitalizeWords(rawName);
      const curr = map.get(name) || {
        name,
        grossEarned: 0,
        netEarned: 0,
        activeCount: 0,
        completedCount: 0,
        lastDate: item.createdAt,
      };

      curr.grossEarned += Number(item.baseAmount ?? item.amount) || 0;
      curr.netEarned += Number(item.netAmount ?? item.amount) || 0;
      if (new Date(item.createdAt).getTime() > new Date(curr.lastDate).getTime()) {
        curr.lastDate = item.createdAt;
      }
      map.set(name, curr);
    }

    for (const p of periodFilteredProjects) {
      const name = capitalizeWords(p.clientName || "Direct Client");
      const curr = map.get(name) || {
        name,
        grossEarned: 0,
        netEarned: 0,
        activeCount: 0,
        completedCount: 0,
        lastDate: p.acceptedAt,
      };

      if (p.status === "COMPLETED") curr.completedCount++;
      else curr.activeCount++;
      map.set(name, curr);
    }

    const totalPeriodGross = metrics.grossEarnings || 1;
    return Array.from(map.values()).map((c) => ({
      ...c,
      sharePercentage: Math.round((c.grossEarned / totalPeriodGross) * 100),
    })).sort((a, b) => b.grossEarned - a.grossEarned);
  }, [periodFilteredEarnings, periodFilteredProjects, metrics.grossEarnings]);

  return (
    <div className="space-y-6 pb-12">
      {/* Executive Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200 backdrop-blur-md">
              <FileText className="h-3.5 w-3.5" /> Professional Earnings Intelligence
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              Reports & Earnings Statements
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base leading-relaxed">
              Official audit statements of your milestone billings, platform commissions, Section 194-O
              statutory TDS deductions, and verified bank/UPI disbursements.
            </p>
          </div>

          {/* 2 Executive Tabs Switcher */}
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/20 bg-black/40 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setTab("projects");
                setSearch("");
                setStatusFilter("ALL");
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "projects"
                  ? "bg-white text-slate-950 shadow-sm font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Project Contracts</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("payments");
                setSearch("");
                setStatusFilter("ALL");
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "payments"
                  ? "bg-white text-slate-950 shadow-sm font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Landmark className="h-4 w-4" />
              <span>Payments & Disbursements</span>
            </button>
          </div>
        </div>
      </section>

      {/* Global Financial Reporting Period Selector */}
      <section className="bg-card border border-border rounded-2xl p-4 shadow-xs">
        <ReportingPeriodSelector
          value={period}
          onChange={setPeriod}
          availableYears={["2026-27", "2025-26", "2024-25"]}
        />
      </section>

      {/* 4 Executive KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Gross Milestone Earnings
            </span>
            <CircleDollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-foreground">
            {formatINR(metrics.grossEarnings)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Contractual milestone value in {period.label}
          </p>
        </div>

        {isCommissionOn ? (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Platform Commission
              </span>
              <Percent className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-foreground">
              {formatINR(metrics.commissionDeducted)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Platform service fee ({Math.round(commissionRate * 100)}%) retained
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Net Milestone Earnings
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatINR(metrics.netEarningsCredited)}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              100% credited to wallet · Zero commission cut
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Statutory TDS (Sec 194-O)
            </span>
            <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-foreground">
            {formatINR(metrics.tdsDeducted)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            1% statutory e-commerce participant withholding
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs bg-gradient-to-br from-card to-primary/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Wallet Available
            </span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-primary">
            {formatINR(metrics.walletAvailable)}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Net spendable balance ready for instant withdrawal
          </p>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* TAB 1: CONSOLIDATED EARNINGS STATEMENT */}
      {/* ===================================================================== */}
      {(tab as string) === "summary" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            {/* Search & Status Filter */}
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by description, project, client, or invoice #"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Settled / Paid</option>
                  <option value="PENDING">Pending Approval</option>
                </select>
              </div>

              {(search || statusFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>

            {/* Export Menu */}
            <ExportMenu
              endpoint="/api/professional/earnings/export"
              selectedIds={displayEarnings.map((e) => e.id)}
              totalCount={displayEarnings.length}
              fileBaseName="klick-pro-professional-earnings"
              buttonLabel="Download Earnings (PDF)"
              onExportCsv={() => {
                downloadCsvFile({
                  filename: "professional-earnings-statement",
                  title: `Official Professional Earnings Statement (${period.label})`,
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
                  rows: displayEarnings.map((e) =>
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

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <SelectableReportTable
              loading={loading}
              rows={displayEarnings}
              selectable={false}
              emptyMessage="No earnings records match the active period or filter criteria."
              columns={[
                {
                  key: "invoiceNumber",
                  header: "Voucher / Ref",
                  render: (item) => (
                    <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                      {item.invoiceNumber || `#EARN-${item.id}`}
                    </span>
                  ),
                },
                {
                  key: "description",
                  header: "Particulars / Milestone",
                  render: (item) => (
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">
                        {capitalizeFirst(item.description || item.milestoneTitle || "Milestone Settlement")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {capitalizeWords(item.projectTitle || `Project #${item.trackingId ?? item.id}`)}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "clientName",
                  header: "Client",
                  render: (item) => (
                    <span className="text-xs font-medium text-foreground">
                      {capitalizeWords(item.clientName || "Direct Client")}
                    </span>
                  ),
                },
                {
                  key: "gross",
                  header: "Gross Amount",
                  align: "right",
                  render: (item) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {formatINR(Number(item.baseAmount ?? item.amount) || 0)}
                    </span>
                  ),
                },
                ...(isCommissionOn
                  ? [
                      {
                        key: "commission",
                        header: "Commission",
                        align: "right" as const,
                        render: (item: EarningsItem) => (
                          <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
                            -{formatINR(Number(item.feeAmount) || 0)}
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
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {formatINR(Number(item.netAmount ?? item.amount) || 0)}
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
                  key: "createdAt",
                  header: "Disbursed Date",
                  align: "right",
                  render: (item) => (
                    <span className="text-xs text-muted-foreground">
                      {formatDateSafely(item.createdAt)}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  align: "right",
                  render: (item) => (
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={`/api/portal/invoices/${item.invoicePaymentId || item.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                        title="Download official Payout Receipt PDF"
                      >
                        <FileDown className="h-3 w-3 text-primary" />
                        <span>Receipt PDF</span>
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
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                        title="Export single earning CSV"
                      >
                        <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>CSV</span>
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* Statement Reconciliation Strip */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{displayEarnings.length}</span> of{" "}
              <span className="font-semibold text-foreground">{periodFilteredEarnings.length}</span> records for {period.label}.
            </div>
            <div className="flex items-center gap-4 font-mono text-xs">
              <span>
                Net Settled:{" "}
                <strong className="text-foreground">{formatINR(metrics.netEarningsCredited)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: PROJECT & MILESTONE CONTRACTS */}
      {/* ===================================================================== */}
      {tab === "projects" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by project title, client, or PRJ #"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-xl border border-border bg-background focus:outline-none"
                >
                  <option value="ALL">All Contracts</option>
                  <option value="IN_PROGRESS">Active / In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center border border-border rounded-xl p-0.5 bg-muted/40">
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
              </div>
            </div>

            <ExportMenu
              endpoint="/api/professional/jobs/export"
              selectedIds={displayProjects.map((p) => p.id)}
              totalCount={displayProjects.length}
              fileBaseName="professional-projects"
              buttonLabel="Download Projects (PDF)"
              onExportCsv={() => {
                downloadCsvFile({
                  filename: "professional-projects-statement",
                  title: `Professional Contracts Statement (${period.label})`,
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
                  rows: displayProjects.map((p) => [
                    `#PRJ-${p.id}`,
                    capitalizeWords(p.jobTitle || `Project #${p.id}`),
                    capitalizeWords(p.clientName || "Direct Client"),
                    displayStatus(p.status),
                    p.budget ?? 0,
                    `${p.progress}%`,
                    p.deadline ? formatDateSafely(p.deadline) : "Flexible",
                    formatDateSafely(p.acceptedAt),
                  ]),
                });
              }}
            />
          </div>

          {/* Dual View Display */}
          {viewMode === "boxes" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayProjects.length === 0 ? (
                <div className="col-span-full py-12 text-center text-muted-foreground">
                  <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="font-semibold text-foreground">No contracts found</p>
                  <p className="text-xs mt-1">Try clearing your filters or selecting a different reporting period.</p>
                </div>
              ) : (
                displayProjects.map((project) => {
                  const trackingHref = `/project/${project.id}/tracking`;
                  return (
                    <article
                      key={project.id}
                      className="relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/40"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                              #PRJ-{project.id}
                            </span>
                          </div>
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
                              {project.progress}%
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
                            {project.budget ? formatINR(project.budget) : "Fixed Scope"}
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
                            <span>Dossier PDF</span>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              downloadCsvFile({
                                filename: `project-${project.id}-contract`,
                                title: `Project Contract · #PRJ-${project.id}`,
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
                                rows: [[
                                  `#PRJ-${project.id}`,
                                  capitalizeWords(project.jobTitle || `Project #${project.id}`),
                                  capitalizeWords(project.clientName || "Direct Client"),
                                  displayStatus(project.status),
                                  project.budget ?? 0,
                                  `${project.progress}%`,
                                  project.deadline ? formatDateSafely(project.deadline) : "Flexible",
                                  formatDateSafely(project.acceptedAt),
                                ]],
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs hover:bg-muted cursor-pointer"
                            title="Export single project CSV"
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>CSV</span>
                          </button>
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
                })
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <SelectableReportTable
                loading={loading}
                rows={displayProjects}
                selectable={false}
                emptyMessage="No project records match the active period or filter criteria."
                columns={[
                  {
                    key: "id",
                    header: "Ref",
                    render: (p) => (
                      <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                        #PRJ-{p.id}
                      </span>
                    ),
                  },
                  {
                    key: "jobTitle",
                    header: "Job Scope",
                    render: (p) => (
                      <Link
                        href={`/project/${p.id}/tracking`}
                        className="font-semibold text-foreground hover:text-primary transition"
                      >
                        {capitalizeWords(p.jobTitle) || `Project #${p.id}`}
                      </Link>
                    ),
                  },
                  {
                    key: "clientName",
                    header: "Client",
                    render: (p) => (
                      <span className="text-xs font-medium text-foreground">
                        {capitalizeWords(p.clientName) || "Direct Client"}
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
                    key: "budget",
                    header: "Contract Amount",
                    align: "right",
                    render: (p) => (
                      <span className="font-mono text-xs font-bold text-foreground">
                        {p.budget ? formatINR(p.budget) : "Fixed Scope"}
                      </span>
                    ),
                  },
                  {
                    key: "progress",
                    header: "Progress",
                    align: "right",
                    render: (p) => (
                      <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {p.progress}%
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    align: "right",
                    render: (p) => (
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/portal/projects/${p.id}/export`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={formatProjectPdfFilename(p.jobTitle, `project-${p.id}`)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                          title="Download official Project Dossier PDF"
                        >
                          <FileDown className="h-3 w-3 text-primary" />
                          <span>Dossier PDF</span>
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
                              rows: [[
                                `#PRJ-${p.id}`,
                                capitalizeWords(p.jobTitle || `Project #${p.id}`),
                                capitalizeWords(p.clientName || "Direct Client"),
                                displayStatus(p.status),
                                p.budget ?? 0,
                                `${p.progress}%`,
                                p.deadline ? formatDateSafely(p.deadline) : "Flexible",
                                formatDateSafely(p.acceptedAt),
                              ]],
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                          title="Export single project CSV"
                        >
                          <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          <span>CSV</span>
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BANK & UPI SETTLEMENT AUDIT LOG */}
      {/* ===================================================================== */}
      {tab === "payments" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Payments & Bank Disbursements</h2>
                <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] font-semibold">
                  Excludes Milestones (Tracked in Projects)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official withdrawal disbursements and direct payouts to your bank accounts & UPI VPAs. Project milestone payments and deliverables are tracked under the Projects tab.
              </p>
            </div>

            <ExportMenu
              selectedIds={periodFilteredWithdrawals.map((w) => w.id)}
              totalCount={periodFilteredWithdrawals.length}
              fileBaseName="klick-pro-settlements-audit"
              buttonLabel="Export Settlements (CSV)"
              onExportCsv={() => {
                downloadCsvFile({
                  filename: "bank-upi-settlements-audit",
                  title: `Bank & UPI Settlements Audit Log (${period.label})`,
                  headers: [
                    "Withdrawal Ref #",
                    "Requested Date",
                    "Payout Rail",
                    "Destination Account / VPA",
                    "UTR / Bank Reference",
                    "Status",
                    "Amount (INR)",
                  ],
                  rows: periodFilteredWithdrawals.map((w) => [
                    `#WD-${w.id}`,
                    formatDateSafely(w.createdAt),
                    w.payoutRail || "BANK_TRANSFER",
                    w.destinationLabel || "Verified Bank Account",
                    w.referenceNumber || "Processing via Gateway",
                    capitalizeWords(w.status),
                    w.amount,
                  ]),
                });
              }}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3">Ref #</th>
                  <th className="p-3">Requested Date</th>
                  <th className="p-3">Payout Rail</th>
                  <th className="p-3">Destination Details</th>
                  <th className="p-3">UTR / Bank Ref</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Settled Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periodFilteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No bank or UPI withdrawal settlements recorded in {period.label}.
                    </td>
                  </tr>
                ) : (
                  periodFilteredWithdrawals.map((w) => {
                    return (
                      <tr
                        key={w.id}
                        className="hover:bg-muted/30 transition"
                      >
                        <td className="p-3 font-mono font-semibold text-muted-foreground">
                          #WD-{w.id}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {formatDateSafely(w.createdAt)}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                            <CreditCard className="h-3 w-3 text-primary" />
                            {w.payoutRail || "IMPS / NEFT"}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-foreground">
                          {w.destinationLabel || "Verified Account"}
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {w.referenceNumber || <span className="text-amber-600">Pending UTR</span>}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                              w.status,
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {displayStatus(w.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatINR(w.amount)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              downloadCsvFile({
                                filename: `settlement-voucher-${w.id}`,
                                title: `Settlement Voucher · #WD-${w.id}`,
                                headers: [
                                  "Withdrawal Ref #",
                                  "Requested Date",
                                  "Payout Rail",
                                  "Destination Account / VPA",
                                  "UTR / Bank Reference",
                                  "Status",
                                  "Amount (INR)",
                                ],
                                rows: [[
                                  `#WD-${w.id}`,
                                  formatDateSafely(w.createdAt),
                                  w.payoutRail || "BANK_TRANSFER",
                                  w.destinationLabel || "Verified Bank Account",
                                  w.referenceNumber || "Processing via Gateway",
                                  capitalizeWords(w.status),
                                  w.amount,
                                ]],
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                            title="Export single settlement CSV"
                          >
                            <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>CSV</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CLIENT-WISE REVENUE CONCENTRATION */}
      {/* ===================================================================== */}
      {(tab as string) === "concentration" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
            <div>
              <h2 className="text-base font-bold text-foreground">Client Revenue Concentration</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Analyze your earnings diversification, client dependencies, and repeat engagement volumes.
              </p>
            </div>

            <ExportMenu
              selectedIds={clientConcentration.map((_, i) => i)}
              selectedCount={clientConcentration.length}
              totalCount={clientConcentration.length}
              fileBaseName="klick-pro-client-concentration"
              onExportCsv={() => {
                downloadCsvFile({
                  filename: "client-concentration-analysis",
                  title: `Client Revenue Concentration (${period.label})`,
                  headers: [
                    "Client Name",
                    "Gross Billings (INR)",
                    "Net Credited (INR)",
                    "Revenue Share %",
                    "Completed Engagements",
                    "Active Contracts",
                    "Last Billed Date",
                  ],
                  rows: clientConcentration.map((c) => [
                    c.name,
                    c.grossEarned,
                    c.netEarned,
                    `${c.sharePercentage}%`,
                    c.completedCount,
                    c.activeCount,
                    formatDateSafely(c.lastDate),
                  ]),
                });
              }}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3">Client Name</th>
                  <th className="p-3">Gross Billings</th>
                  <th className="p-3">Net Received</th>
                  <th className="p-3">Revenue Concentration</th>
                  <th className="p-3">Completed Jobs</th>
                  <th className="p-3">Active Jobs</th>
                  <th className="p-3 text-right">Last Engagement</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientConcentration.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No client engagements recorded for {period.label}.
                    </td>
                  </tr>
                ) : (
                  clientConcentration.map((client) => {
                    const isHighDependency = client.sharePercentage >= 50;
                    return (
                      <tr key={client.name} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-primary" />
                          <span>{client.name}</span>
                        </td>
                        <td className="p-3 font-mono font-semibold text-foreground">
                          {formatINR(client.grossEarned)}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatINR(client.netEarned)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isHighDependency ? "bg-amber-500" : "bg-primary"
                                }`}
                                style={{ width: `${Math.min(100, client.sharePercentage)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-semibold text-foreground">
                              {client.sharePercentage}%
                            </span>
                            {isHighDependency && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600"
                                title="Over 50% of revenue originates from this single client"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                High Share
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-muted-foreground">
                          {client.completedCount}
                        </td>
                        <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400">
                          {client.activeCount}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {formatDateSafely(client.lastDate)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              downloadCsvFile({
                                filename: `client-${client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-concentration`,
                                title: `Client Concentration · ${client.name}`,
                                headers: [
                                  "Client Name",
                                  "Gross Billings (INR)",
                                  "Net Received (INR)",
                                  "Revenue Share %",
                                  "Completed Jobs",
                                  "Active Jobs",
                                  "Last Engagement",
                                ],
                                rows: [[
                                  client.name,
                                  client.grossEarned,
                                  client.netEarned,
                                  `${client.sharePercentage}%`,
                                  client.completedCount,
                                  client.activeCount,
                                  formatDateSafely(client.lastDate),
                                ]],
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                            title="Export client concentration CSV"
                          >
                            <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>CSV</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
