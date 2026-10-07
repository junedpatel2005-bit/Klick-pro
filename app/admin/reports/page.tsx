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

type UserRow = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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
      const matchesDate = isWithinDateRange(user.createdAt, dateFilter);
      return matchesSearch && matchesRole && matchesDate;
    });
  }, [users, search, roleFilter, dateFilter]);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } =
    useRowSelection(filteredUsers);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  // KPIs
  const totalCount = filteredUsers.length;
  const verifiedCount = filteredUsers.filter((u) => u.isVerified).length;
  const proCount = filteredUsers.filter((u) => u.role === "PROFESSIONAL").length;
  const clientCount = filteredUsers.filter((u) => u.role === "CLIENT").length;

  const handleExportCsv = () => {
    const rowsToExport =
      selectedList.length > 0 ? filteredUsers.filter((u) => selectedIds.has(u.id)) : filteredUsers;
    downloadCsv(
      "klick-pro-admin-users",
      ["User ID", "First Name", "Last Name", "Email", "Role", "Active", "Verified", "Joined Date"],
      rowsToExport.map((u) => [
        `#USR-${u.id}`,
        u.firstName,
        u.lastName,
        u.email,
        u.role,
        u.isActive ? "Yes" : "No",
        u.isVerified ? "Yes" : "No",
        formatDateSafely(u.createdAt),
      ]),
    );
  };

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Accounts</span>
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {totalCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Registered users</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Verified Identity
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-emerald-600 sm:text-3xl">
              {verifiedCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">KYC / Identity verified</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Professionals</span>
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {proCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Service providers</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Clients</span>
            <CircleDollarSign className="h-4 w-4 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-8 w-20 rounded-lg bg-slate-200 animate-pulse" />
          ) : (
            <div className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {clientCount}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Hiring employers</p>
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
              placeholder="Search name, email, or user ID…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="PROFESSIONAL">Professionals</option>
              <option value="CLIENT">Clients</option>
              <option value="ADMIN">Admins</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredUsers.length === 0}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
            title="Download CSV for Excel"
          >
            <ArrowDownToLine className="h-4 w-4" />
            <span>CSV</span>
          </button>

          <ExportMenu
            endpoint="/api/admin/reports/users"
            selectedIds={selectedList}
            fileBaseName="admin-users"
          />
        </div>
      </div>

      {/* Statement Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50/80 [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70">
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
              header: "Reference",
              render: (user) => (
                <span className="font-mono text-xs font-semibold text-slate-400">
                  #USR-{user.id}
                </span>
              ),
            },
            {
              key: "name",
              header: "User Name",
              render: (user) => (
                <div>
                  <span className="font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </span>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Account Role",
              render: (user) => (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    user.role === "PROFESSIONAL"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : user.role === "CLIENT"
                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                        : "bg-slate-100 text-slate-800 border border-slate-200"
                  }`}
                >
                  {user.role}
                </span>
              ),
            },
            {
              key: "verified",
              header: "KYC Verified",
              render: (user) => (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    user.isVerified ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      user.isVerified ? "bg-emerald-500" : "bg-slate-300"
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
                  className={`text-xs font-semibold ${
                    user.isActive ? "text-slate-700" : "text-rose-600"
                  }`}
                >
                  {user.isActive ? "Active" : "Suspended"}
                </span>
              ),
            },
            {
              key: "joined",
              header: "Joined Date",
              align: "right",
              render: (user) => (
                <span className="text-xs text-slate-500">{formatDateSafely(user.createdAt)}</span>
              ),
            },
          ]}
        />
      </div>

      {/* Period Reconciliation Summary */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
        <div>
          Showing <span className="font-semibold text-slate-900">{filteredUsers.length}</span> of{" "}
          <span className="font-semibold text-slate-900">{users.length}</span> accounts.
          {selectedList.length > 0 && (
            <span className="ml-2 font-semibold text-indigo-600">
              ({selectedList.length} rows selected for export)
            </span>
          )}
        </div>
        <div className="font-mono">
          Identity Verified Rate:{" "}
          <span className="font-bold text-slate-900">
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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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
      const matchesDate = isWithinDateRange(job.createdAt, dateFilter);
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [jobs, search, statusFilter, dateFilter]);

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

  const handleExportCsv = () => {
    const rowsToExport =
      selectedList.length > 0 ? filteredJobs.filter((j) => selectedIds.has(j.id)) : filteredJobs;
    downloadCsv(
      "klick-pro-admin-jobs",
      ["Job ID", "Title", "Client Name", "Category", "Status", "Created Date"],
      rowsToExport.map((j) => [
        `#JOB-${j.id}`,
        j.title ?? "Untitled job",
        `${j.user?.firstName ?? ""} ${j.user?.lastName ?? ""}`.trim() || "Client",
        j.category ?? "General",
        j.status,
        formatDateSafely(j.createdAt),
      ]),
    );
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

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            type="button"
            onClick={handleExportCsv}
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
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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
      const matchesDate = isWithinDateRange(row.createdAt, dateFilter);
      return matchesSearch && matchesKind && matchesDate;
    });
  }, [rows, search, kindFilter, dateFilter]);

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

  const handleExportCsv = () => {
    const rowsToExport =
      selectedList.length > 0 ? filteredRows.filter((r) => selectedIds.has(r.id)) : filteredRows;
    downloadCsv(
      "klick-pro-admin-financial-audit",
      [
        "Reference",
        "Kind",
        "Transaction Type",
        "Amount (INR)",
        "Status",
        "Parties Involved",
        "Timestamp",
      ],
      rowsToExport.map((r) => [
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
    );
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

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-indigo-600 focus:bg-white focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_year">This Year</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            type="button"
            onClick={handleExportCsv}
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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
              <FileText className="h-3.5 w-3.5" /> Enterprise Audit Center
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Platform Reports & Audit Ledgers
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Official compliance records of platform accounts, active marketplace job volume, and
              reconciled gross settlement transactions.
            </p>
          </div>

          <div className="flex gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            <button
              type="button"
              onClick={() => setTab("finance")}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                tab === "finance"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Financial Ledger
            </button>
            <button
              type="button"
              onClick={() => setTab("jobs")}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                tab === "jobs"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Jobs & Projects
            </button>
            <button
              type="button"
              onClick={() => setTab("users")}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                tab === "users"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              User Accounts
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
