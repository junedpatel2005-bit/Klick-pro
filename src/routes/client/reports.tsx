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
} from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { SelectableReportTable } from "@/components/reports/SelectableReportTable";
import { useRowSelection } from "@/hooks/use-row-selection";
import { downloadCsvFile } from "@/lib/reports/csv/export-csv";
import {
  DateRangeFilter,
  type DatePreset,
  isWithinCustomDateRange,
} from "@/components/reports/DateRangeFilter";
import { formatReadableLabel, capitalizeWords, capitalizeFirst } from "@/lib/utils";

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

type DateFilter = "all" | "this_month" | "last_month" | "last_90_days" | "this_year";

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

function jobBudget(job: Job) {
  if (job.timingType === "HOURLY") {
    return job.hourlyRate == null ? "Rate not set" : `₹${job.hourlyRate.toLocaleString()}/hr`;
  }
  if (job.budgetMin == null && job.budgetMax == null) return "Budget not set";
  return `₹${job.budgetMin?.toLocaleString() ?? "—"} – ₹${job.budgetMax?.toLocaleString() ?? "—"}`;
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

function isWithinDateRange(dateString: string | null | undefined, filter: DateFilter): boolean {
  if (filter === "all" || !dateString) return true;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  if (filter === "this_month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  if (filter === "last_month") {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear()
    );
  }
  if (filter === "last_90_days") {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 90);
    return date >= ninetyDaysAgo;
  }
  if (filter === "this_year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function ProjectsReport() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [contractTypeFilter, setContractTypeFilter] = useState<string>("ALL");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [viewMode, setViewMode] = useState<"boxes" | "table">("boxes");

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/client/jobs")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setJobs(data.jobs ?? []))
      .catch(() => setMessage("Your project data could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(["servio:project-update", "servio:proposal", "servio:notification"], loadData);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.category && j.category.trim()) set.add(j.category.trim());
    });
    return Array.from(set).sort();
  }, [jobs]);

  const statusCounts = useMemo(() => {
    const counts = { ALL: jobs.length, RUNNING: 0, COMPLETED: 0, OPEN: 0, DRAFT: 0, CLOSED: 0 };
    jobs.forEach((j) => {
      if (j.status in counts) {
        counts[j.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [jobs]);

  const clearAllFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setCategoryFilter("ALL");
    setContractTypeFilter("ALL");
    setBudgetMin("");
    setBudgetMax("");
    setDatePreset("all");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    contractTypeFilter !== "ALL" ||
    budgetMin !== "" ||
    budgetMax !== "" ||
    datePreset !== "all" ||
    startDate !== "" ||
    endDate !== "";

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        (job.title && job.title.toLowerCase().includes(q)) ||
        (job.category && job.category.toLowerCase().includes(q)) ||
        (job.locationAddress && job.locationAddress.toLowerCase().includes(q)) ||
        String(job.id).includes(q);

      const matchesStatus = statusFilter === "ALL" || job.status === statusFilter;
      const matchesCategory =
        categoryFilter === "ALL" ||
        (job.category && job.category.trim().toLowerCase() === categoryFilter.trim().toLowerCase());
      const matchesContract =
        contractTypeFilter === "ALL" || job.timingType === contractTypeFilter;

      const effectiveBudget =
        job.agreedAmount ?? job.budgetMax ?? job.budgetMin ?? job.hourlyRate ?? 0;
      const matchesMinBudget = budgetMin === "" || effectiveBudget >= Number(budgetMin);
      const matchesMaxBudget = budgetMax === "" || effectiveBudget <= Number(budgetMax);

      const matchesDate = isWithinCustomDateRange(
        job.updatedAt || job.createdAt,
        datePreset,
        startDate,
        endDate,
      );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesContract &&
        matchesMinBudget &&
        matchesMaxBudget &&
        matchesDate
      );
    });
  }, [
    jobs,
    search,
    statusFilter,
    categoryFilter,
    contractTypeFilter,
    budgetMin,
    budgetMax,
    datePreset,
    startDate,
    endDate,
  ]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredJobs);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // Financial and KPI computations
  const totalJobs = filteredJobs.length;
  const runningJobs = filteredJobs.filter((j) => j.status === "RUNNING").length;
  const completedJobs = filteredJobs.filter((j) => j.status === "COMPLETED").length;
  const totalBudgetEst = filteredJobs.reduce(
    (sum, j) => sum + (j.budgetMax || j.budgetMin || j.agreedAmount || 0),
    0,
  );

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport = isSelected
      ? filteredJobs.filter((j) => selectedIds.has(j.id))
      : filteredJobs;

    if (isSelected && rowsToExport.length === 1 && rowsToExport[0]) {
      window.open(`/api/v1/portal/jobs/${rowsToExport[0].id}/export?format=csv`, "_blank");
      return;
    }

    downloadCsvFile({
      filename: "klick-pro-client-projects",
      title: "Client Workspace · Posted Projects & Jobs Statement",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Projects`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Estimated Scope Value", value: `INR ${totalBudgetEst.toLocaleString("en-IN")}` },
        { label: "Active Filter Status", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Job ID",
        "Title",
        "Description",
        "Category",
        "Status",
        "Contract Type",
        "Hourly Rate",
        "Budget Min (INR)",
        "Budget Max (INR)",
        "Budget Estimate",
        "Milestones Completed",
        "Total Milestones",
        "Location",
        "Linked Project",
        "Created Date",
        "Last Updated Date",
      ],
      rows: rowsToExport.map((j) => [
        `#JOB-${j.id}`,
        capitalizeWords(j.title) || "Untitled Job",
        j.description ?? "No description",
        capitalizeWords(j.category) || "General",
        readableStatus(j.status),
        j.timingType === "HOURLY" ? "Hourly" : "Fixed Price",
        j.hourlyRate != null ? `INR ${j.hourlyRate}/hr` : "—",
        j.budgetMin ?? "—",
        j.budgetMax ?? "—",
        j.agreedAmount != null ? `INR ${j.agreedAmount.toLocaleString("en-IN")}` : jobBudget(j),
        j.milestoneStats?.completed ?? 0,
        j.milestoneStats?.total ?? 0,
        capitalizeWords(j.locationAddress) || "Remote",
        j.projectId ? `#PRJ-${j.projectId}` : "None",
        formatDateSafely(j.createdAt),
        formatDateSafely(j.updatedAt),
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Executive Statement KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Projects</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {totalJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Under active record</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Clock className="h-4 w-4 text-indigo-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 sm:text-3xl">
              {runningJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Active contracts</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              {completedJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Delivered & verified</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Allocated Value</span>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl truncate">
              ₹{totalBudgetEst.toLocaleString("en-IN")}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Cumulative budget</p>
        </div>
      </div>

      {/* Main Two-Column Layout (Sidebar Filters + Projects View) */}
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left Column: Rich Sidebar Filters (matching Find Professional page) */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-soft lg:sticky lg:top-24 space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Filters</h2>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Project Status
            </label>
            <div className="flex flex-col gap-1">
              {[
                { id: "ALL", label: "All Statuses", count: statusCounts.ALL },
                { id: "RUNNING", label: "In Progress", count: statusCounts.RUNNING },
                { id: "COMPLETED", label: "Completed", count: statusCounts.COMPLETED },
                { id: "OPEN", label: "Open for Proposals", count: statusCounts.OPEN },
                { id: "DRAFT", label: "Drafts", count: statusCounts.DRAFT },
                { id: "CLOSED", label: "Closed", count: statusCounts.CLOSED },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer ${
                    statusFilter === item.id
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                      statusFilter === item.id
                        ? "bg-white/20 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          {uniqueCategories.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
              >
                <option value="ALL">All Categories ({uniqueCategories.length})</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {capitalizeWords(cat)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Contract Type */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contract Type
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1 text-xs">
              {[
                { id: "ALL", label: "All" },
                { id: "FIXED", label: "Fixed" },
                { id: "HOURLY", label: "Hourly" },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setContractTypeFilter(type.id)}
                  className={`rounded-lg py-1.5 text-center text-xs font-semibold transition cursor-pointer ${
                    contractTypeFilter === type.id
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget Range (INR) */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Budget Range (₹)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Date Period
            </label>
            <DateRangeFilter
              preset={datePreset}
              onPresetChange={setDatePreset}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />
          </div>
        </aside>

        {/* Right Column: Search & Controls Bar + Projects Listing */}
        <div className="space-y-4">
          {/* Controls Bar: Search, View Mode, CSV & PDF Export */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, location, category or ID…"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Switcher: Boxes (Grid) vs Table */}
              <div className="flex items-center rounded-xl border border-border bg-muted/60 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("boxes")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    viewMode === "boxes"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Show jobs in 2-column boxes"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Boxes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Show structured statement table"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>Table</span>
                </button>
              </div>

              {/* CSV Export */}
              <button
                type="button"
                onClick={() => handleExportCsv()}
                disabled={filteredJobs.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50 cursor-pointer"
                title="Download CSV for Excel / Accounting"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>

              <ExportMenu
                endpoint="/api/client/jobs/export"
                selectedIds={selectedList}
                fileBaseName="client-projects"
                emptyMessage="Select project first"
                onExportCsv={handleExportCsv}
              />
            </div>
          </div>

          {message ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {message}
            </p>
          ) : null}

          {/* View Mode 1: Box Grid View (Boxes: 1 & 2 in Row 1, 3 & 4 in Row 2) */}
          {viewMode === "boxes" ? (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-56 rounded-2xl border border-border bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
                <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="font-semibold text-foreground">No project records found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Try clearing or adjusting your filters to see more projects.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredJobs.map((job) => {
                  const href = job.projectId
                    ? `/project/${job.projectId}/tracking`
                    : `/job/${job.id}`;
                  return (
                    <article
                      key={job.id}
                      className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-xs transition hover:border-primary/40 hover:shadow-soft"
                    >
                      <div>
                        {/* Reference, Status, & Category Tag */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/70 px-2.5 py-0.5 rounded-md">
                            #JOB-{job.id}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                                job.status,
                              )}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {readableStatus(job.status)}
                            </span>
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {capitalizeWords(job.category ?? "General")}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">
                          <Link href={href} className="hover:text-primary transition-colors">
                            {capitalizeWords(job.title ?? `Project #${job.id}`)}
                          </Link>
                        </h3>

                        {/* Location & Updated Date */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            {capitalizeWords(job.locationAddress ?? "Remote")}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            Updated {formatDateSafely(job.updatedAt)}
                          </span>
                        </div>

                        {/* Milestones Progress Bar */}
                        {job.milestoneStats && job.milestoneStats.total > 0 && (
                          <div className="mt-3.5 rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs">
                            <div className="flex items-center justify-between font-medium">
                              <span className="text-muted-foreground">
                                Milestones: {job.milestoneStats.completed} of{" "}
                                {job.milestoneStats.total} done
                              </span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {Math.round(
                                  (job.milestoneStats.completed / job.milestoneStats.total) * 100,
                                )}
                                %
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.round(
                                    (job.milestoneStats.completed / job.milestoneStats.total) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Financial Footer & Action Buttons */}
                      <div className="mt-4 pt-3.5 border-t border-border flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {job.timingType === "HOURLY" ? "Hourly Rate" : "Project Budget"}
                          </p>
                          <p className="font-mono text-sm sm:text-base font-bold text-foreground">
                            {job.agreedAmount != null
                              ? `₹${job.agreedAmount.toLocaleString("en-IN")}`
                              : jobBudget(job)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/portal/jobs/${job.id}/export`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-xs transition hover:bg-muted hover:border-primary/40 cursor-pointer"
                            title="Download official PDF Job Dossier"
                          >
                            <FileDown className="h-3.5 w-3.5 text-primary" />
                            <span>Dossier PDF</span>
                          </a>
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            /* View Mode 2: Structured Statement Table */
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
              <SelectableReportTable
                loading={loading}
                rows={filteredJobs}
                emptyMessage="No project records match your filter criteria."
                selectedIds={selectedIds}
                onToggle={toggle}
                allSelected={allVisibleSelected}
                onToggleAll={toggleAllVisible}
                rowLabel={(job) => capitalizeWords(job.title) || `Job #${job.id}`}
                columns={[
                  {
                    key: "id",
                    header: "Reference",
                    render: (job) => (
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        #JOB-{job.id}
                      </span>
                    ),
                  },
                  {
                    key: "title",
                    header: "Project Title",
                    render: (job) => (
                      <div>
                        <span className="font-medium text-foreground">
                          {capitalizeWords(job.title) || `Untitled Project #${job.id}`}
                        </span>
                        {job.locationAddress && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {capitalizeWords(job.locationAddress)}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (job) => (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                          job.status,
                        )}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {readableStatus(job.status)}
                      </span>
                    ),
                  },
                  {
                    key: "budget",
                    header: "Budget Allocation",
                    render: (job) => (
                      <span className="font-medium text-foreground">{jobBudget(job)}</span>
                    ),
                  },
                  {
                    key: "updatedAt",
                    header: "Last Activity",
                    align: "right",
                    render: (job) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDateSafely(job.updatedAt)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          )}

          {/* Period Reconciliation Summary */}
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{filteredJobs.length}</span>{" "}
              of <span className="font-semibold text-foreground">{jobs.length}</span> total project
              records.
              {selectedList.length > 0 && (
                <span className="ml-2 font-semibold text-primary">
                  ({selectedList.length} rows selected for export)
                </span>
              )}
            </div>
            <div className="font-mono">
              Est. Scope Value:{" "}
              <span className="font-bold text-foreground">
                ₹{totalBudgetEst.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsReport() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setPayments(Array.isArray(data) ? data : []))
      .catch(() => setMessage("Your payment statement could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(["servio:project-update", "servio:notification"], loadData);

  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase())) ||
        String(item.id).includes(search);
      const matchesStatus = statusFilter === "ALL" || item.status.toUpperCase() === statusFilter;
      const matchesDate = isWithinCustomDateRange(item.createdAt, datePreset, startDate, endDate);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [payments, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredPayments);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // Statement calculations
  const totalAmount = filteredPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const clearedPayments = filteredPayments.filter(
    (p) => p.status.toUpperCase() === "COMPLETED" || p.status.toUpperCase() === "PAID",
  );
  const clearedTotal = clearedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const pendingPayments = filteredPayments.filter(
    (p) => p.status.toUpperCase() === "PENDING" || p.status.toUpperCase() === "FUNDED",
  );
  const pendingTotal = pendingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport = isSelected
      ? filteredPayments.filter((p) => selectedIds.has(p.id))
      : filteredPayments;

    if (isSelected && rowsToExport.length === 1 && rowsToExport[0]) {
      const p = rowsToExport[0];
      downloadCsvFile({
        filename: `klick-pro-payment-voucher-${p.id}`,
        title: `Klick-Pro Official Payment Receipt & Settlement Voucher #${p.invoiceNumber || p.id}`,
        metadata: [
          { label: "Voucher / Invoice Number", value: p.invoiceNumber || `#INV-${p.id}` },
          { label: "Project Title", value: p.projectTitle || `Project #${p.trackingId ?? p.id}` },
          { label: "Milestone", value: p.milestoneTitle || p.description },
          { label: "Recipient / Professional", value: p.professionalName || "Professional" },
          { label: "Payment Method", value: p.paymentMethod || "Escrow" },
          { label: "Gateway Ref / Order ID", value: p.razorpayPaymentId || "Verified" },
          { label: "Settlement Status", value: p.status },
          { label: "Transaction Date", value: formatDateSafely(p.createdAt) },
          {
            label: "Gross Disbursed",
            value: `INR ${(p.grossAmount ?? p.amount).toLocaleString("en-IN")}`,
          },
          {
            label: "Platform Service Fee",
            value: `INR ${(p.feeAmount ?? 0).toLocaleString("en-IN")}`,
          },
          {
            label: "Net Milestone Amount",
            value: `INR ${(p.netAmount ?? p.amount).toLocaleString("en-IN")}`,
          },
        ],
        headers: ["Line Item Description", "Charged Amount (INR)", "Status", "Reference"],
        rows: [
          [
            p.milestoneTitle || "Milestone Escrow Base Amount",
            p.netAmount ?? p.amount,
            p.status,
            p.invoiceNumber || `#INV-${p.id}`,
          ],
          [
            "Platform Service Fee (Escrow & Verification)",
            p.feeAmount ?? 0,
            "Deducted",
            "Platform Fee",
          ],
          [
            "Total Charged & Disbursed",
            p.grossAmount ?? p.amount,
            "Settled",
            p.paymentMethod || "Escrow",
          ],
        ],
      });
      return;
    }

    downloadCsvFile({
      filename: "klick-pro-client-payments",
      title: "Client Financial Disbursements & Invoices Statement",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Records`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Disbursed", value: `INR ${totalAmount.toLocaleString("en-IN")}` },
        { label: "Cleared & Settled", value: `INR ${clearedTotal.toLocaleString("en-IN")}` },
        { label: "In Escrow / Hold", value: `INR ${pendingTotal.toLocaleString("en-IN")}` },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Invoice / Voucher #",
        "Project Title",
        "Milestone Title",
        "Professional Payee",
        "Transaction Type",
        "Payment Method",
        "Amount (INR)",
        "Settlement Status",
        "Disbursement Date",
        "Description",
      ],
      rows: rowsToExport.map((p) => [
        p.invoiceNumber || `#INV-${p.id}`,
        p.projectTitle || `Project #${p.trackingId ?? p.id}`,
        p.milestoneTitle || p.description,
        p.professionalName || "Professional",
        p.type,
        p.paymentMethod || "Escrow",
        p.grossAmount ?? p.amount,
        p.status,
        formatDateSafely(p.createdAt),
        p.description ?? "Milestone service payment",
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Executive Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Disbursed</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              ₹{totalAmount.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {filteredPayments.length} transactions
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Cleared & Settled
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              ₹{clearedTotal.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {clearedPayments.length} paid milestones
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">In Escrow / Hold</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl">
              ₹{pendingTotal.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Protected escrow balance</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Invoice</span>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-24 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              ₹
              {filteredPayments.length > 0
                ? Math.round(totalAmount / filteredPayments.length).toLocaleString()
                : "0"}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Per milestone release</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by description or invoice ID…"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-medium text-foreground focus:border-primary focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed / Paid</option>
              <option value="FUNDED">Funded in Escrow</option>
              <option value="PENDING">Pending Approval</option>
            </select>

            <DateRangeFilter
              preset={datePreset}
              onPresetChange={setDatePreset}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
          <button
            type="button"
            onClick={() => handleExportCsv()}
            disabled={filteredPayments.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            title="Download CSV for Excel / Accounting"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/client/payments/export"
            selectedIds={selectedList}
            fileBaseName="client-payments"
            emptyMessage="Select payment first"
            onExportCsv={handleExportCsv}
          />
        </div>
      </div>

      {message ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={filteredPayments}
          emptyMessage="No payment records match your filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(payment) => payment.description ?? `Payment #${payment.id}`}
          columns={[
            {
              key: "id",
              header: "Reference",
              render: (payment) => (
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  #INV-{payment.id}
                </span>
              ),
            },
            {
              key: "description",
              header: "Description / Milestone",
              render: (payment) => (
                <span className="font-medium text-foreground">{payment.description}</span>
              ),
            },
            {
              key: "type",
              header: "Type",
              render: (payment) => (
                <span className="text-xs font-medium text-foreground">
                  {formatReadableLabel(payment.type) || "Payment"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (payment) => (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                    payment.status,
                  )}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {formatReadableLabel(payment.status)}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (payment) => (
                <span className="font-mono font-bold text-foreground">
                  ₹{Number(payment.amount).toLocaleString()} {payment.currency || "INR"}
                </span>
              ),
            },
            {
              key: "createdAt",
              header: "Date",
              align: "right",
              render: (payment) => (
                <span className="text-xs text-muted-foreground">
                  {formatDateSafely(payment.createdAt)}
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{filteredPayments.length}</span>{" "}
          of <span className="font-semibold text-foreground">{payments.length}</span> total entries.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-primary">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Period Settlement Total:{" "}
          <span className="font-bold text-foreground">₹{totalAmount.toLocaleString()} INR</span>
        </div>
      </div>
    </div>
  );
}

export default function ClientReports() {
  const [tab, setTab] = useState<"projects" | "payments">("projects");

  return (
    <div className="space-y-8 pb-12">
      {/* Executive Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200 backdrop-blur-md">
              <FileText className="h-3.5 w-3.5" /> Client Financial Center
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              Reports & Statements
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base leading-relaxed">
              Official audit records of your project allocations, escrow deposits, and payment
              settlements. Download itemized statements in PDF or Excel format.
            </p>
          </div>

          <div className="flex gap-1.5 rounded-2xl border border-white/20 bg-black/30 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setTab("projects")}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                tab === "projects"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              Projects Audit
            </button>
            <button
              type="button"
              onClick={() => setTab("payments")}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                tab === "payments"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              Payment Statements
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section>{tab === "projects" ? <ProjectsReport /> : <PaymentsReport />}</section>
    </div>
  );
}
