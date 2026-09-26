"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Briefcase,
  FileBarChart,
  LayoutDashboard,
  MessageSquare,
  Search,
  User,
  Wallet,
} from "lucide-react";
import { ClientAccountMenu, type AccountUser } from "@/components/ClientAccountMenu";
import { Button } from "@/components/ui/button";

type DashboardNotification = {
  id: number;
  title: string;
  description: string | null;
  href?: string | null;
  createdAt: string;
  readAt: string | null;
};

export function AppHeader({
  role,
  initialUser,
}: {
  role?: string;
  initialUser?: AccountUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

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
            : "/my-info",
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
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setNotificationOpen(false);
  }, [pathname]);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as DashboardNotification[];
      setNotifications(data);
      if (pathname.startsWith("/notifications")) {
        setUnreadNotifications(0);
      } else {
        setUnreadNotifications(data.filter((notification) => !notification.readAt).length);
      }
    } catch {
      setNotifications([]);
      setUnreadNotifications(0);
    }
  }, [pathname]);

  const handleNotificationClick = async (item: DashboardNotification) => {
    setNotificationOpen(false);
    if (!item.readAt) {
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)));
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
      try {
        await fetch("/api/portal/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
        window.dispatchEvent(new CustomEvent("servio:notifications-read"));
      } catch {
        // Ignored
      }
    }

    if (item.href && item.href !== "#") {
      router.push(item.href);
    } else {
      router.push("/notifications");
    }
  };

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadNotifications(0);
    try {
      await fetch("/api/portal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, unread: false }),
      });
      window.dispatchEvent(new CustomEvent("servio:notifications-read"));
    } catch {
      // Ignored
    }
  };

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
      <div ref={notificationRef} className="relative">
        <button
          type="button"
          onClick={() => setNotificationOpen((prev) => !prev)}
          className={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors ${
            notificationOpen
              ? "bg-muted text-foreground"
              : "text-foreground/80 hover:bg-muted hover:text-foreground"
          }`}
          aria-label="Notifications"
          aria-expanded={notificationOpen}
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && !pathname.startsWith("/notifications") && (
            <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-bold text-cta-foreground shadow-sm">
              {unreadNotifications > 9 ? "9+" : unreadNotifications}
            </span>
          )}
        </button>

        {notificationOpen && (
          <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unreadNotifications > 0 && (
                  <span className="rounded-full bg-cta/15 px-2 py-0.5 text-xs font-semibold text-cta">
                    {unreadNotifications} new
                  </span>
                )}
              </div>
              {unreadNotifications > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="divide-y divide-border/60 max-h-[380px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                    <Bell className="h-5 w-5 opacity-60" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">
                    We'll notify you when something arrives
                  </p>
                </div>
              ) : (
                notifications.slice(0, 3).map((item) => {
                  const isUnread = !item.readAt;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationClick(item)}
                      className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-muted/60 ${
                        isUnread ? "bg-primary/[0.04]" : ""
                      }`}
                    >
                      <div className="mt-1 flex-shrink-0">
                        {isUnread ? (
                          <span className="block h-2 w-2 rounded-full bg-cta ring-4 ring-cta/20" />
                        ) : (
                          <span className="block h-2 w-2 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate text-xs font-semibold ${
                              isUnread ? "text-foreground" : "text-foreground/80"
                            }`}
                          >
                            {item.title}
                          </p>
                          <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-border/80 p-2 bg-muted/20">
              <Link
                href="/notifications"
                onClick={() => setNotificationOpen(false)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <span>View more</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ClientAccountMenu initialUser={initialUser} />
      </div>
    </header>
  );
}

function formatRelativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

type SearchJob = { id: number; title: string; category: string; locationLabel: string | null };
