"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  ArrowRight,
  BellRing,
  BriefcaseBusiness,
  FileText,
  Plus,
  Star,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";

type DashboardData = {
  user: { firstName: string; averageRating: number; phoneVerifiedAt: string | null };
  spent: number;
  projectSummary: { total: number; open: number; running: number; drafts: number };
  jobs: {
    id: number;
    title: string;
    category: string;
    status: string;
    budgetMin: number | null;
    budgetMax: number | null;
    createdAt: string;
    _count: { favoriteJobs: number };
  }[];
  proposals: {
    id: number;
    jobId: number;
    professionalId: number;
    professionalName: string;
    bidAmount: number;
    duration: string;
    coverLetter: string;
  }[];
  hireRequests: {
    id: number;
    jobId: number;
    professionalId: number;
    professionalName: string;
    bidAmount: number;
    duration: string;
    coverLetter: string;
    status: string;
  }[];
  notifications: {
    id: number;
    title: string;
    description: string | null;
    createdAt: string;
    readAt: string | null;
  }[];
};

function formatBudget(job: DashboardData["jobs"][number]) {
  if (job.budgetMin == null && job.budgetMax == null) return "Budget pending";
  return `₹${job.budgetMin?.toLocaleString() ?? "—"} – ₹${job.budgetMax?.toLocaleString() ?? "—"}`;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"proposals" | "hireRequests">("proposals");
  const [phoneReminderDismissed, setPhoneReminderDismissed] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/dashboard", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const nextData = (await response.json()) as DashboardData;
      setData(nextData);
      setError(null);
    } catch {
      setError("Sign in as a client to view your dashboard.");
    }
  }, []);

  useEffect(() => {
    setPhoneReminderDismissed(
      window.localStorage.getItem("servio-phone-reminder-dismissed") === "1",
    );
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const socket = io({
      path: "/api/realtime",
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    const onUpdate = () => void loadDashboard();
    socket.on("proposal:new", onUpdate);
    socket.on("project:updated", onUpdate);
    socket.on("notification:new", onUpdate);

    const onCustomUpdate = () => void loadDashboard();
    window.addEventListener("servio:notification", onCustomUpdate);
    window.addEventListener("servio:project-update", onCustomUpdate);

    return () => {
      socket.off("proposal:new", onUpdate);
      socket.off("project:updated", onUpdate);
      socket.off("notification:new", onUpdate);
      socket.disconnect();
      window.removeEventListener("servio:notification", onCustomUpdate);
      window.removeEventListener("servio:project-update", onCustomUpdate);
    };
  }, [loadDashboard]);
  return (
    <>
      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-7">
          {!data.user.phoneVerifiedAt && !phoneReminderDismissed && (
            <section className="flex flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">Your phone number is not verified</p>
                <p className="mt-1 text-sm">
                  Verify your phone number from your profile to keep your account secure.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild size="sm">
                  <Link href="/client-profile?from=dashboard">Verify phone</Link>
                </Button>
                <button
                  type="button"
                  aria-label="Dismiss phone verification reminder"
                  onClick={() => {
                    window.localStorage.setItem("servio-phone-reminder-dismissed", "1");
                    setPhoneReminderDismissed(true);
                  }}
                  className="rounded-lg p-2 text-amber-800 hover:bg-amber-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}
          <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,var(--color-ink),var(--color-primary))] px-6 py-7 text-white shadow-card sm:px-8 sm:py-8">
            <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full bg-cta/20 blur-3xl" />
            <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">
                  Client workspace
                </p>
                <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  Good to see you, {data.user.firstName}.
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                  Everything you need to hire confidently and keep your projects on track.
                </p>
              </div>
              <Button asChild className="bg-white text-primary shadow-lg hover:bg-white/90">
                <Link href="/post-job">
                  <Plus className="mr-2 h-4 w-4" />
                  Post a new job
                </Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Your projects</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Review and manage your latest postings.
                  </p>
                </div>
                <Link
                  href="/my-jobs"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {data.jobs.slice(0, 4).map((job) => (
                  <Link
                    key={job.id}
                    href={`/job/${job.id}`}
                    className="group flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 transition-all hover:border-primary/25 hover:shadow-soft sm:flex-row sm:items-center"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{job.title}</h3>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          {job.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {job.category} · {job._count.favoriteJobs} saved ·{" "}
                        {new Date(job.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                      <p className="text-sm font-semibold">{formatBudget(job)}</p>
                      <span className="mt-1 inline-flex items-center text-sm font-medium text-primary">
                        Open{" "}
                        <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                ))}
                {!data.jobs.length ? (
                  <Empty
                    text="Post your first job to start receiving proposals."
                    href="/post-job"
                    label="Post a job"
                  />
                ) : null}
              </div>
            </div>
            <aside className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Activity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Recent project updates</p>
                </div>
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-5 space-y-5">
                {data.notifications.slice(0, 5).map((notification) => (
                  <Link key={notification.id} href="/notifications" className="group flex gap-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.readAt ? "bg-muted" : "bg-cta ring-4 ring-cta/15"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug group-hover:text-primary">
                        {notification.title}
                      </p>
                      {notification.description ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {notification.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </Link>
                ))}
                {!data.notifications.length ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    You’re all caught up—no new notifications.
                  </p>
                ) : null}
              </div>
            </aside>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.8fr)]">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    {activeTab === "proposals" ? "Recent proposals" : "Sent hire requests"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeTab === "proposals"
                      ? "Compare offers and choose the right professional."
                      : "Professionals you've directly invited to your jobs."}
                  </p>
                </div>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 flex gap-1 rounded-xl border border-border bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("proposals")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${activeTab === "proposals" ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Proposals
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("hireRequests")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${activeTab === "hireRequests" ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Sent hire requests
                </button>
              </div>
              <div className="mt-5 space-y-3">
                {activeTab === "proposals"
                  ? data.proposals.slice(0, 3).map((proposal) => {
                      const name =
                        proposal.professionalName?.trim() ||
                        `Professional #${proposal.professionalId}`;
                      return (
                        <Link
                          key={proposal.id}
                          href={`/job/${proposal.jobId}`}
                          className="block rounded-2xl border border-border bg-background p-4 transition-colors hover:border-primary/25"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold">{name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Delivery estimate: {proposal.duration}
                                </p>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-primary">
                              ₹{proposal.bidAmount.toLocaleString()}
                            </p>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {proposal.coverLetter}
                          </p>
                        </Link>
                      );
                    })
                  : data.hireRequests.slice(0, 3).map((hireRequest) => {
                      const name =
                        hireRequest.professionalName?.trim() ||
                        `Professional #${hireRequest.professionalId}`;
                      return (
                        <Link
                          key={hireRequest.id}
                          href={`/job/${hireRequest.jobId}`}
                          className="block rounded-2xl border border-border bg-background p-4 transition-colors hover:border-primary/25"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold">{name}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Timeline: {hireRequest.duration}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">
                                ₹{hireRequest.bidAmount.toLocaleString()}
                              </p>
                              <span
                                className={`text-xs font-semibold ${
                                  hireRequest.status === "PENDING"
                                    ? "text-warning"
                                    : hireRequest.status === "ACCEPTED"
                                      ? "text-success"
                                      : "text-destructive"
                                }`}
                              >
                                {hireRequest.status === "PENDING"
                                  ? "Awaiting professional"
                                  : hireRequest.status}
                              </span>
                            </div>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {hireRequest.coverLetter}
                          </p>
                        </Link>
                      );
                    })}
                {activeTab === "proposals" && !data.proposals.length ? (
                  <Empty
                    text="New proposals will show up here as professionals respond."
                    href="/discover"
                    label="Find professionals"
                  />
                ) : null}
                {activeTab === "hireRequests" && !data.hireRequests.length ? (
                  <Empty
                    text="Hire requests you send to professionals will show up here."
                    href="/discover"
                    label="Find professionals"
                  />
                ) : null}
              </div>
            </div>
            <div className="rounded-3xl bg-[linear-gradient(145deg,var(--color-primary),var(--color-ink))] p-6 text-white shadow-card">
              <UsersRound className="h-6 w-6 text-white/75" />
              <h2 className="mt-8 font-display text-2xl font-semibold">Find your next expert.</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Browse trusted professionals and invite the right person to your next project.
              </p>
              <Button
                asChild
                variant="secondary"
                className="mt-6 bg-white text-primary hover:bg-white/90"
              >
                <Link href="/discover">
                  Explore professionals <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <div className="mt-8 border-t border-white/15 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 fill-cta text-cta" />
                  Your average rating: <strong>{data.user.averageRating.toFixed(1)}</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Empty({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/[0.025] px-5 py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        {label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
