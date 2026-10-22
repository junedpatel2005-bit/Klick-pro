"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRealtimeRefresh } from "@/lib/use-realtime-refresh";
import {
  FileText,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  CircleDollarSign,
  ArrowDownToLine,
  RefreshCw,
  FileDown,
  Briefcase,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
  Building2,
  ExternalLink,
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

type ClientTab = "projects" | "transactions";

function readableStatus(status: string) {
  if (status === "RUNNING") return "In Progress";
  if (status === "COMPLETED") return "Completed";
  if (status === "CLOSED") return "Closed";
  if (status === "DRAFT") return "Draft";
  if (status === "OPEN") return "Open";
  return status ? status[0] + status.slice(1).toLowerCase() : "—";
}

function statusBadgeClass(status: string) {
  switch ((status || "").toUpperCase()) {
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
    case "WAITING_RESPONSE":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "CLOSED":
    case "CANCELLED":
    case "FAILED":
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/v1/client/jobs", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { jobs: [] },
      ),
      fetch("/api/v1/portal/earnings", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : [],
      ),
    ])
      .then(([jobsData, paymentsData]) => {
        setJobs(Array.isArray(jobsData?.jobs) ? jobsData.jobs : []);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      })
      .catch((err) => {
        console.error("Failed to load client reports records:", err);
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

  // Switch tab resets pagination and search
  const handleTabChange = (newTab: ClientTab) => {
    setTab(newTab);
    setSearch("");
    setStatusFilter("ALL");
    setPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // ---------------------------------------------------------------------------
  // FILTERED PROJECTS
  // ---------------------------------------------------------------------------
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        (job.title && job.title.toLowerCase().includes(q)) ||
        (job.category && job.category.toLowerCase().includes(q)) ||
        String(job.id).includes(q);

      const matchesStatus =
        statusFilter === "ALL" ||
        job.status.toUpperCase() === statusFilter ||
        (statusFilter === "IN_PROGRESS" &&
          (job.status === "RUNNING" || job.status === "OPEN"));

      const dateToCheck = job.createdAt || job.updatedAt;
      const matchesDate = isWithinCustomDateRange(dateToCheck, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [jobs, search, statusFilter, datePreset, startDate, endDate]);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, page]);

  // Project KPIs (zeros are suppressed with "—")
  const totalAgreedBudget = useMemo(() => {
    return filteredJobs.reduce((sum, j) => sum + (Number(j.agreedAmount) || 0), 0);
  }, [filteredJobs]);

  const activeProjectsCount = useMemo(() => {
    return filteredJobs.filter((j) => j.status === "RUNNING" || j.status === "OPEN").length;
  }, [filteredJobs]);

  const completedProjectsCount = useMemo(() => {
    return filteredJobs.filter((j) => j.status === "COMPLETED").length;
  }, [filteredJobs]);

  const { completedMilestones, totalMilestones } = useMemo(() => {
    let completed = 0;
    let total = 0;
    filteredJobs.forEach((j) => {
      if (j.milestoneStats) {
        completed += j.milestoneStats.completed;
        total += j.milestoneStats.total;
      }
    });
    return { completedMilestones: completed, totalMilestones: total };
  }, [filteredJobs]);

  // ---------------------------------------------------------------------------
  // FILTERED TRANSACTIONS
  // ---------------------------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    return payments.filter((p) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.projectTitle && p.projectTitle.toLowerCase().includes(q)) ||
        (p.professionalName && p.professionalName.toLowerCase().includes(q)) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        String(p.id).includes(q);

      const s = (p.status || "").toUpperCase();
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "COMPLETED" && (s === "COMPLETED" || s === "PAID" || s === "SETTLED")) ||
        (statusFilter === "PENDING" && (s === "PENDING" || s === "FUNDED"));

      const matchesDate = isWithinCustomDateRange(p.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [payments, search, statusFilter, datePreset, startDate, endDate]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, page]);

  // Transaction KPIs (zeros are suppressed with "—")
  const clearedPayments = useMemo(() => {
    return filteredTransactions.filter(
      (p) => (p.status || "").toUpperCase() === "COMPLETED" || (p.status || "").toUpperCase() === "PAID",
    );
  }, [filteredTransactions]);

  const totalSpent = useMemo(() => {
    return clearedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [clearedPayments]);

  const pendingPayments = useMemo(() => {
    return filteredTransactions.filter(
      (p) => (p.status || "").toUpperCase() === "PENDING" || (p.status || "").toUpperCase() === "FUNDED",
    );
  }, [filteredTransactions]);

  const totalEscrowHeld = useMemo(() => {
    return pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [pendingPayments]);

  // ---------------------------------------------------------------------------
  // SINGLE ROW CSV EXPORTERS
  // ---------------------------------------------------------------------------
  const exportSingleJobCsv = (job: Job) => {
    downloadCsvFile({
      filename: `klick-pro-job-${job.id}`,
      title: `Project Engagement Statement #${job.id}`,
      headers: [
        "Job ID",
        "Project Title",
        "Category",
        "Status",
        "Contract Value (INR)",
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
          job.agreedAmount ? job.agreedAmount : "—",
          job.milestoneStats?.completed ?? 0,
          job.milestoneStats?.total ?? 0,
          formatDateSafely(job.createdAt),
        ],
      ],
    });
  };

  const exportSinglePaymentCsv = (p: Payment) => {
    downloadCsvFile({
      filename: `klick-pro-receipt-${p.id}`,
      title: `Transaction Receipt #${p.invoiceNumber || p.id}`,
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

  // ---------------------------------------------------------------------------
  // PROJECT TABLE COLUMNS
  // ---------------------------------------------------------------------------
  const projectColumns: ReportTableColumn<Job>[] = [
    {
      key: "id",
      header: "Ref #",
      render: (job) => (
        <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
          #JOB-{job.id}
        </span>
      ),
    },
    {
      key: "title",
      header: "Project Title",
      render: (job) => (
        <div className="space-y-0.5 max-w-[240px]">
          <Link
            href={job.projectId ? `/project/${job.projectId}/tracking` : `/job/${job.id}`}
            className="font-semibold text-foreground hover:text-primary transition line-clamp-1 block text-xs"
          >
            {capitalizeWords(job.title || `Project #${job.id}`)}
          </Link>
          <span className="text-[11px] text-muted-foreground block truncate">
            {capitalizeWords(job.category || "General Services")}
          </span>
        </div>
      ),
    },
    {
      key: "contractValue",
      header: "Contract Value",
      align: "right",
      render: (job) => (
        <span className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
          {formatCurrencyNoZero(job.agreedAmount)}
        </span>
      ),
    },
    {
      key: "milestones",
      header: "Milestones",
      render: (job) => {
        if (!job.milestoneStats || job.milestoneStats.total === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <span className="text-xs font-medium text-foreground">
            {job.milestoneStats.completed} / {job.milestoneStats.total} done
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (job) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
            job.status,
          )}`}
        >
          {readableStatus(job.status)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Created Date",
      align: "right",
      render: (job) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateSafely(job.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (job) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <a
            href={
              job.projectId
                ? `/api/portal/projects/${job.projectId}/export`
                : `/api/portal/jobs/${job.id}/export`
            }
            target="_blank"
            rel="noopener noreferrer"
            download={formatProjectPdfFilename(job.title, `project-${job.id}`)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition"
            title="Download official Project Dossier PDF"
          >
            <FileDown className="h-3 w-3 text-primary" />
            <span>PDF</span>
          </a>
          <button
            type="button"
            onClick={() => exportSingleJobCsv(job)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            title="Export single project CSV"
          >
            <FileSpreadsheet className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span>CSV</span>
          </button>
          {job.projectId && (
            <Link
              href={`/project/${job.projectId}/tracking`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <span>Workspace</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // TRANSACTION TABLE COLUMNS
  // ---------------------------------------------------------------------------
  const transactionColumns: ReportTableColumn<Payment>[] = [
    {
      key: "id",
      header: "Ref #",
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">
          #{p.invoiceNumber || `PAY-${p.id}`}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date Recorded",
      render: (p) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateSafely(p.createdAt)}
        </span>
      ),
    },
    {
      key: "description",
      header: "Particulars / Deliverable",
      render: (p) => (
        <div className="space-y-0.5 max-w-[240px]">
          <div className="font-semibold text-foreground text-xs line-clamp-1">
            {capitalizeFirst(p.description || p.milestoneTitle || "Direct Payment")}
          </div>
          {p.projectTitle && (
            <div className="text-[11px] text-muted-foreground truncate">
              {capitalizeWords(p.projectTitle)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "professional",
      header: "Professional Payee",
      render: (p) => (
        <span className="text-xs font-medium text-foreground whitespace-nowrap">
          {capitalizeWords(p.professionalName || "Assigned Professional")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(
            p.status,
          )}`}
        >
          {formatReadableLabel(p.status)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (p) => (
        <span className="font-mono text-xs font-bold text-foreground whitespace-nowrap">
          {formatCurrencyNoZero(p.amount)}
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
            href={`/api/portal/invoices/${p.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition"
            title="Download official Tax Invoice PDF"
          >
            <FileDown className="h-3 w-3 text-primary" />
            <span>PDF</span>
          </a>
          <button
            type="button"
            onClick={() => exportSinglePaymentCsv(p)}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            title="Export single payment CSV"
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
              <span>Client Financial Control & Audit Ledgers</span>
              <span className="text-primary/40">·</span>
              <span className="font-mono text-[11px] text-primary/80">IST (UTC+5:30)</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-display">
              Spend Reports & Project Ledgers
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Official audit statements of project contract budgets, milestone releases, custodial escrow allocations,
              and gateway transaction receipts verified against platform settlement records.
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
            <span>Projects & Engagements</span>
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
            <ArrowDownToLine className="h-4 w-4" />
            <span>Transactions & Settlements</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: PROJECTS & ENGAGEMENTS */}
      {/* ===================================================================== */}
      {tab === "projects" && (
        <div className="space-y-6">
          {/* 4 Executive KPI Cards with Skeletons */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Contract Value</span>
                <CircleDollarSign className="h-4 w-4 text-primary" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatCurrencyNoZero(totalAgreedBudget)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Combined agreed contracts</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Projects</span>
                <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 sm:text-3xl truncate">
                  {formatCountNoZero(activeProjectsCount)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Currently in progress or open</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Completed Projects</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl truncate">
                  {formatCountNoZero(completedProjectsCount)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Delivered & closed contracts</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Milestone Progress</span>
                <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {totalMilestones > 0 ? `${completedMilestones} / ${totalMilestones}` : "—"}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {totalMilestones > 0
                  ? `${Math.round((completedMilestones / totalMilestones) * 100)}% deliverables approved`
                  : "No milestone records"}
              </p>
            </div>
          </div>

          {/* Filter Bar and Action Controls */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search project title, category, ref..."
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
                <option value="ALL">All Project Statuses</option>
                <option value="IN_PROGRESS">Active / In Progress</option>
                <option value="OPEN">Open for Hire</option>
                <option value="COMPLETED">Completed</option>
                <option value="CLOSED">Closed</option>
                <option value="DRAFT">Draft</option>
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
                endpoint="/api/client/jobs/export"
                selectedIds={filteredJobs.map((j) => j.id)}
                totalCount={filteredJobs.length}
                fileBaseName="client-projects"
                buttonLabel="Export PDF"
                onExportCsv={() => {
                  downloadCsvFile({
                    filename: "client-projects-cost-ledger",
                    title: "Project Cost Ledger & Engagement Statement",
                    headers: [
                      "Job ID",
                      "Project Title",
                      "Category",
                      "Status",
                      "Contract Value (INR)",
                      "Completed Milestones",
                      "Total Milestones",
                      "Created Date",
                    ],
                    rows: filteredJobs.map((j) => [
                      j.id,
                      capitalizeWords(j.title || "Untitled Project"),
                      capitalizeWords(j.category || "General"),
                      capitalizeWords(j.status),
                      j.agreedAmount ? j.agreedAmount : "—",
                      j.milestoneStats?.completed ?? 0,
                      j.milestoneStats?.total ?? 0,
                      formatDateSafely(j.createdAt),
                    ]),
                  });
                }}
              />
            </div>
          </div>

          {/* Projects Table with Pagination */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <SelectableReportTable
              loading={loading}
              rows={paginatedJobs}
              emptyMessage="No project records match the active filter criteria."
              selectable={false}
              rowLabel={(j) => j.title || String(j.id)}
              columns={projectColumns}
            />
            <AdminPagination
              currentPage={page}
              totalItems={filteredJobs.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
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
                <span className="text-xs font-semibold uppercase tracking-wider">Total Spend (Released)</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl truncate">
                  {formatCurrencyNoZero(totalSpent)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Disbursed to professional payees</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Escrow in Custody</span>
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl truncate">
                  {formatCurrencyNoZero(totalEscrowHeld)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">100% held safely in milestone trust</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Cleared Settlements</span>
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
                  {formatCountNoZero(clearedPayments.length)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Approved transaction releases</p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Pending Release</span>
                <ArrowDownToLine className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              {loading ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
              ) : (
                <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 sm:text-3xl truncate">
                  {formatCountNoZero(pendingPayments.length)}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Awaiting deliverable review</p>
            </div>
          </div>

          {/* Filter Bar and Action Controls */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search ref #, description, payee, invoice..."
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
                <option value="ALL">All Settlement Statuses</option>
                <option value="COMPLETED">Cleared / Paid</option>
                <option value="PENDING">Pending / Custody</option>
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
                endpoint="/api/client/payments/export"
                selectedIds={filteredTransactions.map((p) => p.id)}
                totalCount={filteredTransactions.length}
                fileBaseName="client-transactions"
                buttonLabel="Export PDF"
                onExportCsv={() => {
                  downloadCsvFile({
                    filename: "client-transactions-settlement-register",
                    title: "Transactions & Settlement Register",
                    headers: [
                      "Payment Ref #",
                      "Date Recorded",
                      "Recipient Professional",
                      "Description",
                      "Status",
                      "Amount (INR)",
                    ],
                    rows: filteredTransactions.map((p) => [
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
          </div>

          {/* Transactions Table with Pagination */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <SelectableReportTable
              loading={loading}
              rows={paginatedTransactions}
              emptyMessage="No transaction records match the active filter criteria."
              selectable={false}
              rowLabel={(p) => String(p.id)}
              columns={transactionColumns}
            />
            <AdminPagination
              currentPage={page}
              totalItems={filteredTransactions.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
