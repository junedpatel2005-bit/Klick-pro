"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Filter,
  MapPin,
  MessageSquare,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UsersRound,
  XCircle,
  LogIn,
} from "lucide-react";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";
import { Button } from "@/components/ui/button";

type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  isActive: boolean;
  isVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  averageRating: number;
  reviewCount: number;
  completedProjects: number;
  closedProjects: number;
  totalProjects: number;
  location: string;
  companyName: string | null;
};

function UserGroup({
  title,
  users,
  kind,
  loading = false,
  onToggle,
  onDelete,
  onImpersonate,
}: {
  title: string;
  users: User[];
  kind: "client" | "professional";
  loading?: boolean;
  onToggle: (user: User) => void;
  onDelete: (user: User) => void;
  onImpersonate?: (user: User) => void;
}) {
  const router = useRouter();
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
            {loading ? (
              <div className="mt-1 h-3.5 w-16 animate-pulse rounded bg-slate-200" />
            ) : (
              <p className="text-xs text-slate-500">{users.length} accounts</p>
            )}
          </div>
        </div>
      </header>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <div className="p-5 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 py-2 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          users.map((user) => (
            <article
              key={user.id}
              onClick={() => router.push(`/admin/users/${user.id}`)}
              className="flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 group"
            >
              {/* User Avatar */}
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold border transition ${
                  kind === "professional"
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200 group-hover:border-indigo-300"
                    : "bg-sky-50 text-sky-700 border-sky-200 group-hover:border-sky-300"
                }`}
              >
                {`${user.firstName?.[0] ?? "U"}${user.lastName?.[0] ?? ""}`}
              </span>

              {/* Main Information Box */}
              <div className="min-w-64 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition">
                    {user.firstName} {user.lastName}
                  </p>
                  {user.companyName && (
                    <span className="text-xs text-slate-500 font-medium">({user.companyName})</span>
                  )}
                  {user.isVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      user.emailVerifiedAt
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {user.emailVerifiedAt ? "Email verified" : "Email not verified"}
                  </span>
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{user.email}</span>
                  {user.phone && <span>• {user.phone}</span>}
                </div>

                {/* Rating, Completed Projects, Closed Projects, and Location in Box */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {/* Rating */}
                  <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-0.5 text-xs font-bold text-amber-800 shadow-2xs">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {Number(user.averageRating) > 0 ? (
                      <>
                        {Number(user.averageRating).toFixed(1)}
                        <span className="text-[10px] font-medium text-amber-700 opacity-80">
                          ({user.reviewCount ?? 0} rev)
                        </span>
                      </>
                    ) : (
                      "Unrated"
                    )}
                  </span>

                  {/* Completed Projects */}
                  <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    {user.completedProjects ?? 0} Completed
                  </span>

                  {/* Closed Projects */}
                  <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-0.5 text-xs font-semibold text-rose-800 shadow-2xs">
                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                    {user.closedProjects ?? 0} Closed
                  </span>

                  {/* Total Projects */}
                  {(user.totalProjects ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/70 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {user.totalProjects} Total
                    </span>
                  )}

                  {/* Location */}
                  {user.location && user.location !== "—" && (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-2xs">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px]" title={user.location}>
                        {user.location}
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <Link
                    href={`/admin/users/${user.id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 group-hover:underline"
                  >
                    Click to view full profile and activity
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold border ${
                  user.isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {user.isActive ? "Enabled" : "Disabled"}
              </span>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Direct Message button */}
                <Link
                  href={`/admin/messages?recipientId=${user.id}`}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-700 shadow-2xs transition hover:bg-indigo-50 hover:border-indigo-300"
                  title="Direct Message"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                  Message
                </Link>

                {/* Support View / Impersonate */}
                {ENABLE_ADMIN_EXTRA_SECTION && user.isActive && (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      onImpersonate?.(user);
                    }}
                    variant="outline"
                    className="border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100 hover:text-amber-900 shadow-2xs text-xs font-semibold"
                    title={`Support View: Inspect portal as ${user.firstName}`}
                  >
                    <LogIn className="mr-1.5 h-3.5 w-3.5 text-amber-700" />
                    View as User
                  </Button>
                )}

                {/* Shortcut to disable/enable user */}
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
                  title={user.isActive ? "Disable Account" : "Enable Account"}
                >
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                  {user.isActive ? "Disable" : "Enable"}
                </Button>

                {/* Delete button */}
                <Button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(user);
                  }}
                  variant="outline"
                  className="border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  title="Delete user"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </article>
          ))
        )}
        {!loading && users.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-500">
            No {title.toLowerCase()} found matching your filters.
          </p>
        )}
      </div>
    </section>
  );
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const targetUserId = searchParams.get("id");
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeGroup, setActiveGroup] = useState<"clients" | "professionals">("clients");

  // Filters: Search, Location, Rating, Status
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ENABLED" | "DISABLED">("ALL");

  const [confirmAction, setConfirmAction] = useState<{
    user: User;
    kind: "toggle" | "delete";
  } | null>(null);

  const load = () => {
    setLoading(true);
    void fetch("/api/v1/admin/data/users", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
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

  // If ?id= query param is provided, redirect to dedicated page
  useEffect(() => {
    if (targetUserId && Number.isSafeInteger(Number(targetUserId))) {
      router.push(`/admin/users/${targetUserId}`);
    }
  }, [targetUserId, router]);

  // Comprehensive Filtering Logic
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const l = locationSearch.trim().toLowerCase();

    return users.filter((user) => {
      const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim().toLowerCase();
      const email = (user.email ?? "").toLowerCase();
      const phone = user.phone ?? "";
      const userLoc = (user.location ?? "").toLowerCase();
      const rating = Number(user.averageRating) || 0;

      // 1. Name, Email, or Phone match
      if (q && !fullName.includes(q) && !email.includes(q) && !phone.includes(q)) {
        return false;
      }

      // 2. Location match
      if (l && !userLoc.includes(l)) {
        return false;
      }

      // 3. Rating filter
      if (ratingFilter === "4.5" && rating < 4.5) return false;
      if (ratingFilter === "4.0" && rating < 4.0) return false;
      if (ratingFilter === "3.0" && rating < 3.0) return false;
      if (ratingFilter === "UNRATED" && rating > 0) return false;

      // 4. Status filter
      if (statusFilter === "ENABLED" && !user.isActive) return false;
      if (statusFilter === "DISABLED" && user.isActive) return false;

      return true;
    });
  }, [users, search, locationSearch, ratingFilter, statusFilter]);

  const clients = useMemo(() => filtered.filter((user) => user.role === "CLIENT"), [filtered]);
  const professionals = useMemo(
    () => filtered.filter((user) => user.role === "PROFESSIONAL"),
    [filtered],
  );

  // Total counts for tabs
  const totalClientsCount = useMemo(() => users.filter((u) => u.role === "CLIENT").length, [users]);
  const totalProsCount = useMemo(
    () => users.filter((u) => u.role === "PROFESSIONAL").length,
    [users],
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
    setMessage(`${user.firstName} ${user.lastName}'s account was deleted.`);
  };

  const handleImpersonate = async (user: User) => {
    try {
      const response = await fetch("/api/admin/extra/impersonate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error ?? "Unable to impersonate user.");
      window.location.href = data.redirectUrl || "/dashboard";
    } catch {
      setMessage("Impersonation request failed.");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setLocationSearch("");
    setRatingFilter("ALL");
    setStatusFilter("ALL");
  };

  const hasActiveFilters = Boolean(
    search || locationSearch || ratingFilter !== "ALL" || statusFilter !== "ALL",
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-600">Admin module</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">User management</h1>
        <p className="mt-2 text-slate-500">
          Manage Clients and Professionals independently. View user ratings, completed and closed
          projects, and direct messaging shortcuts.
        </p>
      </div>

      {/* Top Group Switchers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => setActiveGroup("clients")}
          className={`rounded-2xl border p-5 text-left transition ${
            activeGroup === "clients"
              ? "border-sky-500 bg-sky-50/60 ring-2 ring-sky-200"
              : "border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Clients</p>
            <UsersRound className="h-5 w-5 text-sky-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-9 w-16 animate-pulse rounded-md bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalClientsCount}</p>
          )}
          <p className="mt-2 text-xs font-medium text-sky-600">
            {activeGroup === "clients" ? "Currently viewing clients" : "Click to view clients"}
          </p>
        </button>

        <button
          onClick={() => setActiveGroup("professionals")}
          className={`rounded-2xl border p-5 text-left transition ${
            activeGroup === "professionals"
              ? "border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200"
              : "border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Professionals
            </p>
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
          </div>
          {loading ? (
            <div className="mt-2 h-9 w-16 animate-pulse rounded-md bg-slate-200" />
          ) : (
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalProsCount}</p>
          )}
          <p className="mt-2 text-xs font-medium text-indigo-600">
            {activeGroup === "professionals"
              ? "Currently viewing professionals"
              : "Click to view professionals"}
          </p>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search by name/email */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, phone…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Search / Filter by location */}
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={locationSearch}
              onChange={(event) => setLocationSearch(event.target.value)}
              placeholder="Filter by city or location…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-2xs"
            />
          </div>

          {/* Filter by Rating */}
          <div className="relative">
            <select
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 shadow-2xs"
            >
              <option value="ALL">⭐ All Ratings</option>
              <option value="4.5">⭐ 4.5 & Above</option>
              <option value="4.0">⭐ 4.0 & Above</option>
              <option value="3.0">⭐ 3.0 & Above</option>
              <option value="UNRATED">⭐ Unrated Only</option>
            </select>
          </div>

          {/* Shortcut to filter by Disabled / Enabled Status */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(
              [
                { key: "ALL", label: "All" },
                { key: "ENABLED", label: "Enabled" },
                { key: "DISABLED", label: "Disabled" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  statusFilter === item.key
                    ? "bg-white text-indigo-700 shadow-2xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter stats & Reset button */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>
              Showing {activeGroup === "professionals" ? professionals.length : clients.length}{" "}
              matching {activeGroup}
            </span>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <RotateCcw className="h-3 w-3" /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {message && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}

      {/* Main List Table */}
      <div className="mt-6">
        {activeGroup === "clients" ? (
          <UserGroup
            key="clients-group"
            title="Clients"
            users={clients}
            kind="client"
            loading={loading}
            onToggle={(user) => setConfirmAction({ user, kind: "toggle" })}
            onDelete={(user) => setConfirmAction({ user, kind: "delete" })}
            onImpersonate={handleImpersonate}
          />
        ) : (
          <UserGroup
            key="professionals-group"
            title="Professionals"
            users={professionals}
            kind="professional"
            loading={loading}
            onToggle={(user) => setConfirmAction({ user, kind: "toggle" })}
            onDelete={(user) => setConfirmAction({ user, kind: "delete" })}
            onImpersonate={handleImpersonate}
          />
        )}
      </div>

      {/* Confirmation Modal */}
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
    </div>
  );
}
