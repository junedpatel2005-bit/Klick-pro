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
  completedProjects?: number;
};

type JobRow = {
  id: number;
  title: string | null;
  category: string | null;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string };
};

type FinanceRow = {
  id: number;
  kind: "Payment" | "Payout";
  type: string;
  amount: number;
  currency: string;
  status: string;
  party: string;
  createdAt: string;
};

type DateFilter = "all" | "this_month" | "last_month" | "last_90_days" | "this_year";

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

function UsersReport() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [verificationFilter, setVerificationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    void fetch("/api/v1/admin/data/users", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setUsers(Array.isArray(data?.users) ? data.users : []))
      .catch((err) => {
        console.error("Failed to load admin users report data:", err);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const matchesSearch =
        search.trim() === "" ||
        fullName.includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        String(user.id).includes(search);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesVerification =
        verificationFilter === "ALL" ||
        (verificationFilter === "VERIFIED" ? user.isVerified : !user.isVerified);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? user.isActive : !user.isActive);
      const matchesDate = isWithinCustomDateRange(
        user.createdAt,
        datePreset,
        startDate,
        endDate,
      );
      return (
        matchesSearch &&
        matchesRole &&
        matchesVerification &&
        matchesStatus &&
        matchesDate
      );
    });
  }, [users, search, roleFilter, verificationFilter, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredUsers);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // KPIs
  const totalCount = filteredUsers.length;
  const verifiedCount = filteredUsers.filter((u) => u.isVerified).length;
  const activeCount = filteredUsers.filter((u) => u.isActive).length;
  const proCount = filteredUsers.filter((u) => u.role === "PROFESSIONAL").length;
  const clientCount = filteredUsers.filter((u) => u.role === "CLIENT").length;
  const totalTopUp = filteredUsers.reduce((sum, u) => sum + (u.totalTopUp ?? 0), 0);
  const totalWithdrawals = filteredUsers.reduce((sum, u) => sum + (u.totalWithdrawals ?? 0), 0);
  const totalWalletBalance = filteredUsers.reduce((sum, u) => sum + (u.walletBalance ?? 0), 0);

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport = isSelected
      ? filteredUsers.filter((u) => selectedIds.has(u.id))
      : filteredUsers;

    downloadCsvFile({
      filename: "klick-pro-admin-users",
      title: "Admin Executive Oversight · User Directory & Financial Audit",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Accounts`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Platform Accounts", value: totalCount },
        { label: "Verified Accounts", value: verifiedCount },
        { label: "Active Accounts", value: activeCount },
        { label: "Total Wallet Top-Up Volume", value: `INR ${totalTopUp.toLocaleString("en-IN")}` },
        { label: "Total Withdrawals Processed", value: `INR ${totalWithdrawals.toLocaleString("en-IN")}` },
        { label: "Circulating Wallet Balance", value: `INR ${totalWalletBalance.toLocaleString("en-IN")}` },
        { label: "Active Role Filter", value: roleFilter },
        { label: "Active Verification Filter", value: verificationFilter },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "User ID",
        "Full Name",
        "Email Address",
        "Phone Number",
        "System Role",
        "Account Status",
        "Identity Verified",
        "Registration Date",
        "Days Active on Platform",
        "Jobs Posted",
        "Proposals / Bids",
        "Completed Projects",
        "Total Wallet Top-Up (INR)",
        "Total Withdrawals (INR)",
        "Current Wallet Balance (INR)",
      ],
      rows: rowsToExport.map((u) => [
        `#USR-${u.id}`,
        `${u.firstName} ${u.lastName}`.trim(),
        u.email,
        u.phone || "—",
        u.role,
        u.isActive ? "Active" : "Suspended",
        u.isVerified ? "Verified" : "Unverified",
        formatDateSafely(u.createdAt),
        `${u.daysActive ?? 1} days`,
        u.jobsCount ?? 0,
        u.proposalsCount ?? 0,
        u.completedProjects ?? 0,
        u.totalTopUp ?? 0,
        u.totalWithdrawals ?? 0,
        u.walletBalance ?? 0,
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Accounts</span>
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalCount}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {clientCount} Clients · {proCount} Pros
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Verified</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {verifiedCount}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0}% KYC verified
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active Status</span>
            <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-xl sm:text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {activeCount}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {totalCount - activeCount} suspended
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Top-Ups</span>
            <ArrowDownToLine className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-lg sm:text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 truncate">
              ₹{totalTopUp.toLocaleString("en-IN")}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Total deposits</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Withdrawals</span>
            <Landmark className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-lg sm:text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 truncate">
              ₹{totalWithdrawals.toLocaleString("en-IN")}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Paid to pros</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Wallet Bal</span>
            <CircleDollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          {loading ? (
            <div className="mt-2 h-7 w-16 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-lg sm:text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400 truncate">
              ₹{totalWalletBalance.toLocaleString("en-IN")}
            </div>
          )}
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">In circulation</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or user ID…"
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="PROFESSIONAL">Professionals</option>
              <option value="CLIENT">Clients</option>
              <option value="ADMIN">Admins</option>
            </select>

            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            >
              <option value="ALL">All Verification</option>
              <option value="VERIFIED">KYC Verified Only</option>
              <option value="UNVERIFIED">Unverified Only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="SUSPENDED">Suspended Accounts</option>
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

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleExportCsv()}
            disabled={filteredUsers.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
            title="Download CSV for Excel"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          {(() => {
            const singleSelectedUser =
              selectedList.length === 1 ? users.find((u) => u.id === selectedList[0]) : null;
            const userFileBaseName = singleSelectedUser
              ? `admin-${(singleSelectedUser.username || `${singleSelectedUser.firstName}-${singleSelectedUser.lastName}`).toLowerCase().replace(/[^a-z0-9_-]/g, "_")}`
              : "admin-users";
            return (
              <ExportMenu
                endpoint="/api/admin/reports/users"
                selectedIds={selectedList}
                fileBaseName={userFileBaseName}
                emptyMessage="Select user first"
                onExportCsv={handleExportCsv}
              />
            );
          })()}
        </div>
      </div>

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50/80 dark:[&_th]:bg-slate-800/40 dark:[&_th]:text-slate-400 [&_tr]:border-slate-100 dark:[&_tr]:border-slate-800">
        <SelectableReportTable
          loading={loading}
          rows={filteredUsers}
          emptyMessage="No user accounts match your filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(user) => `${user.firstName} ${user.lastName}`}
          columns={[
            {
              key: "id",
              header: "Ref #",
              render: (user) => (
                <span className="font-mono text-xs font-semibold text-slate-400 whitespace-nowrap">
                  #USR-{user.id}
                </span>
              ),
            },
            {
              key: "name",
              header: "User & Contact",
              render: (user) => (
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {user.firstName} {user.lastName}
                  </span>
                  {user.username && (
                    <span className="text-[11px] text-indigo-500 font-mono">@{user.username}</span>
                  )}
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-slate-500 font-mono text-[11px]">{user.email}</span>
                  {user.phone && (
                    <>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-slate-500 font-mono text-[11px]">{user.phone}</span>
                    </>
                  )}
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              render: (user) => (
                <span
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user.role === "PROFESSIONAL"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                      : user.role === "CLIENT"
                        ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                        : "bg-slate-100 text-slate-800 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                  }`}
                >
                  {user.role}
                </span>
              ),
            },
            {
              key: "verified",
              header: "KYC",
              render: (user) => (
                <span
                  className={`inline-flex items-center whitespace-nowrap gap-1 text-xs font-semibold ${
                    user.isVerified ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      user.isVerified ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  />
                  {user.isVerified ? "Verified" : "Unverified"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (user) => (
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    user.isActive
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {user.isActive ? "Active" : "Suspended"}
                </span>
              ),
            },
            {
              key: "joined",
              header: "Registration & Active",
              render: (user) => (
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {formatDateSafely(user.createdAt)}
                  </span>
                  <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {user.daysActive ?? 1}d active
                  </span>
                </div>
              ),
            },
            {
              key: "activity",
              header: "Job Activity",
              render: (user) => (
                <div className="whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                  {user.role === "CLIENT" ? (
                    <span className="font-medium">{user.jobsCount ?? 0} jobs posted</span>
                  ) : user.role === "PROFESSIONAL" ? (
                    <span>
                      <strong>{user.proposalsCount ?? 0}</strong> bids ·{" "}
                      <strong>{user.completedProjects ?? 0}</strong> done
                    </span>
                  ) : (
                    <span className="text-slate-400">Internal</span>
                  )}
                </div>
              ),
            },
            {
              key: "topup",
              header: "Total Top-Up",
              align: "right",
              render: (user) => (
                <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                  ₹{(user.totalTopUp ?? 0).toLocaleString("en-IN")}
                </span>
              ),
            },
            {
              key: "withdrawals",
              header: "Withdrawals",
              align: "right",
              render: (user) => (
                <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                  ₹{(user.totalWithdrawals ?? 0).toLocaleString("en-IN")}
                </span>
              ),
            },
            {
              key: "balance",
              header: "Wallet Bal",
              align: "right",
              render: (user) => (
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  ₹{(user.walletBalance ?? 0).toLocaleString("en-IN")}
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 dark:text-slate-400">
        <div>
          Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredUsers.length}</span> of{" "}
          <span className="font-semibold text-slate-900 dark:text-white">{users.length}</span> accounts.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-indigo-600 dark:text-indigo-400">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Identity Verified Rate:{" "}
          <span className="font-bold text-slate-900 dark:text-white">
            {totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}

function JobsReport() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    void fetch("/api/v1/admin/data/jobs", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setJobs(Array.isArray(data?.jobs) ? data.jobs : []))
      .catch((err) => {
        console.error("Failed to load admin jobs report data:", err);
        setJobs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const clientName = `${job.user?.firstName ?? ""} ${job.user?.lastName ?? ""}`.toLowerCase();
      const matchesSearch =
        search.trim() === "" ||
        (job.title && job.title.toLowerCase().includes(search.toLowerCase())) ||
        clientName.includes(search.toLowerCase()) ||
        String(job.id).includes(search);
      const matchesStatus =
        statusFilter === "ALL" || job.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesDate = isWithinCustomDateRange(job.createdAt, datePreset, startDate, endDate);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [jobs, search, statusFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredJobs);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // KPIs
  const totalJobs = filteredJobs.length;
  const runningJobs = filteredJobs.filter(
    (j) =>
      j.status.toUpperCase().includes("RUNNING") || j.status.toUpperCase().includes("PROGRESS"),
  ).length;
  const completedJobs = filteredJobs.filter((j) =>
    j.status.toUpperCase().includes("COMPLETED"),
  ).length;
  const openJobs = filteredJobs.filter((j) => j.status.toUpperCase() === "OPEN").length;

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport =
      selectedList.length > 0 ? filteredJobs.filter((j) => selectedIds.has(j.id)) : filteredJobs;

    if (isSelected && rowsToExport.length === 1 && rowsToExport[0]) {
      window.open(`/api/v1/portal/jobs/${rowsToExport[0].id}/export?format=csv`, "_blank");
      return;
    }

    downloadCsvFile({
      filename: "klick-pro-admin-jobs",
      title: "Admin Executive Oversight · Marketplace Postings & Listings Audit",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Postings`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Total Platform Postings", value: totalJobs },
        { label: "Active In Progress", value: runningJobs },
        { label: "Completed Engagements", value: completedJobs },
        { label: "Open Marketplace Jobs", value: openJobs },
        { label: "Active Status Filter", value: statusFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: ["Job ID", "Title", "Client Name", "Category", "Listing Status", "Creation Date"],
      rows: rowsToExport.map((j) => [
        `#JOB-${j.id}`,
        j.title ?? "Untitled job",
        `${j.user?.firstName ?? ""} ${j.user?.lastName ?? ""}`.trim() || "Client",
        j.category ?? "General",
        j.status,
        formatDateSafely(j.createdAt),
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Postings</span>
            <Briefcase className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {totalJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Platform listings</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
            <Clock className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-600 sm:text-3xl">
              {runningJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Active engagements</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl">
              {completedJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Successfully delivered</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Open / Hiring</span>
            <CircleDollarSign className="h-4 w-4 text-amber-500" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-amber-600 sm:text-3xl">
              {openJobs}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Accepting quotes</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, client, or job ID…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="OPEN">Open</option>
              <option value="DRAFT">Draft</option>
              <option value="CLOSED">Closed</option>
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

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            type="button"
            onClick={() => handleExportCsv()}
            disabled={filteredJobs.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            title="Download CSV for Excel"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/admin/reports/jobs"
            selectedIds={selectedList}
            fileBaseName="admin-jobs"
            emptyMessage="Select project first"
            onExportCsv={handleExportCsv}
          />
        </div>
      </div>

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50/80 [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70">
        <SelectableReportTable
          loading={loading}
          rows={filteredJobs}
          emptyMessage="No job records match your filter criteria."
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
                <span className="font-mono text-xs font-semibold text-slate-400">
                  #JOB-{job.id}
                </span>
              ),
            },
            {
              key: "title",
              header: "Project Title",
              render: (job) => (
                <span className="font-semibold text-slate-900">
                  {job.title ?? `Untitled Project #${job.id}`}
                </span>
              ),
            },
            {
              key: "client",
              header: "Posted By",
              render: (job) => (
                <span className="text-sm text-slate-600 font-medium">
                  {job.user ? `${job.user.firstName} ${job.user.lastName}` : "Client"}
                </span>
              ),
            },
            {
              key: "category",
              header: "Category",
              render: (job) => (
                <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {job.category ?? "General"}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (job) => (
                <span className="text-xs font-semibold text-slate-700">{job.status}</span>
              ),
            },
            {
              key: "createdAt",
              header: "Created Date",
              align: "right",
              render: (job) => (
                <span className="text-xs text-slate-500">{formatDateSafely(job.createdAt)}</span>
              ),
            },
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-900">{filteredJobs.length}</span> of{" "}
          <span className="font-semibold text-slate-900">{jobs.length}</span> postings.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-indigo-600">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Fulfillment Ratio:{" "}
          <span className="font-bold text-slate-900">
            {totalJobs > 0 ? Math.round(((completedJobs + runningJobs) / totalJobs) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}

function FinanceReport() {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    void fetch("/api/v1/admin/data/finance", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
        const names = data.names && typeof data.names === "object" ? data.names : {};

        type ApiTransaction = {
          id: number;
          type?: string;
          amount?: number;
          currency?: string;
          status?: string;
          clientId?: number;
          professionalId?: number;
          createdAt?: string;
        };
        type ApiWithdrawal = {
          id: number;
          amount?: number;
          currency?: string;
          status?: string;
          professionalId?: number;
          createdAt?: string;
        };

        const combined: FinanceRow[] = [
          ...transactions.map((item: ApiTransaction) => ({
            id: item.id,
            kind: "Payment" as const,
            type: item.type ?? "PAYMENT",
            amount: Number(item.amount) || 0,
            currency: item.currency || "INR",
            status: item.status ?? "PENDING",
            party: `Client: ${(item.clientId && names[item.clientId]) ?? `#${item.clientId}`} · Pro: ${(item.professionalId && names[item.professionalId]) ?? `#${item.professionalId}`}`,
            createdAt: item.createdAt || new Date().toISOString(),
          })),
          ...withdrawals.map((item: ApiWithdrawal) => ({
            id: item.id,
            kind: "Payout" as const,
            type: "Withdrawal",
            amount: Number(item.amount) || 0,
            currency: item.currency || "INR",
            status: item.status ?? "PENDING",
            party: `Professional: ${(item.professionalId && names[item.professionalId]) ?? `#${item.professionalId}`}`,
            createdAt: item.createdAt || new Date().toISOString(),
          })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setRows(combined);
      })
      .catch((err) => {
        console.error("Failed to load admin finance reports:", err);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        search.trim() === "" ||
        row.party.toLowerCase().includes(search.toLowerCase()) ||
        row.type.toLowerCase().includes(search.toLowerCase()) ||
        String(row.id).includes(search);
      const matchesKind =
        kindFilter === "ALL" || row.kind.toUpperCase() === kindFilter.toUpperCase();
      const matchesDate = isWithinCustomDateRange(row.createdAt, datePreset, startDate, endDate);
      return matchesSearch && matchesKind && matchesDate;
    });
  }, [rows, search, kindFilter, datePreset, startDate, endDate]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredRows);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // Financial KPIs
  const totalVolume = filteredRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const paymentVolume = filteredRows
    .filter((r) => r.kind === "Payment")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const payoutVolume = filteredRows
    .filter((r) => r.kind === "Payout")
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleExportCsv = (scope?: "all" | "selected") => {
    const isSelected = scope === "selected" || (scope === undefined && selectedList.length > 0);
    const rowsToExport =
      selectedList.length > 0 ? filteredRows.filter((r) => selectedIds.has(r.id)) : filteredRows;

    if (isSelected && rowsToExport.length === 1 && rowsToExport[0]) {
      const r = rowsToExport[0];
      downloadCsvFile({
        filename: `klick-pro-admin-voucher-${r.id}`,
        title: `Admin Oversight · Settlement Voucher #${r.id}`,
        metadata: [
          { label: "Transaction ID", value: `#TXN-${r.id}` },
          { label: "Transfer Kind", value: r.kind },
          { label: "Transaction Type", value: r.type },
          { label: "Gross Amount", value: `INR ${r.amount.toLocaleString("en-IN")}` },
          { label: "Settlement Status", value: r.status },
          { label: "Parties Involved", value: r.party },
          {
            label: "Recorded Timestamp",
            value: formatDateSafely(r.createdAt, {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ],
        headers: ["Audit Entry", "Value", "Settlement Status"],
        rows: [
          ["Platform Transaction Reference", `#TXN-${r.id}`, r.status],
          ["Flow Category & Type", `${r.kind} (${r.type})`, "Verified"],
          ["Disbursed Amount", `INR ${r.amount.toLocaleString("en-IN")}`, r.status],
          ["Associated Platform Parties", r.party, "Audited"],
        ],
      });
      return;
    }

    downloadCsvFile({
      filename: "klick-pro-admin-financial-audit",
      title: "Admin Executive Oversight · Financial Settlements & Reconciliation Ledger",
      metadata: [
        {
          label: "Scope",
          value: isSelected
            ? `${rowsToExport.length} Selected Transactions`
            : `All Filtered (${rowsToExport.length})`,
        },
        { label: "Gross Volume (GMV)", value: `INR ${totalVolume.toLocaleString("en-IN")}` },
        { label: "Payment Volume", value: `INR ${paymentVolume.toLocaleString("en-IN")}` },
        { label: "Payout Volume", value: `INR ${payoutVolume.toLocaleString("en-IN")}` },
        { label: "Active Flow Filter", value: kindFilter },
        { label: "Active Date Range", value: datePreset },
      ],
      headers: [
        "Transaction ID",
        "Transfer Kind",
        "Transaction Type",
        "Gross Amount (INR)",
        "Settlement Status",
        "Parties Involved",
        "Timestamp Recorded",
      ],
      rows: rowsToExport.map((r) => [
        `#TXN-${r.id}`,
        r.kind,
        r.type,
        r.amount,
        r.status,
        r.party,
        formatDateSafely(r.createdAt, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      ]),
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Financial KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Gross Volume (GMV)
            </span>
            <CircleDollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl truncate">
              ₹{totalVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">All marketplace flows</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Client Payments</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl truncate">
              ₹{paymentVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Inbound deposits & releases</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pro Withdrawals</span>
            <Landmark className="h-4 w-4 text-purple-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-28 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-purple-700 sm:text-3xl truncate">
              ₹{payoutVolume.toLocaleString()}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Bank payouts disbursed</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Audit Records</span>
            <FileText className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {filteredRows.length}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Filtered financial ledger rows</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by party, type, or transaction ID…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Flows</option>
              <option value="PAYMENT">Client Payments</option>
              <option value="PAYOUT">Bank Payouts</option>
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

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            type="button"
            onClick={() => handleExportCsv()}
            disabled={filteredRows.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            title="Download CSV for Financial Reconciliation"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/admin/reports/finance"
            selectedIds={selectedList}
            fileBaseName="admin-finance"
            emptyMessage="Select transaction first"
            onExportCsv={handleExportCsv}
          />
        </div>
      </div>

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50/80 [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70">
        <SelectableReportTable
          loading={loading}
          rows={filteredRows}
          emptyMessage="No financial transactions match your filter criteria."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(row) => `${row.kind} #${row.id}`}
          columns={[
            {
              key: "id",
              header: "Reference",
              render: (row) => (
                <span className="font-mono text-xs font-semibold text-slate-400">
                  #TXN-{row.id}
                </span>
              ),
            },
            {
              key: "kind",
              header: "Classification",
              render: (row) => (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    row.kind === "Payment"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-purple-50 text-purple-700 border border-purple-200"
                  }`}
                >
                  {row.kind}
                </span>
              ),
            },
            {
              key: "type",
              header: "Type",
              render: (row) => (
                <span className="text-xs uppercase font-medium text-slate-500">
                  {row.type?.replace(/_/g, " ")}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (row) => (
                <span className="font-mono font-bold text-slate-900">
                  ₹{Number(row.amount).toLocaleString()} {row.currency}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <span className="text-xs font-semibold text-slate-700">{row.status}</span>
              ),
            },
            {
              key: "party",
              header: "Parties Involved",
              render: (row) => (
                <span className="text-xs text-slate-600 line-clamp-1 max-w-sm">{row.party}</span>
              ),
            },
            {
              key: "createdAt",
              header: "Timestamp",
              align: "right",
              render: (row) => (
                <span className="text-xs text-slate-500">{formatDateSafely(row.createdAt)}</span>
              ),
            },
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-900">{filteredRows.length}</span> of{" "}
          <span className="font-semibold text-slate-900">{rows.length}</span> ledger rows.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-indigo-600">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Gross Processed Volume:{" "}
          <span className="font-bold text-slate-900">₹{totalVolume.toLocaleString()} INR</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<"users" | "jobs" | "finance">("finance");

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              <span>Enterprise Audit & Intelligence</span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Platform Reports & Audit Ledgers
            </h1>
            <p className="mt-1.5 text-sm text-slate-300 max-w-2xl leading-relaxed">
              Official compliance records of platform accounts, active marketplace job volume, and
              reconciled gross settlement transactions.
            </p>
          </div>

          <div className="flex flex-nowrap shrink-0 items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-sm whitespace-nowrap">
            <button
              type="button"
              onClick={() => setTab("finance")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
                tab === "finance"
                  ? "bg-white text-slate-950 shadow-md font-bold"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <Landmark className="h-4 w-4" />
              <span>Financial Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("jobs")}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
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
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
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

      {/* Main Content */}
      <section>
        {tab === "finance" && <FinanceReport />}
        {tab === "jobs" && <JobsReport />}
        {tab === "users" && <UsersReport />}
      </section>
    </div>
  );
}
