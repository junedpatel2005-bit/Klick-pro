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
  RefreshCw,
} from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { SelectableReportTable } from "@/components/reports/SelectableReportTable";
import { useRowSelection } from "@/hooks/use-row-selection";
import { downloadCsvFile } from "@/lib/reports/csv/export-csv";

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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        search.trim() === "" ||
        (job.title && job.title.toLowerCase().includes(search.toLowerCase())) ||
        String(job.id).includes(search);
      const matchesStatus = statusFilter === "ALL" || job.status === statusFilter;
      const matchesDate = isWithinDateRange(job.updatedAt, dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [jobs, search, statusFilter, dateFilter]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredJobs);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // Financial and KPI computations
  const totalJobs = filteredJobs.length;
  const runningJobs = filteredJobs.filter((j) => j.status === "RUNNING").length;
  const completedJobs = filteredJobs.filter((j) => j.status === "COMPLETED").length;
  const totalBudgetEst = filteredJobs.reduce(
    (sum, j) => sum + (j.budgetMax || j.budgetMin || 0),
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
        { label: "Active Date Range", value: dateFilter },
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
        j.title ?? "Untitled Job",
        j.description ?? "No description",
        j.category ?? "General",
        readableStatus(j.status),
        j.timingType === "HOURLY" ? "Hourly" : "Fixed Price",
        j.hourlyRate != null ? `INR ${j.hourlyRate}/hr` : "—",
        j.budgetMin ?? "—",
        j.budgetMax ?? "—",
        j.agreedAmount != null ? `INR ${j.agreedAmount.toLocaleString("en-IN")}` : jobBudget(j),
        j.milestoneStats?.completed ?? 0,
        j.milestoneStats?.total ?? 0,
        j.locationAddress ?? "Remote",
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
              ₹{totalBudgetEst.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">Cumulative budget</p>
        </div>
      </div>

      {/* Control Bar: Search, Status, Date Range, & Export */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or job ID…"
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
              <option value="RUNNING">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="OPEN">Open</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-medium text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
          <button
            type="button"
            onClick={() => handleExportCsv()}
            disabled={filteredJobs.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            title="Download CSV for Excel / Accounting"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/client/jobs/export"
            selectedIds={selectedList}
            fileBaseName="client-projects"
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
          rows={filteredJobs}
          emptyMessage="No project records match your filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(job) => job.title ?? `Job #${job.id}`}
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
                    {job.title ?? `Untitled Project #${job.id}`}
                  </span>
                  {job.locationAddress && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {job.locationAddress}
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

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div>
          Showing <span className="font-semibold text-foreground">{filteredJobs.length}</span> of{" "}
          <span className="font-semibold text-foreground">{jobs.length}</span> total project
          records.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-primary">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Est. Scope Value:{" "}
          <span className="font-bold text-foreground">₹{totalBudgetEst.toLocaleString()}</span>
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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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
      const matchesDate = isWithinDateRange(item.createdAt, dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [payments, search, statusFilter, dateFilter]);

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
        { label: "Active Date Range", value: dateFilter },
      ],
      headers: [
        "Invoice / Voucher #",
        "Project Title",
        "Milestone Title",
        "Professional Payee",
        "Transaction Type",
        "Payment Method",
        "Total Paid (INR)",
        "Service Fee (INR)",
        "Milestone Net (INR)",
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
        p.feeAmount ?? 0,
        p.netAmount ?? p.amount,
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

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="h-10 rounded-xl border border-border bg-background px-3 text-xs sm:text-sm font-medium text-foreground focus:border-primary focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_year">This Year</option>
            </select>
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
                <span className="text-xs uppercase font-medium text-muted-foreground">
                  {payment.type?.replace(/_/g, " ") ?? "Payment"}
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
                  {payment.status}
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
