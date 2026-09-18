"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  FileBarChart,
  LayoutDashboard,
  MessageSquare,
  Search,
  User,
  Wallet,
} from "lucide-react";
import { ClientAccountMenu } from "@/components/ClientAccountMenu";
import { Button } from "@/components/ui/button";

type DashboardNotification = {
  id: number;
  title: string;
  description: string | null;
  href?: string | null;
  createdAt: string;
  readAt: string | null;
};

export function AppHeader({ role }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const pages = [
    {
      label: "Dashboard",
      hint: "Workspace overview",
      icon: LayoutDashboard,
      href: role === "PROFESSIONAL" ? "/professional/dashboard" : "/dashboard",
      words: ["dashboard", "home", "workspace"],
    },
    {
      label: "Earnings",
      hint: "Payments and earnings",
      icon: Wallet,
      href: "/earnings",
      words: ["earning", "earnings", "money", "payment", "wallet"],
    },
    {
      label: "Projects",
      hint: "Your jobs and projects",
      icon: Briefcase,
      href: role === "PROFESSIONAL" ? "/professional/my-jobs" : "/my-jobs",
      words: ["job", "jobs", "project", "projects"],
    },
    {
      label: "Messages",
      hint: "Conversations",
      icon: MessageSquare,
      href: role === "PROFESSIONAL" ? "/professional/messages" : "/messages",
      words: ["message", "messages", "chat"],
    },
    {
      label: "Reports",
      hint: "Reports and activity",
      icon: FileBarChart,
      href: role === "PROFESSIONAL" ? "/professional/reports" : "/reports",
      words: ["report", "reports", "analytics"],
    },
    {
      label: "Profile",
      hint: "Account profile",
      icon: User,
      href:
        role === "ADMIN"
          ? "/admin"
          : role === "PROFESSIONAL"
            ? "/professional-profile?from=dashboard"
            : "/client-profile?from=dashboard",
      words: ["profile", "account", "personal"],
    },
  ];

  const pageResults = search.trim()
    ? pages.filter((page) =>
        `${page.label} ${page.words.join(" ")}`.includes(search.trim().toLowerCase()),
      )
    : [];

  useEffect(() => {
    if (!search.trim()) {
      setJobs([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(search.trim())}`)
        .then((response) => (response.ok ? response.json() : { jobs: [] }))
        .then((data: { jobs?: SearchJob[] }) => setJobs(data.jobs ?? []))
        .catch(() => setJobs([]));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (pathname.startsWith("/notifications")) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const response = await fetch("/api/portal/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const notifications = (await response.json()) as DashboardNotification[];
      setUnreadNotifications(notifications.filter((notification) => !notification.readAt).length);
    } catch {
      setUnreadNotifications(0);
    }
  }, [pathname]);

  useEffect(() => {
    void loadNotifications();
    window.addEventListener("servio:notification", loadNotifications);
    window.addEventListener("servio:message-read", loadNotifications);
    window.addEventListener("servio:notifications-read", loadNotifications);
    return () => {
      window.removeEventListener("servio:message-read", loadNotifications);
      window.removeEventListener("servio:notification", loadNotifications);
      window.removeEventListener("servio:notifications-read", loadNotifications);
    };
  }, [loadNotifications]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex flex-1 items-center gap-2">
        <div ref={searchRef} className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search jobs, professionals..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              const firstJob = jobs[0];
              const firstPage = pageResults[0];
              if (event.key === "Enter" && (firstJob || firstPage)) {
                if (firstJob) {
                  const jobUrl =
                    role === "PROFESSIONAL"
                      ? `/professional/job/${firstJob.id}`
                      : `/job/${firstJob.id}`;
                  router.push(jobUrl);
                } else {
                  router.push(firstPage!.href);
                }
                setSearchOpen(false);
              }
            }}
            className="h-9 w-full rounded-lg border border-input bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {searchOpen && search.trim() && (jobs.length > 0 || pageResults.length > 0) && (
            <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xl">
              {pageResults.slice(0, 4).map((page) => (
                <button
                  key={page.label}
                  type="button"
                  onClick={() => {
                    router.push(page.href);
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                >
                  <page.icon className="h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">{page.label}</span>
                    <span className="block text-xs text-muted-foreground">{page.hint}</span>
                  </span>
                </button>
              ))}
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => {
                    const jobUrl =
                      role === "PROFESSIONAL" ? `/professional/job/${job.id}` : `/job/${job.id}`;
                    router.push(jobUrl);
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                >
                  <Briefcase className="h-4 w-4 text-cta" />
                  <span>
                    <span className="block text-sm font-medium">{job.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {job.category}
                      {job.locationLabel ? ` · ${job.locationLabel}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {role === "CLIENT" && (
        <Link href="/post-job" className="hidden sm:inline-flex">
          <Button size="sm" className="bg-cta text-cta-foreground hover:bg-cta/90">
            Post a Job
          </Button>
        </Link>
      )}
      <Link
        href="/notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadNotifications > 0 && !pathname.startsWith("/notifications") && (
          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground">
            {unreadNotifications > 9 ? "9+" : unreadNotifications}
          </span>
        )}
      </Link>
      <div className="flex items-center gap-2">
        <ClientAccountMenu />
      </div>
    </header>
  );
}

type SearchJob = { id: number; title: string; category: string; locationLabel: string | null };
