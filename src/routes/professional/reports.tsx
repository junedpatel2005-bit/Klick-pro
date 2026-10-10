"use client";

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
  invoiceNumber?: string;
  projectTitle?: string;
  clientName?: string;
  milestoneTitle?: string;
  paymentMethod?: string;
  baseAmount?: number;
  feeAmount?: number;
  netAmount?: number;
};

type DateFilter = "all" | "this_month" | "last_month" | "last_90_days" | "this_year";

function displayStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusBadgeClass(status: string) {
  const normalized = status.toUpperCase();
  if (
    normalized.includes("COMPLETED") ||
    normalized.includes("PAID") ||
    normalized.includes("SETTLED")
  ) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  if (
    normalized.includes("RUNNING") ||
    normalized.includes("IN_PROGRESS") ||
    normalized.includes("FUNDED")
  ) {
    return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  }
  if (normalized.includes("PENDING") || normalized.includes("AWAITING")) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  }
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
}

function money(project: RunningProject) {
  if (project.budget == null) return "Amount pending";
  return project.timingType === "HOURLY"
    ? `₹${project.budget.toLocaleString()}/hr`
    : `₹${project.budget.toLocaleString()}`;
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
  const [projects, setProjects] = useState<RunningProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/portal/professional-jobs", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(
        (data: {
          activeProjects?: RunningProject[];
          completedProjects?: Array<{
            id: number;
            jobId: number;
            jobTitle: string | null;
            clientName: string | null;
            completedAt: string;
            amount: number;
          }>;
          closedProjects?: Array<{
            id: number;
            jobId: number;
            jobTitle: string | null;
            clientName: string | null;
            updatedAt?: string;
          }>;
        }) => {
          const active: RunningProject[] = Array.isArray(data.activeProjects)
            ? data.activeProjects
            : [];
          const completed: RunningProject[] = Array.isArray(data.completedProjects)
            ? data.completedProjects.map((cp) => ({
                id: cp.id,
                jobTitle: cp.jobTitle ?? `Job #${cp.jobId}`,
                clientName: cp.clientName ?? "Client",
                status: "COMPLETED",
                acceptedAt: cp.completedAt,
                deadline: null,
                budget: cp.amount,
                timingType: "FIXED",
                progress: 100,
              }))
            : [];
          const closed: RunningProject[] = Array.isArray(data.closedProjects)
            ? data.closedProjects.map((cl) => ({
                id: cl.id,
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
        },
      )
      .catch(() => setError("Your project data could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(["servio:project-update", "servio:proposal", "servio:notification"], loadData);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch =
        search.trim() === "" ||
        (project.jobTitle && project.jobTitle.toLowerCase().includes(search.toLowerCase())) ||
        (project.clientName && project.clientName.toLowerCase().includes(search.toLowerCase())) ||
        String(project.id).includes(search);
      const matchesStatus =
        statusFilter === "ALL" || project.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesDate = isWithinCustomDateRange(
        project.acceptedAt || project.deadline,
        datePreset,
        startDate,
        endDate,
      );
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [projects, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredProjects);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // Financial calculations
  const totalContractValue = filteredProjects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
  const activeCount = filteredProjects.filter(
    (p) =>
      p.status.toUpperCase().includes("RUNNING") || p.status.toUpperCase().includes("PROGRESS"),
  ).length;
  const avgProgress =
    filteredProjects.length > 0
      ? Math.round(
          filteredProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / filteredProjects.length,
        )
      : 0;

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport = isSelected
      ? filteredProjects.filter((p) => selectedIds.has(p.id))
      : filteredProjects;

    if (isSelected && rowsToExport.length === 1 && rowsToExport[0]) {
      window.open(
        `/api/v1/portal/jobs/${rowsToExport[0].jobId || rowsToExport[0].id}/export?format=csv`,
        "_blank",
      );
      return;
    }

    downloadCsvFile({
      filename: "klick-pro-professional-projects",
      title: "Professional Workspace · Projects & Engagements Statement",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Projects`
            : `All Filtered (${rowsToExport.length})`,
        },
        {
          label: "Total Contract Value",
          value: `INR ${totalContractValue.toLocaleString("en-IN")}`,
        },
        { label: "Active In Progress", value: activeCount },
        { label: "Average Progress", value: `${avgProgress}%` },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Project ID",
        "Job Title",
        "Client Name",
        "Status",
        "Progress %",
        "Timing Type",
        "Agreed Budget",
        "Target Deadline",
        "Accepted Date",
      ],
      rows: rowsToExport.map((p) => [
        `#PRJ-${p.id}`,
        p.jobTitle ?? "Untitled project",
        p.clientName ?? "Client",
        displayStatus(p.status),
        `${p.progress}%`,
        p.timingType === "HOURLY" ? "Hourly" : "Fixed Price",
        money(p),
        p.deadline ? formatDateSafely(p.deadline) : "Flexible",
        p.acceptedAt ? formatDateSafely(p.acceptedAt) : "—",
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Executive Statement KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Projects</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {filteredProjects.length}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{activeCount} in progress</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Contract Value</span>
            <CircleDollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-2xl truncate">
              ₹{totalContractValue.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Committed project revenue</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Completion</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 sm:text-3xl">
              {avgProgress}%
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Milestone delivery rate</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Contract</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl truncate">
              ₹
              {filteredProjects.length > 0
                ? Math.round(totalContractValue / filteredProjects.length).toLocaleString()
                : "0"}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Per engagement</p>
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
              placeholder="Search by job title or client…"
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
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="RUNNING">Running</option>
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
            disabled={filteredProjects.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            title="Download CSV for Excel / Accounting"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/professional/jobs/export"
            selectedIds={selectedList}
            fileBaseName="running-projects"
            emptyMessage="Select project first"
            onExportCsv={handleExportCsv}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={filteredProjects}
          emptyMessage="No active project records match your criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(project) => project.jobTitle ?? `Project #${project.id}`}
          columns={[
            {
              key: "id",
              header: "Reference",
              render: (project) => (
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  #PRJ-{project.id}
                </span>
              ),
            },
            {
              key: "jobTitle",
              header: "Job Scope",
              render: (project) => (
                <span className="font-medium text-foreground">
                  {project.jobTitle ?? `Project #${project.id}`}
                </span>
              ),
            },
            {
              key: "clientName",
              header: "Client",
              render: (project) => (
                <span className="text-sm font-medium text-muted-foreground">
                  {project.clientName ?? "Verified Client"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (project) => (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                    project.status,
                  )}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {displayStatus(project.status)}
                </span>
              ),
            },
            {
              key: "budget",
              header: "Contract Amount",
              render: (project) => (
                <span className="font-mono font-bold text-foreground">{money(project)}</span>
              ),
            },
            {
              key: "progress",
              header: "Progress",
              align: "right",
              render: (project) => (
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 rounded-full bg-muted h-1.5 overflow-hidden hidden sm:block">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {project.progress}%
                  </span>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{filteredProjects.length}</span>{" "}
          of <span className="font-semibold text-foreground">{projects.length}</span> engagements.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-primary">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Total Committed Value:{" "}
          <span className="font-bold text-foreground">₹{totalContractValue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function EarningsReport() {
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadData = () => {
    setLoading(true);
    fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setError("Your earnings statement could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useRealtimeRefresh(["servio:project-update", "servio:notification"], loadData);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        search.trim() === "" ||
        (item.description && item.description.toLowerCase().includes(search.toLowerCase())) ||
        String(item.id).includes(search);
      const matchesStatus =
        statusFilter === "ALL" || item.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesDate = isWithinCustomDateRange(item.createdAt, datePreset, startDate, endDate);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [items, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredItems);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // Statement calculations
  const totalEarned = filteredItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const clearedItems = filteredItems.filter(
    (item) => item.status.toUpperCase() === "COMPLETED" || item.status.toUpperCase() === "PAID",
  );
  const clearedTotal = clearedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const pendingItems = filteredItems.filter(
    (item) =>
      item.status.toUpperCase() === "PENDING" ||
      item.status.toUpperCase() === "AWAITING_ADMIN_APPROVAL",
  );
  const pendingTotal = pendingItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport = isSelected
      ? filteredItems.filter((item) => selectedIds.has(item.id))
      : filteredItems;

    if (isSelected && rowsToExport.length === 1 && rowsToExport[0]) {
      const item = rowsToExport[0];
      downloadCsvFile({
        filename: `klick-pro-payout-voucher-${item.id}`,
        title: `Klick-Pro Official Professional Payout Voucher #${item.invoiceNumber || item.id}`,
        metadata: [
          { label: "Voucher / Reference Number", value: item.invoiceNumber || `#EARN-${item.id}` },
          {
            label: "Project Title",
            value: item.projectTitle || `Project #${item.trackingId ?? item.id}`,
          },
          { label: "Milestone", value: item.milestoneTitle || item.description },
          { label: "Client Name", value: item.clientName || "Client" },
          { label: "Disbursement Method", value: item.paymentMethod || "Bank / Escrow" },
          { label: "Settlement Status", value: item.status },
          { label: "Date Recorded", value: formatDateSafely(item.createdAt) },
          {
            label: "Gross Service Value",
            value: `INR ${(item.baseAmount ?? item.amount).toLocaleString("en-IN")}`,
          },
          {
            label: "Platform Commission (10%)",
            value: `INR ${(item.feeAmount ?? Math.round(item.amount * 0.1)).toLocaleString("en-IN")}`,
          },
          {
            label: "Net Earnings Credited",
            value: `INR ${(item.netAmount ?? item.amount).toLocaleString("en-IN")}`,
          },
        ],
        headers: ["Line Item Description", "Amount (INR)", "Status", "Reference"],
        rows: [
          [
            item.milestoneTitle || "Milestone Approved Gross Earnings",
            item.baseAmount ?? item.amount,
            item.status,
            item.invoiceNumber || `#EARN-${item.id}`,
          ],
          [
            "Payment Credited to Professional Wallet",
            item.netAmount ?? item.amount,
            "Settled",
            item.paymentMethod || "Escrow",
          ],
        ],
      });
      return;
    }

    downloadCsvFile({
      filename: "klick-pro-professional-earnings",
      title: "Professional Earnings & Financial Settlements Statement",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Records`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Earnings Total", value: `INR ${totalEarned.toLocaleString("en-IN")}` },
        { label: "Cleared & Paid Out", value: `INR ${clearedTotal.toLocaleString("en-IN")}` },
        { label: "Pending in Escrow", value: `INR ${pendingTotal.toLocaleString("en-IN")}` },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Voucher / Reference #",
        "Project Title",
        "Milestone Title",
        "Client Name",
        "Disbursement Method",
        "Earnings Amount (INR)",
        "Settlement Status",
        "Date Recorded",
        "Description",
      ],
      rows: rowsToExport.map((item) => [
        item.invoiceNumber || `#EARN-${item.id}`,
        item.projectTitle || `Project #${item.trackingId ?? item.id}`,
        item.milestoneTitle || item.description,
        item.clientName || "Client",
        item.paymentMethod || "Bank / Escrow",
        item.baseAmount ?? item.amount,
        item.status,
        formatDateSafely(item.createdAt),
        item.description ?? "Milestone earnings",
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Executive Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Earnings</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
              ₹{totalEarned.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{filteredItems.length} settlements</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Disbursed Funds</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl truncate">
              ₹{clearedTotal.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Cleared into bank / wallet</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Release</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl truncate">
              ₹{pendingTotal.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Awaiting milestone approval</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Average Payout</span>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl truncate">
              ₹
              {filteredItems.length > 0
                ? Math.round(totalEarned / filteredItems.length).toLocaleString()
                : "0"}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Per milestone</p>
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
              placeholder="Search by description or transaction ID…"
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
              <option value="COMPLETED">Cleared / Paid</option>
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
            disabled={filteredItems.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            title="Download CSV for Tax & Bookkeeping"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/professional/earnings/export"
            selectedIds={selectedList}
            fileBaseName="professional-earnings"
            emptyMessage="Select payout first"
            onExportCsv={handleExportCsv}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={filteredItems}
          emptyMessage="No earnings records match your filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(item) => item.description ?? `Payout #${item.id}`}
          columns={[
            {
              key: "id",
              header: "Reference",
              render: (item) => (
                <span className="font-mono text-xs font-semibold text-muted-foreground">
                  #INV-{item.id}
                </span>
              ),
            },
            {
              key: "description",
              header: "Milestone Description",
              render: (item) => (
                <span className="font-medium text-foreground">{item.description}</span>
              ),
            },
            {
              key: "status",
              header: "Settlement Status",
              render: (item) => (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(
                    item.status,
                  )}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {displayStatus(item.status)}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (item) => (
                <span className="font-mono font-bold text-foreground">
                  ₹{Number(item.amount).toLocaleString()} {item.currency || "INR"}
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
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{filteredItems.length}</span> of{" "}
          <span className="font-semibold text-foreground">{items.length}</span> disbursements.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-primary">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Settled Revenue:{" "}
          <span className="font-bold text-foreground">₹{clearedTotal.toLocaleString()} INR</span>
        </div>
      </div>
    </div>
  );
}

export default function ProfessionalReports() {
  const [tab, setTab] = useState<"projects" | "earnings">("projects");

  return (
    <div className="space-y-8 pb-12">
      {/* Executive Header Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200 backdrop-blur-md">
              <FileText className="h-3.5 w-3.5" /> Professional Financial Center
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-4xl">
              Reports & Earnings Statements
            </h1>
            <p className="mt-2 text-sm text-slate-300 sm:text-base leading-relaxed">
              Official audit statements of your contracted projects, milestone disbursements, and
              bank settlements. Download tax-ready statements in PDF or Excel format.
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
              Active Contracts
            </button>
            <button
              type="button"
              onClick={() => setTab("earnings")}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                tab === "earnings"
                  ? "bg-white text-slate-950 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              Disbursement Statements
            </button>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section>{tab === "projects" ? <ProjectsReport /> : <EarningsReport />}</section>
    </div>
  );
}
