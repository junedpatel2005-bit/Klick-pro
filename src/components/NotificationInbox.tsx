"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPortalNotifications, invalidateNotificationsCache } from "@/lib/notifications-client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Check,
  CheckCheck,
  CircleDollarSign,
  CircleDot,
  Clock3,
  ExternalLink,
  Eye,
  FileText,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { capitalizeFirst } from "@/lib/utils";

export type Notification = {
  id: number;
  type: string;
  title: string;
  description: string | null;
  href: string | null;
  createdAt: string;
  readAt: string | null;
  projectId?: number | null;
  jobId?: number | null;
  isProject?: boolean;
  projectTitle?: string | null;
  projectStatus?: string | null;
  category?: string | null;
  clientName?: string | null;
  professionalName?: string | null;
};

type ProjectGroup = {
  key: string;
  projectId: number | null;
  jobId: number | null;
  title: string;
  projectStatus: string | null;
  category: string | null;
  clientName: string | null;
  professionalName: string | null;
  notifications: Notification[];
};

type TimelineData = {
  project: {
    id: number;
    jobId?: number | null;
    status: string;
    progress: number;
    startedAt?: string | null;
    completedAt?: string | null;
  };
  job?: {
    id?: number;
    title?: string | null;
    category?: string | null;
    description?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    hourlyRate?: number | null;
    timingType?: string | null;
    urgency?: string | null;
    workMode?: string | null;
    locationAddress?: string | null;
    deadline?: string | null;
    attachments?: Array<{ id: number; fileName: string; previewUrl?: string | null }>;
  } | null;
  client?: {
    id?: number;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    averageRating?: number | null;
    isVerified?: boolean;
    address?: string | null;
  } | null;
  professional?: {
    id?: number;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    averageRating?: number | null;
    isVerified?: boolean;
    address?: string | null;
  } | null;
  proposals?: Array<{
    id: number;
    bidAmount: number | null;
    duration: string | null;
    coverLetter: string | null;
    status: string;
    createdAt: string;
    professional: {
      id: number;
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
      averageRating?: number | null;
      isVerified?: boolean;
    };
  }>;
  milestones?: Array<{
    id: number;
    title: string;
    amount: number;
    status: string;
    payment?: { status: string; professionalPayoutAmount?: number | null } | null;
  }>;
  timeline: Array<{
    id: number;
    title: string;
    description: string | null;
    createdAt: string;
    actorRole: string;
  }>;
  agreedAmount?: number | null;
};

function getCategoryIcon(type: string) {
  if (type.includes("DISPUTE"))
    return {
      Icon: AlertTriangle,
      color: "text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-800",
    };
  if (type.includes("SECURITY") || type.includes("VERIFICATION") || type.includes("KYC"))
    return {
      Icon: ShieldCheck,
      color: "text-rose-600 bg-rose-500/10 border-rose-200 dark:border-rose-800",
    };
  if (type.includes("PAYMENT") || type.includes("PAYOUT") || type.includes("ESCROW"))
    return {
      Icon: CircleDollarSign,
      color: "text-emerald-600 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800",
    };
  if (type.includes("MILESTONE"))
    return {
      Icon: Activity,
      color: "text-cyan-600 bg-cyan-500/10 border-cyan-200 dark:border-cyan-800",
    };
  if (type.includes("PROPOSAL") || type.includes("OFFER") || type.includes("BID"))
    return {
      Icon: FileText,
      color: "text-purple-600 bg-purple-500/10 border-purple-200 dark:border-purple-800",
    };
  if (
    type.includes("ACCOUNT") ||
    type.includes("USER") ||
    type.includes("REGISTER") ||
    type.includes("WELCOME")
  )
    return {
      Icon: UserPlus,
      color: "text-indigo-600 bg-indigo-500/10 border-indigo-200 dark:border-indigo-800",
    };
  if (
    type.includes("PROJECT") ||
    type.includes("JOB") ||
    type.includes("CONTRACT") ||
    type.includes("MATCHING")
  )
    return {
      Icon: BriefcaseBusiness,
      color: "text-blue-600 bg-blue-500/10 border-blue-200 dark:border-blue-800",
    };
  return {
    Icon: Bell,
    color: "text-slate-600 bg-slate-500/10 border-slate-200 dark:border-slate-800",
  };
}

function getProjectStatusBadge(status?: string | null) {
  if (!status) {
    return {
      label: "In Progress",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/70",
      dotClass: "bg-emerald-500 animate-pulse",
    };
  }
  const s = status.toUpperCase();
  if (s === "IN_PROGRESS") {
    return {
      label: "In Progress",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/70",
      dotClass: "bg-emerald-500 animate-pulse",
    };
  }
  if (s === "READY_TO_START") {
    return {
      label: "Ready to Start",
      className:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/70",
      dotClass: "bg-blue-500",
    };
  }
  if (s === "AWAITING_CLIENT_REVIEW" || s === "FINAL_WORK_SUBMITTED") {
    return {
      label: "Review Needed",
      className:
        "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/70",
      dotClass: "bg-purple-500",
    };
  }
  if (s === "REVISION_REQUESTED") {
    return {
      label: "Revision Requested",
      className:
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/70",
      dotClass: "bg-rose-500",
    };
  }
  if (s === "COMPLETED" || s === "CLOSED") {
    return {
      label: "Completed",
      className:
        "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
      dotClass: "bg-slate-400",
    };
  }
  return {
    label: s.replace(/_/g, " "),
    className:
      "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/70",
    dotClass: "bg-indigo-500",
  };
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function isEngagementType(type?: string | null): boolean {
  if (!type) return false;
  const t = type.toUpperCase();
  return (
    t.startsWith("PROJECT_") ||
    t.startsWith("MILESTONE_") ||
    t.startsWith("DISPUTE_") ||
    t.startsWith("REVISION_") ||
    t.startsWith("WORK_") ||
    t.startsWith("PROPOSAL_") ||
    t.startsWith("NEW_PROPOSAL") ||
    t.startsWith("REQUEST_") ||
    t.startsWith("COUNTER_") ||
    t.startsWith("OFFER_") ||
    t.startsWith("CONTRACT_") ||
    t.startsWith("BID_") ||
    t.startsWith("HIRE_") ||
    t.startsWith("NEW_HIRE") ||
    t === "JOB_POSTED" ||
    t === "NEW_JOB" ||
    t.includes("PAYOUT") ||
    t.includes("ESCROW")
  );
}

function cleanProjectTitle(title?: string | null): string | null {
  if (!title) return null;
  const cleaned = title.replace(/^New job posted\s+/i, "").trim();
  return cleaned || null;
}

export function NotificationInbox({ admin: _isAdmin = false }: { admin?: boolean } = {}) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // 2 TABS: "projects" or "other"
  const [activeTab, setActiveTab] = useState<"projects" | "other">("projects");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Pop-up Timeline Modal state
  const [timelineTarget, setTimelineTarget] = useState<{
    projectId?: number | null;
    jobId?: number | null;
  } | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [modalTab, setModalTab] = useState<"timeline" | "details" | "proposals">("timeline");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await fetchPortalNotifications({ force: true })) as Notification[];
      setItems(Array.isArray(data) ? data : []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Split into Project items & Other items
  const { projectItems, otherItems } = useMemo(() => {
    const engagedJobIds = new Set<number>();
    const engagedProjectIds = new Set<number>();
    const engagedTitles = new Set<string>();

    for (const item of items) {
      const hasEngagement = Boolean(
        item.projectId || item.isProject || isEngagementType(item.type),
      );
      if (hasEngagement) {
        if (item.jobId) engagedJobIds.add(item.jobId);
        if (item.projectId) engagedProjectIds.add(item.projectId);
        const t = cleanProjectTitle(item.projectTitle)?.toLowerCase();
        if (t) engagedTitles.add(t);
      }
    }

    const proj: Notification[] = [];
    const oth: Notification[] = [];

    for (const item of items) {
      const t = cleanProjectTitle(item.projectTitle)?.toLowerCase();
      const belongsToActiveEngagement = Boolean(
        item.projectId ||
        item.isProject ||
        isEngagementType(item.type) ||
        (item.jobId && engagedJobIds.has(item.jobId)) ||
        (t && engagedTitles.has(t) && (item.jobId || item.projectId)),
      );

      if (belongsToActiveEngagement) {
        proj.push(item);
      } else {
        oth.push(item);
      }
    }

    return { projectItems: proj, otherItems: oth };
  }, [items]);

  useEffect(() => {
    if (
      !loading &&
      activeTab === "projects" &&
      projectItems.length === 0 &&
      otherItems.length > 0
    ) {
      setActiveTab("other");
    }
  }, [activeTab, loading, otherItems.length, projectItems.length]);

  // Group project items by project/job (unifying all updates for the same project/job into one card)
  const projectGroups = useMemo(() => {
    const map = new Map<string, ProjectGroup>();
    const normalized = query.trim().toLowerCase();

    // Pass 1: Build bidirectional cross-reference maps between projectIds, jobIds, and titles
    const projToJob = new Map<number, number>();
    const jobToProj = new Map<number, number>();
    const titleToJob = new Map<string, number>();
    const titleToProj = new Map<string, number>();

    projectItems.forEach((item) => {
      if (item.projectId && item.jobId) {
        projToJob.set(item.projectId, item.jobId);
        jobToProj.set(item.jobId, item.projectId);
      }
      const t = cleanProjectTitle(item.projectTitle)?.trim().toLowerCase();
      if (t) {
        if (item.jobId && !titleToJob.has(t)) titleToJob.set(t, item.jobId);
        if (item.projectId && !titleToProj.has(t)) titleToProj.set(t, item.projectId);
      }
    });

    // Pass 2: Group with unified canonical key
    projectItems.forEach((item) => {
      if (unreadOnly && item.readAt) return;
      if (normalized) {
        const text =
          `${item.title} ${item.description ?? ""} ${item.projectTitle ?? ""} ${item.clientName ?? ""} ${item.professionalName ?? ""}`.toLowerCase();
        if (!text.includes(normalized)) return;
      }

      const t = cleanProjectTitle(item.projectTitle)?.trim().toLowerCase();
      const canonicalJobId =
        item.jobId ??
        (item.projectId ? projToJob.get(item.projectId) : null) ??
        (t ? titleToJob.get(t) : null) ??
        null;
      const canonicalProjectId =
        item.projectId ??
        (item.jobId ? jobToProj.get(item.jobId) : null) ??
        (t ? titleToProj.get(t) : null) ??
        null;

      let key: string;
      if (canonicalJobId) {
        key = `j_${canonicalJobId}`;
      } else if (canonicalProjectId) {
        key = `p_${canonicalProjectId}`;
      } else if (t) {
        key = `t_${t}`;
      } else {
        key = `n_${item.id}`;
      }

      const cleanedTitle = cleanProjectTitle(item.projectTitle);
      const existing = map.get(key);
      if (existing) {
        existing.notifications.push(item);
        if (!existing.projectId && canonicalProjectId) existing.projectId = canonicalProjectId;
        if (!existing.jobId && canonicalJobId) existing.jobId = canonicalJobId;
        if (!existing.clientName && item.clientName) existing.clientName = item.clientName;
        if (!existing.professionalName && item.professionalName)
          existing.professionalName = item.professionalName;
        if (!existing.category && item.category) existing.category = item.category;
        if (!existing.projectStatus && item.projectStatus)
          existing.projectStatus = item.projectStatus;
        if (
          (!existing.title ||
            existing.title.startsWith("Job #") ||
            existing.title.startsWith("Project #")) &&
          cleanedTitle
        ) {
          existing.title = cleanedTitle;
        }
      } else {
        map.set(key, {
          key,
          projectId: canonicalProjectId,
          jobId: canonicalJobId,
          title:
            cleanedTitle ||
            (canonicalProjectId
              ? `Project #${canonicalProjectId}`
              : `Job #${canonicalJobId ?? item.id}`),
          projectStatus: item.projectStatus ?? null,
          category: item.category ?? null,
          clientName: item.clientName ?? null,
          professionalName: item.professionalName ?? null,
          notifications: [item],
        });
      }
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        notifications: [...group.notifications].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      }))
      .sort(
        (a, b) =>
          new Date(b.notifications[0]?.createdAt ?? 0).getTime() -
          new Date(a.notifications[0]?.createdAt ?? 0).getTime(),
      );
  }, [projectItems, query, unreadOnly]);

  // Filtered other items
  const filteredOtherItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return otherItems.filter((item) => {
      if (unreadOnly && item.readAt) return false;
      if (!normalized) return true;
      return `${item.title} ${item.description ?? ""}`.toLowerCase().includes(normalized);
    });
  }, [otherItems, query, unreadOnly]);

  const totalUnreadCount = useMemo(() => items.filter((i) => !i.readAt).length, [items]);
  const projectUnreadCount = useMemo(
    () => projectItems.filter((i) => !i.readAt).length,
    [projectItems],
  );
  const otherUnreadCount = useMemo(() => otherItems.filter((i) => !i.readAt).length, [otherItems]);

  // Actions
  async function markRead(ids: number[], unread = false) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((curr) =>
      curr.map((i) =>
        ids.includes(i.id) ? { ...i, readAt: unread ? null : (i.readAt ?? now) } : i,
      ),
    );
    invalidateNotificationsCache();
    try {
      await fetch("/api/portal/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, unread }),
      });
      window.dispatchEvent(new CustomEvent("servio:notifications-read"));
    } catch {
      // Ignored
    }
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setItems((curr) => curr.map((i) => ({ ...i, readAt: i.readAt ?? now })));
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
  }

  async function deleteNotification(id: number, e?: React.MouseEvent) {
    e?.stopPropagation();
    setItems((curr) => curr.filter((i) => i.id !== id));
    invalidateNotificationsCache();
    try {
      await fetch("/api/portal/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      window.dispatchEvent(new CustomEvent("servio:notifications-read"));
    } catch {
      // Ignored
    }
  }

  // Open rich timeline pop-up
  async function openTimelineModal(
    opts: { projectId?: number | null; jobId?: number | null },
    e?: React.MouseEvent,
  ) {
    e?.stopPropagation();
    setTimelineTarget(opts);
    setTimeline(null);
    setTimelineLoading(true);
    setModalTab("timeline");

    const queryParam = opts.projectId ? `id=${opts.projectId}` : `jobId=${opts.jobId}`;
    try {
      const res = await fetch(`/api/portal/project?${queryParam}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch project");
      const data = (await res.json()) as TimelineData;
      setTimeline(data);

      const related = items
        .filter(
          (i) =>
            (opts.projectId && i.projectId === opts.projectId) ||
            (opts.jobId && i.jobId === opts.jobId),
        )
        .map((i) => i.id);
      if (related.length > 0) {
        void markRead(related, false);
      }
    } catch {
      setTimeline(null);
    } finally {
      setTimelineLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Notifications
            </h1>
            {totalUnreadCount > 0 ? (
              <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 px-3 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-2xs">
                {totalUnreadCount} new
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                All caught up
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Real-time project timeline updates, milestones, offers, and workspace notifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {totalUnreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer active:scale-95"
              title="Mark all as read"
            >
              <CheckCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-2xs disabled:opacity-50 cursor-pointer active:scale-95"
            title="Refresh notifications"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-2 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* THE 2 TABS */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "projects"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BriefcaseBusiness className="h-3.5 w-3.5" />
              <span>Project &amp; Job Activity</span>
              {projectItems.length > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeTab === "projects"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800"
                      : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {projectItems.length}
                </span>
              )}
              {projectUnreadCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  {projectUnreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("other")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                activeTab === "other"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bell className="h-3.5 w-3.5" />
              <span>Other Notifications</span>
              {otherItems.length > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    activeTab === "other"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800"
                      : "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {otherItems.length}
                </span>
              )}
              {otherUnreadCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  {otherUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Search & Unread filter */}
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter notifications…"
                className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 pl-8 pr-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setUnreadOnly((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                unreadOnly
                  ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <CircleDot className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Unread only
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && items.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading notifications…</p>
        </div>
      )}

      {/* TAB 1: PROJECT & JOB ACTIVITY (Project-Wise Grouped) */}
      {!loading && activeTab === "projects" && (
        <div className="space-y-4">
          {projectGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
              <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No project activity found</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {unreadOnly || query
                  ? "Try clearing search filters or the unread toggle."
                  : "Proposals received, milestones funded, and project status alerts will appear here."}
              </p>
            </div>
          ) : (
            projectGroups.map((group) => {
              const unreadCount = group.notifications.filter((n) => !n.readAt).length;
              const statusBadge = getProjectStatusBadge(group.projectStatus);
              const isRunning = Boolean(group.projectId);

              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {/* Project Card Header */}
                  <div className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/25 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs">
                            <BriefcaseBusiness className="h-4 w-4" />
                          </span>
                          <h2 className="truncate text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                            {group.title}
                          </h2>

                          {/* Project Status Pill */}
                          {statusBadge && isRunning && (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusBadge.dotClass}`} />
                              <span>{statusBadge.label}</span>
                            </span>
                          )}

                          {group.category && (
                            <span className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              {group.category}
                            </span>
                          )}

                          {unreadCount > 0 && (
                            <span className="rounded-full bg-indigo-600 text-white px-2 py-0.5 text-[10px] font-bold shadow-xs">
                              {unreadCount} unread
                            </span>
                          )}
                        </div>

                        {/* Client & Pro metadata */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                          {group.clientName && (
                            <span className="inline-flex items-center gap-1.5">
                              <UserRound className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" /> Client:{" "}
                              <strong className="text-slate-800 dark:text-slate-200 font-medium">
                                {group.clientName}
                              </strong>
                            </span>
                          )}
                          {group.professionalName && (
                            <span className="inline-flex items-center gap-1.5">
                              <UsersRound className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" /> Pro:{" "}
                              <strong className="text-slate-800 dark:text-slate-200 font-medium">
                                {group.professionalName}
                              </strong>
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {group.notifications.length} update{group.notifications.length > 1 ? "s" : ""} · Latest{" "}
                            {relativeTime(group.notifications[0]?.createdAt ?? "")}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Direct Go to Timeline button */}
                        {group.projectId ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/project/${group.projectId}/tracking?tab=timeline#timeline`);
                              }}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-xs hover:shadow-sm transition-all active:scale-95 cursor-pointer"
                              title="Go to project tracking page and open timeline"
                            >
                              <Clock3 className="h-3.5 w-3.5" />
                              <span>Go to Timeline</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => void openTimelineModal({ projectId: group.projectId, jobId: group.jobId }, e)}
                              className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-2 text-xs font-medium transition cursor-pointer shadow-2xs"
                              title="Quick popup preview"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Preview</span>
                            </button>
                          </>
                        ) : group.jobId ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/job/${group.jobId}`);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>View Job &amp; Proposals</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        ) : null}

                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const ids = group.notifications.filter((n) => !n.readAt).map((n) => n.id);
                              void markRead(ids, false);
                            }}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition cursor-pointer shadow-2xs"
                            title="Mark all notifications in this project as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* List of notifications inside this project */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {group.notifications.map((item) => {
                      const { Icon, color } = getCategoryIcon(item.type);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!item.readAt) void markRead([item.id], false);
                            if (item.href) router.push(item.href);
                          }}
                          className={`group flex items-start justify-between gap-4 p-4 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer ${
                            !item.readAt ? "bg-indigo-50/25 dark:bg-indigo-950/20" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <span
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${color} shadow-2xs mt-0.5`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {capitalizeFirst(item.title)}
                                </span>
                                {!item.readAt && (
                                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                                )}
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {relativeTime(item.createdAt)}
                                </span>
                              </div>
                              {item.description && (
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                  {capitalizeFirst(item.description)}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                                <span>{new Date(item.createdAt).toLocaleString()}</span>
                                {item.href && (
                                  <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 font-medium transition-colors" title="View details">
                                    <span>Details</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons on Hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {!item.readAt ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void markRead([item.id], false);
                                }}
                                title="Mark as read"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void markRead([item.id], true);
                                }}
                                title="Mark as unread"
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 transition cursor-pointer"
                              >
                                <CircleDot className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => void deleteNotification(item.id, e)}
                              title="Delete notification"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: OTHER NOTIFICATIONS (Welcome, KYC, Matching Jobs) */}
      {!loading && activeTab === "other" && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          {filteredOtherItems.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No general notifications</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Welcome alerts, verification updates, and matching opportunities will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredOtherItems.map((item) => {
                const { Icon, color } = getCategoryIcon(item.type);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!item.readAt) void markRead([item.id], false);
                      if (item.href) router.push(item.href);
                    }}
                    className={`group flex items-start justify-between gap-4 p-4 text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer ${
                      !item.readAt ? "bg-indigo-50/25 dark:bg-indigo-950/20" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${color} shadow-2xs mt-0.5`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {capitalizeFirst(item.title)}
                          </span>
                          {!item.readAt && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                          <span className="text-[11px] text-slate-400 font-normal">
                            {relativeTime(item.createdAt)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {capitalizeFirst(item.description)}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                          {item.href && (
                            <span className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 font-medium transition-colors" title="View details">
                              <span>Details</span>
                              <ArrowRight className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {!item.readAt ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markRead([item.id], false);
                          }}
                          title="Mark as read"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 transition cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markRead([item.id], true);
                          }}
                          title="Mark as unread"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 transition cursor-pointer"
                        >
                          <CircleDot className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => void deleteNotification(item.id, e)}
                        title="Delete notification"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* POP-UP TIMELINE & PROJECT DETAILS MODAL                   */}
      {/* ========================================================= */}
      <Dialog
        open={timelineTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTimelineTarget(null);
            setTimeline(null);
          }
        }}
      >
        <DialogContent className="fixed inset-y-0 right-0 left-auto flex h-full w-full max-w-2xl translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-0 sm:max-w-2xl">
          {/* Modal Header */}
          <div className="border-b border-slate-200 dark:border-slate-800 p-6 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-950 dark:text-white">
                    {timeline?.job?.title ??
                      (timelineTarget?.projectId
                        ? `Project #${timelineTarget.projectId}`
                        : `Job #${timelineTarget?.jobId}`)}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {timeline?.job?.category ?? "Marketplace Activity"} · Timeline &amp; Project Info
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Modal Internal Tabs */}
            <div className="mt-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setModalTab("timeline")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  modalTab === "timeline"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Clock3 className="h-3.5 w-3.5" /> Activity Timeline
              </button>
              <button
                type="button"
                onClick={() => setModalTab("details")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  modalTab === "details"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> Scope &amp; Details
              </button>
              <button
                type="button"
                onClick={() => setModalTab("proposals")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                  modalTab === "proposals"
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <UsersRound className="h-3.5 w-3.5" /> Proposals &amp; Parties (
                {timeline?.proposals?.length ?? 0})
              </button>
            </div>
          </div>

          {/* Modal Body */}
          {timelineLoading && (
            <div className="p-16 text-center text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400 mb-3" />
              Loading project details &amp; timeline…
            </div>
          )}

          {!timelineLoading && !timeline && (
            <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-4 text-sm text-rose-700 dark:text-rose-300">
              Unable to load project timeline information.
            </div>
          )}

          {!timelineLoading && timeline && (
            <div className="space-y-6 p-6">
              {/* Progress & Status Summary */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Status:{" "}
                    <strong className="text-slate-900 dark:text-white uppercase">
                      {timeline.project.status.replaceAll("_", " ")}
                    </strong>
                  </span>
                  <span>{timeline.project.progress}% completed</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${timeline.project.progress}%` }}
                  />
                </div>
              </div>

              {/* TAB 1: VISUAL TIMELINE */}
              {modalTab === "timeline" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Chronological Events
                  </h3>
                  <div className="relative space-y-6 border-l-2 border-indigo-200 dark:border-indigo-800 pl-5 ml-2">
                    {timeline.timeline.length === 0 ? (
                      <p className="text-sm text-slate-500">No activity events recorded yet.</p>
                    ) : (
                      timeline.timeline.map((event) => (
                        <div key={event.id} className="relative">
                          <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {capitalizeFirst(event.title)}
                            </h4>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-300">
                              {event.actorRole}
                            </span>
                          </div>
                          {event.description && (
                            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                              {capitalizeFirst(event.description)}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-slate-400">
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SCOPE & DETAILS */}
              {modalTab === "details" && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Budget / Pricing
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {timeline.job?.timingType === "HOURLY"
                          ? `₹${timeline.job?.hourlyRate ?? 0} / hr`
                          : `₹${timeline.job?.budgetMin ?? 0} – ₹${timeline.job?.budgetMax ?? 0}`}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Work Mode &amp; Urgency
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {timeline.job?.workMode ?? "On-site"} ·{" "}
                        {timeline.job?.urgency ?? "Standard"}
                      </div>
                    </div>
                  </div>

                  {timeline.job?.locationAddress && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 text-xs text-slate-700 dark:text-slate-300">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Location
                      </div>
                      <div className="flex items-center gap-1.5 font-medium">
                        <MapPin className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        {timeline.job.locationAddress}
                      </div>
                    </div>
                  )}

                  {timeline.job?.description && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Scope of Work &amp; Description
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {capitalizeFirst(timeline.job.description)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PROPOSALS & PARTIES */}
              {modalTab === "proposals" && (
                <div className="space-y-4">
                  {/* Parties Cards */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Client Details
                      </div>
                      <div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        {timeline.client
                          ? `${timeline.client.firstName} ${timeline.client.lastName}`
                          : "Unknown"}
                      </div>
                      {timeline.client?.email && (
                        <div className="text-xs text-slate-500">{timeline.client.email}</div>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Assigned Professional
                      </div>
                      <div className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                        {timeline.professional
                          ? `${timeline.professional.firstName} ${timeline.professional.lastName}`
                          : "Not assigned yet"}
                      </div>
                      {timeline.professional?.email && (
                        <div className="text-xs text-slate-500">{timeline.professional.email}</div>
                      )}
                    </div>
                  </div>

                  {/* Proposals List */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Received Proposals ({timeline.proposals?.length ?? 0})
                    </h4>
                    {!timeline.proposals || timeline.proposals.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No proposals submitted yet.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {timeline.proposals.map((prop) => (
                          <div
                            key={prop.id}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {prop.professional.firstName} {prop.professional.lastName}
                              </span>
                              <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                Bid: ₹{prop.bidAmount ?? "N/A"}
                              </span>
                            </div>
                            {prop.coverLetter && (
                              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                                &ldquo;{prop.coverLetter}&rdquo;
                              </p>
                            )}
                            <div className="mt-2 text-[10px] text-slate-400">
                              Duration: {prop.duration ?? "Estimated"} · Submitted{" "}
                              {relativeTime(prop.createdAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Direct Navigation Button at bottom of modal */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const url = timelineTarget?.projectId
                      ? `/project/${timelineTarget.projectId}/tracking?tab=timeline#timeline`
                      : `/job/${timelineTarget?.jobId}`;
                    router.push(url);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-2xs cursor-pointer"
                >
                  <Clock3 className="h-4 w-4" />
                  {timelineTarget?.projectId
                    ? "Go to Full Project Timeline & Tracking"
                    : "View Full Job Details"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
