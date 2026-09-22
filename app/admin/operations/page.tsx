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
  Database,
  ExternalLink,
  FileCheck,
  Gavel,
  Layers,
  MapPin,
  MessageSquare,
  Paperclip,
  PlayCircle,
  Power,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type AdminTimelineItem = {
  id: string;
  type:
    | "PAYMENT"
    | "MILESTONE_COMPLETED"
    | "PROOF_SUBMITTED"
    | "PROJECT_COMPLETED"
    | "WORK_STARTED"
    | "MILESTONE_CREATED"
    | "REVISION_REQUESTED"
    | "PROGRESS_UPDATE"
    | "JOB_POSTED"
    | "PROFESSIONAL_HIRED"
    | "OTHER";
  title: string;
  description?: string | null;
  amount?: number | null;
  actorRole?: "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM";
  actorName?: string | null;
  createdAt: string;
  status?: string | null;
  stage?: string | null;
  progress?: number | null;
  files?: Array<{ name: string; url?: string | null }>;
};
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
  trackingId?: number;
  milestoneId?: number | null;
  issueType: string;
  priority: string;
  message: string;
  reporterRole: string;
  status: string;
  disputeRound?: number;
  decision?: string | null;
  decisionReason?: string | null;
  refundAmount?: number | null;
  payoutAmount?: number | null;
  createdAt: string;
  updatedAt: string;
};
type OperationsData = {
  jobs: Job[];
  disputes: Dispute[];
  stats: { totalJobs: number; openJobs: number; scheduledJobs: number };
};
type DisputeDetails = {
  dispute: Dispute & {
    trackingId: number;
    disputeRound?: number;
    message: string;
    evidence?: Array<{
      id?: number;
      name: string;
      url: string;
      mimeType?: string;
      sizeBytes?: number;
    }>;
    responseMessage?: string | null;
    responseEvidence?: Array<{
      id?: number;
      name: string;
      url: string;
      mimeType?: string;
      sizeBytes?: number;
    }>;
    respondedAt?: string | null;
    respondentAction?: string | null;
    decision?: string | null;
    decisionReason?: string | null;
    decisionAt?: string | null;
    refundAmount?: number | null;
    payoutAmount?: number | null;
  };
  disputeCount?: number;
  disputeLimit?: number;
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
    description?: string | null;
    submittedAt?: string | null;
    approvedAt?: string | null;
  }[];
  payments?: {
    id: number;
    amount: number;
    baseAmount: number;
    professionalPayoutAmount?: number | null;
    status: string;
    milestoneId: number | null;
    provider?: string;
    capturedAt?: string | null;
    createdAt: string;
  }[];
  workUploads?: {
    id: number;
    milestoneId: number | null;
    roundNumber: number;
    title: string;
    note: string | null;
    fileName: string | null;
    fileUrl: string | null;
    filesJson?: string | null;
    createdAt: string;
    status: string;
  }[];
  clientWalletBalance?: number;
  milestoneSummary: { completed: number; total: number };
  financial: {
    milestoneTotal: number;
    paidAmount: number;
    inEscrow?: number;
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
  timeline?: AdminTimelineItem[];
};

const date = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
const formatDateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
};
function getTimelineNodeConfig(type: AdminTimelineItem["type"]) {
  switch (type) {
    case "PAYMENT":
      return {
        label: "Payment",
        icon: Wallet,
        iconBg: "bg-emerald-500",
        iconColor: "text-white",
        badgeStyle: "bg-emerald-100 text-emerald-800",
      };
    case "MILESTONE_COMPLETED":
      return {
        label: "Milestone Completed",
        icon: CheckCircle2,
        iconBg: "bg-indigo-600",
        iconColor: "text-white",
        badgeStyle: "bg-indigo-100 text-indigo-800",
      };
    case "PROOF_SUBMITTED":
      return {
        label: "Proof Submitted",
        icon: Upload,
        iconBg: "bg-sky-500",
        iconColor: "text-white",
        badgeStyle: "bg-sky-100 text-sky-800",
      };
    case "PROJECT_COMPLETED":
      return {
        label: "Project Completed",
        icon: Sparkles,
        iconBg: "bg-purple-600",
        iconColor: "text-white",
        badgeStyle: "bg-purple-100 text-purple-800",
      };
    case "WORK_STARTED":
      return {
        label: "Work Started",
        icon: PlayCircle,
        iconBg: "bg-amber-500",
        iconColor: "text-white",
        badgeStyle: "bg-amber-100 text-amber-800",
      };
    case "JOB_POSTED":
      return {
        label: "Job Posted",
        icon: BriefcaseBusiness,
        iconBg: "bg-slate-700",
        iconColor: "text-white",
        badgeStyle: "bg-slate-100 text-slate-700",
      };
    case "PROFESSIONAL_HIRED":
      return {
        label: "Professional Hired",
        icon: UserCheck,
        iconBg: "bg-teal-600",
        iconColor: "text-white",
        badgeStyle: "bg-teal-100 text-teal-800",
      };
    case "REVISION_REQUESTED":
      return {
        label: "Revision Requested",
        icon: AlertTriangle,
        iconBg: "bg-rose-500",
        iconColor: "text-white",
        badgeStyle: "bg-rose-100 text-rose-800",
      };
    case "PROGRESS_UPDATE":
      return {
        label: "Progress Update",
        icon: Clock3,
        iconBg: "bg-blue-500",
        iconColor: "text-white",
        badgeStyle: "bg-blue-100 text-blue-800",
      };
    default:
      return {
        label: "Activity",
        icon: Layers,
        iconBg: "bg-slate-400",
        iconColor: "text-white",
        badgeStyle: "bg-slate-100 text-slate-600",
      };
  }
}
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

  async function executeDisputeDecision(
    details: DisputeDetails,
    decision: "CLIENT_WINS" | "PROFESSIONAL_WINS",
    reason: string,
    refundAmount?: number,
    payoutAmount?: number,
    milestoneId?: number,
  ) {
    const response = await fetch(`/api/v1/admin/disputes/${details.dispute.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision,
        reason,
        refundAmount,
        payoutAmount,
        milestoneId,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to execute dispute decision.");

    setSelectedDispute((current) =>
      current && current.dispute.id === details.dispute.id
        ? {
            ...current,
            dispute: {
              ...current.dispute,
              ...data.dispute,
              status: "RESOLVED",
            },
          }
        : current,
    );
    setData((current) =>
      current
        ? {
            ...current,
            disputes: current.disputes.map((item) =>
              item.id === details.dispute.id
                ? { ...item, ...data.dispute, status: "RESOLVED" }
                : item,
            ),
          }
        : current,
    );
    setMessage(
      `Case #${details.dispute.id} decided: ${decision === "CLIENT_WINS" ? "Client Wins (Refunded)" : "Freelancer Wins (Released)"}.`,
    );
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
          onDecide={(details, decision, reason, refund, payout) =>
            executeDisputeDecision(details, decision, reason, refund, payout)
          }
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

function JobTimelineSection({ timeline }: { timeline: AdminTimelineItem[] }) {
  const [filter, setFilter] = useState<"ALL" | "PAYMENT" | "MILESTONE" | "PROOF" | "COMPLETION">(
    "ALL",
  );

  const filteredTimeline = useMemo(() => {
    if (filter === "ALL") return timeline;
    if (filter === "PAYMENT") return timeline.filter((item) => item.type === "PAYMENT");
    if (filter === "MILESTONE")
      return timeline.filter(
        (item) => item.type === "MILESTONE_COMPLETED" || item.type === "MILESTONE_CREATED",
      );
    if (filter === "PROOF") return timeline.filter((item) => item.type === "PROOF_SUBMITTED");
    if (filter === "COMPLETION")
      return timeline.filter((item) => item.type === "PROJECT_COMPLETED");
    return timeline;
  }, [timeline, filter]);

  const counts = useMemo(
    () => ({
      all: timeline.length,
      payments: timeline.filter((item) => item.type === "PAYMENT").length,
      milestones: timeline.filter(
        (item) => item.type === "MILESTONE_COMPLETED" || item.type === "MILESTONE_CREATED",
      ).length,
      proofs: timeline.filter((item) => item.type === "PROOF_SUBMITTED").length,
      completion: timeline.filter((item) => item.type === "PROJECT_COMPLETED").length,
    }),
    [timeline],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
              <Clock3 className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">Activity Timeline</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {timeline.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Chronological log of payments, completed milestones, submitted proofs, and project
            completion.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 font-medium transition ${
              filter === "ALL"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({counts.all})
          </button>
          {counts.payments > 0 && (
            <button
              type="button"
              onClick={() => setFilter("PAYMENT")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                filter === "PAYMENT"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Payments ({counts.payments})
            </button>
          )}
          {counts.milestones > 0 && (
            <button
              type="button"
              onClick={() => setFilter("MILESTONE")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                filter === "MILESTONE"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              Milestones ({counts.milestones})
            </button>
          )}
          {counts.proofs > 0 && (
            <button
              type="button"
              onClick={() => setFilter("PROOF")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                filter === "PROOF"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-sky-50 text-sky-700 hover:bg-sky-100"
              }`}
            >
              Proofs ({counts.proofs})
            </button>
          )}
          {counts.completion > 0 && (
            <button
              type="button"
              onClick={() => setFilter("COMPLETION")}
              className={`rounded-lg px-2.5 py-1 font-medium transition ${
                filter === "COMPLETION"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100"
              }`}
            >
              Completed ({counts.completion})
            </button>
          )}
        </div>
      </div>

      {filteredTimeline.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-slate-500">
            {filter === "ALL"
              ? "No timeline activity recorded yet."
              : `No ${filter.toLowerCase()} events recorded yet.`}
          </p>
        </div>
      ) : (
        <div className="relative mt-6 space-y-6 pl-6 before:absolute before:bottom-3 before:left-3 before:top-3 before:w-0.5 before:bg-slate-200">
          {filteredTimeline.map((item) => {
            const config = getTimelineNodeConfig(item.type);
            const Icon = config.icon;
            return (
              <div key={item.id} className="relative group">
                <div
                  className={`absolute -left-6 top-0 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border-2 border-white shadow-xs ${config.iconBg} ${config.iconColor}`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:bg-slate-50 hover:border-slate-300">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${config.badgeStyle}`}
                      >
                        {config.label}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                      {item.amount != null && item.amount > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          ₹{item.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <time className="text-xs text-slate-400 font-medium">
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>

                  {item.description && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 whitespace-pre-wrap">
                      {item.description}
                    </p>
                  )}

                  {item.files && item.files.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Submitted proof deliverables ({item.files.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.files.map((file, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-xs font-medium text-sky-800"
                          >
                            <FileCheck className="h-3.5 w-3.5 text-sky-600" />
                            <span className="max-w-44 truncate">{file.name}</span>
                            {file.url && (
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-1 text-sky-600 hover:text-sky-900"
                                title="Open / Download proof"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400 font-medium">
                    {item.actorName && (
                      <span>
                        By: <span className="font-semibold text-slate-600">{item.actorName}</span> (
                        {label(item.actorRole ?? "SYSTEM")})
                      </span>
                    )}
                    {item.stage && (
                      <span>
                        Stage: <span className="font-semibold text-slate-600">{item.stage}</span>
                      </span>
                    )}
                    {item.progress != null && (
                      <span>
                        Progress:{" "}
                        <span className="font-semibold text-slate-600">{item.progress}%</span>
                      </span>
                    )}
                    {item.status && (
                      <span className="ml-auto font-semibold uppercase text-slate-500">
                        {label(item.status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
              <JobTimelineSection timeline={job.timeline ?? []} />
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
  onDecide,
}: {
  details: DisputeDetails | null;
  status: "idle" | "loading" | "error";
  onClose: () => void;
  onToggle: (details: DisputeDetails) => void;
  onDecide: (
    details: DisputeDetails,
    decision: "CLIENT_WINS" | "PROFESSIONAL_WINS",
    reason: string,
    refundAmount?: number,
    payoutAmount?: number,
    milestoneId?: number,
  ) => Promise<void>;
}) {
  const dispute = details?.dispute;
  const [recipient, setRecipient] = useState<"CLIENT" | "PROFESSIONAL">("CLIENT");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  const [selectedDecision, setSelectedDecision] = useState<
    "CLIENT_WINS" | "PROFESSIONAL_WINS"
  >("CLIENT_WINS");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [executingDecision, setExecutingDecision] = useState(false);

  // Target the specific disputed milestone instead of the entire contract budget
  const targetMilestone = details
    ? (details.milestones.find((m) => m.id === details.dispute.milestoneId) ||
       details.milestones.find(
         (m) =>
           m.status === "AWAITING_CLIENT_REVIEW" ||
           m.status === "REVISION_REQUESTED" ||
           m.status === "IN_PROGRESS",
       ) ||
       details.milestones[0] ||
       null)
    : null;

  const targetPayment = targetMilestone && details?.payments
    ? details.payments.find((p) => p.milestoneId === targetMilestone.id)
    : null;

  const isMilestoneFunded = targetPayment?.status === "FUNDED";

  // Specific disputed milestone amount (e.g. ₹1,300) rather than the whole project contract (₹41,250)
  const disputeAmount = targetMilestone
    ? targetMilestone.amount
    : (details?.financial.inEscrow || details?.financial.unpaidApproved || 0);

  const refundableAmount = isMilestoneFunded ? (targetPayment?.amount ?? disputeAmount) : 0;

  async function handleExecuteDecision() {
    if (!details || !decisionNotes.trim()) return;
    setExecutingDecision(true);
    try {
      await onDecide(
        details,
        selectedDecision,
        decisionNotes.trim(),
        selectedDecision === "CLIENT_WINS" ? refundableAmount : 0,
        selectedDecision === "PROFESSIONAL_WINS" ? disputeAmount : 0,
        targetMilestone?.id,
      );
      setDecisionNotes("");
    } finally {
      setExecutingDecision(false);
    }
  }

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
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
                Dispute Adjudication
              </p>
              {dispute?.disputeRound && (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 border border-indigo-200">
                  Round {dispute.disputeRound} of 3
                </span>
              )}
            </div>
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
        {details && dispute ? (() => {
          const milestoneUploads =
            details.workUploads?.filter(
              (u) => targetMilestone && u.milestoneId === targetMilestone.id,
            ) || (details.workUploads ?? []);

          const milestonePayment = details.payments?.find(
            (p) =>
              (targetMilestone ? p.milestoneId === targetMilestone.id : false) &&
              (p.status === "SUCCEEDED" || p.status === "RELEASED" || p.status === "COMPLETED"),
          );

          const isMilestonePaid = Boolean(
            milestonePayment ||
              (targetMilestone &&
                (targetMilestone.status === "COMPLETED" || targetMilestone.status === "APPROVED")),
          );

          const hasWorkSubmitted =
            milestoneUploads.length > 0 || Boolean(targetMilestone?.submittedAt);

          const combinedText = `${dispute.message || ""} ${
            details.dispute.responseMessage || ""
          }`.toLowerCase();
          const mentionsPayment = /pay|paid|money|escrow|release|fund|salary|fee|amount|balance|cost/i.test(
            combinedText,
          );
          const respondentRole = dispute.reporterRole === "CLIENT" ? "PROFESSIONAL" : "CLIENT";

          return (
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={dispute.status} />
                  <Badge value={dispute.priority} />
                  {dispute.disputeRound && (
                    <span className="rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
                      Dispute Round {dispute.disputeRound} of 3
                    </span>
                  )}
                  <span className="text-sm text-slate-500 font-medium">
                    Case #{dispute.id} · Updated {date(dispute.updatedAt)}
                  </span>
                </div>

                {/* RESOLVED OUTCOME CARD */}
                {details.dispute.status === "RESOLVED" && (
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        <span className="font-bold text-sm text-emerald-900">
                          Dispute Resolved · {label(details.dispute.decision || "RESOLVED")}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-emerald-800">
                        {details.dispute.refundAmount
                          ? `Client Refund: ₹${details.dispute.refundAmount.toLocaleString()} `
                          : ""}
                        {details.dispute.payoutAmount
                          ? `Freelancer Payout: ₹${details.dispute.payoutAmount.toLocaleString()}`
                          : ""}
                      </div>
                    </div>
                    {details.dispute.decisionReason && (
                      <p className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-emerald-200">
                        &ldquo;{details.dispute.decisionReason}&rdquo;
                      </p>
                    )}
                  </div>
                )}

                {/* 1. PARTICIPANT STATEMENTS & CLAIMS (SHOW BOTH FIRST) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      1. Participant Statements & Dispute Claims
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Complainant Initial Claim */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <CircleAlert className="h-4 w-4 text-rose-500" />
                            Complainant ({label(dispute.reporterRole)})
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {date(dispute.createdAt)}
                          </span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800 bg-white p-3 rounded-xl border border-slate-200">
                          {dispute.message}
                        </p>
                      </div>

                      {details.dispute.evidence && details.dispute.evidence.length > 0 ? (
                        <div className="mt-3 pt-3 border-t border-slate-200/80">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Complainant Evidence ({details.dispute.evidence.length} files)
                          </p>
                          <div className="space-y-1.5">
                            {details.dispute.evidence.map((file, i) => (
                              <a
                                key={i}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50 transition text-xs font-semibold text-indigo-700"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-[11px] text-slate-400 italic">No files attached by complainant.</p>
                      )}
                    </div>

                    {/* Respondent Counter-Explanation */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-200">
                          <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                            <ShieldAlert className="h-4 w-4 text-amber-600" />
                            Respondent ({label(respondentRole)})
                          </span>
                          {details.dispute.respondedAt ? (
                            <span className="text-[11px] text-amber-700 font-medium">
                              {date(details.dispute.respondedAt)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md">
                              Pending Response
                            </span>
                          )}
                        </div>

                        {details.dispute.responseMessage ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800 bg-white p-3 rounded-xl border border-amber-200">
                            {details.dispute.responseMessage}
                          </p>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed border-amber-300 bg-white/60 p-4 text-center">
                            <p className="text-xs text-amber-800 font-medium">
                              Respondent has not submitted a counter-explanation yet.
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1">
                              Admin can proceed with ruling based on verified database records.
                            </p>
                          </div>
                        )}
                      </div>

                      {details.dispute.responseEvidence && details.dispute.responseEvidence.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-amber-200/80">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-1.5">
                            Counter-Evidence ({details.dispute.responseEvidence.length} files)
                          </p>
                          <div className="space-y-1.5">
                            {details.dispute.responseEvidence.map((file, i) => (
                              <a
                                key={i}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-2 hover:bg-amber-50 transition text-xs font-semibold text-amber-900"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span className="truncate">{file.name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. DATABASE GROUND TRUTH & "WHAT'S THE MATTER" VERIFICATION */}
                <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-indigo-600" />
                      <h3 className="text-sm font-bold text-indigo-950">
                        2. Database Ground Truth & Verified System Records
                      </h3>
                    </div>
                    <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                      Live System Records
                    </span>
                  </div>

                  {/* Smart "What's the Matter" Finding */}
                  <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-2.5">
                    <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      What&apos;s the Matter · Automated DB Analysis
                    </p>
                    <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                      {mentionsPayment ? (
                        isMilestonePaid ? (
                          <div className="flex items-start gap-2 text-emerald-800 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            <span>
                              Payment Verified in DB: Milestone &quot;{targetMilestone?.title ?? "Target"}&quot; is recorded as PAID (₹{(targetMilestone?.amount ?? details.financial.paidAmount).toLocaleString()}). Funds have already been paid out/completed.
                            </span>
                          </div>
                        ) : isMilestoneFunded ? (
                          <div className="flex items-start gap-2 text-indigo-900 font-semibold bg-indigo-50 p-2.5 rounded-lg border border-indigo-200">
                            <Wallet className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                            <span>
                              Payment in Escrow: ₹{(targetPayment?.amount ?? disputeAmount).toLocaleString()} is currently SECURED in platform escrow for this milestone, but has NOT been released to the professional.
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 text-rose-900 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>
                              Payment Verification: Milestone is UNPAID in database (₹0 paid or in escrow). Client wallet balance is ₹{(details.clientWalletBalance ?? 0).toLocaleString()}.
                            </span>
                          </div>
                        )
                      ) : null}

                      {hasWorkSubmitted ? (
                        <div className="flex items-start gap-2 text-blue-900 bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                          <FileCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            Deliverables Verified: Professional submitted {milestoneUploads.length} work deliverable upload(s) in system{targetMilestone?.submittedAt ? ` on ${date(targetMilestone.submittedAt)}` : ""}.
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-slate-700 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                          <Clock3 className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                          <span>
                            Deliverables Status: No work uploads or deliverable files are recorded in the database for this milestone.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ground Truth Metric Cards */}
                  <div className="grid gap-3 sm:grid-cols-3 text-xs">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                      <p className="text-[11px] font-bold uppercase text-slate-500">Disputed Milestone</p>
                      <p className="font-bold text-slate-900 text-sm truncate">
                        {targetMilestone?.title ?? "General Contract"}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="font-semibold text-indigo-700">
                          ₹{(targetMilestone?.amount ?? 0).toLocaleString()}
                        </span>
                        <Badge value={targetMilestone?.status ?? "N/A"} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                      <p className="text-[11px] font-bold uppercase text-slate-500">Milestone Payment Status</p>
                      <div className="pt-0.5">
                        {isMilestonePaid ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            PAID IN DB
                          </span>
                        ) : isMilestoneFunded ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800">
                            <Wallet className="h-3.5 w-3.5 text-indigo-600" />
                            HELD IN ESCROW
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 font-bold text-rose-800">
                            <CircleAlert className="h-3.5 w-3.5 text-rose-600" />
                            UNPAID / NOT IN ESCROW
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 pt-1">
                        {isMilestonePaid
                          ? `Milestone settled and completed`
                          : isMilestoneFunded
                            ? `Secured in platform escrow`
                            : `Client has not funded this milestone`}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                      <p className="text-[11px] font-bold uppercase text-slate-500">Work Delivery Record</p>
                      <div className="pt-0.5">
                        {hasWorkSubmitted ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-800">
                            <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                            {milestoneUploads.length} UPLOAD(S) RECORDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                            NO SUBMISSION IN DB
                          </span>
                        )}
                      </div>
                      {milestoneUploads[0]?.fileName && (
                        <p className="text-[11px] text-indigo-600 truncate pt-1">
                          File: {milestoneUploads[0].fileName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Uploaded files list if present */}
                  {milestoneUploads.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-bold uppercase text-slate-600 mb-1.5">
                        Database Deliverables & Files on Record:
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {milestoneUploads.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{u.title || u.fileName || "Uploaded Work"}</p>
                              <p className="text-[10px] text-slate-500">
                                Round {u.roundNumber} · {date(u.createdAt)}
                              </p>
                            </div>
                            {u.fileUrl && (
                              <a
                                href={u.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                              >
                                View File
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. PROJECT DETAILS & MILESTONES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      3. Project Milestones & Contract Breakdown
                    </h3>
                    <span className="text-xs font-semibold text-slate-600">
                      {details.milestoneSummary.completed} of {details.milestoneSummary.total} completed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {details.milestones.length ? (
                      details.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                            milestone.id === details.dispute.milestoneId
                              ? "border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-300"
                              : "border-slate-200 bg-slate-50/60"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900">{milestone.title}</p>
                              {milestone.id === details.dispute.milestoneId && (
                                <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                                  In Dispute
                                </span>
                              )}
                            </div>
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

                {/* 4. ADJUDICATION DECISION SUITE */}
                {details.dispute.status !== "RESOLVED" && (
                  <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                        <Gavel className="h-5 w-5 text-indigo-600" />
                        4. Admin Adjudication & Decision Suite
                      </div>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg">
                        {isMilestoneFunded
                          ? `Held in Escrow: ₹${disputeAmount.toLocaleString()}`
                          : targetMilestone
                            ? `Disputed Milestone: ₹${disputeAmount.toLocaleString()}`
                            : `Dispute Amount: ₹${disputeAmount.toLocaleString()}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Select a binding ruling for {targetMilestone ? `milestone "${targetMilestone.title}" (₹${disputeAmount.toLocaleString()})` : `₹${disputeAmount.toLocaleString()}`}. Submitting will execute automated wallet transactions and update milestone status.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedDecision("CLIENT_WINS")}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          selectedDecision === "CLIENT_WINS"
                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500 text-emerald-900"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <p className="font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Client Wins
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {isMilestoneFunded
                            ? `Full refund of ₹${disputeAmount.toLocaleString()} to client wallet & cancel milestone.`
                            : `Cancel disputed milestone in client favor (₹0 refund as milestone was unpaid).`}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDecision("PROFESSIONAL_WINS")}
                        className={`p-3.5 rounded-xl border text-left transition ${
                          selectedDecision === "PROFESSIONAL_WINS"
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500 text-blue-900"
                            : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <p className="font-bold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          Freelancer Wins
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Release payout of ₹{disputeAmount.toLocaleString()} to freelancer & approve milestone.
                        </p>
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-800 block mb-1">
                        Ruling Justification / Resolution Notes *
                      </label>
                      <textarea
                        value={decisionNotes}
                        onChange={(e) => setDecisionNotes(e.target.value)}
                        placeholder="Detail the rationale for this ruling..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:ring-2 focus:ring-indigo-200 outline-none"
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleExecuteDecision}
                        disabled={executingDecision || !decisionNotes.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs"
                      >
                        <Gavel className="mr-1.5 h-3.5 w-3.5" />
                        {executingDecision ? "Executing Ruling..." : "Execute Binding Ruling"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* 5. CONTACT PARTICIPANTS */}
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
                  <h3 className="text-sm font-semibold text-slate-900">Payments & Escrow</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                      <dt className="text-[10px] uppercase font-semibold text-slate-500">Paid</dt>
                      <dd className="mt-1 text-sm font-bold text-slate-900">
                        ₹{details.financial.paidAmount.toLocaleString()}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-2 shadow-2xs">
                      <dt className="text-[10px] uppercase font-semibold text-slate-500">
                        In Escrow
                      </dt>
                      <dd className="mt-1 text-sm font-bold text-indigo-700">
                        ₹{(details.financial.inEscrow ?? 0).toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>
              </aside>
            </div>
          );
        })() : null}
      </section>
    </div>
  );
}
