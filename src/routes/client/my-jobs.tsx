"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { CardListSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";

type Job = {
  id: number;
  title: string | null;
  status: "DRAFT" | "OPEN" | "RUNNING" | "CLOSED";
  projectId: number | null;
  proposalCount: number;
  budgetMin: number | null;
  budgetMax: number | null;
  hourlyRate: number | null;
  timingType: string;
  locationAddress: string | null;
  updatedAt: string;
  createdAt: string;
  jobDate: string | null;
};

type Filter = "ALL" | Job["status"] | "SCHEDULED";

const filters: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All projects" },
  { value: "OPEN", label: "Open" },
  { value: "SCHEDULED", label: "Scheduled jobs" },
  { value: "RUNNING", label: "In progress" },
  { value: "DRAFT", label: "Drafts" },
  { value: "CLOSED", label: "Completed" },
];

function jobStatus(job: Job) {
  return job.projectId ? "RUNNING" : job.status;
}

function isScheduled(job: Job) {
  return (
    job.status === "OPEN" &&
    !job.projectId &&
    job.jobDate != null &&
    new Date(job.jobDate).getTime() > Date.now()
  );
}

function readableStatus(status: Job["status"]) {
  return status === "RUNNING" ? "In progress" : status[0] + status.slice(1).toLowerCase();
}

function jobBudget(job: Job) {
  if (job.timingType === "HOURLY") {
    return job.hourlyRate == null
      ? "Rate not set"
      : `₹${job.hourlyRate.toLocaleString("en-US")}/hr`;
  }
  if (job.budgetMin == null && job.budgetMax == null) return "Budget not set";
  if (job.budgetMin === job.budgetMax) return `₹${job.budgetMin?.toLocaleString("en-US")}`;
  return `₹${job.budgetMin?.toLocaleString("en-US") ?? "—"} – ₹${job.budgetMax?.toLocaleString("en-US") ?? "—"}`;
}

function statusStyle(status: Job["status"]) {
  if (status === "OPEN") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "RUNNING") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "DRAFT") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function MyJobs() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<Filter>("ALL");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [posted, setPosted] = useState(false);

  const load = () =>
    void fetch("/api/v1/client/jobs")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        setJobs(data.jobs);
        setMessage("");
      })
      .catch(() => setMessage("Your projects could not be loaded. Please try again."))
      .finally(() => setLoading(false));

  useEffect(load, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("posted") === "1") {
      setPosted(true);
      window.history.replaceState(null, "", "/my-jobs");
    }
  }, []);

  useEffect(() => {
    const socket = io({
      path: "/api/realtime",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    const refresh = () => {
      void fetch("/api/v1/client/jobs", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((data: { jobs: Job[] }) => setJobs(data.jobs))
        .catch(() => undefined);
    };
    socket.on("proposal:new", refresh);
    socket.on("project:updated", refresh);
    socket.on("notification:new", refresh);

    window.addEventListener("servio:notification", refresh);
    window.addEventListener("servio:project-update", refresh);

    return () => {
      socket.off("proposal:new", refresh);
      socket.off("project:updated", refresh);
      socket.off("notification:new", refresh);
      socket.disconnect();
      window.removeEventListener("servio:notification", refresh);
      window.removeEventListener("servio:project-update", refresh);
    };
  }, []);

  const summary = useMemo(
    () => ({
      total: jobs.length,
      open: jobs.filter((job) => jobStatus(job) === "OPEN" && !isScheduled(job)).length,
      running: jobs.filter((job) => jobStatus(job) === "RUNNING").length,
      drafts: jobs.filter((job) => jobStatus(job) === "DRAFT").length,
    }),
    [jobs],
  );
  const filterCounts: Record<Filter, number> = {
    ALL: jobs.length,
    OPEN: summary.open,
    SCHEDULED: jobs.filter(isScheduled).length,
    RUNNING: summary.running,
    DRAFT: summary.drafts,
    CLOSED: jobs.filter((job) => jobStatus(job) === "CLOSED").length,
  };
  const visible = useMemo(() => {
    const filtered =
      status === "ALL"
        ? jobs
        : status === "SCHEDULED"
          ? jobs.filter(isScheduled)
          : jobs.filter(
              (job) => jobStatus(job) === status && (status !== "OPEN" || !isScheduled(job)),
            );
    return [...filtered].sort((a, b) => {
      const statusRank: Record<Job["status"], number> = {
        OPEN: 0,
        DRAFT: 1,
        CLOSED: 2,
        RUNNING: 3,
      };

      const aStatus = jobStatus(a);
      const bStatus = jobStatus(b);

      if (statusRank[aStatus] !== statusRank[bStatus]) {
        return statusRank[aStatus] - statusRank[bStatus];
      }

      if (aStatus === "OPEN" && bStatus === "OPEN") {
        if (b.proposalCount !== a.proposalCount) return b.proposalCount - a.proposalCount;
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [jobs, status]);

  async function remove(id: number) {
    if (!confirm("Delete this draft permanently?")) return;
    const response = await fetch(`/api/v1/client/jobs/${id}`, { method: "DELETE" });
    if (response.ok) load();
    else setMessage("The draft could not be deleted.");
  }

  return (
    <>
      {posted ? (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Your job was posted. Professionals in this category will be notified.
        </p>
      ) : null}
      <section className="relative overflow-hidden rounded-3xl border border-primary/10 bg-[linear-gradient(115deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-cta/20 blur-3xl" />
        <div className="absolute -bottom-28 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/65">
              Client workspace
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Your projects, at a glance.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Keep every posting moving—from your first draft to a finished project.
            </p>
          </div>
          <Button
            asChild
            className="w-full bg-white text-primary shadow-lg hover:bg-white/90 sm:w-auto"
          >
            <Link href="/post-job">
              <Plus className="mr-2 h-4 w-4" /> Post a new job
            </Link>
          </Button>
        </div>
      </section>

      <section className="relative z-10 -mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total projects",
            value: summary.total,
            icon: ClipboardList,
            tint: "bg-primary/10 text-primary",
            filter: "ALL" as const,
          },
          {
            label: "Open for proposals",
            value: summary.open,
            icon: BriefcaseBusiness,
            tint: "bg-emerald-500/10 text-emerald-600",
            filter: "OPEN" as const,
          },
          {
            label: "Currently active",
            value: summary.running,
            icon: CircleDollarSign,
            tint: "bg-blue-500/10 text-blue-600",
            filter: "RUNNING" as const,
          },
          {
            label: "Saved drafts",
            value: summary.drafts,
            icon: Pencil,
            tint: "bg-amber-500/10 text-amber-600",
            filter: "DRAFT" as const,
          },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => setStatus(item.filter)}
            aria-pressed={status === item.filter}
            className={`rounded-2xl border bg-card p-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${status === item.filter ? "border-primary/60 ring-2 ring-primary/15" : "border-border/80"}`}
          >
            <div className="flex items-center justify-between">
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${item.tint}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-2xl font-bold tracking-tight">{item.value}</span>
            </div>
            <p
              className={`mt-3 text-sm font-medium ${status === item.filter ? "text-primary" : "text-muted-foreground"}`}
            >
              {item.label}
            </p>
          </button>
        ))}
      </section>

      <section className="mt-8">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-semibold">Manage projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {visible.length} {visible.length === 1 ? "project" : "projects"} shown
            </p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1">
            {filters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatus(filter.value)}
                aria-label={`${filter.label}: ${filterCounts[filter.value]} projects`}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${status === filter.value ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${status === filter.value ? "bg-primary/10 text-primary" : "bg-foreground/5 text-muted-foreground"}`}
                >
                  {filterCounts[filter.value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {message ? (
          <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {message}
          </p>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            <CardListSkeleton />
          ) : (
            visible.map((job) => {
              const currentStatus = jobStatus(job);
              const isDraft = currentStatus === "DRAFT";
              const href = isDraft
                ? `/post-job?edit=${job.id}`
                : job.projectId
                  ? `/project/${job.projectId}/tracking`
                  : `/job/${job.id}`;
              return (
                <article
                  key={job.id}
                  onClick={() => router.push(href)}
                  className={`group cursor-pointer rounded-2xl border bg-card p-5 shadow-soft transition-all duration-200 hover:border-primary/25 hover:shadow-card sm:p-6 ${
                    job.proposalCount > 0 && currentStatus !== "RUNNING"
                      ? "border-primary/30 shadow-[0_0_0_1px_rgba(59,130,246,0.12)]"
                      : "border-border"
                  }`}
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <BriefcaseBusiness className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold sm:text-lg">
                            {job.title ?? `Untitled job #${job.id}`}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${isScheduled(job) ? "border-violet-200 bg-violet-50 text-violet-700" : statusStyle(currentStatus)}`}
                          >
                            {isScheduled(job) ? "Scheduled" : readableStatus(currentStatus)}
                          </span>
                          {currentStatus !== "RUNNING" && job.proposalCount > 0 && (
                            <span className="animate-pulse rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/20">
                              {job.proposalCount}{" "}
                              {job.proposalCount === 1 ? "proposal" : "proposals"}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {job.locationAddress ?? "Remote"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Updated{" "}
                            {new Date(job.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <div className="min-w-28">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {job.timingType === "HOURLY" ? "Hourly rate" : "Project budget"}
                        </p>
                        <p className="mt-1 font-semibold text-foreground">{jobBudget(job)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDraft ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete draft"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              void remove(job.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button asChild className="group/button">
                          <Link href={href} onClick={(event) => event.stopPropagation()}>
                            {isDraft ? "Continue" : job.projectId ? "Track project" : "View job"}
                            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/button:translate-x-0.5" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
          {!loading && !visible.length && !message ? (
            <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.025] px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {status === "ALL" ? "Ready to hire great talent?" : "No projects in this view"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                {status === "ALL"
                  ? "Post your first job and start receiving proposals from qualified professionals."
                  : "Choose another filter or post a new job to get started."}
              </p>
              {status === "ALL" ? (
                <Button asChild className="mt-6">
                  <Link href="/post-job">
                    <Plus className="mr-2 h-4 w-4" />
                    Post a job
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
