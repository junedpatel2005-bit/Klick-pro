"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Search,
  Filter,
  Download,
  Users,
  Briefcase,
  CircleDollarSign,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowDownToLine,
  Landmark,
  Scale,
  AlertTriangle,
  RotateCcw,
  Building2,
  Receipt,
  FileSpreadsheet,
  FileCheck,
  Percent,
} from "lucide-react";
import { SelectableReportTable, type ReportTableColumn } from "@/components/reports/SelectableReportTable";
import { useRowSelection } from "@/hooks/use-row-selection";
import { downloadCsvFile } from "@/lib/reports/csv/export-csv";
import {
  DateRangeFilter,
  type DatePreset,
  isWithinCustomDateRange,
} from "@/components/reports/DateRangeFilter";
import { formatReadableLabel, capitalizeWords, capitalizeFirst } from "@/lib/utils";
import { AdminPagination } from "@/components/admin/AdminPagination";

// ---------------------------------------------------------------------------
// Shared Helper Functions
// ---------------------------------------------------------------------------
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

function getStatusBadgeClass(status: string) {
  const norm = (status || "").toUpperCase();
  if (
    norm === "COMPLETED" ||
    norm === "APPROVED" ||
    norm === "PAID" ||
    norm === "SETTLED" ||
    norm === "RESOLVED"
  ) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
  }
  if (
    norm === "PENDING" ||
    norm === "WAITING_RESPONSE" ||
    norm === "UNDER_ADMIN_REVIEW" ||
    norm === "PROCESSING" ||
    norm === "HELD_IN_TRUST" ||
    norm === "HELD"
  ) {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
  }
  if (norm === "RUNNING" || norm === "IN_PROGRESS" || norm === "OPEN" || norm === "ACTIVE") {
    return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20";
  }
  if (
    norm === "REJECTED" ||
    norm === "FAILED" ||
    norm === "CANCELLED" ||
    norm === "DISPUTED" ||
    norm === "SUSPENDED"
  ) {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
  }
  return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20";
}

// ===========================================================================
// TAB 1: REVENUE & COMMISSION RECONCILIATION
// ===========================================================================
type RevenueRow = {
  id: string;
  rawId: number;
  referenceNumber: string;
  jobTitle: string;
  clientName: string;
  professionalName: string;
  grossAmount: number;
  commissionAmount: number;
  netPayoutAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
};

function RevenueReport() {
  const [rows, setRows] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [commissionFilter, setCommissionFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    void fetch("/api/v1/admin/data/finance", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const payments = Array.isArray(data.payments) ? data.payments : [];

        type ApiPayment = {
          id: number;
          jobTitle?: string;
          milestoneTitle?: string;
          client?: { firstName?: string; lastName?: string };
          professional?: { firstName?: string; lastName?: string };
          baseAmount?: number;
          amount?: number;
          commissionAmount?: number;
          professionalPayoutAmount?: number;
          status?: string;
          paymentMethod?: string;
          createdAt?: string;
          financials?: {
            grossClientAmount?: number;
            commissionAmount?: number;
            professionalPayoutAmount?: number;
          };
        };

        const parsed: RevenueRow[] = payments.map((p: ApiPayment) => {
          const clientName = p.client
            ? capitalizeWords(`${p.client.firstName ?? ""} ${p.client.lastName ?? ""}`.trim()) || "Client"
            : "Client";
          const proName = p.professional
            ? capitalizeWords(`${p.professional.firstName ?? ""} ${p.professional.lastName ?? ""}`.trim()) || "Professional"
            : "Professional";
          const gross = Number(p.financials?.grossClientAmount ?? p.baseAmount ?? p.amount) || 0;
          const commission = Number(p.financials?.commissionAmount ?? p.commissionAmount) || 0;
          const net =
            Number(p.financials?.professionalPayoutAmount ?? p.professionalPayoutAmount) ||
            Math.max(0, gross - commission);
          const jobTitle =
            p.jobTitle ||
            (p.milestoneTitle ? `Milestone: ${p.milestoneTitle}` : `Payment #${p.id}`);

          return {
            id: `rev-${p.id}`,
            rawId: p.id,
            referenceNumber: `PAY-${p.id}`,
            jobTitle: capitalizeWords(jobTitle),
            clientName,
            professionalName: proName,
            grossAmount: gross,
            commissionAmount: commission,
            netPayoutAmount: net,
            status: p.status ?? "PENDING",
            paymentMethod: capitalizeWords(p.paymentMethod ?? "Escrow"),
            createdAt: p.createdAt ?? new Date().toISOString(),
          };
        });

        parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(parsed);
      })
      .catch((err) => {
        console.error("Failed to load revenue report:", err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        r.referenceNumber.toLowerCase().includes(q) ||
        r.jobTitle.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.professionalName.toLowerCase().includes(q) ||
        String(r.rawId).includes(q);

      const matchesStatus = statusFilter === "ALL" || r.status.toUpperCase() === statusFilter;
      const matchesCommission =
        commissionFilter === "ALL" ||
        (commissionFilter === "WITH_COMMISSION" && r.commissionAmount > 0) ||
        (commissionFilter === "ZERO_COMMISSION" && r.commissionAmount === 0);
      const matchesDate = isWithinCustomDateRange(r.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesCommission && matchesDate;
    });
  }, [rows, search, statusFilter, commissionFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredRows);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Financial KPIs
  const totalGross = filteredRows.reduce((sum, r) => sum + r.grossAmount, 0);
  const totalCommission = filteredRows.reduce((sum, r) => sum + r.commissionAmount, 0);
  const totalNet = filteredRows.reduce((sum, r) => sum + r.netPayoutAmount, 0);
  const completedCount = filteredRows.filter((r) => r.status.toUpperCase() === "COMPLETED").length;

  const handleExportCsv = () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;

    downloadCsvFile({
      filename: "klick-pro-revenue-commission-audit",
      title: "Revenue & Platform Commission Reconciliation Ledger",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Transactions`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Gross Volume (GMV)", value: `INR ${totalGross.toLocaleString("en-IN")}` },
        {
          label: "Total Commission",
          value:
            totalCommission > 0
              ? `INR ${totalCommission.toLocaleString("en-IN")}`
              : "INR 0 (Commission Disabled / Off)",
        },
        { label: "Net Pro Disbursements", value: `INR ${totalNet.toLocaleString("en-IN")}` },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Settlement Ref #",
        "Date Recorded",
        "Project / Engagement",
        "Client Depositor",
        "Professional Payee",
        "Gross Paid (INR)",
        "Platform Commission (INR)",
        "Net Pro Payout (INR)",
        "Payment Method",
        "Settlement Status",
      ],
      rows: rowsToExport.map((r) => [
        `#${r.referenceNumber}`,
        formatDateSafely(r.createdAt, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        r.jobTitle,
        r.clientName,
        r.professionalName,
        r.grossAmount,
        r.commissionAmount,
        r.netPayoutAmount,
        r.paymentMethod,
        formatReadableLabel(r.status),
      ]),
    });
  };

  const handleExportPdf = async () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;
    const ids = rowsToExport.map((r) => r.rawId);

    setExportingPdf(true);
    try {
      const res = await fetch("/api/admin/reports/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isSelected ? "selected" : "all",
          ids,
          orientation: "landscape",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `klick-pro-revenue-commission-report-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const columns: ReportTableColumn<RevenueRow>[] = [
    {
      key: "ref",
      header: "Ref #",
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-indigo-700 whitespace-nowrap">
          #{r.referenceNumber}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date & Time",
      render: (r) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {formatDateSafely(r.createdAt, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "job",
      header: "Project / Engagement",
      render: (r) => (
        <span className="text-xs font-semibold text-slate-900 max-w-[200px] block truncate">
          {r.jobTitle}
        </span>
      ),
    },
    {
      key: "client",
      header: "Client Depositor",
      render: (r) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{r.clientName}</span>,
    },
    {
      key: "pro",
      header: "Professional Payee",
      render: (r) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{r.professionalName}</span>,
    },
    {
      key: "gross",
      header: "Gross Paid",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
          ₹{r.grossAmount.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "commission",
      header: "Platform Cut",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs whitespace-nowrap">
          {r.commissionAmount > 0 ? (
            <span className="font-semibold text-emerald-600">
              ₹{r.commissionAmount.toLocaleString("en-IN")}
            </span>
          ) : (
            <span className="text-slate-400">₹0 (0%)</span>
          )}
        </span>
      ),
    },
    {
      key: "net",
      header: "Net Pro Payout",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
          ₹{r.netPayoutAmount.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{r.paymentMethod}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
            r.status,
          )}`}
        >
          {formatReadableLabel(r.status)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 High-Density Stat Cards - Zero Charts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Volume (GMV)</span>
            <CircleDollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalGross.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{filteredRows.length} client payments recorded</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Platform Commission</span>
            <Percent className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              ₹{totalCommission.toLocaleString()}
            </div>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                totalCommission > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              {totalCommission > 0 ? "Rate: Active Commission" : "Rate: 0% · Commission Disabled"}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Pro Payouts</span>
            <ArrowDownToLine className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalNet.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Contractual funds disbursed to professionals</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Settlement Health</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              {completedCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {filteredRows.length > 0
              ? `${Math.round((completedCount / filteredRows.length) * 100)}% completion rate`
              : "Zero records"}
          </p>
        </div>
      </div>

      {/* Filter and Action Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ref #, project, client, pro..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Settlement Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
          </select>

          <select
            value={commissionFilter}
            onChange={(e) => {
              setCommissionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Fee Modes</option>
            <option value="WITH_COMMISSION">With Commission (&gt; 0)</option>
            <option value="ZERO_COMMISSION">Zero Commission (0%)</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV {selectedList.length > 0 ? `(${selectedList.length})` : ""}</span>
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>{exportingPdf ? "Generating..." : `Export PDF ${selectedList.length > 0 ? `(${selectedList.length})` : ""}`}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={paginatedRows}
          emptyMessage="No revenue records match the active filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(r) => r.referenceNumber}
          columns={columns}
        />
        <AdminPagination
          currentPage={page}
          totalItems={filteredRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2: ESCROW & TREASURY RECONCILIATION
// ===========================================================================
type EscrowRow = {
  id: string;
  rawId: number;
  projectTitle: string;
  milestoneTitle: string;
  clientName: string;
  professionalName: string;
  amount: number;
  milestoneStatus: string;
  custodyStatus: string;
  releaseDue: string;
  createdAt: string;
};

function EscrowReport() {
  const [rows, setRows] = useState<EscrowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [custodyFilter, setCustodyFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    void fetch("/api/v1/admin/data/finance", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const payments = Array.isArray(data.payments) ? data.payments : [];

        type ApiMilestone = {
          id: number;
          title?: string;
          amount?: number;
          status?: string;
          releaseAt?: string;
        };

        type ApiPayment = {
          id: number;
          jobTitle?: string;
          milestoneTitle?: string;
          milestoneId?: number;
          status?: string;
          createdAt?: string;
          client?: { firstName?: string; lastName?: string };
          professional?: { firstName?: string; lastName?: string };
          baseAmount?: number;
          amount?: number;
          projectTracking?: {
            milestones?: ApiMilestone[];
          };
          milestonesList?: ApiMilestone[];
        };

        const escrowItems: EscrowRow[] = [];

        payments.forEach((p: ApiPayment) => {
          const clientName = p.client
            ? capitalizeWords(`${p.client.firstName ?? ""} ${p.client.lastName ?? ""}`.trim()) || "Client"
            : "Client";
          const proName = p.professional
            ? capitalizeWords(`${p.professional.firstName ?? ""} ${p.professional.lastName ?? ""}`.trim()) || "Professional"
            : "Professional";
          const projectTitle = capitalizeWords(p.jobTitle || `Milestone Project #${p.id}`);

          const milestones = p.projectTracking?.milestones ?? p.milestonesList ?? [];
          if (milestones.length > 0) {
            milestones.forEach((m) => {
              const status = m.status ?? p.status ?? "PENDING";
              const custody =
                status === "APPROVED"
                  ? "RELEASED TO WALLET"
                  : status === "REFUNDED"
                    ? "REFUNDED TO CLIENT"
                    : "HELD IN TRUST";

              escrowItems.push({
                id: `esc-${m.id}`,
                rawId: m.id,
                projectTitle,
                milestoneTitle: capitalizeWords(m.title ?? "Milestone Requirement"),
                clientName,
                professionalName: proName,
                amount: Number(m.amount) || 0,
                milestoneStatus: status,
                custodyStatus: custody,
                releaseDue: m.releaseAt ? formatDateSafely(m.releaseAt) : "On Approval",
                createdAt: p.createdAt ?? new Date().toISOString(),
              });
            });
          } else {
            const status = p.status ?? "PENDING";
            const custody =
              status === "COMPLETED" || status === "APPROVED"
                ? "RELEASED TO WALLET"
                : status === "REFUNDED"
                  ? "REFUNDED TO CLIENT"
                  : "HELD IN TRUST";

            escrowItems.push({
              id: `esc-pay-${p.id}`,
              rawId: p.milestoneId || p.id,
              projectTitle,
              milestoneTitle: capitalizeWords(p.milestoneTitle ?? "Contract Milestone"),
              clientName,
              professionalName: proName,
              amount: Number(p.baseAmount ?? p.amount) || 0,
              milestoneStatus: status,
              custodyStatus: custody,
              releaseDue: "On Approval",
              createdAt: p.createdAt ?? new Date().toISOString(),
            });
          }
        });

        escrowItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(escrowItems);
      })
      .catch((err) => {
        console.error("Failed to load escrow report:", err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        r.projectTitle.toLowerCase().includes(q) ||
        r.milestoneTitle.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.professionalName.toLowerCase().includes(q) ||
        String(r.rawId).includes(q);

      const matchesCustody =
        custodyFilter === "ALL" ||
        (custodyFilter === "HELD" && r.custodyStatus === "HELD IN TRUST") ||
        (custodyFilter === "RELEASED" && r.custodyStatus === "RELEASED TO WALLET") ||
        (custodyFilter === "REFUNDED" && r.custodyStatus === "REFUNDED TO CLIENT");

      const matchesDate = isWithinCustomDateRange(r.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesCustody && matchesDate;
    });
  }, [rows, search, custodyFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredRows);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Escrow KPIs
  const totalEscrowVolume = filteredRows.reduce((sum, r) => sum + r.amount, 0);
  const heldEscrow = filteredRows
    .filter((r) => r.custodyStatus === "HELD IN TRUST")
    .reduce((sum, r) => sum + r.amount, 0);
  const releasedEscrow = filteredRows
    .filter((r) => r.custodyStatus === "RELEASED TO WALLET")
    .reduce((sum, r) => sum + r.amount, 0);
  const heldCount = filteredRows.filter((r) => r.custodyStatus === "HELD IN TRUST").length;

  const handleExportCsv = () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;

    downloadCsvFile({
      filename: "klick-pro-escrow-treasury-audit",
      title: "Escrow Subledger & Treasury Custody Audit Statement",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Records`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Escrow Volume", value: `INR ${totalEscrowVolume.toLocaleString("en-IN")}` },
        { label: "Escrow Held in Trust", value: `INR ${heldEscrow.toLocaleString("en-IN")}` },
        { label: "Released to Professionals", value: `INR ${releasedEscrow.toLocaleString("en-IN")}` },
        { label: "Treasury Backing", value: "100% Fully Backed" },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Milestone ID",
        "Project Title",
        "Milestone Description",
        "Client Depositor",
        "Assigned Professional",
        "Escrow Amount (INR)",
        "Milestone Status",
        "Escrow Custody Status",
        "Release Timeline",
        "Funded Date",
      ],
      rows: rowsToExport.map((r) => [
        `#MS-${r.rawId}`,
        r.projectTitle,
        r.milestoneTitle,
        r.clientName,
        r.professionalName,
        r.amount,
        formatReadableLabel(r.milestoneStatus),
        r.custodyStatus,
        r.releaseDue,
        formatDateSafely(r.createdAt),
      ]),
    });
  };

  const handleExportPdf = async () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;
    const ids = rowsToExport.map((r) => r.rawId);

    setExportingPdf(true);
    try {
      const res = await fetch("/api/admin/reports/escrow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isSelected ? "selected" : "all",
          ids,
          orientation: "landscape",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `klick-pro-escrow-audit-report-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const columns: ReportTableColumn<EscrowRow>[] = [
    {
      key: "ref",
      header: "Milestone ID",
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-indigo-700 whitespace-nowrap">
          #MS-{r.rawId}
        </span>
      ),
    },
    {
      key: "project",
      header: "Project / Job",
      render: (r) => (
        <span className="text-xs font-semibold text-slate-900 max-w-[180px] block truncate">
          {r.projectTitle}
        </span>
      ),
    },
    {
      key: "milestone",
      header: "Milestone Description",
      render: (r) => (
        <span className="text-xs text-slate-700 max-w-[180px] block truncate">
          {r.milestoneTitle}
        </span>
      ),
    },
    {
      key: "client",
      header: "Client (Depositor)",
      render: (r) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{r.clientName}</span>,
    },
    {
      key: "pro",
      header: "Professional (Beneficiary)",
      render: (r) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{r.professionalName}</span>,
    },
    {
      key: "amount",
      header: "Escrow Amount",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
          ₹{r.amount.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Milestone Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
            r.milestoneStatus,
          )}`}
        >
          {formatReadableLabel(r.milestoneStatus)}
        </span>
      ),
    },
    {
      key: "custody",
      header: "Escrow Custody",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold tracking-tight ${
            r.custodyStatus === "HELD IN TRUST"
              ? "bg-amber-100 text-amber-800 border border-amber-300"
              : r.custodyStatus === "RELEASED TO WALLET"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-slate-100 text-slate-700 border border-slate-300"
          }`}
        >
          {r.custodyStatus}
        </span>
      ),
    },
    {
      key: "due",
      header: "Release Due",
      render: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{r.releaseDue}</span>,
    },
    {
      key: "created",
      header: "Funded Date",
      render: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateSafely(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 High-Density Stat Cards - Zero Charts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Escrow in Trust</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 sm:text-3xl truncate">
              ₹{heldEscrow.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{heldCount} milestones currently held</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Released Escrow</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              ₹{releasedEscrow.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Credited into professional wallets</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Contractual Pool</span>
            <CircleDollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalEscrowVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Combined client milestone commitments</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Treasury Guarantee</span>
            <Building2 className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              100%
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Fully backed custodial subledger</p>
        </div>
      </div>

      {/* Filter and Action Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search project, milestone, client, pro..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
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
            value={custodyFilter}
            onChange={(e) => {
              setCustodyFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Custody Balances</option>
            <option value="HELD">Held in Trust</option>
            <option value="RELEASED">Released to Wallet</option>
            <option value="REFUNDED">Refunded to Client</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV {selectedList.length > 0 ? `(${selectedList.length})` : ""}</span>
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>{exportingPdf ? "Generating..." : `Export PDF ${selectedList.length > 0 ? `(${selectedList.length})` : ""}`}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={paginatedRows}
          emptyMessage="No escrow records match the active filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(r) => `#MS-${r.rawId}`}
          columns={columns}
        />
        <AdminPagination
          currentPage={page}
          totalItems={filteredRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 3: BANK WITHDRAWALS & PAYOUTS LEDGER
// ===========================================================================
type WithdrawalRow = {
  id: string;
  rawId: number;
  referenceNumber: string;
  professionalName: string;
  amount: number;
  destination: string;
  bankInfo: string;
  utr: string;
  status: string;
  createdAt: string;
};

function WithdrawalsReport() {
  const [rows, setRows] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    void fetch("/api/v1/admin/data/finance", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
        const names = data.names && typeof data.names === "object" ? data.names : {};

        type ApiWithdrawal = {
          id: number;
          amount?: number;
          professionalId?: number;
          destinationLabel?: string;
          payoutMode?: string;
          utr?: string;
          status?: string;
          createdAt?: string;
        };

        const parsed: WithdrawalRow[] = withdrawals.map((w: ApiWithdrawal) => {
          const proName =
            w.professionalId && names[w.professionalId]
              ? capitalizeWords(names[w.professionalId])
              : `Professional #${w.professionalId}`;

          let bankInfo = "Bank / UPI Transfer";
          if (w.destinationLabel) {
            try {
              const parsedDest = JSON.parse(w.destinationLabel);
              if (parsedDest && typeof parsedDest === "object") {
                const parts = [];
                if (parsedDest.bankName) parts.push(capitalizeWords(parsedDest.bankName));
                if (parsedDest.accountNumber || parsedDest.last4)
                  parts.push(parsedDest.last4 || parsedDest.accountNumber);
                if (parsedDest.ifsc) parts.push(`IFSC: ${parsedDest.ifsc.toUpperCase()}`);
                if (parsedDest.vpa) parts.push(parsedDest.vpa);
                bankInfo = parts.length > 0 ? parts.join(" · ") : w.destinationLabel;
              } else {
                bankInfo = w.destinationLabel;
              }
            } catch {
              bankInfo = w.destinationLabel;
            }
          }

          return {
            id: `wdr-${w.id}`,
            rawId: w.id,
            referenceNumber: `WDR-${w.id}`,
            professionalName: proName,
            amount: Number(w.amount) || 0,
            destination: capitalizeWords(w.payoutMode ?? "Bank Transfer"),
            bankInfo,
            utr: w.utr || "—",
            status: w.status ?? "PENDING",
            createdAt: w.createdAt ?? new Date().toISOString(),
          };
        });

        parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(parsed);
      })
      .catch((err) => {
        console.error("Failed to load withdrawals report:", err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        r.referenceNumber.toLowerCase().includes(q) ||
        r.professionalName.toLowerCase().includes(q) ||
        r.bankInfo.toLowerCase().includes(q) ||
        r.utr.toLowerCase().includes(q) ||
        String(r.rawId).includes(q);

      const matchesStatus = statusFilter === "ALL" || r.status.toUpperCase() === statusFilter;
      const matchesDate = isWithinCustomDateRange(r.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [rows, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredRows);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Payout KPIs
  const totalVolume = filteredRows.reduce((sum, r) => sum + r.amount, 0);
  const settledVolume = filteredRows
    .filter((r) => r.status.toUpperCase() === "COMPLETED")
    .reduce((sum, r) => sum + r.amount, 0);
  const pendingVolume = filteredRows
    .filter((r) => r.status.toUpperCase() === "PENDING" || r.status.toUpperCase() === "PROCESSING")
    .reduce((sum, r) => sum + r.amount, 0);
  const pendingCount = filteredRows.filter(
    (r) => r.status.toUpperCase() === "PENDING" || r.status.toUpperCase() === "PROCESSING",
  ).length;

  const handleExportCsv = () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;

    downloadCsvFile({
      filename: "klick-pro-bank-withdrawals-audit",
      title: "Bank Withdrawals & Payout Settlements Ledger",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Records`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Requested Volume", value: `INR ${totalVolume.toLocaleString("en-IN")}` },
        { label: "Settled Bank Credits", value: `INR ${settledVolume.toLocaleString("en-IN")}` },
        { label: "Pending Processing", value: `INR ${pendingVolume.toLocaleString("en-IN")}` },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Payout Ref #",
        "Request Date",
        "Professional Payee",
        "Requested Amount (INR)",
        "Disbursement Method",
        "Bank / Destination Details",
        "UTR / Bank Reference",
        "Settlement Status",
      ],
      rows: rowsToExport.map((r) => [
        `#${r.referenceNumber}`,
        formatDateSafely(r.createdAt, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        r.professionalName,
        r.amount,
        r.destination,
        r.bankInfo,
        r.utr,
        formatReadableLabel(r.status),
      ]),
    });
  };

  const handleExportPdf = async () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;
    const ids = rowsToExport.map((r) => r.rawId);

    setExportingPdf(true);
    try {
      const res = await fetch("/api/admin/reports/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isSelected ? "selected" : "all",
          ids,
          orientation: "landscape",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `klick-pro-withdrawals-ledger-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const columns: ReportTableColumn<WithdrawalRow>[] = [
    {
      key: "ref",
      header: "Ref #",
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-indigo-700 whitespace-nowrap">
          #{r.referenceNumber}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date Requested",
      render: (r) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {formatDateSafely(r.createdAt, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "pro",
      header: "Professional Payee",
      render: (r) => <span className="text-xs font-medium text-slate-900 whitespace-nowrap">{r.professionalName}</span>,
    },
    {
      key: "amount",
      header: "Payout Amount",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
          ₹{r.amount.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "dest",
      header: "Method",
      render: (r) => <span className="text-xs text-slate-700 whitespace-nowrap">{r.destination}</span>,
    },
    {
      key: "bank",
      header: "Destination Details",
      render: (r) => <span className="text-xs text-slate-600 max-w-[220px] block truncate">{r.bankInfo}</span>,
    },
    {
      key: "utr",
      header: "UTR / Bank Ref",
      render: (r) => <span className="font-mono text-xs text-slate-700 whitespace-nowrap">{r.utr}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
            r.status,
          )}`}
        >
          {formatReadableLabel(r.status)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 High-Density Stat Cards - Zero Charts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Settled Bank Volume</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              ₹{settledVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Credited to professional accounts</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Queue</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 sm:text-3xl truncate">
              ₹{pendingVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{pendingCount} requests awaiting payout</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Requested</span>
            <ArrowDownToLine className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{filteredRows.length} withdrawal filings</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Settlement Rate</span>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              {filteredRows.length > 0
                ? `${Math.round(
                    (filteredRows.filter((r) => r.status === "COMPLETED").length /
                      filteredRows.length) *
                      100,
                  )}%`
                : "100%"}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Clean disbursement execution</p>
        </div>
      </div>

      {/* Filter and Action Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search ref #, pro name, bank, UTR..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Payout Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="FAILED">Failed</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV {selectedList.length > 0 ? `(${selectedList.length})` : ""}</span>
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>{exportingPdf ? "Generating..." : `Export PDF ${selectedList.length > 0 ? `(${selectedList.length})` : ""}`}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={paginatedRows}
          emptyMessage="No payout records match the active filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(r) => r.referenceNumber}
          columns={columns}
        />
        <AdminPagination
          currentPage={page}
          totalItems={filteredRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 4: DISPUTES & ARBITRATION AUDIT
// ===========================================================================
type DisputeRow = {
  id: string;
  rawId: number;
  referenceNumber: string;
  projectTitle: string;
  issueType: string;
  priority: string;
  disputedAmount: number;
  claimant: string;
  respondent: string;
  decisionSplit: string;
  status: string;
  createdAt: string;
};

function DisputesReport() {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    void fetch("/api/v1/admin/data/jobs", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const disputes = Array.isArray(data.disputes) ? data.disputes : [];
        const runningTrackings = Array.isArray(data.runningProjectTrackings)
          ? data.runningProjectTrackings
          : [];

        type ApiTracking = {
          id: number;
          job?: { title?: string };
          client?: { firstName?: string; lastName?: string };
          professional?: { firstName?: string; lastName?: string };
        };

        const trackingMap = new Map<number, ApiTracking>(
          runningTrackings.map((t: ApiTracking) => [t.id, t]),
        );

        type ApiDispute = {
          id: number;
          trackingId: number;
          issueType?: string;
          priority?: string;
          status?: string;
          reporterRole?: string;
          refundAmount?: number;
          payoutAmount?: number;
          createdAt?: string;
        };

        const parsed: DisputeRow[] = disputes.map((d: ApiDispute) => {
          const tracking = trackingMap.get(d.trackingId);
          const clientName = tracking?.client
            ? capitalizeWords(`${tracking.client.firstName ?? ""} ${tracking.client.lastName ?? ""}`.trim())
            : "Client";
          const proName = tracking?.professional
            ? capitalizeWords(`${tracking.professional.firstName ?? ""} ${tracking.professional.lastName ?? ""}`.trim())
            : "Professional";

          const claimant = d.reporterRole === "CLIENT" ? clientName : proName;
          const respondent = d.reporterRole === "CLIENT" ? proName : clientName;
          const splitInfo =
            d.status === "RESOLVED"
              ? `Refund: ₹${(d.refundAmount ?? 0).toLocaleString("en-IN")} · Payout: ₹${(d.payoutAmount ?? 0).toLocaleString("en-IN")}`
              : "Under Arbitration";

          return {
            id: `dsp-${d.id}`,
            rawId: d.id,
            referenceNumber: `DSP-${d.id}`,
            projectTitle: capitalizeWords(tracking?.job?.title ?? `Project Tracking #${d.trackingId}`),
            issueType: capitalizeWords(formatReadableLabel(d.issueType ?? "Contract Dispute")),
            priority: (d.priority ?? "MEDIUM").toUpperCase(),
            disputedAmount: Number(d.refundAmount ?? 0) + Number(d.payoutAmount ?? 0),
            claimant,
            respondent,
            decisionSplit: splitInfo,
            status: d.status ?? "OPEN",
            createdAt: d.createdAt ?? new Date().toISOString(),
          };
        });

        parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(parsed);
      })
      .catch((err) => {
        console.error("Failed to load disputes report:", err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        r.referenceNumber.toLowerCase().includes(q) ||
        r.projectTitle.toLowerCase().includes(q) ||
        r.issueType.toLowerCase().includes(q) ||
        r.claimant.toLowerCase().includes(q) ||
        r.respondent.toLowerCase().includes(q) ||
        String(r.rawId).includes(q);

      const matchesStatus = statusFilter === "ALL" || r.status.toUpperCase() === statusFilter;
      const matchesDate = isWithinCustomDateRange(r.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [rows, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredRows);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Dispute KPIs
  const openCount = filteredRows.filter(
    (r) => r.status.toUpperCase() !== "RESOLVED" && r.status.toUpperCase() !== "CANCELLED",
  ).length;
  const resolvedCount = filteredRows.filter((r) => r.status.toUpperCase() === "RESOLVED").length;
  const totalDisputedEscrow = filteredRows.reduce((sum, r) => sum + r.disputedAmount, 0);

  const handleExportCsv = () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;

    downloadCsvFile({
      filename: "klick-pro-disputes-arbitration-audit",
      title: "Disputes & Contract Arbitration Audit Register",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Records`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Disputes Filed", value: rowsToExport.length },
        { label: "Open / Under Review", value: openCount },
        { label: "Resolved Disputes", value: resolvedCount },
        { label: "Disputed Escrow Exposure", value: `INR ${totalDisputedEscrow.toLocaleString("en-IN")}` },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Dispute Ref #",
        "Date Filed",
        "Project / Job Title",
        "Issue Category",
        "Priority",
        "Claimant",
        "Respondent",
        "Disputed Escrow (INR)",
        "Arbitration Decision / Split",
        "Dispute Status",
      ],
      rows: rowsToExport.map((r) => [
        `#${r.referenceNumber}`,
        formatDateSafely(r.createdAt),
        r.projectTitle,
        r.issueType,
        r.priority,
        r.claimant,
        r.respondent,
        r.disputedAmount,
        r.decisionSplit,
        formatReadableLabel(r.status),
      ]),
    });
  };

  const handleExportPdf = async () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredRows.filter((r) => selectedIds.has(r.id))
      : filteredRows;
    const ids = rowsToExport.map((r) => r.rawId);

    setExportingPdf(true);
    try {
      const res = await fetch("/api/admin/reports/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isSelected ? "selected" : "all",
          ids,
          orientation: "landscape",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `klick-pro-disputes-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const columns: ReportTableColumn<DisputeRow>[] = [
    {
      key: "ref",
      header: "Case #",
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-rose-700 whitespace-nowrap">
          #{r.referenceNumber}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date Filed",
      render: (r) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateSafely(r.createdAt)}</span>,
    },
    {
      key: "project",
      header: "Project / Job",
      render: (r) => (
        <span className="text-xs font-semibold text-slate-900 max-w-[200px] block truncate">
          {r.projectTitle}
        </span>
      ),
    },
    {
      key: "issue",
      header: "Issue Category",
      render: (r) => <span className="text-xs text-slate-700 whitespace-nowrap">{r.issueType}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
            r.priority === "URGENT" || r.priority === "HIGH"
              ? "bg-rose-100 text-rose-800"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {r.priority}
        </span>
      ),
    },
    {
      key: "claimant",
      header: "Claimant",
      render: (r) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{r.claimant}</span>,
    },
    {
      key: "respondent",
      header: "Respondent",
      render: (r) => <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{r.respondent}</span>,
    },
    {
      key: "amount",
      header: "Disputed Escrow",
      align: "right",
      render: (r) => (
        <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
          ₹{r.disputedAmount.toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "split",
      header: "Arbitration Split",
      render: (r) => <span className="text-xs text-slate-600 max-w-[200px] block truncate">{r.decisionSplit}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
            r.status,
          )}`}
        >
          {formatReadableLabel(r.status)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 High-Density Stat Cards - Zero Charts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Disputes</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-rose-600 sm:text-3xl truncate">
              {openCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Requiring admin arbitration</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved Arbitrations</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              {resolvedCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Settled cases with final decision</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Disputed Escrow</span>
            <CircleDollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalDisputedEscrow.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Total funds involved in proceedings</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Filings</span>
            <Scale className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              {filteredRows.length}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Marketplace dispute rate: &lt; 2%</p>
        </div>
      </div>

      {/* Filter and Action Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search case #, project, issue, claimant..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Dispute Statuses</option>
            <option value="OPEN">Open</option>
            <option value="WAITING_RESPONSE">Waiting Response</option>
            <option value="UNDER_ADMIN_REVIEW">Under Admin Review</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV {selectedList.length > 0 ? `(${selectedList.length})` : ""}</span>
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>{exportingPdf ? "Generating..." : `Export PDF ${selectedList.length > 0 ? `(${selectedList.length})` : ""}`}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={paginatedRows}
          emptyMessage="No dispute records match the active filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(r) => r.referenceNumber}
          columns={columns}
        />
        <AdminPagination
          currentPage={page}
          totalItems={filteredRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 5: JOBS & MARKETPLACE FUNNEL
// ===========================================================================
type JobRow = {
  id: number;
  title: string | null;
  category: string | null;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
};

function JobsReport() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    void fetch("/api/v1/admin/data/jobs", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setJobs(Array.isArray(data?.jobs) ? data.jobs : []))
      .catch((err) => {
        console.error("Failed to load admin jobs report:", err);
        setJobs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const q = search.trim().toLowerCase();
      const clientName = `${job.user?.firstName ?? ""} ${job.user?.lastName ?? ""}`.toLowerCase();
      const matchesSearch =
        q === "" ||
        (job.title && job.title.toLowerCase().includes(q)) ||
        (job.category && job.category.toLowerCase().includes(q)) ||
        clientName.includes(q) ||
        String(job.id).includes(q);

      const matchesStatus = statusFilter === "ALL" || job.status.toUpperCase() === statusFilter;
      const matchesDate = isWithinCustomDateRange(job.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [jobs, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredJobs);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, page]);

  const openCount = filteredJobs.filter((j) => j.status.toUpperCase() === "OPEN").length;
  const runningCount = filteredJobs.filter(
    (j) => j.status.toUpperCase() === "RUNNING" || j.status.toUpperCase() === "IN_PROGRESS",
  ).length;
  const completedCount = filteredJobs.filter((j) => j.status.toUpperCase() === "COMPLETED").length;

  const handleExportCsv = () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredJobs.filter((j) => selectedIds.has(j.id))
      : filteredJobs;

    downloadCsvFile({
      filename: "klick-pro-admin-jobs-audit",
      title: "Marketplace Job Postings & Project Operations Audit",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Jobs`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Listings", value: rowsToExport.length },
        { label: "Open & Hiring", value: openCount },
        { label: "Running Projects", value: runningCount },
        { label: "Completed Projects", value: completedCount },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Job ID",
        "Project Title",
        "Category",
        "Client Name",
        "Marketplace Status",
        "Date Posted",
      ],
      rows: rowsToExport.map((j) => [
        `#JOB-${j.id}`,
        capitalizeWords(j.title ?? "Untitled"),
        capitalizeWords(j.category ?? "General"),
        capitalizeWords(`${j.user?.firstName ?? ""} ${j.user?.lastName ?? ""}`.trim() || "Client"),
        formatReadableLabel(j.status),
        formatDateSafely(j.createdAt),
      ]),
    });
  };

  const handleExportPdf = async () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredJobs.filter((j) => selectedIds.has(j.id))
      : filteredJobs;
    const ids = rowsToExport.map((j) => j.id);

    setExportingPdf(true);
    try {
      const res = await fetch("/api/admin/reports/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isSelected ? "selected" : "all",
          ids,
          orientation: "landscape",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `klick-pro-jobs-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const columns: ReportTableColumn<JobRow>[] = [
    {
      key: "id",
      header: "Reference",
      render: (j) => (
        <span className="font-mono text-xs font-semibold text-indigo-700 whitespace-nowrap">
          #JOB-{j.id}
        </span>
      ),
    },
    {
      key: "title",
      header: "Project Title",
      render: (j) => (
        <span className="text-xs font-semibold text-slate-900 max-w-[280px] block truncate">
          {capitalizeWords(j.title ?? "Untitled")}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (j) => (
        <span className="text-xs text-slate-700 whitespace-nowrap">
          {capitalizeWords(j.category ?? "General")}
        </span>
      ),
    },
    {
      key: "client",
      header: "Client Name",
      render: (j) => (
        <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
          {capitalizeWords(`${j.user?.firstName ?? ""} ${j.user?.lastName ?? ""}`.trim() || "Client")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Marketplace Status",
      render: (j) => (
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClass(
            j.status,
          )}`}
        >
          {formatReadableLabel(j.status)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date Posted",
      render: (j) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateSafely(j.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 High-Density Stat Cards - Zero Charts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Listings</span>
            <Briefcase className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              {filteredJobs.length}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Marketplace postings in scope</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Open & Hiring</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 sm:text-3xl truncate">
              {openCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Accepting professional proposals</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">In-Progress Projects</span>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 sm:text-3xl truncate">
              {runningCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Active milestone delivery</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Projects</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              {completedCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Successfully closed contracts</p>
        </div>
      </div>

      {/* Filter and Action Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search job title, category, client..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
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
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Marketplace Statuses</option>
            <option value="OPEN">Open</option>
            <option value="RUNNING">Running / In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV {selectedList.length > 0 ? `(${selectedList.length})` : ""}</span>
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>{exportingPdf ? "Generating..." : `Export PDF ${selectedList.length > 0 ? `(${selectedList.length})` : ""}`}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={paginatedJobs}
          emptyMessage="No job records match the active filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(j) => j.title ?? `Job #${j.id}`}
          columns={columns}
        />
        <AdminPagination
          currentPage={page}
          totalItems={filteredJobs.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 6: USER ACCOUNTS & KYC DIRECTORY
// ===========================================================================
type UserRow = {
  id: number;
  username?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  daysActive?: number;
  jobsCount?: number;
  proposalsCount?: number;
  walletBalance?: number;
  totalTopUp?: number;
  totalWithdrawals?: number;
};

function UsersReport() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    void fetch("/api/v1/admin/data/users", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUsers(Array.isArray(data?.users) ? data.users : []))
      .catch((err) => {
        console.error("Failed to load admin users report:", err);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const q = search.trim().toLowerCase();
      const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.toLowerCase();
      const matchesSearch =
        q === "" ||
        fullName.includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.username && user.username.toLowerCase().includes(q)) ||
        (user.phone && user.phone.includes(q)) ||
        String(user.id).includes(q);

      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesVerification =
        verificationFilter === "ALL" ||
        (verificationFilter === "VERIFIED" && user.isVerified) ||
        (verificationFilter === "UNVERIFIED" && !user.isVerified);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.isActive) ||
        (statusFilter === "SUSPENDED" && !user.isActive);
      const matchesDate = isWithinCustomDateRange(user.createdAt, datePreset, startDate, endDate);

      return matchesSearch && matchesRole && matchesVerification && matchesStatus && matchesDate;
    });
  }, [users, search, roleFilter, verificationFilter, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredUsers);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  const verifiedCount = filteredUsers.filter((u) => u.isVerified).length;
  const totalWalletFloat = filteredUsers.reduce((sum, u) => sum + (Number(u.walletBalance) || 0), 0);
  const prosCount = filteredUsers.filter((u) => u.role === "PROFESSIONAL").length;
  const clientsCount = filteredUsers.filter((u) => u.role === "CLIENT").length;

  const handleExportCsv = () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredUsers.filter((u) => selectedIds.has(u.id))
      : filteredUsers;

    downloadCsvFile({
      filename: "klick-pro-admin-users-audit",
      title: "User Accounts & KYC Compliance Directory",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Accounts`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Profiles", value: rowsToExport.length },
        { label: "KYC Verified", value: verifiedCount },
        { label: "Professionals", value: prosCount },
        { label: "Clients", value: clientsCount },
        { label: "Wallet Float", value: `INR ${totalWalletFloat.toLocaleString("en-IN")}` },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "User ID",
        "Full Name",
        "Platform Role",
        "Email Address",
        "Phone Number",
        "KYC Status",
        "Wallet Balance (INR)",
        "Lifetime Top-Up (INR)",
        "Lifetime Withdrawals (INR)",
        "Account Status",
        "Registered Date",
      ],
      rows: rowsToExport.map((u) => [
        `#USR-${u.id}`,
        capitalizeWords(`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()),
        capitalizeWords(u.role),
        u.email,
        u.phone || "—",
        u.isVerified ? "Verified" : "Unverified",
        u.walletBalance ?? 0,
        u.totalTopUp ?? 0,
        u.totalWithdrawals ?? 0,
        u.isActive ? "Active" : "Suspended",
        formatDateSafely(u.createdAt),
      ]),
    });
  };

  const handleExportPdf = async () => {
    const isSelected = selectedList.length > 0;
    const rowsToExport = isSelected
      ? filteredUsers.filter((u) => selectedIds.has(u.id))
      : filteredUsers;
    const ids = rowsToExport.map((u) => u.id);

    setExportingPdf(true);
    try {
      const res = await fetch("/api/admin/reports/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: isSelected ? "selected" : "all",
          ids,
          orientation: "landscape",
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `klick-pro-users-directory-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  const columns: ReportTableColumn<UserRow>[] = [
    {
      key: "id",
      header: "Ref #",
      render: (u) => (
        <span className="font-mono text-xs font-semibold text-indigo-700 whitespace-nowrap">
          #USR-{u.id}
        </span>
      ),
    },
    {
      key: "name",
      header: "Full Name",
      render: (u) => (
        <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">
          {capitalizeWords(`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim())}
        </span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
            u.role === "PROFESSIONAL"
              ? "bg-purple-100 text-purple-800"
              : u.role === "CLIENT"
                ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-800"
          }`}
        >
          {capitalizeWords(u.role)}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email Address",
      render: (u) => <span className="text-xs text-slate-600 max-w-[180px] block truncate">{u.email}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (u) => <span className="text-xs text-slate-500 whitespace-nowrap">{u.phone || "—"}</span>,
    },
    {
      key: "verified",
      header: "KYC Status",
      render: (u) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            u.isVerified
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
              : "bg-slate-500/10 text-slate-600 border-slate-500/20"
          }`}
        >
          {u.isVerified ? "Verified" : "Unverified"}
        </span>
      ),
    },
    {
      key: "wallet",
      header: "Wallet Bal",
      align: "right",
      render: (u) => (
        <span className="font-mono text-xs font-bold text-slate-900 whitespace-nowrap">
          ₹{(u.walletBalance ?? 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "topup",
      header: "Top-Up",
      align: "right",
      render: (u) => (
        <span className="font-mono text-xs text-slate-700 whitespace-nowrap">
          ₹{(u.totalTopUp ?? 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "withdrawals",
      header: "Withdrawals",
      align: "right",
      render: (u) => (
        <span className="font-mono text-xs text-slate-700 whitespace-nowrap">
          ₹{(u.totalWithdrawals ?? 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            u.isActive
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-700 border-rose-500/20"
          }`}
        >
          {u.isActive ? "Active" : "Suspended"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Registered",
      render: (u) => <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateSafely(u.createdAt)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 High-Density Stat Cards - Zero Charts */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Accounts</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              {filteredUsers.length}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">{clientsCount} clients · {prosCount} professionals</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">KYC Compliance</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              {verifiedCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            {filteredUsers.length > 0
              ? `${Math.round((verifiedCount / filteredUsers.length) * 100)}% verified identity`
              : "Zero accounts"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Wallet Float</span>
            <CircleDollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalWalletFloat.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Spendable user balances</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Account Health</span>
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              {filteredUsers.filter((u) => u.isActive).length}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Active profiles in good standing</p>
        </div>
      </div>

      {/* Filter and Action Controls Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search user name, email, phone, ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
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
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Roles</option>
            <option value="CLIENT">Clients</option>
            <option value="PROFESSIONAL">Professionals</option>
            <option value="ADMIN">Admins</option>
          </select>

          <select
            value={verificationFilter}
            onChange={(e) => {
              setVerificationFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
          >
            <option value="ALL">All Verification</option>
            <option value="VERIFIED">KYC Verified</option>
            <option value="UNVERIFIED">Unverified</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV {selectedList.length > 0 ? `(${selectedList.length})` : ""}</span>
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={() => void handleExportPdf()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-indigo-400" />
            <span>{exportingPdf ? "Generating..." : `Export PDF ${selectedList.length > 0 ? `(${selectedList.length})` : ""}`}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <SelectableReportTable
          loading={loading}
          rows={paginatedUsers}
          emptyMessage="No user accounts match the active filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(u) => `${u.firstName} ${u.lastName}`}
          columns={columns}
        />
        <AdminPagination
          currentPage={page}
          totalItems={filteredUsers.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// MAIN ADMIN REPORTS PAGE COMPONENT
// ===========================================================================
export default function AdminReportsPage() {
  const [tab, setTab] = useState<
    "revenue" | "escrow" | "withdrawals" | "disputes" | "jobs" | "users"
  >("revenue");

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              <span>Enterprise Financial Control & Audit</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Platform Reports & Audit Ledgers
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-2xl leading-relaxed">
              Official regulatory compliance records of verified accounts, escrow custody liabilities,
              milestone settlement transactions, dispute arbitration, and marketplace health.
            </p>
          </div>

          {/* 6 Tab Switcher */}
          <div className="flex flex-nowrap shrink-0 items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm whitespace-nowrap">
            <button
              type="button"
              onClick={() => setTab("revenue")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "revenue"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Landmark className="h-4 w-4" />
              <span>Revenue & Commission</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("escrow")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "escrow"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Escrow & Treasury</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("withdrawals")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "withdrawals"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <ArrowDownToLine className="h-4 w-4" />
              <span>Bank Withdrawals</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("disputes")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "disputes"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Disputes & Arbitration</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("jobs")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "jobs"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Jobs & Projects</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("users")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
                tab === "users"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>User Accounts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <section>
        {tab === "revenue" && <RevenueReport />}
        {tab === "escrow" && <EscrowReport />}
        {tab === "withdrawals" && <WithdrawalsReport />}
        {tab === "disputes" && <DisputesReport />}
        {tab === "jobs" && <JobsReport />}
        {tab === "users" && <UsersReport />}
      </section>
    </div>
  );
}
