"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart } from "lucide-react";
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

function UsersReport() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/v1/admin/data/users", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(users);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          {users.length} {users.length === 1 ? "account" : "accounts"}
        </p>
        <ExportMenu
          endpoint="/api/admin/reports/users"
          selectedIds={selectedList}
          fileBaseName="users"
        />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50 [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70">
        <SelectableReportTable
          loading={loading}
          rows={users}
          emptyMessage="No accounts to report on yet."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(user) => `${user.firstName} ${user.lastName}`}
          columns={[
            {
              key: "name",
              header: "Name",
              render: (user) => (
                <span className="font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </span>
              ),
            },
            { key: "email", header: "Email", render: (user) => user.email },
            { key: "role", header: "Role", render: (user) => user.role },
            { key: "active", header: "Active", render: (user) => (user.isActive ? "Yes" : "No") },
            {
              key: "verified",
              header: "Verified",
              render: (user) => (user.isVerified ? "Yes" : "No"),
            },
            {
              key: "joined",
              header: "Joined",
              align: "right",
              render: (user) => new Date(user.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    </>
  );
}

function JobsReport() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/v1/admin/data/jobs", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setJobs(data.jobs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(jobs);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 font-medium">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
        </p>
        <ExportMenu
          endpoint="/api/admin/reports/jobs"
          selectedIds={selectedList}
          fileBaseName="jobs"
        />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50 [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70">
        <SelectableReportTable
          loading={loading}
          rows={jobs}
          emptyMessage="No jobs to report on yet."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(job) => job.title ?? "job"}
          columns={[
            {
              key: "title",
              header: "Title",
              render: (job) => (
                <span className="font-semibold text-slate-900">{job.title ?? "Untitled job"}</span>
              ),
            },
            {
              key: "client",
              header: "Client",
              render: (job) => `${job.user.firstName} ${job.user.lastName}`,
            },
            { key: "category", header: "Category", render: (job) => job.category ?? "General" },
            { key: "status", header: "Status", render: (job) => job.status },
            {
              key: "createdAt",
              header: "Created",
              align: "right",
              render: (job) => new Date(job.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    </>
  );
}

function FinanceReport() {
  const [rows, setRows] = useState<FinanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/v1/admin/data/finance", { cache: "no-store" })
      .then((response) => response.json())
      .then(
        (data: {
          transactions: {
            id: number;
            type: string;
            amount: number;
            currency: string;
            status: string;
            clientId: number;
            professionalId: number;
            createdAt: string;
          }[];
          withdrawals: {
            id: number;
            amount: number;
            currency: string;
            status: string;
            professionalId: number;
            createdAt: string;
          }[];
          names: Record<string, string>;
        }) => {
          const combined: FinanceRow[] = [
            ...data.transactions.map((item) => ({
              id: item.id,
              kind: "Payment" as const,
              type: item.type,
              amount: item.amount,
              currency: item.currency,
              status: item.status,
              party: `Client: ${data.names[item.clientId] ?? `#${item.clientId}`} · Professional: ${data.names[item.professionalId] ?? `#${item.professionalId}`}`,
              createdAt: item.createdAt,
            })),
            ...data.withdrawals.map((item) => ({
              id: item.id,
              kind: "Payout" as const,
              type: "Withdrawal",
              amount: item.amount,
              currency: item.currency,
              status: item.status,
              party: `Professional: ${data.names[item.professionalId] ?? `#${item.professionalId}`}`,
              createdAt: item.createdAt,
            })),
          ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setRows(combined);
        },
      )
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(rows);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 font-medium">
          {rows.length} {rows.length === 1 ? "record" : "records"} — payments and payouts
        </p>
        <ExportMenu
          endpoint="/api/admin/reports/finance"
          selectedIds={selectedList}
          fileBaseName="finance"
        />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xs [&_th]:text-slate-500 [&_th]:bg-slate-50 [&_tr]:border-slate-100 [&_tr:hover]:bg-slate-50/70">
        <SelectableReportTable
          loading={loading}
          rows={rows}
          emptyMessage="No financial activity to report on yet."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(row) => `${row.kind} ${row.id}`}
          columns={[
            { key: "kind", header: "Kind", render: (row) => row.kind },
            { key: "type", header: "Type", render: (row) => row.type },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (row) => `₹${row.amount.toLocaleString()} ${row.currency}`,
            },
            { key: "status", header: "Status", render: (row) => row.status },
            { key: "party", header: "Parties", render: (row) => row.party },
            {
              key: "createdAt",
              header: "Date",
              align: "right",
              render: (row) => new Date(row.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    </>
  );
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<"users" | "jobs" | "finance">("users");

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">Admin module</p>
      <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold text-slate-900">
        <FileBarChart className="h-6 w-6 text-indigo-600" /> Reports
      </h1>
      <p className="mt-2 text-slate-500">
        Export platform data as a PDF — download everything, or select specific rows.
      </p>

      <div className="mt-6 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xs lg:w-fit">
        {(
          [
            { key: "users", label: "Users & professionals" },
            { key: "jobs", label: "Jobs & projects" },
            { key: "finance", label: "Finance & payments" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === item.key
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "users" && <UsersReport />}
        {tab === "jobs" && <JobsReport />}
        {tab === "finance" && <FinanceReport />}
      </div>
    </div>
  );
}
