"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Star,
  UserRound,
} from "lucide-react";

type DashboardData = {
  professional: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    professionalCategory: string | null;
    professionalCity: string | null;
    averageRating: number;
    reviewCount: number;
    isVerified: boolean;
    availabilityStatus: string;
    experienceYears: number | null;
  } | null;
  proposals: {
    id: number;
    jobTitle: string | null;
    clientName: string | null;
    bidAmount: number;
    duration: string;
  }[];
  activeProjects: {
    id: number;
    jobTitle: string | null;
    clientName: string | null;
    status: string;
    acceptedAt: string;
  }[];
  completedProjects: { id: number }[];
};

type Notification = {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  readAt: string | null;
};

export default function ProfessionalDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    void fetch("/api/v1/portal/professional-jobs")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch(() => setError("Unable to load your professional dashboard."));
    void fetch("/api/portal/notifications")
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Notification[]) => setNotifications(items))
      .catch(() => setNotifications([]));
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
    const refreshDashboard = () => {
      void fetch("/api/v1/portal/professional-jobs", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          return response.json() as Promise<DashboardData>;
        })
        .then(setData)
        .catch(() => undefined);
      void fetch("/api/portal/notifications", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : []))
        .then((items: Notification[]) => setNotifications(items))
        .catch(() => setNotifications([]));
    };
    socket.on("notification:new", refreshDashboard);
    socket.on("project:updated", refreshDashboard);
    socket.on("proposal:new", refreshDashboard);

    window.addEventListener("servio:notification", refreshDashboard);
    window.addEventListener("servio:project-update", refreshDashboard);

    return () => {
      socket.off("notification:new", refreshDashboard);
      socket.off("project:updated", refreshDashboard);
      socket.off("proposal:new", refreshDashboard);
      socket.disconnect();
      window.removeEventListener("servio:notification", refreshDashboard);
      window.removeEventListener("servio:project-update", refreshDashboard);
    };
  }, []);

  const stats = useMemo(
    () => ({
      requests: data?.proposals.length ?? 0,
      active: data?.activeProjects.length ?? 0,
      completed: data?.completedProjects.length ?? 0,
      rating: data?.professional?.averageRating ?? 0,
    }),
    [data],
  );

  if (error)
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error}
      </div>
    );

  if (!data || !data.professional)
    return (
      <div className="space-y-4">
        <div className="h-48 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );

  const professional = data.professional;
  const name = `${professional.firstName} ${professional.lastName}`.trim();
  const availability = professional.availabilityStatus.replaceAll("_", " ");

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition-all">
        {/* Cover Canvas Banner */}
        <div className="relative h-36 sm:h-44 w-full overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.22),transparent_50%),radial-gradient(circle_at_85%_20%,rgba(99,102,241,0.2),transparent_45%)]" />
          <div className="absolute -top-20 -right-10 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-10 left-1/3 h-40 w-40 rounded-full bg-cyan-400/15 blur-2xl" />

          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: "28px 28px",
            }}
          />

          {/* Top Glass Badge */}
          <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span>Professional Workspace</span>
          </div>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-7">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-14 sm:-mt-16">
            <div className="relative inline-block shrink-0">
              <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-3xl p-1 bg-card ring-4 ring-card shadow-2xl overflow-hidden">
                {professional.avatarUrl ? (
                  <img
                    src={professional.avatarUrl}
                    alt={name}
                    className="h-full w-full rounded-[20px] object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[20px] bg-gradient-to-br from-primary/15 via-primary/5 to-accent/30 text-2xl sm:text-3xl font-bold font-display text-primary shadow-inner">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card ring-2 ring-card shadow-md">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              </span>
            </div>

            <Button variant="outline" asChild className="gap-2 font-medium shadow-xs sm:mb-2">
              <Link href="/professional-profile?from=dashboard">
                <Pencil className="h-4 w-4" />
                Edit profile
              </Link>
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {name}
                </h1>
                {professional.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                    Verified Pro
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm sm:text-base font-medium text-muted-foreground">
                {professional.professionalCategory ?? "Professional"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {professional.professionalCity ?? "Location not added"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                {professional.isVerified ? "Verified professional" : "Verification pending"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 capitalize">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                {availability}
              </span>
              {professional.experienceYears != null && (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {professional.experienceYears} years experience
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed jobs"
          value={stats.completed}
          icon={CheckCircle2}
          href="/professional/reports"
        />
        <StatCard
          label="Active projects"
          value={stats.active}
          icon={BriefcaseBusiness}
          href="/professional/running-projects"
        />
        <StatCard
          label="Client requests"
          value={stats.requests}
          icon={Clock3}
          href="/professional/my-jobs?tab=proposals"
        />
        <StatCard
          label="Your rating"
          value={stats.rating ? stats.rating.toFixed(1) : "New"}
          icon={Star}
          href="/professional/reviews"
          note={`${professional.reviewCount} reviews`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active work</h2>
            <Link
              href="/professional/running-projects"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-border">
            {data.activeProjects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {project.jobTitle ?? `Project #${project.id}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {project.clientName ?? "Client"} · Started{" "}
                    {new Date(project.acceptedAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="secondary">{project.status}</Badge>
                <Button asChild size="sm">
                  <Link href={`/project/${project.id}/tracking`}>Open</Link>
                </Button>
              </div>
            ))}
            {!data.activeProjects.length && (
              <p className="py-6 text-sm text-muted-foreground">
                No active work yet. Accept a client request to start a project.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <Link href="/notifications" className="text-sm text-primary hover:underline">
              All
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {notifications.map((notification) => (
              <div key={notification.id} className="flex gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-muted" : "bg-primary"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
              </div>
            ))}
            {!notifications.length && (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Incoming client requests</h2>
            <Link
              href="/professional/my-jobs?tab=proposals"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {data.proposals.slice(0, 3).map((proposal) => (
              <div
                key={proposal.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{proposal.jobTitle ?? "New client request"}</p>
                  <p className="text-xs text-muted-foreground">
                    {proposal.clientName ?? "Client"} · {proposal.duration}
                  </p>
                </div>
                <p className="font-semibold">₹{proposal.bidAmount.toLocaleString()}</p>
                <Button asChild size="sm">
                  <Link href="/professional/my-jobs?tab=proposals">Review</Link>
                </Button>
              </div>
            ))}
            {!data.proposals.length && (
              <p className="py-6 text-sm text-muted-foreground">
                No client requests waiting for you.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Professional profile</h2>
            <UserRound className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Keep your services, rates, and portfolio up to date so clients can find you.
          </p>
          <Button variant="link" className="mt-3 h-auto px-0" asChild>
            <Link href="/professional-profile?from=dashboard">Edit profile</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  note,
}: {
  label: string;
  value: number | string;
  icon: typeof Star;
  href: string;
  note?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/70 hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>
        <Icon className="h-6 w-6 text-primary" />
      </div>
    </Link>
  );
}
