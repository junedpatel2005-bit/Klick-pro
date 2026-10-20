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
  RefreshCw,
  LayoutGrid,
  List,
  MapPin,
  CalendarDays,
  ExternalLink,
  FileDown,
  Briefcase,
  SlidersHorizontal,
  RotateCcw,
  Users,
  Building2,
  Receipt,
  FileSpreadsheet,
  FileCheck,
  AlertCircle,
  Percent,
} from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
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

type Job = {
  id: number;
  title: string | null;
  description?: string | null;
  category?: string | null;
  status: "DRAFT" | "OPEN" | "RUNNING" | "COMPLETED" | "CLOSED";
  projectId: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
  agreedAmount?: number | null;
  locationAddress: string | null;
  createdAt?: string;
  updatedAt: string;
  milestoneStats?: { total: number; completed: number; remaining: number } | null;
};

type Payment = {
  id: number;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
  trackingId?: number;
  invoiceNumber?: string;
  projectTitle?: string;
  professionalName?: string;
  milestoneTitle?: string;
  paymentMethod?: string;
  razorpayPaymentId?: string | null;
  baseAmount?: number;
  feeAmount?: number;
  netAmount?: number;
  grossAmount?: number;
};

type ClientTab = "projects" | "payments";

function readableStatus(status: string) {
  if (status === "RUNNING") return "In Progress";
  if (status === "COMPLETED") return "Completed";
  if (status === "CLOSED") return "Closed";
  if (status === "DRAFT") return "Draft";
  if (status === "OPEN") return "Open";
  return status[0] + status.slice(1).toLowerCase();
}

function statusBadgeClass(status: string) {
  switch (status.toUpperCase()) {
    case "COMPLETED":
    case "PAID":
    case "SETTLED":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "RUNNING":
    case "IN_PROGRESS":
    case "FUNDED":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    case "DRAFT":
    case "PENDING":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "CLOSED":
    case "CANCELLED":
      return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
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

export default function ClientReports() {
  const [tab, setTab] = useState<ClientTab>("projects");
  const [period, setPeriod] = useState<PeriodSelection>(getDefaultPeriodSelection);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/v1/client/jobs").then((r) => (r.ok ? r.json() : { jobs: [] })),
      fetch("/api/v1/portal/earnings", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([jobsData, paymentsData]) => {
        setJobs(jobsData.jobs ?? []);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        setMessage("");
      })
      .catch(() => {
        setMessage("Unable to load client financial records at this time.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(
    ["servio:project-update", "servio:proposal", "servio:notification"],
    loadData,
  );

  // Filter jobs by selected period & criteria
  const periodFilteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      const dateToCheck = j.createdAt || j.updatedAt;
      return isDateWithinPeriod(dateToCheck, period.startDate, period.endDate);
    });
  }, [jobs, period]);

  // Filter payments by selected period & criteria
  const periodFilteredPayments = useMemo(() => {
    return payments.filter((p) => {
      return isDateWithinPeriod(p.createdAt, period.startDate, period.endDate);
    });
  }, [payments, period]);

  // Non-milestone payments: Milestone payments are included inside each Project in the Projects tab
  const nonMilestonePayments = useMemo(() => {
    return periodFilteredPayments.filter((p) => {
      if (p.milestoneTitle) return false;
      const typeStr = (p.type || "").toUpperCase();
      if (typeStr.includes("MILESTONE") || typeStr === "MILESTONE_PAYMENT") return false;
      if (p.description && /milestone/i.test(p.description)) return false;
      return true;
    });
  }, [periodFilteredPayments]);


  // Single item CSV exporters
  const exportSingleJobCsv = (job: Job) => {
    downloadCsvFile({
      filename: `klick-pro-job-${job.id}`,
      title: `Project Engagement Statement #${job.id}`,
      headers: [
        "Job ID",
        "Project Title",
        "Category",
        "Status",
        "Contract Value",
        "Milestones Done",
        "Total Milestones",
        "Created Date",
      ],
      rows: [
        [
          job.id,
          capitalizeWords(job.title || `Project #${job.id}`),
          capitalizeWords(job.category || "General"),
          capitalizeWords(job.status),
          job.agreedAmount ? formatINR(job.agreedAmount) : "Pending",
          job.milestoneStats?.completed ?? 0,
          job.milestoneStats?.total ?? 0,
          formatDateSafely(job.createdAt),
        ],
      ],
    });
  };

  const exportSinglePaymentCsv = (p: Payment) => {
    downloadCsvFile({
      filename: `klick-pro-payment-receipt-${p.id}`,
      title: `Official Payment Receipt #${p.invoiceNumber || p.id}`,
      headers: [
        "Payment Ref #",
        "Date",
        "Recipient Professional",
        "Particulars / Description",
        "Status",
        "Amount (INR)",
      ],
      rows: [
        [
          p.id,
          formatDateSafely(p.createdAt),
          capitalizeWords(p.professionalName || "Assigned Professional"),
          capitalizeFirst(p.description),
          capitalizeWords(p.status),
          p.amount,
        ],
      ],
    });
  };

  // Executive Spend Calculations
  const metrics = useMemo(() => {
    const clearedPayments = periodFilteredPayments.filter(
      (p) => p.status.toUpperCase() === "COMPLETED" || p.status.toUpperCase() === "PAID",
    );
    const totalSpent = clearedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const pendingPayments = periodFilteredPayments.filter(
      (p) => p.status.toUpperCase() === "PENDING" || p.status.toUpperCase() === "FUNDED",
    );
    const escrowHeld = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const activeProjectsCount = periodFilteredJobs.filter(
      (j) => j.status === "RUNNING" || j.status === "OPEN",
    ).length;

    let totalMilestones = 0;
    let completedMilestones = 0;
    periodFilteredJobs.forEach((j) => {
      if (j.milestoneStats) {
        totalMilestones += j.milestoneStats.total;
        completedMilestones += j.milestoneStats.completed;
      }
    });

    return {
      totalSpent,
      escrowHeld,
      activeProjectsCount,
      totalMilestones,
      completedMilestones,
      clearedCount: clearedPayments.length,
      pendingCount: pendingPayments.length,
    };
  }, [periodFilteredJobs, periodFilteredPayments]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.category?.trim()) set.add(capitalizeWords(j.category.trim()));
    });
    return Array.from(set).sort();
  }, [jobs]);

  // Contractor Breakdown Aggregation
  const contractorRows = useMemo(() => {
    type ContractorAgg = {
      name: string;
      projectCount: number;
      totalFunded: number;
      totalReleased: number;
      categories: Set<string>;
      lastDate: string;
    };
    const map = new Map<string, ContractorAgg>();

    periodFilteredPayments.forEach((p) => {
      const proName = capitalizeWords(p.professionalName || "Assigned Professional");
      const current = map.get(proName) || {
        name: proName,
        projectCount: 0,
        totalFunded: 0,
        totalReleased: 0,
        categories: new Set<string>(),
        lastDate: p.createdAt,
      };

      if (p.status.toUpperCase() === "COMPLETED" || p.status.toUpperCase() === "PAID") {
        current.totalReleased += Number(p.amount) || 0;
      } else {
        current.totalFunded += Number(p.amount) || 0;
      }

      if (new Date(p.createdAt) > new Date(current.lastDate)) {
        current.lastDate = p.createdAt;
      }
      map.set(proName, current);
    });

    return Array.from(map.values()).map((c) => ({
      ...c,
      effectiveCost: c.totalReleased + c.totalFunded,
    }));
  }, [periodFilteredPayments]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 text-foreground shadow-card">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <CircleDollarSign className="h-3.5 w-3.5" />
              <span>Client Spend Intelligence</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Spend Reports & Expense Ledger
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Consolidated financial statements, milestone payment approvals, contractor costs, and
              escrow allocations verified against platform settlement records.
            </p>
          </div>

          {/* Quick Refresh */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>
      </div>

      {/* Shared Indian Financial Year Period Selector */}
      <ReportingPeriodSelector value={period} onChange={setPeriod} />

      {/* 4 Executive Spend KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Spend (Released)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl truncate">
            {formatINR(metrics.totalSpent)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {metrics.clearedCount} {metrics.clearedCount === 1 ? "milestone released" : "milestones released"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Escrow Held / Committed</span>
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
            {formatINR(metrics.escrowHeld)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">100% protected in milestone custody</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Projects</span>
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
            {metrics.activeProjectsCount}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">In progress or open for hire</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Milestone Progress</span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
            {metrics.completedMilestones} / {metrics.totalMilestones}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {metrics.totalMilestones > 0
              ? `${Math.round((metrics.completedMilestones / metrics.totalMilestones) * 100)}% deliverables approved`
              : "No milestone deliverables"}
          </p>
        </div>
      </div>

      {/* 2-Option Executive Tab Deck */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/60 p-1.5 w-fit">
        <button
          type="button"
          onClick={() => {
            setTab("projects");
            setSearch("");
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            tab === "projects"
              ? "bg-card text-foreground shadow-soft font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          <span>Projects & Engagements</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab("payments");
            setSearch("");
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            tab === "payments"
              ? "bg-card text-foreground shadow-soft font-bold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" />
          <span>Direct Payments & Wallet</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PROJECTS & COST LEDGER */}
      {/* ===================================================================== */}
      {tab === "projects" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Project Cost Ledger</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Contract values, milestone completion, and financial lifecycle per project. Select 1 or more projects to download.
              </p>
            </div>
            <ExportMenu
              endpoint="/api/client/jobs/export"
              selectedIds={periodFilteredJobs.map((j) => j.id)}
              totalCount={periodFilteredJobs.length}
              fileBaseName="client-projects"
              buttonLabel="Download Projects (PDF)"
              onExportCsv={() => {
                downloadCsvFile({
                  filename: "client-projects-cost-ledger",
                  title: `Project Cost Ledger (${period.label})`,
                  headers: [
                    "Job ID",
                    "Project Title",
                    "Category",
                    "Status",
                    "Agreed Amount",
                    "Completed Milestones",
                    "Total Milestones",
                    "Created Date",
                  ],
                  rows: periodFilteredJobs.map((j) => [
                    j.id,
                    capitalizeWords(j.title || "Untitled Project"),
                    capitalizeWords(j.category || "General"),
                    capitalizeWords(j.status),
                    j.agreedAmount ? formatINR(j.agreedAmount) : "Not Set",
                    j.milestoneStats?.completed ?? 0,
                    j.milestoneStats?.total ?? 0,
                    formatDateSafely(j.createdAt),
                  ]),
                });
              }}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3">Project Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Contract Value</th>
                  <th className="p-3">Milestone Progress</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periodFilteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No projects found within the selected reporting period.
                    </td>
                  </tr>
                ) : (
                  periodFilteredJobs.map((job) => {
                    return (
                      <tr
                        key={job.id}
                        className="hover:bg-muted/40 transition"
                      >
                        <td className="p-3 font-semibold text-foreground">
                          <Link
                            href={job.projectId ? `/project/${job.projectId}/tracking` : `/job/${job.id}`}
                            className="hover:text-primary transition"
                          >
                            {capitalizeWords(job.title || `Project #${job.id}`)}
                          </Link>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {capitalizeWords(job.category || "General")}
                        </td>
                        <td className="p-3 font-semibold font-mono text-foreground">
                          {job.agreedAmount ? formatINR(job.agreedAmount) : "Budget Pending"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {job.milestoneStats ? (
                            <span>
                              {job.milestoneStats.completed} / {job.milestoneStats.total} done
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                              job.status,
                            )}`}
                          >
                            {readableStatus(job.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={job.projectId ? `/api/portal/projects/${job.projectId}/export` : `/api/portal/jobs/${job.id}/export`}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={formatProjectPdfFilename(job.title, `project-${job.id}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                              title="Download official Project Dossier PDF"
                            >
                              <FileDown className="h-3 w-3 text-primary" />
                              <span>Dossier PDF</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => exportSingleJobCsv(job)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                              title="Export single project CSV"
                            >
                              <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>CSV</span>
                            </button>
                            {job.projectId && (
                              <Link
                                href={`/project/${job.projectId}/tracking`}
                                className="font-medium text-primary hover:underline text-[11px]"
                              >
                                Workspace →
                              </Link>
                            )}
                          </div>
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
      {/* TAB 2: DIRECT PAYMENTS & WALLET LEDGER (EXCLUDES MILESTONES) */}
      {/* ===================================================================== */}
      {tab === "payments" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Direct Payments & Platform Receipts</h2>
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2.5 py-0.5 text-[10px] font-semibold">
                  Excludes Milestones (Shown in Projects)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Official gateway payments, wallet top-ups, and direct service receipts. Milestone payments are tracked directly within each project under the Projects tab.
              </p>
            </div>
            <ExportMenu
              endpoint="/api/client/payments/export"
              selectedIds={nonMilestonePayments.map((p) => p.id)}
              totalCount={nonMilestonePayments.length}
              fileBaseName="klick-pro-client-direct-payments"
              buttonLabel="Download Receipts (PDF)"
              onExportCsv={() => {
                downloadCsvFile({
                  filename: "client-direct-payments-register",
                  title: `Direct Payments & Gateway Receipts (${period.label})`,
                  headers: [
                    "Payment Ref #",
                    "Date",
                    "Recipient Professional",
                    "Description",
                    "Status",
                    "Amount (INR)",
                  ],
                  rows: nonMilestonePayments.map((p) => [
                    p.id,
                    formatDateSafely(p.createdAt),
                    capitalizeWords(p.professionalName || "Assigned Professional"),
                    capitalizeFirst(p.description),
                    capitalizeWords(p.status),
                    p.amount,
                  ]),
                });
              }}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3">Ref #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Recipient Professional</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nonMilestonePayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <div className="max-w-md mx-auto space-y-1">
                        <p className="font-semibold text-foreground">No direct payments found in this period</p>
                        <p className="text-xs text-muted-foreground">
                          All project milestone payments are tracked directly inside their respective projects in the <span className="font-semibold text-primary">Projects & Engagements</span> tab.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  nonMilestonePayments.map((p) => {
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-muted/40 transition"
                      >
                        <td className="p-3 font-mono font-semibold text-primary">#{p.id}</td>
                        <td className="p-3 text-muted-foreground">{formatDateSafely(p.createdAt)}</td>
                        <td className="p-3 font-medium text-foreground">
                          {capitalizeWords(p.professionalName || "Assigned Professional")}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[280px] truncate">
                          {capitalizeFirst(p.description)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
                              p.status,
                            )}`}
                          >
                            {capitalizeWords(p.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-foreground">
                          {formatINR(p.amount)}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/api/portal/invoices/${p.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
                              title="Download official Tax Invoice PDF"
                            >
                              <FileDown className="h-3 w-3 text-primary" />
                              <span>Invoice PDF</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => exportSinglePaymentCsv(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted cursor-pointer"
                              title="Export single payment CSV"
                            >
                              <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              <span>CSV</span>
                            </button>
                          </div>
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
