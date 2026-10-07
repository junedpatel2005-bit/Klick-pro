"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Share2,
  ShieldCheck,
  Star,
  Users,
  Briefcase,
  ArrowRight,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import type {
  PublicClientProfile,
  PublicClientJobItem,
  PublicReviewItem,
} from "@/lib/types/marketplace";

const formatCurrency = (value: number | null) =>
  value == null ? "Flexible" : `₹${value.toLocaleString("en-IN")}`;

const formatDate = (isoString: string) => {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
};

const formatMemberSince = (isoString: string) => {
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Recent member";
  }
};

export default function ClientProfilePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [client, setClient] = useState<PublicClientProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    setStatus("loading");
    void fetch(`/api/v1/marketplace/client-detail?id=${encodeURIComponent(clientId)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setStatus("missing");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load client profile");
        }
        const data = (await res.json()) as PublicClientProfile;
        setClient(data);
        setStatus("ready");
      })
      .catch((err) => {
        console.error("client.profile.error", err);
        setStatus("error");
      });
  }, [clientId]);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${client?.name || "Client"} Profile · Klick-Pro`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Profile link copied to clipboard!");
      }
    } catch {
      // User cancelled or clipboard permission denied
    }
  };

  const scrollToOpenJobs = () => {
    const el = document.getElementById("open-jobs-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (status === "loading") {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="h-44 sm:h-52 md:h-56 w-full animate-pulse rounded-3xl bg-muted" />
          <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 sm:h-28 sm:w-28 animate-pulse rounded-2xl bg-muted" />
              <div className="space-y-2 flex-1">
                <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
            <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-40 animate-pulse rounded-2xl bg-muted" />
              <div className="h-40 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (status === "missing") {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl text-center py-16 px-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Client Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The client profile you are looking for does not exist, has been removed, or is not
            publicly accessible.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="default">
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/professionals">Find Professionals</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (status === "error" || !client) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl text-center py-16 px-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Unable to Load Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A temporary network issue occurred while loading this client profile. Please try again.
          </p>
          <div className="mt-6">
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition-all">
        {/* Cover Canvas Banner */}
        <div className="relative h-44 sm:h-52 md:h-56 w-full overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.22),transparent_50%),radial-gradient(circle_at_85%_20%,rgba(99,102,241,0.2),transparent_45%)]" />
          <div className="absolute -top-24 -right-12 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 h-52 w-52 rounded-full bg-cyan-400/15 blur-2xl" />

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
            <span>{client.verified ? "Verified Client" : "Client Profile"}</span>
          </div>
        </div>

        {/* Profile Content Section */}
        <div className="px-6 pb-7 sm:px-8 sm:pb-8">
          {/* Top Profile Row: Avatar & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-20">
            {/* Avatar with ring and shadow */}
            <div className="relative inline-block shrink-0">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-3xl p-1 bg-card ring-4 ring-card shadow-2xl overflow-hidden">
                {client.avatar && !avatarError ? (
                  <img
                    src={client.avatar}
                    alt={client.name}
                    className="h-full w-full rounded-[22px] object-cover"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-indigo-500/20 via-primary/10 to-purple-500/20 text-3xl sm:text-4xl font-bold font-display text-primary shadow-inner">
                    {client.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Presence status dot */}
              <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-card ring-2 ring-card shadow-md">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:mb-2">
              {client.openJobs.length > 0 && (
                <Button
                  size="lg"
                  onClick={scrollToOpenJobs}
                  className="w-full sm:w-auto gap-2 font-semibold shadow-md"
                >
                  <Briefcase className="h-4 w-4" />
                  View Open Jobs ({client.openJobs.length})
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleShare}
                className="w-full sm:w-auto gap-2 font-semibold"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </div>

          {/* Identity Header */}
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {client.name}
                </h1>
                {client.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                    Verified Client
                  </span>
                )}
                {client.companyName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border border-border">
                    <Building2 className="h-3 w-3" />
                    {client.companyName}
                  </span>
                )}
                {client.industry && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                    {client.industry}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Member since {formatMemberSince(client.memberSince)}
              </p>
            </div>

            {/* Structured Metadata & Trust Badges Strip */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Rating */}
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{client.rating > 0 ? client.rating.toFixed(1) : "New"}</span>
                {client.reviewCount > 0 && (
                  <span className="font-normal opacity-80">({client.reviewCount} reviews)</span>
                )}
              </div>

              {/* Location */}
              {client.location && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{client.location}</span>
                </div>
              )}

              {/* Total Jobs Posted */}
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <Briefcase className="h-3.5 w-3.5" />
                <span>
                  {client.totalJobsPosted} {client.totalJobsPosted === 1 ? "Job" : "Jobs"} Posted
                </span>
              </div>

              {/* Completed Hires */}
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {client.completedProjectsCount} Completed{" "}
                  {client.completedProjectsCount === 1 ? "Hire" : "Hires"}
                </span>
              </div>
            </div>
          </div>

          {/* About / Company Information Section */}
          <section className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">About the Client</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {client.companyDescription ||
                  "This client has not added a detailed company description yet. They actively hire qualified professionals on Klick-Pro."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <h2 className="text-lg font-semibold">Client details</h2>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                {client.companyName && (
                  <div>
                    <p className="font-medium text-foreground">Company</p>
                    <p>{client.companyName}</p>
                  </div>
                )}
                {client.industry && (
                  <div>
                    <p className="font-medium text-foreground">Industry</p>
                    <p>{client.industry}</p>
                  </div>
                )}
                {client.teamSize && (
                  <div>
                    <p className="font-medium text-foreground">Team size</p>
                    <p>{client.teamSize}</p>
                  </div>
                )}
                {client.companyWebsite && (
                  <div>
                    <p className="font-medium text-foreground">Website</p>
                    <a
                      href={
                        client.companyWebsite.startsWith("http")
                          ? client.companyWebsite
                          : `https://${client.companyWebsite}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {client.companyWebsite.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3 opacity-70" />
                    </a>
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">Location</p>
                  <p>{client.location || "Location not disclosed"}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Open Jobs Section */}
          <section id="open-jobs-section" className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Active Job Openings
                  <span className="text-sm font-normal text-muted-foreground">
                    ({client.openJobs.length})
                  </span>
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Current projects and tasks posted by this client open for proposals
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/jobs" className="gap-1.5">
                  Browse All Marketplace Jobs
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {client.openJobs.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
                <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-2 text-sm font-medium text-foreground">No active jobs right now</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This client does not have open job postings at the moment. Check back soon or
                  explore other opportunities.
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/jobs">Explore Marketplace Jobs</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-6 space-y-3.5">
                {client.openJobs.map((job: PublicClientJobItem) => (
                  <div
                    key={job.id}
                    className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-md sm:flex-row sm:items-center"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                          {job.category}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                          {job.workMode.replace("_", " ").toLowerCase()}
                        </span>
                        {job.urgency === "HIGH" && (
                          <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            Urgent
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Posted {formatDate(job.createdAt)}
                        </span>
                      </div>
                      <Link
                        href={`/job/${job.id}`}
                        className="text-base font-bold text-foreground transition-colors group-hover:text-primary line-clamp-1"
                      >
                        {job.title}
                      </Link>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {job.timingType === "HOURLY"
                            ? `${formatCurrency(job.hourlyRate)}/hr`
                            : job.budgetMin && job.budgetMax
                              ? `${formatCurrency(job.budgetMin)} – ${formatCurrency(job.budgetMax)}`
                              : job.budgetMin
                                ? `From ${formatCurrency(job.budgetMin)}`
                                : formatCurrency(job.budgetMax)}
                        </span>
                        {job.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      asChild
                      size="sm"
                      className="w-full sm:w-auto shrink-0 gap-1.5 font-semibold"
                    >
                      <Link href={`/job/${job.id}`}>
                        View Job
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Professional Reviews Section */}
          <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Reviews from Professionals
                  <span className="text-sm font-normal text-muted-foreground">
                    ({client.reviewsList.length})
                  </span>
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Feedback left by verified professionals who worked with this client
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 text-base font-bold text-amber-600 dark:text-amber-400">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  <span>{client.rating > 0 ? client.rating.toFixed(1) : "New"}</span>
                  <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                </div>
              </div>
            </div>

            {client.reviewsList.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  This client has not received reviews from professionals yet.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {client.reviewsList.map((review: PublicReviewItem) => (
                  <div
                    key={review.id}
                    className="rounded-xl border border-border/80 bg-muted/20 p-4 transition-colors hover:border-border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                          {review.reviewerAvatar ? (
                            <img
                              src={review.reviewerAvatar}
                              alt={review.reviewerName}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <span>{review.reviewerName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {review.reviewerName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {review.reviewerCategory && <span>{review.reviewerCategory}</span>}
                            {review.projectTitle && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-foreground">
                                  {review.projectTitle}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "fill-muted text-muted"
                            }`}
                          />
                        ))}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                    </div>

                    {review.comment ? (
                      <p className="mt-3 text-sm leading-relaxed text-foreground/90 pl-13">
                        &ldquo;{review.comment}&rdquo;
                      </p>
                    ) : (
                      <p className="mt-2 text-xs italic text-muted-foreground pl-13">
                        No written comments provided.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Safety & Trust Footer */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>
                All client ratings and reviews are verified from completed project milestones on
                Klick-Pro.
              </span>
            </div>
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy & Trust Policy
            </Link>
          </div>
        </div>
      </article>
    </AppShell>
  );
}
