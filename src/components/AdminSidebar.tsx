"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useDatabaseStatus } from "@/hooks/use-database-status";
import {
  BarChart3,
  Bell,
  Briefcase,
  BriefcaseBusiness,
  ChevronRight,
  CircleDollarSign,
  FileBarChart,
  FileText,
  LayoutDashboard,
  Mail,
  MessageSquare,
  ShieldCheck,
  UsersRound,
  Wrench,
  Sliders,
} from "lucide-react";

const linkGroups = [
  {
    group: "MAIN",
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboard },
      { href: "/admin/users", label: "Users", icon: UsersRound, badge: "newUsers" },
      {
        href: "/admin/verifications",
        label: "Verification",
        icon: ShieldCheck,
        badge: "verification",
      },
      {
        href: "/admin/operations",
        label: "Jobs & disputes",
        icon: BriefcaseBusiness,
        badge: "jobs",
      },
    ],
  },
  {
    group: "CATALOG & FINANCE",
    items: [
      { href: "/admin/services", label: "Services catalog", icon: Wrench },
      { href: "/admin/finance", label: "Finance & payouts", icon: CircleDollarSign },
      { href: "/admin/reports", label: "Reports & exports", icon: FileBarChart },
    ],
  },
  {
    group: "PLATFORM & CONTENT",
    items: [
      { href: "/admin/templates", label: "Email templates", icon: Mail },
      { href: "/admin/support", label: "Support & FAQs", icon: FileText },
      { href: "/admin/cms", label: "Website content", icon: FileText },
      { href: "/admin/settings", label: "Platform settings", icon: Sliders },
      { href: "/admin/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare, badge: "messages" },
    ],
  },
];

import { useAdminSidebar } from "@/components/AdminSidebarContext";

export function AdminSidebar() {
  const pathname = usePathname();
  const dbStatus = useDatabaseStatus();
  const { collapsed } = useAdminSidebar();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = () => {
      void fetch("/api/admin/sidebar-counts", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: Record<string, number> | null) => setCounts(data ?? {}))
        .catch(() => setCounts({}));
    };
    load();
    window.addEventListener("servio:notification", load);
    window.addEventListener("servio:message", load);
    window.addEventListener("servio:message-read", load);
    window.addEventListener("servio:notifications-read", load);
    window.addEventListener("servio:admin-overview-update", load);
    window.addEventListener("servio:admin-verifications-update", load);
    window.addEventListener("servio:admin-operations-update", load);
    window.addEventListener("servio:admin-users-update", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("servio:notification", load);
      window.removeEventListener("servio:message", load);
      window.removeEventListener("servio:message-read", load);
      window.removeEventListener("servio:notifications-read", load);
      window.removeEventListener("servio:admin-overview-update", load);
      window.removeEventListener("servio:admin-verifications-update", load);
      window.removeEventListener("servio:admin-operations-update", load);
      window.removeEventListener("servio:admin-users-update", load);
      window.removeEventListener("focus", load);
    };
  }, []);

  useEffect(() => {
    let section: string | null = null;
    let badgeKey: string | null = null;

    if (pathname === "/admin/users") {
      section = "users";
      badgeKey = "newUsers";
    } else if (pathname === "/admin/verifications") {
      section = "verifications";
      badgeKey = "verification";
    } else if (pathname === "/admin/operations") {
      section = "operations";
      badgeKey = "jobs";
    } else if (pathname === "/admin/messages") {
      section = "messages";
      badgeKey = "messages";
    }

    if (!section) return;

    // Immediately clear in local sidebar state
    if (badgeKey) {
      setCounts((current) => ({ ...current, [badgeKey!]: 0 }));
    }

    void fetch("/api/admin/sidebar-counts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section }),
    }).then(() => {
      window.dispatchEvent(new Event("servio:notifications-read"));
      window.dispatchEvent(new Event("servio:message-read"));
    });
  }, [pathname]);

  return (
    <aside
      className={`fixed inset-y-0 hidden border-r border-slate-200 bg-white lg:flex lg:flex-col justify-between shadow-xs z-30 overflow-y-auto transition-all duration-200 ease-in-out ${
        collapsed ? "w-20 p-2.5 items-center" : "w-64 p-4"
      }`}
    >
      <div className={collapsed ? "w-full" : ""}>
        {/* Brand Header */}
        <Link
          href="/admin"
          title="Klick-Pro Admin"
          className={`flex items-center gap-3 px-2 py-2 group ${collapsed ? "justify-center px-0" : ""}`}
        >
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl overflow-hidden bg-white shadow-soft border border-slate-200/80 transition-transform group-hover:scale-105">
            <img
              src="/logo-icon.png"
              alt="Klick-Pro"
              className="h-full w-full object-contain p-0.5"
            />
          </div>
          {!collapsed && (
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-display font-extrabold text-slate-900 tracking-tight">
                  Klick-Pro
                </p>
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Enterprise Control Suite</p>
            </div>
          )}
        </Link>

        {/* Grouped Navigation */}
        <nav className={`mt-6 ${collapsed ? "space-y-4" : "space-y-6"}`}>
          {linkGroups.map((group) => (
            <div key={group.group}>
              {!collapsed ? (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {group.group}
                </p>
              ) : (
                <div className="h-px w-8 bg-slate-200/80 mx-auto my-2.5" />
              )}
              <div className="space-y-1">
                {group.items.map((link) => {
                  const active = pathname === link.href;
                  const badgeCount = link.badge ? (counts[link.badge] ?? 0) : 0;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      title={link.label}
                      className={`group relative flex items-center rounded-xl transition-all duration-150 ${
                        collapsed
                          ? "h-11 w-11 justify-center mx-auto"
                          : "gap-3 px-3 py-2.5 text-sm font-medium"
                      } ${
                        active
                          ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80 shadow-2xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div
                        className={`grid h-7 w-7 place-items-center rounded-lg transition ${
                          active
                            ? "bg-indigo-600 text-white shadow-2xs"
                            : "text-slate-400 group-hover:text-slate-700 group-hover:bg-slate-200/60"
                        }`}
                      >
                        <link.icon className="h-4 w-4" />
                      </div>
                      {!collapsed && <span>{link.label}</span>}
                      {badgeCount > 0 &&
                        !active &&
                        (collapsed ? (
                          <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white shadow-xs">
                            {badgeCount > 9 ? "9+" : badgeCount}
                          </span>
                        ) : (
                          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-bold text-indigo-700">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        ))}
                      {active && !collapsed && (
                        <ChevronRight className="ml-auto h-4 w-4 text-indigo-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* System Status Footer */}
      {!collapsed ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-700">System Environment</p>
            <span className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
              v2.4.0
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {dbStatus === "connected" && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  dbStatus === "connected"
                    ? "bg-emerald-500"
                    : dbStatus === "disconnected"
                      ? "bg-rose-500"
                      : "bg-slate-400"
                }`}
              />
            </span>
            <span
              className={`text-xs font-semibold ${
                dbStatus === "connected"
                  ? "text-emerald-700"
                  : dbStatus === "disconnected"
                    ? "text-rose-700"
                    : "text-slate-500"
              }`}
            >
              {dbStatus === "connected"
                ? "All services operational"
                : dbStatus === "disconnected"
                  ? "System Server Offline"
                  : "Checking health…"}
            </span>
          </div>
        </div>
      ) : (
        <div
          title={
            dbStatus === "connected"
              ? "All services operational"
              : dbStatus === "disconnected"
                ? "Database disconnected"
                : "Checking health…"
          }
          className="my-3 flex justify-center"
        >
          <span className="relative flex h-3 w-3">
            {dbStatus === "connected" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                dbStatus === "connected"
                  ? "bg-emerald-500"
                  : dbStatus === "disconnected"
                    ? "bg-rose-500"
                    : "bg-slate-400"
              }`}
            />
          </span>
        </div>
      )}
    </aside>
  );
}
