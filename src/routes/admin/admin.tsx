"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Clock3,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";

type Data = {
  clients: number;
  professionals: number;
  pendingVerifications: number;
  jobs: number;
  disputes: number;
  payments: number;
  newUsers: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    createdAt: string;
  }[];
  newJobs: {
    id: number;
    title: string | null;
    category: string | null;
    status: string;
    createdAt: string;
    user: { firstName: string; lastName: string };
  }[];
  newDisputes: {
    id: number;
    issueType: string;
    priority: string;
    status: string;
    createdAt: string;
  }[];
};
const ago = (date: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
export default function Admin() {
  const [data, setData] = useState<Data | null>(null);

  const load = () => {
    void fetch("/api/v1/admin/data/overview", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload) setData(payload);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    window.addEventListener("servio:admin-overview-update", load);
    window.addEventListener("servio:notification", load);
    window.addEventListener("servio:project-update", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("servio:admin-overview-update", load);
      window.removeEventListener("servio:notification", load);
      window.removeEventListener("servio:project-update", load);
      window.removeEventListener("focus", load);
    };
  }, []);
  const cards = [
    {
      label: "Registered Clients",
      value: data?.clients,
      icon: UsersRound,
      href: "/admin/users",
      badge: "Accounts",
      color: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      label: "Verified Pros",
      value: data?.professionals,
      icon: BriefcaseBusiness,
      href: "/admin/users",
      badge: "Partners",
      color: "from-indigo-500 to-purple-600",
      bgLight: "bg-indigo-50 text-indigo-600 border-indigo-100",
    },
    {
      label: "Pending Verifications",
      value: data?.pendingVerifications,
      icon: ShieldCheck,
      href: "/admin/verifications",
      badge: "Review Queue",
      color: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50 text-amber-600 border-amber-100",
    },
    {
      label: "Active Operations & Disputes",
      value: data?.disputes,
      icon: AlertTriangle,
      href: "/admin/operations",
      badge: "Action Required",
      color: "from-rose-500 to-pink-600",
      bgLight: "bg-rose-50 text-rose-600 border-rose-100",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50/50 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Live Control Center
              </span>
              <span className="text-xs font-medium text-slate-400">· Real-time sync</span>
            </div>
            <h1 className="mt-2.5 font-display text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
              Platform Command Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
              Overview of active marketplace accounts, jobs workflow, compliance status, and escrow
              transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/verifications"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition"
            >
              <ShieldCheck className="h-4 w-4" />
              Review Verifications
            </Link>
            <Link
              href="/admin/operations"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <BriefcaseBusiness className="h-4 w-4 text-slate-500" />
              Manage Jobs
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200"
          >
            <div className="flex items-center justify-between">
              <div
                className={`grid h-12 w-12 place-items-center rounded-2xl border ${card.bgLight} transition group-hover:scale-105`}
              >
                <card.icon className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                {card.badge}
              </span>
            </div>
            <p className="mt-5 text-3xl font-extrabold text-slate-900 tracking-tight">
              {card.value ?? "0"}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
              <UserPlus className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
              Growth
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{data?.newUsers.length ?? "0"}</p>
          <p className="text-xs font-semibold text-emerald-800">Recent User Registrations</p>
        </div>

        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-700 border border-sky-200">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-md">
              Marketplace
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">{data?.newJobs.length ?? "0"}</p>
          <p className="text-xs font-semibold text-sky-800">Recent Job Requests</p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md">
              Attention
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-900">
            {data?.newDisputes.length ?? "0"}
          </p>
          <p className="text-xs font-semibold text-amber-800">Pending Resolution Tickets</p>
        </div>
      </div>

      {/* Activity Feeds */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Latest title="New registrations" icon={UserPlus} href="/admin/users">
          {data?.newUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 py-3.5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-bold text-xs text-slate-700 border border-slate-200">
                  {user.firstName[0]}
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {user.email} · <span className="font-medium text-indigo-600">{user.role}</span>
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                {ago(user.createdAt)}
              </span>
            </div>
          ))}
        </Latest>

        <Latest title="Recent job posts" icon={BriefcaseBusiness} href="/admin/operations">
          {data?.newJobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <p className="font-semibold text-sm text-slate-900">
                  {job.title ?? `Job #${job.id}`}
                </p>
                <p className="text-xs text-slate-500">
                  {job.category ?? "General"} · {job.user.firstName} {job.user.lastName}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                {ago(job.createdAt)}
              </span>
            </div>
          ))}
        </Latest>

        <Latest title="Disputes & inquiries" icon={AlertTriangle} href="/admin/operations">
          {data?.newDisputes.map((dispute) => (
            <div key={dispute.id} className="flex items-center justify-between gap-3 py-3.5">
              <div>
                <p className="font-semibold text-sm text-slate-900">{dispute.issueType}</p>
                <p className="text-xs text-slate-500">
                  <span className="font-bold text-amber-600">{dispute.priority}</span> ·{" "}
                  {dispute.status}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                {ago(dispute.createdAt)}
              </span>
            </div>
          ))}
        </Latest>
      </div>
    </div>
  );
}

function Latest({
  title,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  icon: typeof Clock3;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-indigo-600" />
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        <Link href={href} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          View all →
        </Link>
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        {children || <p className="py-6 text-sm text-slate-400">No recent records.</p>}
      </div>
    </section>
  );
}
