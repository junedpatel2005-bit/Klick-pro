"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CheckCircle2,
  CreditCard,
  FileBarChart,
  HelpCircle,
  Info,
  LayoutDashboard,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ClientAccountMenu, type AccountUser } from "@/components/ClientAccountMenu";
import { Button } from "@/components/ui/button";
import { fetchPortalNotifications, invalidateNotificationsCache } from "@/lib/notifications-client";
import { capitalizeFirst, capitalizeWords } from "@/lib/utils";

type DashboardNotification = {
  id: number;
  title: string;
  description: string | null;
  href?: string | null;
  createdAt: string;
  readAt: string | null;
};

type SearchJob = {
  id: number;
  title: string;
  category: string | null;
  locationLabel: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  hourlyRate?: number | null;
  timingType?: string;
};

type SearchPro = {
  id: number;
  name: string;
  title: string;
  category: string;
  city: string;
  avatar: string | null;
  rating: number;
  reviews: number;
  hourlyRate: number | null;
};

type SearchPayment = {
  id: number;
  amount: number;
  status: string;
  description: string;
  type: string;
  createdAt: string;
};

type SystemPage = {
  id: string;
  label: string;
  hint: string;
  badge?: string;
  category: "Payments & Wallet" | "About & Guides" | "Marketplace & Jobs" | "Account";
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  words: string[];
};

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const d: number[] = [];
  for (let j = 0; j <= b.length; j++) {
    d[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = d[j] ?? 0;
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        d[j] = prev;
      } else {
        d[j] = Math.min(prev + 1, (d[j - 1] ?? 0) + 1, temp + 1);
      }
      prev = temp;
    }
  }
  return d[b.length] ?? 0;
}

function fuzzyMatch(corpus: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const c = corpus.toLowerCase();
  if (c.includes(q)) return true;

  const typoSynonyms: Record<string, string[]> = {
    payment: [
      "paymnet",
      "paymnt",
      "payement",
      "pay",
      "paymants",
      "deposit",
      "transfer",
      "billing",
      "bill",
      "invoice",
      "escrow",
      "milestone",
      "funds",
      "payout",
    ],
    wallet: ["walet", "money", "balance", "add money", "withdraw", "deposit"],
    about: ["abowt", "abut", "about us", "company", "mission", "story", "info", "klick pro"],
    help: ["support", "faq", "contact", "issue", "guide"],
    professional: [
      "profesional",
      "proffesional",
      "pro",
      "pros",
      "freelancer",
      "hire",
      "worker",
      "contractor",
      "expert",
    ],
    projects: ["project", "job", "jobs", "proposals", "my jobs", "task"],
    reports: ["report", "repot", "statement", "receipt", "gst", "history"],
  };

  for (const [canonical, variants] of Object.entries(typoSynonyms)) {
    if (variants.some((v) => q.includes(v) || v.includes(q))) {
      if (c.includes(canonical)) return true;
    }
  }

  const queryWords = q.split(/\s+/).filter(Boolean);
  const corpusWords = c.split(/[\s,·\-_/]+/).filter(Boolean);

  return queryWords.every((qw) =>
    corpusWords.some((cw) => {
      if (cw.startsWith(qw) || qw.startsWith(cw)) return true;
      if (qw.length >= 4 && cw.length >= 4) {
        return levenshteinDistance(qw, cw) <= (qw.length > 5 ? 2 : 1);
      }
      return false;
    }),
  );
}

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [pros, setPros] = useState<SearchPro[]>([]);
  const [payments, setPayments] = useState<SearchPayment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [isBellRinging, setIsBellRinging] = useState(false);

  const systemPages: SystemPage[] = useMemo(
    () => [
      {
        id: "wallet-payments",
        label: role === "PROFESSIONAL" ? "Earnings & Payouts" : "Wallet & Payments",
        hint:
          role === "PROFESSIONAL"
            ? "Track milestone releases, wallet balance, and withdrawals"
            : "Manage deposits, escrow balances, and release payments",
        badge: "Finance",
        category: "Payments & Wallet",
        icon: Wallet,
        href: "/earnings",
        words: [
          "payment",
          "payments",
          "paymnet",
          "paymnt",
          "payement",
          "wallet",
          "walet",
          "money",
          "funds",
          "deposit",
          "withdraw",
          "escrow",
          "balance",
          "transfer",
          "payout",
        ],
      },
      {
        id: "invoices-reports",
        label: "Invoices & Payment Reports",
        hint: "Download project invoices, GST summaries, and receipts",
        badge: "Reports",
        category: "Payments & Wallet",
        icon: FileBarChart,
        href: role === "PROFESSIONAL" ? "/professional/reports" : "/reports",
        words: [
          "invoice",
          "invoices",
          "receipt",
          "receipts",
          "billing",
          "bill",
          "tax",
          "gst",
          "statement",
          "payment report",
          "payment reports",
          "paymnet",
          "reports",
        ],
      },
      {
        id: "about-escrow",
        label: "About Escrow & Milestone Payments",
        hint: "Learn how 100% money-back escrow protection and milestone payments work",
        badge: "Guide",
        category: "About & Guides",
        icon: ShieldCheck,
        href: "/how-it-works",
        words: [
          "about payment",
          "about payments",
          "about escrow",
          "how payment works",
          "milestone payment",
          "protection",
          "guarantee",
          "safe payment",
          "escrow",
          "paymnet",
        ],
      },
      {
        id: "about-klickpro",
        label: "About Klick-Pro",
        hint: "Our mission, company story, leadership, and trust standards",
        badge: "About",
        category: "About & Guides",
        icon: Info,
        href: "/about",
        words: [
          "about",
          "about us",
          "abowt",
          "abut",
          "company",
          "mission",
          "klick pro",
          "story",
          "team",
          "who we are",
        ],
      },
      {
        id: "how-it-works",
        label: "How Klick-Pro Works",
        hint: "Step-by-step guide to posting jobs, hiring, and escrow milestones",
        badge: "Guide",
        category: "About & Guides",
        icon: Sparkles,
        href: "/how-it-works",
        words: ["how it works", "guide", "workflow", "process", "tutorial", "steps"],
      },
      {
        id: "find-professionals",
        label: "Find Professionals",
        hint: "Browse verified professionals across all categories",
        badge: "Explore",
        category: "Marketplace & Jobs",
        icon: Users,
        href: "/discover",
        words: [
          "find",
          "discover",
          "professionals",
          "professional",
          "profesional",
          "hire",
          "category",
          "service",
          "experts",
          "pro",
          "pros",
        ],
      },
      {
        id: "manage-projects",
        label: "Manage Projects",
        hint: "View and track all open and ongoing jobs",
        badge: "Projects",
        category: "Marketplace & Jobs",
        icon: Briefcase,
        href: role === "PROFESSIONAL" ? "/professional/my-jobs" : "/my-jobs",
        words: [
          "jobs",
          "job",
          "projects",
          "project",
          "my jobs",
          "manage projects",
          "proposals",
        ],
      },
      ...(role === "CLIENT"
        ? [
            {
              id: "post-job",
              label: "Post a Job",
              hint: "Publish a new job requirement and receive quotes",
              badge: "Client",
              category: "Marketplace & Jobs" as const,
              icon: Briefcase,
              href: "/post-job",
              words: ["post", "post a job", "new job", "create project", "hire"],
            },
          ]
        : []),
      {
        id: "messages",
        label: "Messages & Chat",
        hint: "Direct communication with clients and professionals",
        badge: "Chat",
        category: "Account",
        icon: MessageSquare,
        href: role === "PROFESSIONAL" ? "/professional/messages" : "/messages",
        words: ["message", "messages", "mesage", "chat", "inbox", "conversation"],
      },
      {
        id: "faq-support",
        label: "FAQ & Support Center",
        hint: "Answers about payments, hiring, and dispute resolution",
        badge: "Help",
        category: "About & Guides",
        icon: HelpCircle,
        href: "/faq",
        words: ["faq", "help", "support", "contact", "questions", "dispute", "resolution"],
      },
      {
        id: "dashboard",
        label: "Dashboard",
        hint: "Workspace overview and quick statistics",
        badge: "Overview",
        category: "Account",
        icon: LayoutDashboard,
        href: role === "PROFESSIONAL" ? "/professional/dashboard" : "/dashboard",
        words: ["dashboard", "home", "workspace"],
      },
      {
        id: "profile",
        label: "Account Profile",
        hint: "Manage your personal profile and verification status",
        badge: "Profile",
        category: "Account",
        icon: User,
        href:
          role === "ADMIN"
            ? "/admin"
            : role === "PROFESSIONAL"
              ? "/professional-profile?from=dashboard"
              : "/my-info",
        words: ["profile", "account", "personal", "settings", "verification"],
      },
    ],
    [role],
  );

  const matchedPages = useMemo(() => {
    if (!search.trim()) return [];
    return systemPages.filter((page) =>
      fuzzyMatch(`${page.label} ${page.hint} ${page.words.join(" ")}`, search),
    );
  }, [search, systemPages]);

  // Debounced API search for jobs, professionals, and payments
  useEffect(() => {
    const query = search.trim();
    if (!query) {
      setJobs([]);
      setPros([]);
      setPayments([]);
      setIsSearching(false);
      setActiveIndex(-1);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : {}))
        .then(
          (data: {
            jobs?: SearchJob[];
            professionals?: SearchPro[];
            payments?: SearchPayment[];
          }) => {
            setJobs(data.jobs ?? []);
            setPros(data.professionals ?? []);
            setPayments(data.payments ?? []);
            setActiveIndex(-1);
          },
        )
        .catch(() => {
          setJobs([]);
          setPros([]);
          setPayments([]);
        })
        .finally(() => setIsSearching(false));
    }, 160);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  // Close search and notification dropdowns on outside click
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    setNotificationOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Notification handlers
  const loadNotifications = useCallback(
    async (force = false) => {
      try {
        const data = (await fetchPortalNotifications({ force })) as DashboardNotification[];
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
    },
    [pathname],
  );

  const handleNotificationClick = async (item: DashboardNotification) => {
    setNotificationOpen(false);
    if (!item.readAt) {
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: now } : n)));
      setUnreadNotifications((prev) => Math.max(0, prev - 1));
      invalidateNotificationsCache();
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

  useEffect(() => {
    const onBellRing = () => {
      setIsBellRinging(true);
      setTimeout(() => setIsBellRinging(false), 800);
    };
    window.addEventListener("servio:bell-ring", onBellRing);
    return () => window.removeEventListener("servio:bell-ring", onBellRing);
  }, []);

  const handleMarkAllRead = async () => {
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadNotifications(0);
    invalidateNotificationsCache();
    window.dispatchEvent(new CustomEvent("servio:bell-ring"));
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
    const onNotification = () => void loadNotifications(true);
    const onRead = () => {
      setUnreadNotifications(0);
      setNotifications((prev) => {
        const now = new Date().toISOString();
        return prev.map((n) => ({ ...n, readAt: n.readAt ?? now }));
      });
    };
    window.addEventListener("servio:notification", onNotification);
    window.addEventListener("servio:notifications-read", onRead);
    return () => {
      window.removeEventListener("servio:notification", onNotification);
      window.removeEventListener("servio:notifications-read", onRead);
    };
  }, [loadNotifications]);

  // Flatten selectable items for keyboard navigation
  const selectableItems = useMemo(() => {
    const items: { id: string; action: () => void }[] = [];

    matchedPages.slice(0, 4).forEach((page) => {
      items.push({
        id: `page-${page.id}`,
        action: () => {
          router.push(page.href);
          setSearchOpen(false);
        },
      });
    });

    pros.slice(0, 4).forEach((pro) => {
      items.push({
        id: `pro-${pro.id}`,
        action: () => {
          router.push(`/pro/${pro.id}`);
          setSearchOpen(false);
        },
      });
    });

    jobs.slice(0, 4).forEach((job) => {
      items.push({
        id: `job-${job.id}`,
        action: () => {
          const jobUrl =
            role === "PROFESSIONAL" ? `/professional/job/${job.id}` : `/job/${job.id}`;
          router.push(jobUrl);
          setSearchOpen(false);
        },
      });
    });

    payments.slice(0, 3).forEach((payment) => {
      items.push({
        id: `payment-${payment.id}`,
        action: () => {
          router.push("/earnings");
          setSearchOpen(false);
        },
      });
    });

    return items;
  }, [matchedPages, pros, jobs, payments, role, router]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveIndex((prev) => (prev + 1 >= selectableItems.length ? 0 : prev + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchOpen(true);
      setActiveIndex((prev) => (prev <= 0 ? selectableItems.length - 1 : prev - 1));
      return;
    }

    if (event.key === "Escape") {
      setSearchOpen(false);
      searchInputRef.current?.blur();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      // If a specific item is selected with arrow keys, trigger it
      const selected = activeIndex >= 0 ? selectableItems[activeIndex] : undefined;
      if (selected) {
        selected.action();
        return;
      }

      // If top search result matches
      const firstItem = selectableItems[0];
      if (firstItem) {
        firstItem.action();
        return;
      }

      // Smart Fallback routing based on query keywords
      const queryLower = search.trim().toLowerCase();
      if (
        fuzzyMatch("payment wallet earnings money paymnet deposit withdraw", queryLower)
      ) {
        router.push("/earnings");
      } else if (fuzzyMatch("about us mission company who we are story", queryLower)) {
        router.push("/about");
      } else if (fuzzyMatch("report reports invoice billing gst", queryLower)) {
        router.push(role === "PROFESSIONAL" ? "/professional/reports" : "/reports");
      } else if (role === "PROFESSIONAL") {
        router.push(`/professional/my-jobs?q=${encodeURIComponent(search.trim())}`);
      } else {
        router.push(`/discover?query=${encodeURIComponent(search.trim())}`);
      }
      setSearchOpen(false);
    }
  };

  const hasAnyResults =
    matchedPages.length > 0 || pros.length > 0 || jobs.length > 0 || payments.length > 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex flex-1 items-center gap-2">
        <div ref={searchRef} className="relative w-full max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            placeholder="Search jobs, professionals, payments, about..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleKeyDown}
            className="h-9.5 w-full rounded-xl border border-input bg-surface pl-9.5 pr-8 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          {/* Quick Clear Button */}
          {search.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setJobs([]);
                setPros([]);
                setPayments([]);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Search Dropdown Results */}
          {searchOpen && search.trim() && (
            <div className="absolute left-0 right-0 top-11.5 z-50 max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-md">
              {/* Searching Indicator */}
              {isSearching && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Searching for &ldquo;{search}&rdquo;…</span>
                </div>
              )}

              {/* SECTION 1: Pages, Wallet, Invoices, About */}
              {matchedPages.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Pages & Guides
                  </p>
                  <div className="space-y-0.5">
                    {matchedPages.slice(0, 4).map((page) => {
                      const itemIndex = selectableItems.findIndex(
                        (i) => i.id === `page-${page.id}`,
                      );
                      const isHighlighted = itemIndex === activeIndex;

                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => {
                            router.push(page.href);
                            setSearchOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            isHighlighted
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                            <page.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{page.label}</span>
                              {page.badge && (
                                <span className="rounded-md bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                                  {page.badge}
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{page.hint}</p>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 2: Verified Professionals */}
              {pros.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Verified Professionals
                  </p>
                  <div className="space-y-0.5">
                    {pros.slice(0, 4).map((pro) => {
                      const itemIndex = selectableItems.findIndex((i) => i.id === `pro-${pro.id}`);
                      const isHighlighted = itemIndex === activeIndex;

                      return (
                        <button
                          key={pro.id}
                          type="button"
                          onClick={() => {
                            router.push(`/pro/${pro.id}`);
                            setSearchOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            isHighlighted
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold text-xs text-primary">
                            {pro.avatar ? (
                              <img
                                src={pro.avatar}
                                alt={pro.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              pro.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{pro.name}</span>
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              {pro.rating > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                  <Star className="h-3 w-3 fill-current" />
                                  {pro.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{pro.title}</span>
                              {pro.city && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5 shrink-0">
                                    <MapPin className="h-3 w-3" />
                                    {pro.city}
                                  </span>
                                </>
                              )}
                              {pro.hourlyRate ? (
                                <>
                                  <span>•</span>
                                  <span className="shrink-0 font-medium text-foreground">
                                    ₹{pro.hourlyRate}/hr
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 3: Jobs & Projects */}
              {jobs.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Jobs & Requirements
                  </p>
                  <div className="space-y-0.5">
                    {jobs.slice(0, 4).map((job) => {
                      const itemIndex = selectableItems.findIndex((i) => i.id === `job-${job.id}`);
                      const isHighlighted = itemIndex === activeIndex;

                      return (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => {
                            const jobUrl =
                              role === "PROFESSIONAL"
                                ? `/professional/job/${job.id}`
                                : `/job/${job.id}`;
                            router.push(jobUrl);
                            setSearchOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            isHighlighted
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cta/15 text-cta">
                            <Briefcase className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{job.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {job.category}
                              {job.locationLabel ? ` · ${job.locationLabel}` : ""}
                            </span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 4: Recent Payments & Transactions */}
              {payments.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Your Payments & Transactions
                  </p>
                  <div className="space-y-0.5">
                    {payments.slice(0, 3).map((payment) => {
                      const itemIndex = selectableItems.findIndex(
                        (i) => i.id === `payment-${payment.id}`,
                      );
                      const isHighlighted = itemIndex === activeIndex;

                      return (
                        <button
                          key={payment.id}
                          type="button"
                          onClick={() => {
                            router.push("/earnings");
                            setSearchOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                            isHighlighted
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold">
                                {payment.description}
                              </span>
                              <span className="font-bold text-xs text-foreground shrink-0">
                                ₹{payment.amount.toLocaleString("en-IN")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                {payment.status}
                              </span>
                              <span>•</span>
                              <span>{formatRelativeTime(payment.createdAt)}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* EMPTY STATE */}
              {!hasAnyResults && !isSearching && (
                <div className="p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    No results found for &ldquo;{search}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try searching for payment, wallet, about us, or a professional category.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                    {["Payment", "Wallet", "About", "Plumber", "Invoices"].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          setSearch(sug.toLowerCase());
                          searchInputRef.current?.focus();
                        }}
                        className="rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* DROPDOWN FOOTER ACTIONS */}
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/80 px-3 py-2 text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    if (role === "PROFESSIONAL") {
                      router.push(`/professional/my-jobs?q=${encodeURIComponent(search.trim())}`);
                    } else {
                      router.push(`/discover?query=${encodeURIComponent(search.trim())}`);
                    }
                    setSearchOpen(false);
                  }}
                  className="font-medium text-primary hover:underline"
                >
                  See all directory results for &ldquo;{search.trim()}&rdquo; →
                </button>
                <div className="flex items-center gap-2 text-[10px]">
                  <span>
                    <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-mono">↵</kbd>{" "}
                    to open
                  </span>
                  <span>
                    <kbd className="rounded border bg-muted px-1 py-0.5 text-[9px] font-mono">↑↓</kbd>{" "}
                    to navigate
                  </span>
                </div>
              </div>
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

      {/* Notifications bell */}
      <div ref={notificationRef} className="relative">
        <button
          type="button"
          id="header-notification-bell"
          onClick={() => setNotificationOpen((prev) => !prev)}
          className={`relative grid h-9 w-9 place-items-center rounded-lg transition-colors ${
            notificationOpen
              ? "bg-muted text-foreground"
              : "text-foreground/80 hover:bg-muted hover:text-foreground"
          }`}
          aria-label="Notifications"
          aria-expanded={notificationOpen}
        >
          <Bell
            className={`h-4 w-4 transition-transform duration-200 ${
              isBellRinging ? "animate-bell-ring text-primary" : ""
            }`}
          />
          {unreadNotifications > 0 && !pathname.startsWith("/notifications") && (
            <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-cta px-1 text-[9.5px] font-bold text-cta-foreground shadow-sm ring-2 ring-background">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
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
                    We&apos;ll notify you when something arrives
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
                            {capitalizeFirst(item.title)}
                          </p>
                          <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {capitalizeFirst(item.description)}
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
                prefetch={false}
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
