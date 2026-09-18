"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BriefcaseBusiness,
  CheckCircle2,
  DollarSign,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};
type Detail = {
  user: User & {
    phone: string | null;
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
    phoneVerifiedAt: string | null;
    emailVerifiedAt: string | null;
    serviceArea: string | null;
    workMode: string;
    serviceRadiusKm: number | null;
    availabilityStatus: string;
    experienceYears: number | null;
    professionalSkillsJson: string | null;
    professionalLatitude: number | null;
    professionalLongitude: number | null;
    updatedAt: string;
    clientProfiles: {
      fullName: string;
      email: string;
      phone: string;
      companyName: string | null;
      companyWebsite: string | null;
      industry: string | null;
      teamSize: string | null;
      companyDescription: string | null;
      address: string;
      savedLocations: { label: string; address: string; isPrimary: boolean }[];
    }[];
  };
  stats: {
    jobsPosted: number;
    proposals: number;
    projects: number;
    completedPayments: number;
    money: number;
    services: number;
  };
};
function parseSkills(value: string | null) {
  if (!value) return "—";
  try {
    const skills = JSON.parse(value) as unknown;
    return Array.isArray(skills)
      ? skills.filter((item) => typeof item === "string").join(", ") || "—"
      : "—";
  } catch {
    return "—";
  }
}
function UserGroup({
  title,
  users,
  kind,
  onToggle,
  onOpen,
  onDelete,
}: {
  title: string;
  users: User[];
  kind: "client" | "professional";
  onToggle: (user: User) => void;
  onOpen: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  const Icon = kind === "professional" ? ShieldCheck : UsersRound;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-10 w-10 place-items-center rounded-xl border ${
              kind === "professional"
                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                : "bg-sky-50 text-sky-700 border-sky-100"
            }`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{users.length} accounts</p>
          </div>
        </div>
      </header>
      <div className="divide-y divide-slate-100">
        {users.map((user) => (
          <article
            key={user.id}
            onClick={() => onOpen(user)}
            className="flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80"
          >
            <span
              className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold border ${
                kind === "professional"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-sky-50 text-sky-700 border-sky-200"
              }`}
            >{`${user.firstName?.[0] ?? "U"}${user.lastName?.[0] ?? ""}`}</span>
            <div className="min-w-48 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                {user.isVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border ${
                    user.emailVerifiedAt
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {user.emailVerifiedAt ? "Email verified" : "Email not verified"}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
              <p className="mt-1 text-xs font-medium text-indigo-600">
                Click to view full profile and activity
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
                user.isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {user.isActive ? "Enabled" : "Disabled"}
            </span>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                onToggle(user);
              }}
              variant="outline"
              className={
                user.isActive
                  ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                  : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
              }
            >
              <Power className="mr-2 h-4 w-4" />
              {user.isActive ? "Disable" : "Enable"}
            </Button>
            <Button
              onClick={(event) => {
                event.stopPropagation();
                onDelete(user);
              }}
              variant="outline"
              className="border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </article>
        ))}
        {users.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">No {title.toLowerCase()} found.</p>
        )}
      </div>
    </section>
  );
}
export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("id");
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");
  const [activeGroup, setActiveGroup] = useState<"clients" | "professionals">("professionals");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    user: User;
    kind: "toggle" | "delete";
  } | null>(null);
  const load = () => {
    void fetch("/api/v1/admin/data/users", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    window.addEventListener("servio:admin-users-update", load);
    window.addEventListener("servio:notification", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("servio:admin-users-update", load);
      window.removeEventListener("servio:notification", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  const openUser = (user: User) => {
    setDetail(null);
    void fetch(`/api/v1/admin/users/${user.id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setDetail);
  };

  useEffect(() => {
    if (!targetUserId || users.length === 0) return;
    const target = users.find((u) => String(u.id) === targetUserId);
    if (target) {
      if (target.role === "CLIENT") setActiveGroup("clients");
      else setActiveGroup("professionals");
      openUser(target);
    }
  }, [targetUserId, users]);
  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      users.filter(
        (user) =>
          !query ||
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      ),
    [users, query],
  );
  const clients = useMemo(() => filtered.filter((user) => user.role === "CLIENT"), [filtered]);
  const professionals = useMemo(
    () => filtered.filter((user) => user.role === "PROFESSIONAL"),
    [filtered],
  );
  const toggle = async (user: User) => {
    const response = await fetch(`/api/v1/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Account update failed.");
    setUsers((current) =>
      current.map((item) =>
        item.id === user.id ? { ...item, isActive: data.user.isActive } : item,
      ),
    );
    setMessage(
      `${user.firstName}'s account is now ${data.user.isActive ? "enabled" : "disabled"}.`,
    );
  };
  const deleteUser = async (user: User) => {
    const response = await fetch(`/api/v1/admin/users/${user.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(data.error ?? "Unable to delete account.");
    setUsers((current) => current.filter((item) => item.id !== user.id));
    setDetail((current) => (current?.user.id === user.id ? null : current));
    setMessage(`${user.firstName} ${user.lastName}'s account was deleted.`);
  };
  const clientProfile = detail?.user.clientProfiles?.[0];
  const mobileNumber = detail?.user.phone ?? clientProfile?.phone ?? null;
  const skills = detail ? parseSkills(detail.user.professionalSkillsJson) : "—";
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">Admin module</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">User management</h1>
      <p className="mt-2 text-slate-500">
        Manage Clients and Professionals independently. Disabled accounts cannot use the platform.
      </p>
      <div className="relative mt-6 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email…"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-2xs"
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => setActiveGroup("clients")}
          className={`rounded-2xl border p-5 text-left transition ${
            activeGroup === "clients"
              ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-200"
              : "border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Clients</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{clients.length}</p>
          <p className="mt-2 text-xs font-medium text-sky-600">Click to view clients</p>
        </button>
        <button
          onClick={() => setActiveGroup("professionals")}
          className={`rounded-2xl border p-5 text-left transition ${
            activeGroup === "professionals"
              ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200"
              : "border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Professionals
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{professionals.length}</p>
          <p className="mt-2 text-xs font-medium text-indigo-600">Click to view professionals</p>
        </button>
      </div>
      {message && (
        <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}
      <div className="mt-6">
        {activeGroup === "professionals" ? (
          <UserGroup
            title="Professionals"
            users={professionals}
            kind="professional"
            onToggle={(user) => setConfirmAction({ user, kind: "toggle" })}
            onOpen={openUser}
            onDelete={(user) => setConfirmAction({ user, kind: "delete" })}
          />
        ) : (
          <UserGroup
            title="Clients"
            users={clients}
            kind="client"
            onToggle={(user) => setConfirmAction({ user, kind: "toggle" })}
            onOpen={openUser}
            onDelete={(user) => setConfirmAction({ user, kind: "delete" })}
          />
        )}
      </div>
      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {confirmAction.kind === "delete"
                ? "Delete account?"
                : `${confirmAction.user.isActive ? "Disable" : "Enable"} account?`}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirmAction.user.firstName} {confirmAction.user.lastName}{" "}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${
                  confirmAction.user.role === "PROFESSIONAL"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                    : "bg-sky-50 text-sky-700 border-sky-200"
                }`}
              >
                {confirmAction.user.role === "PROFESSIONAL" ? "Professional" : "Client"}
              </span>{" "}
              {confirmAction.kind === "delete"
                ? "and their account data will be permanently deleted. This cannot be undone."
                : confirmAction.user.isActive
                  ? "will lose access to the platform."
                  : "will regain access to the platform."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className={
                  confirmAction.kind === "delete" || confirmAction.user.isActive
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }
                onClick={() => {
                  const { user, kind } = confirmAction;
                  setConfirmAction(null);
                  if (kind === "delete") void deleteUser(user);
                  else void toggle(user);
                }}
              >
                {confirmAction.kind === "delete"
                  ? "Delete"
                  : confirmAction.user.isActive
                    ? "Disable"
                    : "Enable"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {detail && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setDetail(null)}
              className="float-right rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">
              User profile
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-900">
              {detail.user.firstName} {detail.user.lastName}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {detail.user.email} {detail.user.phone ? `· ${detail.user.phone}` : ""}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Jobs posted", detail.stats.jobsPosted, BriefcaseBusiness],
                ["Proposals", detail.stats.proposals, UserRound],
                ["Projects", detail.stats.projects, CheckCircle2],
                ["Payments", detail.stats.completedPayments, DollarSign],
                ["Money", `₹${detail.stats.money.toLocaleString()}`, DollarSign],
                ["Services", detail.stats.services, ShieldCheck],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof DollarSign;
                return (
                  <div
                    key={label as string}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <MetricIcon className="h-4 w-4 text-indigo-600" />
                    <p className="mt-3 text-xl font-bold text-slate-900">
                      {value as string | number}
                    </p>
                    <p className="text-xs font-medium text-slate-500">{label as string}</p>
                  </div>
                );
              })}
            </div>
            <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="font-semibold text-slate-900">Account details</h3>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <p className="text-slate-500 font-medium">
                  Mobile{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {mobileNumber ?? "Not added"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Email status{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.emailVerifiedAt ? "Verified" : "Not verified"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Phone status{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {mobileNumber
                      ? detail.user.phoneVerifiedAt
                        ? "Verified"
                        : "Not verified"
                      : "Not added"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Industry{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.industry ?? clientProfile?.industry ?? "—"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Work mode{" "}
                  <span className="ml-2 font-semibold text-slate-900">{detail.user.workMode}</span>
                </p>
                <p className="text-slate-500 font-medium">
                  Availability{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.availabilityStatus}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Experience{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.experienceYears ?? "—"} years
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Skills <span className="ml-2 font-semibold text-slate-900">{skills}</span>
                </p>
                <p className="text-slate-500 font-medium sm:col-span-2">
                  Address{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {clientProfile?.address ?? detail.user.address ?? "—"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium sm:col-span-2">
                  Saved locations{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {clientProfile?.savedLocations
                      .map((location) => `${location.label}: ${location.address}`)
                      .join(" · ") || "—"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Role <span className="ml-2 font-semibold text-slate-900">{detail.user.role}</span>
                </p>
                <p className="text-slate-500 font-medium">
                  Status{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.isActive ? "Enabled" : "Disabled"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Category{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.professionalCategory ?? "—"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Location{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.professionalCity ?? detail.user.address ?? "—"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Company{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.companyName ?? "—"}
                  </span>
                </p>
                <p className="text-slate-500 font-medium">
                  Rating{" "}
                  <span className="ml-2 font-semibold text-slate-900">
                    {detail.user.averageRating} ({detail.user.reviewCount} reviews)
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
