import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BadgeCheck,
  Clock,
  MapPin,
  Star,
  Mail,
  Phone,
  Globe,
  Building2,
  ShieldCheck,
  Users,
  Calendar,
  Image,
  FileText,
  CheckCircle,
  AlertCircle,
  Pencil,
  LayoutDashboard,
} from "lucide-react";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getDetailedProfessional } from "@/lib/queries/marketplace";
import type { DetailedProfessional } from "@/lib/types/marketplace";

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "Not specified";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not available";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getVerificationBadge(status: string | null) {
  switch (status) {
    case "VERIFIED":
    case "APPROVED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-xs">
          <CheckCircle className="h-3.5 w-3.5 text-primary" />
          Verified
        </span>
      );
    case "PENDING":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-xs">
          <Clock className="h-3.5 w-3.5 animate-spin" />
          Pending review
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive shadow-xs">
          <AlertCircle className="h-3.5 w-3.5" />
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          Not verified
        </span>
      );
  }
}

function getAvailabilityBadge(status: string) {
  switch (status) {
    case "available":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Available for hire
        </span>
      );
    case "busy":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-xs">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Busy
        </span>
      );
    case "unavailable":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive shadow-xs">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Unavailable
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs capitalize">
          {status.replace("_", " ")}
        </span>
      );
  }
}

function getWorkModeBadge(mode: string) {
  switch (mode) {
    case "on_site":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          On-site
        </span>
      );
    case "remote":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          Remote
        </span>
      );
    case "both":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Hybrid
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground shadow-xs capitalize">
          {mode}
        </span>
      );
  }
}

import { cookies } from "next/headers";

async function getSessionTokenFromCookies() {
  return (await cookies()).get(sessionCookie)?.value;
}

async function getProfessionalProfile(): Promise<DetailedProfessional> {
  const token = await getSessionTokenFromCookies();
  if (!token) redirect("/login");
  let session;
  try {
    session = await verifySession(token);
  } catch {
    redirect("/login");
  }
  if (session.role !== "PROFESSIONAL") {
    if (session.role === "CLIENT") redirect("/dashboard");
    redirect("/login");
  }

  const professional = await getDetailedProfessional(session.userId);
  if (!professional) redirect("/login");
  return professional;
}

export default async function ProfessionalProfilePage() {
  const professional = await getProfessionalProfile();

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <article className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-card transition-all">
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
            <span>Professional Portal</span>
          </div>
        </div>

        {/* Profile Content Section */}
        <div className="px-6 pb-7 sm:px-8 sm:pb-8">
          {/* Top Profile Row: Avatar & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-16 sm:-mt-20">
            {/* Avatar with ring, shadow, and live indicator */}
            <div className="relative inline-block shrink-0">
              <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-3xl p-1 bg-card ring-4 ring-card shadow-2xl overflow-hidden">
                {professional.avatar ? (
                  <img
                    src={professional.avatar}
                    alt={professional.name}
                    className="h-full w-full rounded-[22px] object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-gradient-to-br from-primary/15 via-primary/5 to-accent/30 text-3xl sm:text-4xl font-bold font-display text-primary shadow-inner">
                    {professional.name.slice(0, 1).toUpperCase()}
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
              <Button asChild className="gap-2 shadow-sm font-medium">
                <Link href="/professional/setup">
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </Link>
              </Button>
              <Button variant="outline" asChild className="gap-2 font-medium">
                <Link href="/professional/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </div>

          {/* Profile Identity Details (Guaranteed clean position below banner) */}
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {professional.name}
                </h1>
                {professional.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                    <BadgeCheck className="h-3.5 w-3.5 text-primary" />
                    Verified Pro
                  </span>
                )}
                {(professional.companyName || professional.industry) && (
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground border border-border">
                    {professional.companyName ?? professional.industry}
                  </span>
                )}
              </div>
              <p className="mt-1 text-base font-medium text-muted-foreground">
                {professional.title}
              </p>
            </div>

            {/* Structured Metadata & Trust Badges Strip */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {/* Rating */}
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span>{professional.rating.toFixed(1)}</span>
                <span className="font-normal opacity-80">({professional.reviews} reviews)</span>
              </div>

              {/* Location */}
              {professional.location && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{professional.location}</span>
                </div>
              )}

              {/* Availability */}
              {getAvailabilityBadge(professional.availability)}

              {/* Work Mode */}
              {getWorkModeBadge(professional.workMode)}

              {/* Verification Status */}
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{professional.verificationStatus ?? "Verification pending"}</span>
              </span>

              {/* Email Verified */}
              {professional.email ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Email verified</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Email unverified</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </article>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">About</h2>
            <p className="mt-4 text-muted-foreground whitespace-pre-wrap">
              {professional.bio ?? "No bio has been provided yet."}
            </p>
          </article>

          <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Services</h2>
            {professional.services.length > 0 ? (
              <div className="mt-4 space-y-4">
                {professional.services.map((service) => (
                  <div key={service.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                      <div className="text-right text-sm font-semibold">
                        {service.price === null
                          ? "Contact for pricing"
                          : formatCurrency(service.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No active services added yet.</p>
            )}
          </article>

          <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Credentials</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Experience</p>
                <p className="mt-2 text-lg font-semibold">
                  {professional.experienceYears !== null
                    ? `${professional.experienceYears}+ years`
                    : "Not specified"}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Team size</p>
                <p className="mt-2 text-lg font-semibold">
                  {professional.teamSize ?? "Not specified"}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Service area</p>
                <p className="mt-2 text-lg font-semibold">
                  {professional.serviceArea ?? "Not specified"}
                </p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-sm text-muted-foreground">Service radius</p>
                <p className="mt-2 text-lg font-semibold">
                  {professional.serviceRadiusKm !== null
                    ? `${professional.serviceRadiusKm} km`
                    : "Not specified"}
                </p>
              </div>
            </div>
          </article>

          {professional.workPhotos.length > 0 && (
            <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
              <h2 className="text-lg font-semibold">Work Photos</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {professional.workPhotos.map((photo, index) => (
                  <div key={index} className="overflow-hidden rounded-2xl border border-border">
                    <img
                      src={photo}
                      alt={`Work photo ${index + 1}`}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>

        <aside className="space-y-6">
          <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Contact</h2>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>{professional.email}</span>
              </div>
              {professional.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <span>{professional.phone}</span>
                </div>
              )}
              {professional.companyWebsite && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <a
                    href={professional.companyWebsite}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {professional.companyWebsite}
                  </a>
                </div>
              )}
              {professional.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1" />
                  <span>{professional.address}</span>
                </div>
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
            <h2 className="text-lg font-semibold">Company</h2>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Company</p>
                <p className="mt-2 font-medium">{professional.companyName ?? "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Industry</p>
                <p className="mt-2 font-medium">{professional.industry ?? "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Verified status
                </p>
                <div className="mt-2">{getVerificationBadge(professional.verificationStatus)}</div>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Profile stats</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-muted-foreground">Joined</p>
                <p className="mt-2 font-medium">{formatDate(professional.createdAt)}</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-muted-foreground">Last updated</p>
                <p className="mt-2 font-medium">{formatDate(professional.updatedAt)}</p>
              </div>
              <div className="rounded-2xl bg-muted p-4">
                <p className="text-muted-foreground">Last login</p>
                <p className="mt-2 font-medium">
                  {professional.lastLoginAt
                    ? formatDate(professional.lastLoginAt)
                    : "Not available"}
                </p>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
