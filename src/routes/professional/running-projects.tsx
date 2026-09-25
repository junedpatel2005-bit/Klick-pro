"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Heart,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/LoadingSkeleton";

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
  milestones: {
    id: number;
    title: string;
    status: string;
    isCompleted: boolean;
  }[];
  currentStage: string | null;
};

type CompletedProject = {
  id: number;
  jobTitle: string | null;
  clientName: string | null;
  completedAt: string;
  amount: number;
  currency: string;
};

type ClosedProject = {
  id: number;
  jobTitle: string | null;
  clientName: string | null;
  closedAt: string;
};

function displayStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

type FilterTab = "all_active" | "in_progress" | "needs_action" | "completed" | "closed";

function money(project: RunningProject) {
  if (project.budget == null) return "Amount pending";
  return project.timingType === "HOURLY"
    ? `₹${project.budget.toLocaleString()}/hr`
    : `₹${project.budget.toLocaleString()}`;
}

export default function RunningProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<RunningProject[]>([]);
  const [completedProjects, setCompletedProjects] = useState<CompletedProject[]>([]);
  const [closedProjects, setClosedProjects] = useState<ClosedProject[]>([]);
  const [savedJobsCount, setSavedJobsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all_active");

  const loadProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/v1/portal/professional-jobs", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        activeProjects?: RunningProject[];
        completedProjects?: CompletedProject[];
        closedProjects?: ClosedProject[];
        savedJobs?: { id: number }[];
      };
      setProjects(data.activeProjects ?? []);
      setCompletedProjects(data.completedProjects ?? []);
      setClosedProjects(data.closedProjects ?? []);
      setSavedJobsCount(data.savedJobs?.length ?? 0);
      setError("");
    } catch {
      if (!silent) setError("Your active projects could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const socket = io({
      path: "/api/realtime",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    const onUpdate = () => void loadProjects(true);
    socket.on("project:updated", onUpdate);
    socket.on("notification:new", onUpdate);
    socket.on("proposal:new", onUpdate);

    const onCustomUpdate = () => void loadProjects(true);
    window.addEventListener("servio:notification", onCustomUpdate);
    window.addEventListener("servio:project-update", onCustomUpdate);

    return () => {
      socket.off("project:updated", onUpdate);
      socket.off("notification:new", onUpdate);
      socket.off("proposal:new", onUpdate);
      socket.disconnect();
      window.removeEventListener("servio:notification", onCustomUpdate);
      window.removeEventListener("servio:project-update", onCustomUpdate);
    };
  }, [loadProjects]);

  const inProgress = projects.filter((project) => project.status === "IN_PROGRESS").length;
  const needsActionCount = projects.length - inProgress;

  const visibleProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (filterTab === "in_progress") return project.status === "IN_PROGRESS";
        if (filterTab === "needs_action") return project.status !== "IN_PROGRESS";
        return true;
      })
      .filter(
        (project) =>
          !term ||
          [project.jobTitle, project.clientName, project.status].some((value) =>
            value?.toLowerCase().includes(term),
          ),
      );
  }, [projects, search, filterTab]);

  const visibleCompletedProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return completedProjects.filter(
      (project) =>
        !term ||
        [project.jobTitle, project.clientName, "completed"].some((value) =>
          value?.toLowerCase().includes(term),
        ),
    );
  }, [completedProjects, search]);

  const visibleClosedProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return closedProjects.filter(
      (project) =>
        !term ||
        [project.jobTitle, project.clientName, "closed"].some((value) =>
          value?.toLowerCase().includes(term),
        ),
    );
  }, [closedProjects, search]);
  const totalValue = projects.reduce(
    (sum, project) => sum + (project.timingType === "HOURLY" ? 0 : (project.budget ?? 0)),
    0,
  );
  const averageProgress = projects.length
    ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
    : 0;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full bg-cta/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/65">
              <Sparkles className="h-3.5 w-3.5" /> Professional workspace
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Keep your work moving.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
              Track delivery, stay ahead of deadlines, and give every client a clear view of
              progress.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs text-white/65">Portfolio progress</p>
            <p className="mt-1 text-xl font-bold">
              {averageProgress}%{" "}
              <span className="text-sm font-medium text-white/70">average completion</span>
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={BriefcaseBusiness}
          label="Active projects"
          value={projects.length}
          tint="bg-primary/10 text-primary"
          loading={loading}
        />
        <Metric
          icon={Clock3}
          label="In progress"
          value={inProgress}
          tint="bg-amber-500/10 text-amber-600"
          loading={loading}
        />
        <Metric
          icon={CircleDollarSign}
          label="Active value"
          value={`₹${totalValue.toLocaleString()}`}
          tint="bg-emerald-500/10 text-emerald-600"
          loading={loading}
        />
        <Metric
          icon={Heart}
          label="Saved jobs"
          value={savedJobsCount}
          tint="bg-rose-500/10 text-rose-600"
          href="/professional/my-jobs?view=saved"
          loading={loading}
        />
      </section>

      <section>
        {/* Unified single-line filter and search bar */}
        <div className="flex flex-col gap-3.5 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterTab("all_active")}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                filterTab === "all_active"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Active ({projects.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("in_progress")}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                filterTab === "in_progress"
                  ? "bg-card text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              In Progress ({inProgress})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("needs_action")}
              className={`inline-flex whitespace-nowrap items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                filterTab === "needs_action"
                  ? "bg-card text-amber-700 dark:text-amber-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Needs Action</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  needsActionCount > 0
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {needsActionCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("completed")}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                filterTab === "completed"
                  ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Completed ({completedProjects.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("closed")}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all sm:text-sm ${
                filterTab === "closed"
                  ? "bg-card text-slate-700 dark:text-slate-300 shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closed ({closedProjects.length})
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Search projects or clients"
            />
          </div>
        </div>
        {error ? (
          <p className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-5 space-y-4">
          {loading ? (
            <CardListSkeleton count={2} />
          ) : filterTab === "all_active" || filterTab === "in_progress" || filterTab === "needs_action" ? (
            visibleProjects.map((project) => (
              <article
                key={project.id}
                onClick={() => router.push(`/project/${project.id}/tracking`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:border-primary/25 hover:shadow-card"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <BriefcaseBusiness className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-semibold">
                            {project.jobTitle ?? `Project #${project.id}`}
                          </h3>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] ${
                              project.status === "REVISION_REQUESTED"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-primary/20 bg-primary/10 text-primary"
                            }`}
                          >
                            {displayStatus(project.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {project.currentStage ?? "Project setup and planning"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {project.clientName ?? "Client"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {project.deadline
                              ? `Due ${new Date(project.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                              : `Started ${new Date(project.acceptedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-5 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Agreed value
                        </p>
                        <p className="mt-1 font-semibold">{money(project)}</p>
                      </div>
                      <Button asChild>
                        <Link
                          href={`/project/${project.id}/tracking`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {project.status === "AWAITING_PROFESSIONAL_CONFIRMATION" ? (
                            <>
                              <span className="hidden sm:inline">Confirm completion</span>
                              <span className="sm:hidden">Confirm</span>
                            </>
                          ) : (
                            <>
                              <span className="hidden sm:inline">
                                {project.status === "REVISION_REQUESTED"
                                  ? "Open revision"
                                  : "View workspace"}
                              </span>
                              <span className="sm:hidden">View</span>
                            </>
                          )}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">Project progress</span>
                      <span className="font-bold text-primary">{project.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary),var(--color-cta))] transition-all duration-700"
                        style={{ width: `${Math.min(Math.max(project.progress, 0), 100)}%` }}
                      />
                    </div>
                    {project.milestones.length > 0 && (
                      <div className="mt-4 rounded-xl border border-border/70 bg-muted/25 p-3 sm:p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <span>Milestones</span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {project.milestones.filter((m) => m.isCompleted).length} of{" "}
                              {project.milestones.length} Done
                            </span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {project.milestones.length} Milestone
                            {project.milestones.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        {/* Milestone Stepper Dots */}
                        <div className="flex items-center gap-2 py-1">
                          {project.milestones.map((milestone, idx) => (
                            <div key={milestone.id} className="flex flex-1 items-center gap-1.5">
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                                  milestone.isCompleted
                                    ? "bg-emerald-500 text-white shadow-xs shadow-emerald-500/50 ring-2 ring-emerald-500/20"
                                    : milestone.status === "AWAITING_CLIENT_REVIEW" ||
                                        milestone.status === "IN_PROGRESS"
                                      ? "bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/20"
                                      : "bg-muted text-muted-foreground border border-border"
                                }`}
                                title={`${milestone.title} - ${milestone.isCompleted ? "Done" : milestone.status}`}
                              >
                                {milestone.isCompleted ? "✓" : idx + 1}
                              </div>
                              {idx < project.milestones.length - 1 && (
                                <div
                                  className={`h-1 flex-1 rounded-full ${
                                    milestone.isCompleted ? "bg-emerald-500" : "bg-muted"
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Milestone rows with Green Dot */}
                        <div className="space-y-1.5 pt-1.5 border-t border-border/50">
                          {project.milestones.map((milestone, index) => (
                            <div
                              key={milestone.id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all ${
                                    milestone.isCompleted
                                      ? "bg-emerald-500 ring-4 ring-emerald-500/25 shadow-xs"
                                      : milestone.status === "AWAITING_CLIENT_REVIEW" ||
                                          milestone.status === "IN_PROGRESS"
                                        ? "bg-amber-400 ring-2 ring-amber-400/20"
                                        : "bg-muted-foreground/30"
                                  }`}
                                />
                                <span className="truncate font-medium text-foreground">
                                  {index + 1}. {milestone.title}
                                </span>
                              </div>
                              <div className="shrink-0">
                                {milestone.isCompleted ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Done
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    {displayStatus(milestone.status)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : filterTab === "completed" ? (
            visibleCompletedProjects.map((project) => (
              <article
                key={project.id}
                onClick={() => router.push(`/project/${project.id}/tracking`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-emerald-200 bg-card shadow-soft transition-all hover:border-emerald-400 hover:shadow-card"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex min-w-0 gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold">
                          {project.jobTitle ?? `Project #${project.id}`}
                        </h3>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-emerald-700">
                          Completed
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {project.clientName ?? "Client"} · Completed{" "}
                        {new Date(project.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button asChild>
                    <Link
                      href={`/project/${project.id}/tracking`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      View project <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))
          ) : (
            visibleClosedProjects.map((project) => (
              <article
                key={project.id}
                onClick={() => router.push(`/project/${project.id}/tracking`)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all hover:border-muted-foreground/40 hover:shadow-card"
              >
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex min-w-0 gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-muted-foreground">
                          {project.jobTitle ?? `Project #${project.id}`}
                        </h3>
                        <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-600 dark:text-slate-400">
                          Closed
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {project.clientName ?? "Client"} · Closed{" "}
                        {new Date(project.closedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link
                      href={`/project/${project.id}/tracking`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      View details <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))
          )}
          {!loading &&
          !error &&
          (filterTab === "completed"
            ? !visibleCompletedProjects.length
            : filterTab === "closed"
              ? !visibleClosedProjects.length
              : !visibleProjects.length) ? (
            <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/[0.025] px-6 py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <BriefcaseBusiness className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {filterTab === "completed"
                  ? "No completed projects yet"
                  : filterTab === "closed"
                    ? "No closed projects yet"
                    : filterTab === "in_progress"
                      ? search ? "No in-progress projects match your search" : "No projects currently in progress"
                      : filterTab === "needs_action"
                        ? search ? "No action-pending projects match your search" : "No projects requiring action right now"
                        : search
                          ? "No matching projects"
                          : "No active projects yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {filterTab === "completed"
                  ? "Completed projects will appear here after a project is confirmed."
                  : filterTab === "closed"
                    ? "Closed or cancelled projects will appear here."
                    : filterTab === "needs_action"
                      ? "Projects awaiting your review, client response, or revisions will appear here."
                      : search
                        ? "Try another project or client name."
                        : "Accepted client work will appear here when it starts."}
              </p>
              {!search && filterTab === "all_active" && (
                <Button asChild className="mt-6">
                  <Link href="/professional/my-jobs">Browse open jobs</Link>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tint,
  href,
  loading,
}: {
  icon: typeof BriefcaseBusiness;
  label: string;
  value: string | number;
  tint: string;
  href?: string;
  loading?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        {loading ? (
          <span className="h-7 w-12 animate-pulse rounded-md bg-muted/80" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
    </>
  );
  if (href)
    return (
      <Link
        href={href}
        className="block rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
      >
        {content}
      </Link>
    );
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">{content}</div>;
}
