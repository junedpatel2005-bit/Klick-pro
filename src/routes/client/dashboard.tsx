"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Bookmark,
  BriefcaseBusiness,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { capitalizeFirst, capitalizeWords } from "@/lib/utils";

type DashboardData = {
  user: {
    firstName: string;
    lastName?: string;
    avatarUrl?: string | null;
    companyName?: string | null;
    averageRating: number;
    phoneVerifiedAt: string | null;
  };
  walletBalance?: number;
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
  return `₹${job.budgetMin?.toLocaleString("en-IN") ?? "—"} – ₹${job.budgetMax?.toLocaleString("en-IN") ?? "—"}`;
}

function getJobStatusBadge(status: string) {
  switch (status.toUpperCase()) {
    case "OPEN":
      return {
        label: "Open for Bids",
        classes: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotColor: "bg-emerald-500",
      };
    case "RUNNING":
      return {
        label: "In Progress",
        classes: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
        dotColor: "bg-indigo-500",
      };
    case "COMPLETED":
      return {
        label: "Completed",
        classes: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        dotColor: "bg-sky-500",
      };
    case "DRAFT":
      return {
        label: "Draft",
        classes: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        dotColor: "bg-amber-500",
      };
    default:
      return {
        label: capitalizeFirst(status),
        classes: "border-border bg-muted text-muted-foreground",
        dotColor: "bg-muted-foreground",
      };
  }
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"proposals" | "hireRequests">("proposals");
  const [phoneReminderDismissed, setPhoneReminderDismissed] = useState(false);
  const inFlightRef = useRef(false);
  const lastLoadedRef = useRef(0);

  const loadDashboard = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force && inFlightRef.current) return;
      if (!force && now - lastLoadedRef.current < 600) return;
      inFlightRef.current = true;
      try {
        const response = await fetch("/api/v1/dashboard", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const nextData = (await response.json()) as DashboardData;
        setData(nextData);
        setError(null);
        lastLoadedRef.current = Date.now();

        // Alert once per login session if client wallet is in minus
        if (nextData.walletBalance !== undefined && nextData.walletBalance < 0) {
          try {
            const alreadyAlerted = window.sessionStorage.getItem(
              "klickpro_negative_wallet_alerted",
            );
            if (!alreadyAlerted) {
              window.sessionStorage.setItem("klickpro_negative_wallet_alerted", "true");
              toast.error(
                `Your wallet balance is -₹${Math.abs(nextData.walletBalance).toLocaleString("en-IN")}. Please add funds to clear your dues.`,
                {
                  duration: 7000,
                  action: {
                    label: "Clear Dues",
                    onClick: () => router.push("/client/earnings"),
                  },
                },
              );
            }
          } catch {
            // ignore session storage access errors
          }
        }
      } catch {
        setError("Sign in as a client to view your dashboard.");
      } finally {
        inFlightRef.current = false;
      }
    },
    [router],
  );

  useEffect(() => {
    setPhoneReminderDismissed(
      window.localStorage.getItem("servio-phone-reminder-dismissed") === "1",
    );
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onCustomUpdate = () => void loadDashboard();
    window.addEventListener("servio:notification", onCustomUpdate);
    window.addEventListener("servio:project-update", onCustomUpdate);
    window.addEventListener("servio:proposal", onCustomUpdate);

    return () => {
      window.removeEventListener("servio:notification", onCustomUpdate);
      window.removeEventListener("servio:project-update", onCustomUpdate);
      window.removeEventListener("servio:proposal", onCustomUpdate);
    };
  }, [loadDashboard]);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return <DashboardSkeleton />;
  }

  const fullName = capitalizeWords(`${data.user.firstName} ${data.user.lastName ?? ""}`.trim());
  const firstInitial = (data.user.firstName || "C").charAt(0).toUpperCase();
  const lastInitial = (data.user.lastName || "").charAt(0).toUpperCase();
  const initials = (firstInitial + lastInitial).toUpperCase();
  const walletBal = data.walletBalance ?? 0;

  return (
    <div className="space-y-8">
      {/* Phone Reminder Notice */}
      {!data.user.phoneVerifiedAt && !phoneReminderDismissed && (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 to-amber-100/60 p-4 text-amber-950 dark:border-amber-500/30 dark:from-amber-950/30 dark:to-amber-900/20 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-300">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">Your phone number is not verified</p>
              <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-300/80">
                Verify your phone number from your profile to keep your account safe and receive instant job updates.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
              <Link href="/client/setup?from=dashboard">Verify phone</Link>
            </Button>
            <button
              type="button"
              aria-label="Dismiss phone verification reminder"
              onClick={() => {
                window.localStorage.setItem("servio-phone-reminder-dismissed", "1");
                setPhoneReminderDismissed(true);
              }}
              className="rounded-lg p-1.5 text-amber-800 hover:bg-amber-200 dark:text-amber-300 dark:hover:bg-amber-800/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-card transition-all sm:p-8">
        {/* Ambient Glows */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 right-1/3 h-48 w-48 rounded-full bg-violet-500/15 blur-2xl" />

        {/* Dot Texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Avatar or Initials Container */}
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-card/90 p-1 ring-4 ring-white/10 shadow-xl backdrop-blur-md">
              {data.user.avatarUrl ? (
                <img
                  src={data.user.avatarUrl}
                  alt={fullName}
                  className="h-full w-full rounded-[12px] object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[12px] bg-gradient-to-br from-primary via-indigo-600 to-violet-700 text-xl font-bold font-display text-white shadow-inner">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 ring-2 ring-slate-900">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-0.5 text-xs font-semibold text-white/90 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Client Workspace
                </span>
                {data.user.companyName && (
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white/80 capitalize">
                    {capitalizeWords(data.user.companyName)}
                  </span>
                )}
                {data.user.averageRating > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                    <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
                    {data.user.averageRating.toFixed(1)}
                  </span>
                )}
              </div>

              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
                Good to see you, <span className="capitalize">{capitalizeWords(data.user.firstName)}</span>.
              </h1>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/75">
                Manage your job postings, review incoming proposals, and collaborate with top professionals.
              </p>
            </div>
          </div>

          {/* Banner Quick Actions */}
          <div className="relative flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 font-semibold"
            >
              <Link href="/post-job">
                <Plus className="mr-2 h-4 w-4" />
                Post a new job
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md"
            >
              <Link href="/discover">
                <UsersRound className="mr-2 h-4 w-4" />
                Browse Talent
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 backdrop-blur-md"
            >
              <Link href="/client/earnings">
                <Wallet className="mr-2 h-4 w-4" />
                Wallet
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Stats Row (4 Metric Cards) */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Stat 1: Wallet Balance */}
        <Link
          href="/client/earnings"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-6 w-6" />
            </div>
            {walletBal < 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 animate-pulse">
                <AlertCircle className="h-3 w-3" /> Dues pending
              </span>
            ) : walletBal === 0 ? (
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                Zero balance
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Ready for Escrow
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Wallet Balance
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              ₹{walletBal.toLocaleString("en-IN")}
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground group-hover:text-primary">
              <span>Manage funds & escrow</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        {/* Stat 2: Active Projects */}
        <Link
          href="/my-jobs"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Activity className="h-6 w-6" />
            </div>
            <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
              {data.projectSummary.running} Active
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Running Projects
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {data.projectSummary.running}
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground group-hover:text-primary">
              <span>{data.projectSummary.open} postings currently open</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>

        {/* Stat 3: Incoming Proposals & Hires */}
        <div
          onClick={() => {
            const el = document.getElementById("proposals-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <UsersRound className="h-6 w-6" />
            </div>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              {data.proposals.length + data.hireRequests.length} Total
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Candidate Responses
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {data.proposals.length + data.hireRequests.length}
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground group-hover:text-primary">
              <span>{data.proposals.length} bids · {data.hireRequests.length} hire invites</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>

        {/* Stat 4: Monthly Spent */}
        <Link
          href="/client/earnings"
          className="group relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-6"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
              This Month
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spent This Month
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              ₹{(data.spent ?? 0).toLocaleString("en-IN")}
            </p>
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground group-hover:text-primary">
              <span>{data.projectSummary.total} total job posts</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </Link>
      </section>

      {/* Main 2-Column Content Grid */}
      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.85fr)]">
        {/* Left Column: Your Projects & Proposals */}
        <div className="space-y-8">
          {/* Projects Card */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl font-bold tracking-tight">Your Job Postings</h2>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {data.jobs.length}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Review, monitor bids, and manage your active requirements.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex text-xs">
                  <Link href="/post-job">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Post Job
                  </Link>
                </Button>
                <Link
                  href="/my-jobs"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-6 space-y-3.5">
              {data.jobs.slice(0, 4).map((job) => {
                const statusMeta = getJobStatusBadge(job.status);
                return (
                  <Link
                    key={job.id}
                    href={`/job/${job.id}`}
                    className="group relative flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/50 p-4.5 transition-all duration-200 hover:border-primary/40 hover:bg-muted/30 hover:shadow-soft sm:flex-row sm:items-center"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <BriefcaseBusiness className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                          {job.title}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusMeta.classes}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dotColor}`} />
                          {statusMeta.label}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {job.category}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Bookmark className="h-3 w-3" />
                          {job._count.favoriteJobs} saved
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(job.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3 sm:border-0 sm:pt-0 sm:text-right">
                      <div>
                        <p className="text-xs uppercase font-medium text-muted-foreground">Budget</p>
                        <p className="font-display font-bold text-foreground text-sm sm:text-base">
                          {formatBudget(job)}
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                        Manage
                        <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}

              {!data.jobs.length && (
                <Empty
                  icon={BriefcaseBusiness}
                  title="No job postings yet"
                  text="Post your first job requirement to receive verified bids from experienced professionals within minutes."
                  href="/post-job"
                  label="Create a job posting"
                />
              )}
            </div>
          </div>

          {/* Proposals & Hire Requests Section - Compact & Sleek */}
          <div
            id="proposals-section"
            className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft sm:p-5"
          >
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold tracking-tight">
                    {activeTab === "proposals" ? "Recent Proposals" : "Sent Hire Requests"}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {activeTab === "proposals"
                      ? "Review pricing, estimated delivery, and proposals."
                      : "Direct invitations sent to professionals."}
                  </p>
                </div>
              </div>

              {/* Segmented Tab Switcher */}
              <div className="inline-flex rounded-lg border border-border/80 bg-muted/50 p-0.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("proposals")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === "proposals"
                      ? "bg-card text-primary shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Proposals
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeTab === "proposals"
                        ? "bg-primary/10 text-primary font-bold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {data.proposals.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("hireRequests")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeTab === "hireRequests"
                      ? "bg-card text-primary shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Send className="h-3 w-3" />
                  Hire Requests
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${
                      activeTab === "hireRequests"
                        ? "bg-primary/10 text-primary font-bold"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {data.hireRequests.length}
                  </span>
                </button>
              </div>
            </div>

            {/* List - Compact Cards */}
            <div className="mt-4 space-y-2">
              {activeTab === "proposals"
                ? data.proposals.slice(0, 4).map((proposal) => {
                    const name =
                      proposal.professionalName?.trim() ||
                      `Professional #${proposal.professionalId}`;
                    const proInitials = name
                      .split(" ")
                      .map((p) => p.charAt(0))
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <Link
                        key={proposal.id}
                        href={`/job/${proposal.jobId}`}
                        className="group flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/50 p-3 transition-all duration-150 hover:border-primary/40 hover:bg-muted/40 hover:shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold font-display text-primary">
                              {proInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {name}
                                </p>
                                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Verified
                                </span>
                              </div>
                              <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock3 className="h-2.5 w-2.5" />
                                Est. {proposal.duration}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <p className="font-display text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                ₹{proposal.bidAmount.toLocaleString("en-IN")}
                              </p>
                              <span className="text-[10px] text-muted-foreground block -mt-0.5">
                                Quote
                              </span>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </div>
                        </div>

                        {proposal.coverLetter && (
                          <p className="line-clamp-1 text-[11px] text-muted-foreground/90 italic pl-2 border-l border-primary/30 mt-0.5">
                            &ldquo;{proposal.coverLetter}&rdquo;
                          </p>
                        )}
                      </Link>
                    );
                  })
                : data.hireRequests.slice(0, 4).map((hireRequest) => {
                    const name =
                      hireRequest.professionalName?.trim() ||
                      `Professional #${hireRequest.professionalId}`;
                    const proInitials = name
                      .split(" ")
                      .map((p) => p.charAt(0))
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <Link
                        key={hireRequest.id}
                        href={`/job/${hireRequest.jobId}`}
                        className="group flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/50 p-3 transition-all duration-150 hover:border-primary/40 hover:bg-muted/40 hover:shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold font-display text-primary">
                              {proInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {name}
                                </p>
                                <span
                                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                                    hireRequest.status === "PENDING"
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                      : hireRequest.status === "ACCEPTED"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                        : "bg-destructive/10 text-destructive border border-destructive/20"
                                  }`}
                                >
                                  {hireRequest.status === "PENDING" ? "Awaiting" : hireRequest.status}
                                </span>
                              </div>
                              <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Clock3 className="h-2.5 w-2.5" />
                                {hireRequest.duration}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <p className="font-display text-sm font-bold text-foreground">
                                ₹{hireRequest.bidAmount.toLocaleString("en-IN")}
                              </p>
                              <span className="text-[10px] text-muted-foreground block -mt-0.5">
                                Sent Offer
                              </span>
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                          </div>
                        </div>

                        {hireRequest.coverLetter && (
                          <p className="line-clamp-1 text-[11px] text-muted-foreground/90 italic pl-2 border-l border-primary/30 mt-0.5">
                            &ldquo;{hireRequest.coverLetter}&rdquo;
                          </p>
                        )}
                      </Link>
                    );
                  })}

              {activeTab === "proposals" && !data.proposals.length && (
                <Empty
                  icon={FileText}
                  title="No proposals received yet"
                  text="When professionals submit proposals to your open postings, their bids and delivery timelines will appear here."
                  href="/discover"
                  label="Invite professionals directly"
                />
              )}

              {activeTab === "hireRequests" && !data.hireRequests.length && (
                <Empty
                  icon={Send}
                  title="No sent hire requests"
                  text="Explore verified specialists and invite them directly to collaborate on your projects."
                  href="/discover"
                  label="Browse professionals"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Shortcuts, Activity Feed & Promo */}
        <div className="space-y-8">
          {/* Quick Shortcuts */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft sm:p-7">
            <h2 className="font-display text-lg font-bold tracking-tight">Quick Shortcuts</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Frequently used client tools and pages.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href="/post-job"
                className="group flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Post a Job</p>
                  <p className="text-[11px] text-muted-foreground">Hire experts</p>
                </div>
              </Link>

              <Link
                href="/discover"
                className="group flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Search className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Find Talent</p>
                  <p className="text-[11px] text-muted-foreground">Explore profiles</p>
                </div>
              </Link>

              <Link
                href="/client/earnings"
                className="group flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Wallet</p>
                  <p className="text-[11px] text-muted-foreground">Deposit & dues</p>
                </div>
              </Link>

              <Link
                href="/my-jobs"
                className="group flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">My Postings</p>
                  <p className="text-[11px] text-muted-foreground">Track jobs</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Activity Stream */}
          <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft sm:p-7">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BellRing className="h-4 w-4" />
                </div>
                <h2 className="font-display text-lg font-bold tracking-tight">Recent Activity</h2>
              </div>
              <Link
                href="/notifications"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {data.notifications.slice(0, 5).map((notification) => (
                <Link
                  key={notification.id}
                  href="/notifications"
                  className="group flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notification.readAt ? "bg-muted-foreground/30" : "bg-primary ring-4 ring-primary/20"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                      {capitalizeFirst(notification.title)}
                    </p>
                    {notification.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {capitalizeFirst(notification.description)}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(notification.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </Link>
              ))}

              {!data.notifications.length && (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
                  You’re all caught up — no new notifications.
                </div>
              )}
            </div>
          </div>

          {/* Talent Discovery Promo Box */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-6 text-white shadow-card">
            {/* Ambient Orb */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/30 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-1/3 h-32 w-32 rounded-full bg-cyan-400/20 blur-xl" />

            <div className="relative">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Featured Talent
              </div>

              <h3 className="mt-4 font-display text-xl font-bold leading-snug">
                Find your next industry specialist.
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-white/70">
                Browse pre-vetted professionals across web development, mobile apps, UI/UX design, marketing, and more.
              </p>

              <Button
                asChild
                className="mt-5 w-full bg-white text-slate-950 font-bold hover:bg-white/90 shadow-md"
              >
                <Link href="/discover" className="inline-flex items-center justify-center gap-2">
                  Explore professionals <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>

              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/75">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                  <span>
                    Your client rating: <strong>{data.user.averageRating.toFixed(1)}</strong>
                  </span>
                </div>
                <span className="text-white/50">•</span>
                <span className="text-white/60">Milestone protected</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
  href,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  href: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="font-semibold text-sm text-foreground">{title}</h4>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{text}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-all"
      >
        {label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
