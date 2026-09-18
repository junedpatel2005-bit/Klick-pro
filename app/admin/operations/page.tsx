"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  MapPin,
  Power,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
type Job = {
  id: number;
  title: string | null;
  category: string | null;
  description: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
  urgency: string;
  workMode: string;
  locationLabel: string | null;
  status: string;
  createdAt: string;
  user: { firstName: string; lastName: string; email: string };
};
type Dispute = {
  id: number;
  issueType: string;
  priority: string;
  message: string;
  reporterRole: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};
type OperationsData = {
  jobs: Job[];
  disputes: Dispute[];
  stats: { totalJobs: number; openJobs: number; scheduledJobs: number };
};
type DisputeDetails = {
  dispute: Dispute & { trackingId: number; message: string };
  client: { id: number; firstName: string; lastName: string; email: string } | null;
  professional: { id: number; firstName: string; lastName: string; email: string } | null;
  job: { id: number; title: string | null } | null;
  project: {
    id: number;
    status: string;
    progress: number;
    currentStage: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  milestones: {
    id: number;
    title: string;
    amount: number;
    status: string;
    dueDate: string | null;
  }[];
  milestoneSummary: { completed: number; total: number };
  financial: {
    milestoneTotal: number;
    paidAmount: number;
    remainingAmount: number;
    approvedTotal: number;
    unpaidApproved: number;
  };
  messages: {
    id: number;
    senderId: number;
    senderRole: string;
    recipientId: number;
    message: string;
    createdAt: string;
  }[];
};
type JobDetails = Job & {
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
  locationAddress: string | null;
  jobDate: string | null;
  deadline: string | null;
  updatedAt: string;
  attachments: {
    id: number;
    fileName: string;
    fileType: string | null;
    fileSize: number | null;
    previewUrl: string | null;
  }[];
  _count: { favoriteJobs: number };
  user: Job["user"] & {
    id: number;
    phone: string | null;
    companyName: string | null;
    address: string | null;
    isVerified: boolean;
    createdAt: string;
  };
  proposals: {
    id: number;
    professionalId: number;
    bidAmount: number;
    duration: string;
    status: string;
    origin: string;
    createdAt: string;
    professional: { firstName: string; lastName: string; email: string } | null;
  }[];
  project: {
    id: number;
    status: string;
    progress: number;
    currentStage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    milestones: {
      id: number;
      title: string;
      description: string | null;
      amount: number;
      dueDate: string | null;
      status: string;
      approvedAt: string | null;
    }[];
    financial: { milestoneTotal: number; paidAmount: number; remainingAmount: number };
  } | null;
};

const date = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
const tone = (value: string) =>
  ({
    OPEN: "bg-emerald-50 text-emerald-700 ring-emerald-200 border border-emerald-200",
    CLOSED: "bg-slate-100 text-slate-700 ring-slate-200 border border-slate-200",
    DRAFT: "bg-slate-100 text-slate-700 ring-slate-200 border border-slate-200",
    PENDING: "bg-amber-50 text-amber-700 ring-amber-200 border border-amber-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200 border border-emerald-200",
    HIGH: "bg-rose-50 text-rose-700 ring-rose-200 border border-rose-200",
    MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200 border border-amber-200",
    LOW: "bg-sky-50 text-sky-700 ring-sky-200 border border-sky-200",
  })[value] ?? "bg-indigo-50 text-indigo-700 ring-indigo-200 border border-indigo-200";
const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const projectStage = (project: DisputeDetails["project"]) => {
  if (!project) return "No active project is linked to this dispute yet.";
  switch (project.status) {
    case "READY_TO_START":
      return "The project hasn't started yet — confirm work has begun.";
    case "IN_PROGRESS":
      return project.currentStage
        ? `Professional is working on "${project.currentStage}".`
        : "Work is in progress.";
    case "AWAITING_CLIENT_REVIEW":
      return project.currentStage
        ? `Waiting on the client to review "${project.currentStage}".`
        : "Waiting on the client to review submitted work.";
    case "REVISION_REQUESTED":
      return project.currentStage
        ? `Client requested revisions on "${project.currentStage}".`
        : "Client requested revisions.";
    case "COMPLETED":
      return "The project is complete.";
    default:
      return `Current project stage: ${label(project.status)}.`;
  }
};
const adminAction = (details: DisputeDetails) => {
  if (details.dispute.status === "RESOLVED")
    return "This dispute is marked resolved. Reopen it if the issue isn't actually fixed.";
  if (details.financial.unpaidApproved > 0)
    return `₹${details.financial.unpaidApproved.toLocaleString()} of approved milestone work hasn't been paid out yet. Verify the payment on the client's side and release funds to the professional, then mark this dispute resolved.`;
  if (details.milestones.length === 0)
    return "No milestones exist for this project yet. Confirm with the client and professional what payment structure was agreed, then follow up with whoever hasn't set it up.";
  return "All approved milestones appear paid. Contact both parties to clarify the reported issue, then mark this dispute resolved once it's addressed.";
};

export default function OperationsPage() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [view, setView] = useState<"jobs" | "disputes">("jobs");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selectedJob, setSelectedJob] = useState<JobDetails | null>(null);
  const [detailsStatus, setDetailsStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [confirmJobAction, setConfirmJobAction] = useState<{
    kind: "toggle" | "delete";
    job: JobDetails;
  } | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<DisputeDetails | null>(null);
  const [disputeDetailsStatus, setDisputeDetailsStatus] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [confirmDisputeAction, setConfirmDisputeAction] = useState<DisputeDetails | null>(null);

  const load = () => {
    void fetch("/api/v1/admin/data/jobs", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) =>
        setData({
          jobs: result.jobs ?? [],
          disputes: result.disputes ?? [],
          stats: result.stats ?? { totalJobs: 0, openJobs: 0, scheduledJobs: 0 },
        }),
      )
      .catch(() =>
        setData({ jobs: [], disputes: [], stats: { totalJobs: 0, openJobs: 0, scheduledJobs: 0 } }),
      );
  };

  useEffect(() => {
    load();
    window.addEventListener("servio:admin-operations-update", load);
    window.addEventListener("servio:project-update", load);
    window.addEventListener("servio:notification", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("servio:admin-operations-update", load);
      window.removeEventListener("servio:project-update", load);
      window.removeEventListener("servio:notification", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const jobs = useMemo(
    () =>
      (data?.jobs ?? []).filter((job) => {
        const text =
          `${job.title} ${job.category} ${job.user.firstName} ${job.user.lastName} ${job.locationLabel}`.toLowerCase();
        return text.includes(query.toLowerCase()) && (filter === "ALL" || job.status === filter);
      }),
    [data, query, filter],
  );
  const disputes = useMemo(
    () =>
      (data?.disputes ?? []).filter((dispute) => {
        const text =
          `${dispute.issueType} ${dispute.message} ${dispute.reporterRole}`.toLowerCase();
        return (
          text.includes(query.toLowerCase()) &&
          (filter === "ALL" || dispute.status === filter || dispute.priority === filter)
        );
      }),
    [data, query, filter],
  );
  const openDisputes = data?.disputes.filter((item) => item.status === "OPEN").length ?? 0;
  const runningProjects = data?.jobs.filter((item) => item.status === "RUNNING").length ?? 0;
  const completedProjects = data?.jobs.filter((item) => item.status === "COMPLETED").length ?? 0;
  const options =
    view === "jobs"
      ? ["ALL", "OPEN", "RUNNING", "COMPLETED", "DRAFT", "CLOSED"]
      : ["ALL", "OPEN", "RESOLVED", "HIGH", "MEDIUM", "LOW"];

  async function openJob(id: number) {
    setDetailsStatus("loading");
    setSelectedJob(null);
    try {
      const response = await fetch(`/api/v1/admin/jobs/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load job details");
      const result = await response.json();
      setSelectedJob(result.job);
      setDetailsStatus("idle");
    } catch {
      setDetailsStatus("error");
    }
  }

  async function openDispute(id: number) {
    setDisputeDetailsStatus("loading");
    setSelectedDispute(null);
    try {
      const response = await fetch(`/api/v1/admin/disputes/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load dispute details");
      const result = await response.json();
      setSelectedDispute(result);
      setDisputeDetailsStatus("idle");
    } catch {
      setDisputeDetailsStatus("error");
    }
  }

  async function toggleDisputeStatus(details: DisputeDetails) {
    const nextStatus = details.dispute.status === "RESOLVED" ? "OPEN" : "RESOLVED";
    const response = await fetch(`/api/v1/admin/disputes/${details.dispute.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Unable to update dispute.");
    setSelectedDispute((current) =>
      current
        ? { ...current, dispute: { ...current.dispute, status: data.dispute.status } }
        : current,
    );
    setData((current) =>
      current
        ? {
            ...current,
            disputes: current.disputes.map((item) =>
              item.id === details.dispute.id ? { ...item, status: data.dispute.status } : item,
            ),
          }
        : current,
    );
    setMessage(`Case #${details.dispute.id} is now ${label(data.dispute.status)}.`);
  }

  async function toggleJobStatus(job: JobDetails) {
    const nextStatus = job.status === "CLOSED" ? "OPEN" : "CLOSED";
    const response = await fetch(`/api/v1/admin/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Unable to update job.");
    setSelectedJob((current) =>
      current && current.id === job.id ? { ...current, status: data.job.status } : current,
    );
    setData((current) =>
      current
        ? {
            ...current,
            jobs: current.jobs.map((item) =>
              item.id === job.id ? { ...item, status: data.job.status } : item,
            ),
          }
        : current,
    );
    setMessage(`"${job.title ?? `Job #${job.id}`}" is now ${label(data.job.status)}.`);
  }

  async function deleteJob(job: JobDetails) {
    const response = await fetch(`/api/v1/admin/jobs/${job.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Unable to delete job.");
    setData((current) =>
      current ? { ...current, jobs: current.jobs.filter((item) => item.id !== job.id) } : current,
    );
    setSelectedJob((current) => (current?.id === job.id ? null : current));
    setDetailsStatus("idle");
    setMessage(`"${job.title ?? `Job #${job.id}`}" was deleted.`);
  }

  return (
    <div className="pb-5">
      <div className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 px-6 py-7 sm:px-8 shadow-xs">
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-indigo-600">
              Marketplace operations
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Jobs & disputes
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-500">
              Monitor marketplace demand and keep service issues moving to resolution.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-500">Operations health</p>
              <p className="text-sm font-semibold text-slate-900">All systems active</p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}

      {!data ? (
        <div className="mt-6 h-80 animate-pulse rounded-3xl bg-slate-100" />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              icon={BriefcaseBusiness}
              label="Total jobs"
              value={data.stats.totalJobs}
              detail={`${data.stats.openJobs} currently open`}
              color="indigo"
              onClick={() => {
                setView("jobs");
                setFilter("ALL");
              }}
            />
            <Metric
              icon={CalendarDays}
              label="Scheduled jobs"
              value={data.stats.scheduledJobs}
              detail="Future-dated open jobs"
              color="amber"
              onClick={() => {
                setView("jobs");
                setFilter("ALL");
              }}
            />
            <Metric
              icon={Clock3}
              label="Open disputes"
              value={openDisputes}
              detail="Need team attention"
              color="amber"
              onClick={() => {
                setView("disputes");
                setFilter("OPEN");
              }}
            />
            <Metric
              icon={BriefcaseBusiness}
              label="Running projects"
              value={runningProjects}
              detail="Currently in progress"
              color="indigo"
              onClick={() => {
                setView("jobs");
                setFilter("RUNNING");
              }}
            />
            <Metric
              icon={CheckCircle2}
              label="Completed projects"
              value={completedProjects}
              detail="Finished work"
              color="emerald"
              onClick={() => {
                setView("jobs");
                setFilter("COMPLETED");
              }}
            />
          </div>

          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 pt-5 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold text-slate-900">
                    Operations queue
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review the latest marketplace activity in one place.
                  </p>
                </div>
                <span className="rounded-full bg-slate-200/70 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {view === "jobs" ? jobs.length : disputes.length} records
                </span>
              </div>
              <div className="mt-5 flex gap-1">
                <Tab
                  active={view === "jobs"}
                  onClick={() => {
                    setView("jobs");
                    setFilter("ALL");
                  }}
                  icon={BriefcaseBusiness}
                  label="Jobs"
                  count={data.jobs.length}
                />
                <Tab
                  active={view === "disputes"}
                  onClick={() => {
                    setView("disputes");
                    setFilter("ALL");
                  }}
                  icon={CircleAlert}
                  label="Disputes"
                  count={data.disputes.length}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:px-6">
              <label className="relative block flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    view === "jobs"
                      ? "Search jobs, clients, locations..."
                      : "Search issue type or reporter..."
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                />
              </label>
              <div className="flex items-center gap-2 overflow-x-auto">
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
                {options.map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filter === item
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {label(item)}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {view === "jobs"
                ? jobs.map((job) => <JobRow key={job.id} job={job} onOpen={openJob} />)
                : disputes.map((dispute) => (
                    <DisputeRow key={dispute.id} dispute={dispute} onOpen={openDispute} />
                  ))}
              {(view === "jobs" ? jobs : disputes).length === 0 && <Empty view={view} />}
            </div>
          </section>
        </>
      )}
      {(selectedJob || detailsStatus !== "idle") && (
        <JobDetailsPanel
          job={selectedJob}
          status={detailsStatus}
          onClose={() => {
            setSelectedJob(null);
            setDetailsStatus("idle");
          }}
          onToggle={(job) => setConfirmJobAction({ kind: "toggle", job })}
          onDelete={(job) => setConfirmJobAction({ kind: "delete", job })}
        />
      )}
      {confirmJobAction && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {confirmJobAction.kind === "delete"
                ? "Delete job?"
                : confirmJobAction.job.status === "CLOSED"
                  ? "Enable job?"
                  : "Disable job?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirmJobAction.kind === "delete"
                ? `"${confirmJobAction.job.title ?? `Job #${confirmJobAction.job.id}`}" and its attachments will be permanently deleted. This cannot be undone.`
                : confirmJobAction.job.status === "CLOSED"
                  ? `"${confirmJobAction.job.title ?? `Job #${confirmJobAction.job.id}`}" will become visible on the marketplace again.`
                  : `"${confirmJobAction.job.title ?? `Job #${confirmJobAction.job.id}`}" will be hidden from the marketplace.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => setConfirmJobAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className={
                  confirmJobAction.kind === "delete" || confirmJobAction.job.status !== "CLOSED"
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }
                onClick={() => {
                  const { kind, job } = confirmJobAction;
                  setConfirmJobAction(null);
                  if (kind === "delete") void deleteJob(job);
                  else void toggleJobStatus(job);
                }}
              >
                {confirmJobAction.kind === "delete"
                  ? "Delete"
                  : confirmJobAction.job.status === "CLOSED"
                    ? "Enable"
                    : "Disable"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {(selectedDispute || disputeDetailsStatus !== "idle") && (
        <DisputeDetailsPanel
          details={selectedDispute}
          status={disputeDetailsStatus}
          onClose={() => {
            setSelectedDispute(null);
            setDisputeDetailsStatus("idle");
          }}
          onToggle={(details) => setConfirmDisputeAction(details)}
        />
      )}
      {confirmDisputeAction && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {confirmDisputeAction.dispute.status === "RESOLVED"
                ? "Reopen dispute?"
                : "Mark dispute resolved?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirmDisputeAction.dispute.status === "RESOLVED"
                ? `Case #${confirmDisputeAction.dispute.id} will be reopened and flagged for attention again.`
                : `Case #${confirmDisputeAction.dispute.id} will be marked resolved and cleared from the open queue.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => setConfirmDisputeAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className={
                  confirmDisputeAction.dispute.status === "RESOLVED"
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }
                onClick={() => {
                  const details = confirmDisputeAction;
                  setConfirmDisputeAction(null);
                  void toggleDisputeStatus(details);
                }}
              >
                {confirmDisputeAction.dispute.status === "RESOLVED" ? "Reopen" : "Resolve"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label: text,
  value,
  detail,
  color,
  onClick,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: number;
  detail: string;
  color: "indigo" | "amber" | "rose" | "emerald";
  onClick: () => void;
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl border ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{text}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </button>
  );
}
function Tab({
  active,
  onClick,
  icon: Icon,
  label: text,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BriefcaseBusiness;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition ${
        active ? "text-indigo-600" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <Icon className="h-4 w-4" />
      {text}
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
          active ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-600"
        }`}
      >
        {count}
      </span>
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-indigo-600" />}
    </button>
  );
}
function JobRow({ job, onOpen }: { job: Job; onOpen: (id: number) => void }) {
  const budget =
    job.timingType === "HOURLY"
      ? job.hourlyRate != null
        ? `₹${job.hourlyRate.toLocaleString()}/hr`
        : "Rate not set"
      : job.budgetMin || job.budgetMax
        ? `₹${(job.budgetMin ?? 0).toLocaleString()} – ₹${(job.budgetMax ?? job.budgetMin ?? 0).toLocaleString()}`
        : "Budget not set";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void onOpen(job.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") void onOpen(job.id);
      }}
      className="group flex w-full cursor-pointer flex-wrap items-center gap-x-5 gap-y-4 px-5 py-5 text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 sm:px-6"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100">
        <BriefcaseBusiness className="h-5 w-5" />
      </span>
      <div className="min-w-56 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900">{job.title ?? `Untitled job #${job.id}`}</h3>
          <Badge value={job.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {job.category ?? "General"} <span className="mx-1.5 text-slate-300">•</span>{" "}
          <span className="font-medium text-slate-700">
            {job.user.firstName} {job.user.lastName}
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {job.locationLabel ?? "Location not set"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            Posted {date(job.createdAt)}
          </span>
        </div>
      </div>
      <div className="min-w-36 sm:text-right">
        <p className="text-sm font-bold text-slate-900">{budget}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">
          {label(job.workMode)} · {label(job.urgency)} priority
        </p>
      </div>
      <ChevronRight className="hidden h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600 sm:block" />
    </div>
  );
}
function DisputeRow({ dispute, onOpen }: { dispute: Dispute; onOpen: (id: number) => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => void onOpen(dispute.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") void onOpen(dispute.id);
      }}
      className="group flex w-full cursor-pointer flex-wrap items-center gap-x-5 gap-y-4 px-5 py-5 text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 sm:px-6"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-700 border border-rose-100">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div className="min-w-56 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900">{label(dispute.issueType)}</h3>
          <Badge value={dispute.status} />
          <Badge value={dispute.priority} />
        </div>
        <p className="mt-1 line-clamp-1 max-w-2xl text-sm text-slate-600">{dispute.message}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <UserRound className="h-3.5 w-3.5 text-slate-400" />
          Reported by {label(dispute.reporterRole)} <span className="mx-1 text-slate-300">•</span>{" "}
          {date(dispute.createdAt)}
        </p>
      </div>
      <div className="min-w-36 sm:text-right">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Case #{dispute.id}
        </p>
        <p className="mt-1 text-sm font-medium text-slate-700">Updated {date(dispute.updatedAt)}</p>
      </div>
      <ChevronRight className="hidden h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600 sm:block" />
    </article>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone(value)}`}
    >
      {label(value)}
    </span>
  );
}
function Empty({ view }: { view: "jobs" | "disputes" }) {
  const Icon = view === "jobs" ? BriefcaseBusiness : CheckCircle2;
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 font-semibold text-slate-900">No matching {view} found</p>
      <p className="mt-1 text-sm text-slate-500">Try changing the search or status filter.</p>
    </div>
  );
}

function JobDetailsPanel({
  job,
  status,
  onClose,
  onToggle,
  onDelete,
}: {
  job: JobDetails | null;
  status: "idle" | "loading" | "error";
  onClose: () => void;
  onToggle: (job: JobDetails) => void;
  onDelete: (job: JobDetails) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-details-title"
    >
      <section
        className="admin-job-details-scroll max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
        aria-live="polite"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-5 sm:px-6 backdrop-blur-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
              Job details
            </p>
            <h2 id="job-details-title" className="mt-1 text-xl font-bold text-slate-900">
              {job?.title ?? (status === "loading" ? "Loading job…" : "Job details")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {job && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggle(job)}
                  className={
                    job.status === "CLOSED"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }
                >
                  <Power className="mr-2 h-3.5 w-3.5" />
                  {job.status === "CLOSED" ? "Enable job" : "Disable job"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onDelete(job)}
                  className="border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Delete job
                </Button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close job details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {status === "loading" ? <div className="h-72 animate-pulse bg-slate-100" /> : null}
        {status === "error" ? (
          <p className="p-6 text-sm text-rose-700">
            Job details could not be loaded. Please try again.
          </p>
        ) : null}
        {job ? (
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={job.status} />
                <Badge value={job.urgency} />
                <span className="text-sm text-slate-500 font-medium">
                  Job #{job.id} · Updated {date(job.updatedAt)}
                </span>
              </div>
              <DetailGrid
                items={[
                  ["Category", job.category ?? "General"],
                  ["Work mode", label(job.workMode)],
                  [
                    "Budget",
                    job.timingType === "HOURLY"
                      ? job.hourlyRate == null
                        ? "Not set"
                        : `₹${job.hourlyRate.toLocaleString()}/hr`
                      : `₹${job.budgetMin?.toLocaleString() ?? "—"} – ₹${job.budgetMax?.toLocaleString() ?? "—"}`,
                  ],
                  ["Location", job.locationAddress ?? job.locationLabel ?? "Not set"],
                  ["Job date", job.jobDate ? date(job.jobDate) : "Not set"],
                  ["Deadline", job.deadline ? date(job.deadline) : "Not set"],
                  ["Posted", date(job.createdAt)],
                  ["Saved", `${job._count.favoriteJobs} times`],
                ]}
              />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 bg-slate-50/70 p-4 rounded-xl border border-slate-200">
                  {job.description ?? "No description was provided."}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Proposals ({job.proposals.length})
                </h3>
                <div className="mt-3 space-y-2">
                  {job.proposals.length ? (
                    job.proposals.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {proposal.professional
                              ? `${proposal.professional.firstName} ${proposal.professional.lastName}`
                              : `Professional #${proposal.professionalId}`}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {proposal.duration} · {date(proposal.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge value={proposal.status} />
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            ₹{proposal.bidAmount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      No proposals have been submitted.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Attachments ({job.attachments.length})
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.attachments.length ? (
                    job.attachments.map((attachment) =>
                      attachment.previewUrl ? (
                        <a
                          key={attachment.id}
                          href={attachment.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          {attachment.fileName}
                        </a>
                      ) : (
                        <span
                          key={attachment.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          {attachment.fileName}
                        </span>
                      ),
                    )
                  ) : (
                    <p className="text-sm text-slate-500">No attachments.</p>
                  )}
                </div>
              </div>
            </div>
            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <h3 className="text-sm font-semibold text-slate-900">Client information</h3>
              <p className="mt-3 font-semibold text-slate-900">
                {job.user.firstName} {job.user.lastName}
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>{job.user.email}</p>
                <p>{job.user.phone ?? "Phone not provided"}</p>
                <p>{job.user.companyName ?? "No company listed"}</p>
                <p>{job.user.address ?? "Address not provided"}</p>
                <p className="pt-2 text-xs text-slate-500 border-t border-slate-200">
                  Account created {date(job.user.createdAt)} ·{" "}
                  <span className="font-semibold text-slate-700">
                    {job.user.isVerified ? "Verified" : "Not verified"}
                  </span>
                </p>
              </div>
              {job.project ? (
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <h3 className="text-sm font-semibold text-slate-900">Project status</h3>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {label(job.project.status)} · {job.project.progress}% complete
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {job.project.currentStage ?? "No current stage"}
                  </p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                      <dt className="text-[10px] uppercase font-semibold text-slate-500">
                        Milestones
                      </dt>
                      <dd className="mt-1 text-sm font-bold text-slate-900">
                        {job.project.milestones.length}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                      <dt className="text-[10px] uppercase font-semibold text-slate-500">Paid</dt>
                      <dd className="mt-1 text-sm font-bold text-slate-900">
                        ₹{job.project.financial.paidAmount.toLocaleString()}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                      <dt className="text-[10px] uppercase font-semibold text-slate-500">
                        Remaining
                      </dt>
                      <dd className="mt-1 text-sm font-bold text-slate-900">
                        ₹{job.project.financial.remainingAmount.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Milestone work
                    </h4>
                    {job.project.milestones.length ? (
                      job.project.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {milestone.title}
                            </p>
                            <Badge value={milestone.status} />
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            ₹{milestone.amount.toLocaleString()}
                            {milestone.dueDate ? ` · Due ${date(milestone.dueDate)}` : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500">No milestones added.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-x-5 gap-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
      {items.map(([term, definition]) => (
        <div key={term}>
          <dt className="text-xs uppercase font-semibold tracking-wider text-slate-500">{term}</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{definition}</dd>
        </div>
      ))}
    </dl>
  );
}

function DisputeDetailsPanel({
  details,
  status,
  onClose,
  onToggle,
}: {
  details: DisputeDetails | null;
  status: "idle" | "loading" | "error";
  onClose: () => void;
  onToggle: (details: DisputeDetails) => void;
}) {
  const dispute = details?.dispute;
  const [recipient, setRecipient] = useState<"CLIENT" | "PROFESSIONAL">("CLIENT");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  async function sendAdminMessage() {
    if (!details || !draft.trim()) return;
    setSending(true);
    setSendMessage("");
    try {
      const response = await fetch(`/api/v1/admin/disputes/${details.dispute.id}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient, message: draft.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to send message.");
      setDraft("");
      setSendMessage("Message sent and notification delivered.");
    } catch (error) {
      setSendMessage(error instanceof Error ? error.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dispute-details-title"
    >
      <section
        className="admin-job-details-scroll max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
        aria-live="polite"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-5 sm:px-6 backdrop-blur-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
              Dispute details
            </p>
            <h2 id="dispute-details-title" className="mt-1 text-xl font-bold text-slate-900">
              {dispute
                ? label(dispute.issueType)
                : status === "loading"
                  ? "Loading dispute…"
                  : "Dispute details"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {details && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onToggle(details)}
                className={
                  details.dispute.status === "RESOLVED"
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }
              >
                {details.dispute.status === "RESOLVED" ? "Reopen dispute" : "Mark resolved"}
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close dispute details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {status === "loading" ? <div className="h-72 animate-pulse bg-slate-100" /> : null}
        {status === "error" ? (
          <p className="p-6 text-sm text-rose-700">
            Dispute details could not be loaded. Please try again.
          </p>
        ) : null}
        {details && dispute ? (
          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={dispute.status} />
                <Badge value={dispute.priority} />
                <span className="text-sm text-slate-500 font-medium">
                  Case #{dispute.id} · Updated {date(dispute.updatedAt)}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Reported issue</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {dispute.message}
                </p>
                <p className="mt-2 text-xs text-slate-500 font-medium">
                  Reported by {label(dispute.reporterRole)} · {date(dispute.createdAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Contact participants</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Send a message directly to the selected participant. They will receive a
                  notification.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={recipient === "CLIENT" ? "default" : "outline"}
                    onClick={() => setRecipient("CLIENT")}
                    className={
                      recipient === "CLIENT"
                        ? "bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }
                  >
                    Message client
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={recipient === "PROFESSIONAL" ? "default" : "outline"}
                    onClick={() => setRecipient("PROFESSIONAL")}
                    className={
                      recipient === "PROFESSIONAL"
                        ? "bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }
                  >
                    Message professional
                  </Button>
                </div>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Write a message to the ${recipient.toLowerCase()}...`}
                  className="mt-3 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 shadow-2xs"
                  maxLength={4000}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">{draft.length}/4000</p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={sendAdminMessage}
                    disabled={sending || !draft.trim()}
                    className="bg-indigo-600 text-white hover:bg-indigo-500 shadow-2xs disabled:opacity-50"
                  >
                    {sending
                      ? "Sending..."
                      : `Send to ${recipient === "CLIENT" ? "client" : "professional"}`}
                  </Button>
                </div>
                {sendMessage ? (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">{sendMessage}</p>
                ) : null}
                {details.messages.length ? (
                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Message history
                    </p>
                    {details.messages.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-2xs"
                      >
                        <p className="text-[11px] font-bold uppercase text-indigo-700">
                          {label(item.senderRole)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{item.message}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{date(item.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
                <h3 className="text-sm font-semibold text-indigo-800">What you should do next</h3>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                  {adminAction(details)}
                </p>
                <p className="mt-3 border-t border-indigo-200/80 pt-3 text-xs font-medium text-slate-600">
                  Project status: {projectStage(details.project)}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Milestones ({details.milestoneSummary.completed} of{" "}
                  {details.milestoneSummary.total} completed)
                </h3>
                <div className="mt-3 space-y-2">
                  {details.milestones.length ? (
                    details.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{milestone.title}</p>
                          <p className="text-xs text-slate-500">
                            {milestone.dueDate ? `Due ${date(milestone.dueDate)}` : "No due date"}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge value={milestone.status} />
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            ₹{milestone.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      No milestones were created yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <aside className="h-fit space-y-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Job</h3>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {details.job?.title ?? "Untitled job"}
                </p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Client</h3>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {details.client
                    ? `${details.client.firstName} ${details.client.lastName}`
                    : "Unknown"}
                </p>
                <p className="text-xs text-slate-500">{details.client?.email}</p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Professional</h3>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {details.professional
                    ? `${details.professional.firstName} ${details.professional.lastName}`
                    : "Unknown"}
                </p>
                <p className="text-xs text-slate-500">{details.professional?.email}</p>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                    <dt className="text-[10px] uppercase font-semibold text-slate-500">Paid</dt>
                    <dd className="mt-1 text-sm font-bold text-slate-900">
                      ₹{details.financial.paidAmount.toLocaleString()}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                    <dt className="text-[10px] uppercase font-semibold text-slate-500">
                      Remaining
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-slate-900">
                      ₹{details.financial.remainingAmount.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}
