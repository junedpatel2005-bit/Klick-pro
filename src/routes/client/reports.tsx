"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart } from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { SelectableReportTable } from "@/components/reports/SelectableReportTable";
import { useRowSelection } from "@/hooks/use-row-selection";

type Job = {
  id: number;
  title: string | null;
  status: "DRAFT" | "OPEN" | "RUNNING" | "CLOSED";
  projectId: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
  locationAddress: string | null;
  updatedAt: string;
};

type Payment = {
  id: number;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
};

function jobStatus(job: Job) {
  return job.projectId ? "RUNNING" : job.status;
}

function readableStatus(status: string) {
  return status === "RUNNING" ? "In progress" : status[0] + status.slice(1).toLowerCase();
}

function jobBudget(job: Job) {
  if (job.timingType === "HOURLY") {
    return job.hourlyRate == null ? "Rate not set" : `₹${job.hourlyRate.toLocaleString()}/hr`;
  }
  if (job.budgetMin == null && job.budgetMax == null) return "Budget not set";
  return `₹${job.budgetMin?.toLocaleString() ?? "—"} – ₹${job.budgetMax?.toLocaleString() ?? "—"}`;
}

function ProjectsReport() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/v1/client/jobs")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setJobs(data.jobs))
      .catch(() => setMessage("Your project data could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(jobs);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold">Project report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobs.length} {jobs.length === 1 ? "project" : "projects"} available
          </p>
        </div>
        <ExportMenu
          endpoint="/api/client/jobs/export"
          selectedIds={selectedList}
          fileBaseName="my-jobs"
        />
      </div>
      {message ? (
        <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <SelectableReportTable
          loading={loading}
          rows={jobs}
          emptyMessage="No projects to report on yet."
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
                <span className="font-medium">{job.title ?? `Untitled job #${job.id}`}</span>
              ),
            },
            { key: "status", header: "Status", render: (job) => readableStatus(jobStatus(job)) },
            { key: "budget", header: "Budget", render: (job) => jobBudget(job) },
            {
              key: "location",
              header: "Location",
              render: (job) => job.locationAddress ?? "Remote",
            },
            {
              key: "updatedAt",
              header: "Updated",
              align: "right",
              render: (job) => new Date(job.updatedAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    </>
  );
}

function PaymentsReport() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setPayments(data))
      .catch(() => setMessage("Your payment data could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(payments);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold">Payment report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {payments.length} {payments.length === 1 ? "payment" : "payments"} on record
          </p>
        </div>
        <ExportMenu
          endpoint="/api/client/payments/export"
          selectedIds={selectedList}
          fileBaseName="my-payments"
        />
      </div>
      {message ? (
        <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <SelectableReportTable
          loading={loading}
          rows={payments}
          emptyMessage="No payments to report on yet."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(payment) => payment.description}
          columns={[
            {
              key: "description",
              header: "Description",
              render: (payment) => <span className="font-medium">{payment.description}</span>,
            },
            { key: "type", header: "Type", render: (payment) => payment.type },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (payment) => `₹${payment.amount.toLocaleString()} ${payment.currency}`,
            },
            { key: "status", header: "Status", render: (payment) => payment.status },
            {
              key: "createdAt",
              header: "Date",
              align: "right",
              render: (payment) => new Date(payment.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    </>
  );
}

export default function ClientReports() {
  const [tab, setTab] = useState<"projects" | "payments">("projects");

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-[linear-gradient(115deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cta/20 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/65">
              <FileBarChart className="h-3.5 w-3.5" /> Client workspace
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Reports
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Export your projects and payments as a PDF — download everything, or pick specific
              rows.
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setTab("projects")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "projects" ? "bg-white text-primary" : "text-white/80 hover:text-white"}`}
            >
              Projects
            </button>
            <button
              type="button"
              onClick={() => setTab("payments")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "payments" ? "bg-white text-primary" : "text-white/80 hover:text-white"}`}
            >
              Payments
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {tab === "projects" ? <ProjectsReport /> : <PaymentsReport />}
      </section>
    </>
  );
}
