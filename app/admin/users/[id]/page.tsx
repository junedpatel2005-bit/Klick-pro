"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Power,
  ShieldCheck,
  Star,
  Trash2,
  UsersRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type UserDetail = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  professionalCategory: string | null;
  professionalCity: string | null;
  hourlyRate: number | null;
  fixedRate: number | null;
  averageRating: number;
  reviewCount: number;
  companyName: string | null;
  companyWebsite: string | null;
  industry: string | null;
  teamSize: string | null;
  companyDescription: string | null;
  address: string | null;
  serviceArea: string | null;
  workMode: string;
  serviceRadiusKm: number | null;
  availabilityStatus: string;
  experienceYears: number | null;
  professionalSkillsJson: string | null;
  clientProfiles?: {
    fullName: string;
    email: string;
    phone: string;
    companyName: string | null;
    companyWebsite: string | null;
    industry: string | null;
    teamSize: string | null;
    companyDescription: string | null;
    address: string;
    savedLocations?: { label: string; address: string; isPrimary: boolean }[];
  }[];
};

type UserProject = {
  id: number;
  jobId: number;
  title: string;
  category: string | null;
  status: string;
  progress: number;
  totalMilestones: number;
  completedMilestones: number;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  jobsPosted: number;
  proposals: number;
  projects: number;
  completedProjects: number;
  closedProjects: number;
  completedPayments: number;
  money: number;
  services: number;
};

function parseSkills(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.id ? String(params.id) : "";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("User not found or unable to load user data.");
      const data = await response.json();
      setUser(data.user);
      setStats(data.stats);
      setProjects(data.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load user details.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const handleToggleActive = async () => {
    if (!user) return;
    setToggling(true);
    setMessage("");
    try {
      const nextState = !user.isActive;
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update account state.");
      setUser((prev) => (prev ? { ...prev, isActive: nextState } : null));
      setMessage(`Account successfully ${nextState ? "enabled" : "disabled"}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setToggling(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Unable to delete user.");
      router.push("/admin/users");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed.");
      setShowDeleteConfirm(false);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-44 w-full animate-pulse rounded-2xl bg-white border border-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-white border border-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xs">
        <XCircle className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="mt-3 text-lg font-bold text-slate-900">User Not Found</h2>
        <p className="mt-1 text-sm text-slate-500">
          {error || "Could not find the requested user."}
        </p>
        <Link
          href="/admin/users"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>
      </div>
    );
  }

  const clientProfile = user.clientProfiles?.[0];
  const location =
    user.professionalCity?.trim() ||
    clientProfile?.address?.trim() ||
    user.address?.trim() ||
    user.serviceArea?.trim() ||
    "Not specified";
  const mobileNumber = user.phone ?? clientProfile?.phone ?? null;
  const skills = parseSkills(user.professionalSkillsJson);
  const isClient = user.role === "CLIENT";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Back to User Management
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">User ID:</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
            #{user.id}
          </span>
        </div>
      </div>

      {/* Action Notification Banner */}
      {message && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 px-4 py-3 text-sm font-medium text-indigo-900 flex items-center justify-between">
          <span>{message}</span>
          <button
            onClick={() => setMessage("")}
            className="text-indigo-500 hover:text-indigo-700 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Profile Header Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <span
              className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold border shadow-xs ${
                user.role === "PROFESSIONAL"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-sky-50 text-sky-700 border-sky-200"
              }`}
            >
              {`${user.firstName?.[0] ?? "U"}${user.lastName?.[0] ?? ""}`}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  {user.firstName} {user.lastName}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    user.role === "PROFESSIONAL"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-sky-50 text-sky-700 border-sky-200"
                  }`}
                >
                  {user.role === "PROFESSIONAL" ? "Professional" : "Client"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                    user.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-rose-500"}`}
                  />
                  {user.isActive ? "Active / Enabled" : "Disabled"}
                </span>
                {user.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" /> ID Verified
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" /> {user.email}
                </span>
                {mobileNumber && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {mobileNumber}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" /> {location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" /> Joined{" "}
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/admin/messages?recipientId=${user.id}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500"
            >
              <MessageSquare className="h-4 w-4" />
              Message User
            </Link>

            <Button
              onClick={handleToggleActive}
              disabled={toggling}
              variant="outline"
              className={`h-10 text-xs font-semibold ${
                user.isActive
                  ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                  : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <Power className="mr-1.5 h-4 w-4" />
              {toggling ? "Updating…" : user.isActive ? "Disable Account" : "Enable Account"}
            </Button>

            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="outline"
              className="h-10 border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 text-xs"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </section>

      {/* KPI Stats Grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Rating Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Rating & Reviews
            </span>
            <Star className="h-5 w-5 text-amber-500 fill-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-slate-900">
              {user.averageRating > 0 ? user.averageRating.toFixed(1) : "—"}
            </span>
            {user.averageRating > 0 && <span className="text-xs text-slate-400">/ 5.0</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {user.reviewCount > 0 ? `${user.reviewCount} user reviews` : "No reviews yet"}
          </p>
        </div>

        {/* Completed Projects */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Completed
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-emerald-700">
            {stats?.completedProjects ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Projects successfully delivered</p>
        </div>

        {/* Closed Projects */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Closed / Cancelled
            </span>
            <XCircle className="h-5 w-5 text-rose-500" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900">
            {stats?.closedProjects ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Closed or terminated projects</p>
        </div>

        {/* Total Projects / Jobs */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {isClient ? "Jobs & Projects" : "Active & Total Projects"}
            </span>
            <Briefcase className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900">
            {stats?.projects ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isClient
              ? `${stats?.jobsPosted ?? 0} jobs posted`
              : `${stats?.proposals ?? 0} proposals submitted`}
          </p>
        </div>

        {/* Financial Volume */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              {isClient ? "Total Paid" : "Total Earnings"}
            </span>
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-slate-900">
            ₹{(stats?.money ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {stats?.completedPayments ?? 0} completed transactions
          </p>
        </div>
      </section>

      {/* Two Column Profile Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Account & Verification Details */}
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Account & Verification
            </h2>

            <dl className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">Account Role</dt>
                <dd className="font-semibold text-slate-800">{user.role}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">Account Status</dt>
                <dd className="font-semibold">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      user.isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}
                  >
                    {user.isActive ? "ENABLED" : "DISABLED"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">Email Verification</dt>
                <dd className="font-semibold">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      user.emailVerifiedAt
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200"
                    }`}
                  >
                    {user.emailVerifiedAt ? "VERIFIED" : "UNVERIFIED"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">Phone Verification</dt>
                <dd className="font-semibold">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      user.phoneVerifiedAt
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {user.phoneVerifiedAt ? "VERIFIED" : "NOT VERIFIED"}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">ID Verification</dt>
                <dd className="font-semibold">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      user.isVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {user.isVerified ? "VERIFIED" : "PENDING"}
                  </span>
                </dd>
              </div>
            </dl>
          </section>

          {/* Location & Service Area */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-600" />
              Location & Service Area
            </h2>

            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-500">City / Address</dt>
                <dd className="mt-1 font-semibold text-slate-800">{location}</dd>
              </div>
              {user.serviceArea && (
                <div>
                  <dt className="text-slate-500">Service Area</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{user.serviceArea}</dd>
                </div>
              )}
              {user.serviceRadiusKm && (
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Service Radius</dt>
                  <dd className="font-semibold text-slate-800">{user.serviceRadiusKm} km</dd>
                </div>
              )}
              {user.workMode && (
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Work Mode</dt>
                  <dd className="font-semibold text-slate-800 capitalize">{user.workMode}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        {/* Right Column: Professional / Client Details & Recent Projects */}
        <div className="space-y-6 lg:col-span-2">
          {/* Professional or Client Specific Info */}
          {user.role === "PROFESSIONAL" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 text-indigo-600" />
                Professional Profile
              </h2>

              <div className="grid gap-4 sm:grid-cols-3 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Category</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.professionalCategory || "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Experience</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.experienceYears ? `${user.experienceYears} Years` : "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Availability</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm capitalize">
                    {user.availabilityStatus || "Available"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Hourly Rate</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.hourlyRate ? `₹${user.hourlyRate}/hr` : "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Fixed Rate</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.fixedRate ? `₹${user.fixedRate}` : "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Offered Services</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {stats?.services ?? 0} Services
                  </span>
                </div>
              </div>

              {skills.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-semibold text-slate-600 block mb-2">
                    Skills & Specializations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <h2 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sky-600" />
                Company & Client Information
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Company Name</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.companyName || clientProfile?.companyName || "Individual Client"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Industry</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.industry || clientProfile?.industry || "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Team Size</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.teamSize || clientProfile?.teamSize || "—"}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block">Website</span>
                  <span className="mt-1 font-semibold text-slate-800 block text-sm">
                    {user.companyWebsite || clientProfile?.companyWebsite ? (
                      <a
                        href={user.companyWebsite || clientProfile?.companyWebsite || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        {user.companyWebsite || clientProfile?.companyWebsite}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>

              {(user.companyDescription || clientProfile?.companyDescription) && (
                <div className="pt-2 text-xs">
                  <span className="text-slate-500 block mb-1">About Company</span>
                  <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {user.companyDescription || clientProfile?.companyDescription}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Connected Projects List */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-indigo-600" />
                Connected Projects ({projects.length})
              </h2>
            </header>

            {projects.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {projects.map((proj) => (
                  <article
                    key={proj.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 text-sm truncate">
                          {proj.title}
                        </p>
                        {proj.category && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                            {proj.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <span>Progress: {proj.progress}%</span>
                        {proj.totalMilestones > 0 && (
                          <span>
                            • {proj.completedMilestones}/{proj.totalMilestones} Milestones
                          </span>
                        )}
                        <span>• Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
                          proj.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : proj.status === "CLOSED" || proj.status === "CANCELLED"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        }`}
                      >
                        {proj.status.replace(/_/g, " ")}
                      </span>
                      <Link
                        href={`/project/${proj.id}/tracking`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                      >
                        Tracking <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                No active or past projects found for this user.
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">Delete Account?</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete {user.firstName} {user.lastName}? This action cannot
              be undone and will remove all their account records.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                onClick={handleDeleteUser}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
