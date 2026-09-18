"use client";

import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import { useDatabaseStatus } from "@/hooks/use-database-status";

const pageTitles: Record<string, string> = {
  "/admin": "Command Center",
  "/admin/users": "Users & Accounts",
  "/admin/verifications": "Verification & Compliance",
  "/admin/operations": "Operations & Disputes",
  "/admin/services": "Services Catalog",
  "/admin/finance": "Finance & Payouts",
  "/admin/reports": "Reports & Analytics",
  "/admin/support": "Support & Knowledge Base",
  "/admin/cms": "Visual CMS Editor",
  "/admin/notifications": "Notifications & Alerts",
  "/admin/messages": "Admin Communications",
};

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const dbStatus = useDatabaseStatus();
  const currentPageTitle = pageTitles[pathname] ?? "Admin Workspace";

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-6 backdrop-blur-md sticky top-0 z-20">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" />
          Admin
        </span>
        <span className="text-slate-300">/</span>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight">{currentPageTitle}</h2>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Marketplace Quick Link */}
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition shadow-2xs"
        >
          <span>Marketplace</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </a>

        {/* Database Status Indicator */}
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${
            dbStatus === "connected"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : dbStatus === "disconnected"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-50 text-slate-600 border-slate-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              dbStatus === "connected"
                ? "bg-emerald-500"
                : dbStatus === "disconnected"
                  ? "bg-rose-500"
                  : "bg-slate-400"
            }`}
          />
          {dbStatus === "connected"
            ? "Live"
            : dbStatus === "disconnected"
              ? "Offline"
              : "Checking…"}
        </div>

        {/* Admin Avatar & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white font-bold text-xs shadow-2xs ring-2 ring-indigo-50">
            A
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition shadow-2xs"
            aria-label="Log out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Log out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
