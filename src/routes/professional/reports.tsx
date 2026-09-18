"use client";

import { useEffect, useMemo, useState } from "react";
import { FileBarChart } from "lucide-react";
import { ExportMenu } from "@/components/reports/ExportMenu";
import { SelectableReportTable } from "@/components/reports/SelectableReportTable";
import { useRowSelection } from "@/hooks/use-row-selection";

type RunningProject = {
  id: number;
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
};

function displayStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(project: RunningProject) {
  if (project.budget == null) return "Amount pending";
  return project.timingType === "HOURLY"
    ? `₹${project.budget.toLocaleString()}/hr`
    : `₹${project.budget.toLocaleString()}`;
}

function ProjectsReport() {
  const [projects, setProjects] = useState<RunningProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/v1/portal/professional-jobs", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { activeProjects?: RunningProject[] }) => setProjects(data.activeProjects ?? []))
      .catch(() => setError("Your project data could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(projects);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold">Project report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {projects.length} active {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        <ExportMenu
          endpoint="/api/professional/jobs/export"
          selectedIds={selectedList}
          fileBaseName="running-projects"
        />
      </div>
      {error ? (
        <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <SelectableReportTable
          loading={loading}
          rows={projects}
          emptyMessage="No active projects to report on yet."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(project) => project.jobTitle ?? "project"}
          columns={[
            {
              key: "jobTitle",
              header: "Job title",
              render: (project) => (
                <span className="font-medium">{project.jobTitle ?? `Project #${project.id}`}</span>
              ),
            },
            {
              key: "clientName",
              header: "Client",
              render: (project) => project.clientName ?? "Client",
            },
            { key: "status", header: "Status", render: (project) => displayStatus(project.status) },
            {
              key: "deadline",
              header: "Deadline",
              render: (project) =>
                project.deadline ? new Date(project.deadline).toLocaleDateString() : "—",
            },
            { key: "budget", header: "Budget", render: (project) => money(project) },
            {
              key: "progress",
              header: "Progress",
              align: "right",
              render: (project) => `${project.progress}%`,
            },
          ]}
        />
      </div>
    </>
  );
}

function EarningsReport() {
  const [items, setItems] = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/v1/portal/earnings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => setItems(data))
      .catch(() => setError("Your earnings data could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  const { selectedIds, toggle, allVisibleSelected, toggleAllVisible } = useRowSelection(items);
  const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <>
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold">Earnings report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? "record" : "records"} — earnings and payouts
          </p>
        </div>
        <ExportMenu
          endpoint="/api/professional/earnings/export"
          selectedIds={selectedList}
          fileBaseName="my-earnings"
        />
      </div>
      {error ? (
        <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border">
        <SelectableReportTable
          loading={loading}
          rows={items}
          emptyMessage="No earnings to report on yet."
          selectedIds={selectedIds}
          onToggle={toggle}
          allSelected={allVisibleSelected}
          onToggleAll={toggleAllVisible}
          rowLabel={(item) => item.description}
          columns={[
            {
              key: "description",
              header: "Description",
              render: (item) => <span className="font-medium">{item.description}</span>,
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (item) => `₹${item.amount.toLocaleString()} ${item.currency}`,
            },
            { key: "status", header: "Status", render: (item) => item.status },
            {
              key: "createdAt",
              header: "Date",
              align: "right",
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
          ]}
        />
      </div>
    </>
  );
}

export default function ProfessionalReports() {
  const [tab, setTab] = useState<"projects" | "earnings">("projects");

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full bg-cta/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/65">
              <FileBarChart className="h-3.5 w-3.5" /> Professional workspace
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Reports
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
              Export your projects and earnings as a PDF — download everything, or pick specific
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
              onClick={() => setTab("earnings")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === "earnings" ? "bg-white text-primary" : "text-white/80 hover:text-white"}`}
            >
              Earnings
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        {tab === "projects" ? <ProjectsReport /> : <EarningsReport />}
      </section>
    </div>
  );
}
