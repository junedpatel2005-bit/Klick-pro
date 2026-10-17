"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser } from "@/lib/current-user";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CircleCheck,
  FileText,
  Flag,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { fetchPortalNotifications, invalidateNotificationsCache } from "@/lib/notifications-client";
import { capitalizeFirst } from "@/lib/utils";

type RealtimeNotification = {
  id?: number;
  type: string;
  title: string;
  description: string;
  href?: string;
  createdAt?: string;
  readAt?: string | null;
};

type ActiveToast = {
  key: string;
  notification: RealtimeNotification;
  timerId: ReturnType<typeof setTimeout>;
};

function getNotificationVisual(type = "", title = "") {
  const upper = `${type} ${title}`.toUpperCase();
  if (upper.includes("DISPUTE")) {
    return {
      Icon: AlertTriangle,
      iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      accentGradient: "bg-gradient-to-r from-amber-500/50 via-amber-500 to-amber-500/50",
      categoryLabel: "Dispute Update",
    };
  }
  if (upper.includes("VERIFICATION") || upper.includes("KYC")) {
    return {
      Icon: ShieldCheck,
      iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      accentGradient: "bg-gradient-to-r from-blue-500/50 via-blue-500 to-blue-500/50",
      categoryLabel: "Verification Status",
    };
  }
  if (
    upper.includes("PAYMENT") ||
    upper.includes("WALLET") ||
    upper.includes("EARNING") ||
    upper.includes("FUNDED") ||
    upper.includes("PAYOUT") ||
    upper.includes("WITHDRAWAL")
  ) {
    return {
      Icon: Wallet,
      iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      accentGradient: "bg-gradient-to-r from-emerald-500/50 via-emerald-500 to-emerald-500/50",
      categoryLabel: "Wallet & Payment",
    };
  }
  if (
    upper.includes("MILESTONE") ||
    upper.includes("DELIVERABLE") ||
    upper.includes("WORK_SUBMITTED") ||
    upper.includes("WORK_UPLOADED")
  ) {
    return {
      Icon: Flag,
      iconClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      accentGradient: "bg-gradient-to-r from-purple-500/50 via-purple-500 to-purple-500/50",
      categoryLabel: "Milestone Deliverable",
    };
  }
  if (upper.includes("PROPOSAL") || upper.includes("JOB")) {
    return {
      Icon: FileText,
      iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
      accentGradient: "bg-gradient-to-r from-indigo-500/50 via-indigo-500 to-indigo-500/50",
      categoryLabel: "Project Opportunity",
    };
  }
  return {
    Icon: CircleCheck,
    iconClass: "bg-primary/15 text-primary border border-primary/20",
    accentGradient: "bg-gradient-to-r from-primary/50 via-primary to-primary/50",
    categoryLabel: "Platform Notification",
  };
}

export function RealtimeNotifications() {
  const router = useRouter();
  const userIdRef = useRef<number | null>(null);
  const seenNotifications = useRef(new Set<string>());
  const notificationsInitialized = useRef(false);

  const [activeQueue, setActiveQueue] = useState<ActiveToast[]>([]);

  const notificationKey = useCallback((notification: RealtimeNotification) => {
    return [notification.type, notification.title, notification.description, notification.href].join("|");
  }, []);

  const dismissFromScreen = useCallback((key: string) => {
    setActiveQueue((prev) => {
      const match = prev.find((item) => item.key === key);
      if (match?.timerId) clearTimeout(match.timerId);
      return prev.filter((item) => item.key !== key);
    });
  }, []);

  const handleCancelAllFromScreen = useCallback(() => {
    // Clear all notifications from the screen state immediately.
    // STRICT CONSTRAINT: "not read only remove" -> No PATCH API call is made,
    // notifications remain unread in the database and user inbox.
    setActiveQueue((prev) => {
      prev.forEach((item) => {
        if (item.timerId) clearTimeout(item.timerId);
      });
      return [];
    });
  }, []);

  const enqueueNotification = useCallback(
    (notification: RealtimeNotification) => {
      const key =
        notification.id != null ? `id:${notification.id}` : notificationKey(notification);

      setActiveQueue((prev) => {
        if (prev.some((item) => item.key === key)) return prev;

        const timerId = setTimeout(() => {
          dismissFromScreen(key);
        }, 8500);

        return [{ key, notification, timerId }, ...prev];
      });
    },
    [dismissFromScreen, notificationKey],
  );

  const enqueueBatch = useCallback(
    (notifications: RealtimeNotification[]) => {
      if (!notifications.length) return;
      setActiveQueue((prev) => {
        const next = [...prev];
        for (const notification of notifications) {
          const key =
            notification.id != null ? `id:${notification.id}` : notificationKey(notification);
          if (!next.some((item) => item.key === key)) {
            const timerId = setTimeout(() => {
              dismissFromScreen(key);
            }, 8500);
            next.unshift({ key, notification, timerId });
          }
        }
        return next;
      });
    },
    [dismissFromScreen, notificationKey],
  );

  useEffect(() => {
    void fetchCurrentUser()
      .then((data) => {
        userIdRef.current = data.user?.id ? Number(data.user.id) : null;
      })
      .catch(() => {
        userIdRef.current = null;
      });

    const loadMissed = async (showNew = false) => {
      try {
        const notifications = (await fetchPortalNotifications({
          force: showNew,
        })) as RealtimeNotification[];
        const newUnread: RealtimeNotification[] = [];
        for (const notification of notifications) {
          const key =
            notification.id != null ? `id:${notification.id}` : notificationKey(notification);
          const isNew = !seenNotifications.current.has(key);
          seenNotifications.current.add(key);
          if (showNew && isNew && !notification.readAt) {
            newUnread.push(notification);
          }
        }
        notificationsInitialized.current = true;
        if (newUnread.length > 0) {
          enqueueBatch(newUnread);
        }
      } catch {
        // The inbox remains available if the background refresh is unavailable.
      }
    };

    void loadMissed();

    const socket = io({
      path: "/api/realtime",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    const SAFETY_POLL_MS = 15 * 1000;
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && notificationsInitialized.current) {
        void loadMissed(true);
      }
    }, SAFETY_POLL_MS);

    let lastActiveCheck = 0;
    const onActiveChange = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") {
        if (now - lastActiveCheck > 3000) {
          lastActiveCheck = now;
          if (notificationsInitialized.current) {
            void loadMissed(true);
          }
        }
      }
    };
    window.addEventListener("focus", onActiveChange);
    document.addEventListener("visibilitychange", onActiveChange);

    const onNotification = (notification: RealtimeNotification) => {
      const key =
        notification.id != null ? `id:${notification.id}` : notificationKey(notification);
      if (seenNotifications.current.has(key)) return;
      seenNotifications.current.add(key);
      enqueueNotification(notification);
      invalidateNotificationsCache();
      window.dispatchEvent(new CustomEvent("servio:notification", { detail: notification }));
      window.dispatchEvent(new CustomEvent("servio:bell-ring"));
    };

    const onMessage = (message: { receiverId?: number }) => {
      if (message.receiverId !== userIdRef.current) return;
      window.dispatchEvent(new CustomEvent("servio:message"));
    };

    const onProject = (payload?: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:project-update", { detail: payload }));
    };

    const onProposal = (payload?: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:proposal", { detail: payload }));
    };

    const onJobPosted = (payload?: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:job-posted", { detail: payload }));
      window.dispatchEvent(new CustomEvent("servio:notification"));
    };

    const onReconnect = () => {
      if (notificationsInitialized.current) {
        void loadMissed(true);
      }
    };
    socket.io.on("reconnect", onReconnect);
    socket.on("notification:new", onNotification);
    socket.on("message:new", onMessage);
    socket.on("project:updated", onProject);
    socket.on("proposal:new", onProposal);
    socket.on("job:posted", onJobPosted);
    socket.on("job:created", onJobPosted);

    return () => {
      socket.io.off("reconnect", onReconnect);
      socket.off("notification:new", onNotification);
      socket.off("message:new", onMessage);
      socket.off("project:updated", onProject);
      socket.off("proposal:new", onProposal);
      socket.off("job:posted", onJobPosted);
      socket.off("job:created", onJobPosted);
      socket.disconnect();
      window.clearInterval(poll);
      window.removeEventListener("focus", onActiveChange);
      document.removeEventListener("visibilitychange", onActiveChange);
    };
  }, [enqueueNotification, enqueueBatch, notificationKey]);

  if (activeQueue.length === 0) return null;

  // Max 3 visible cards on screen to prevent screen flooding (e.g. when 11 arrive)
  const MAX_VISIBLE = 3;
  const visibleItems = activeQueue.slice(0, MAX_VISIBLE);
  const overflowCount = Math.max(0, activeQueue.length - MAX_VISIBLE);

  return (
    <aside
      aria-label="Real-time notifications"
      className="fixed top-20 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none transition-all duration-300"
    >
      {visibleItems.map(({ key, notification }) => {
        let actionLabel = "View";
        if (
          notification.type.includes("MILESTONE") ||
          notification.type.includes("DELIVERABLE") ||
          notification.type.includes("WORK_SUBMITTED") ||
          notification.title.toLowerCase().includes("deliverable") ||
          notification.title.toLowerCase().includes("milestone")
        ) {
          actionLabel = "Review Milestone";
        } else if (notification.href?.includes("/project/")) {
          actionLabel = "View Project";
        } else if (notification.href?.includes("/job/")) {
          actionLabel = "Review Job";
        } else if (notification.type.includes("PROPOSAL")) {
          actionLabel = "Review Proposal";
        } else if (notification.type.includes("DISPUTE")) {
          actionLabel = "Check Dispute";
        } else if (notification.type.includes("VERIFICATION")) {
          actionLabel = "Inspect Status";
        } else if (notification.href?.includes("/earnings")) {
          actionLabel = "View Wallet & Payout";
        } else if (notification.href?.includes("/admin/finance")) {
          actionLabel = "Review Payout";
        }

        const visual = getNotificationVisual(notification.type, notification.title);
        const VisualIcon = visual.Icon;

        let titleContent: React.ReactNode = capitalizeFirst(notification.title);
        if (notification.title.includes(" · ")) {
          const [projectName, ...actionParts] = notification.title.split(" · ");
          titleContent = (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-bold text-foreground text-sm leading-snug break-words line-clamp-2">
                {capitalizeFirst(projectName)}
              </span>
              <span className="text-xs font-semibold text-primary break-words line-clamp-1">
                {capitalizeFirst(actionParts.join(" · "))}
              </span>
            </div>
          );
        } else {
          titleContent = (
            <span className="font-bold text-foreground text-sm leading-snug break-words line-clamp-2">
              {capitalizeFirst(notification.title)}
            </span>
          );
        }

        return (
          <div
            key={key}
            data-notification-toast="true"
            className="pointer-events-auto group relative flex w-full items-start gap-3 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-lg shadow-black/5 dark:shadow-black/30 backdrop-blur-xl transition-all duration-200 hover:border-foreground/20 hover:shadow-xl animate-in fade-in slide-in-from-top-2"
          >
            {/* Category Icon Badge */}
            <div
              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg shadow-xs ${visual.iconClass}`}
            >
              <VisualIcon className="h-4 w-4" />
            </div>

            {/* Clickable Content Body */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                dismissFromScreen(key);
                if (notification.href) {
                  router.push(notification.href);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  dismissFromScreen(key);
                  if (notification.href) {
                    router.push(notification.href);
                  }
                }
              }}
              className={`min-w-0 flex-1 text-left ${notification.href ? "cursor-pointer" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {visual.categoryLabel}
                </span>
                <span className="text-[10px] text-muted-foreground/60">· Just now</span>
              </div>
              <div className="mt-0.5">{titleContent}</div>
              {notification.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground leading-snug">
                  {capitalizeFirst(notification.description)}
                </p>
              )}
              {notification.href && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
                  <span>{actionLabel}</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Remove from screen only (does not mark read) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissFromScreen(key);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Remove notification from screen"
              title="Remove from screen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {/* Overflow Summary when more than 3 notifications are queued (e.g. 11 notifications) */}
      {overflowCount > 0 && (
        <div className="pointer-events-auto rounded-xl border border-primary/25 bg-background/95 p-2.5 shadow-md backdrop-blur-xl transition hover:border-primary/50 animate-in fade-in slide-in-from-top-2">
          <button
            type="button"
            onClick={() => {
              handleCancelAllFromScreen();
              router.push("/notifications");
            }}
            className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-primary cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5" />
              <span>+{overflowCount} more notifications in your inbox</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] hover:underline">
              <span>View all</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        </div>
      )}

      {/* When 2 or more notifications are active, show Cancel button at the bottom (in last) */}
      {activeQueue.length >= 2 && (
        <div className="pointer-events-auto flex items-center justify-end pt-0.5 animate-in fade-in">
          <button
            type="button"
            onClick={handleCancelAllFromScreen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background/95 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 shadow-md backdrop-blur-xl transition-all cursor-pointer"
            title="Remove all notifications from screen without marking read"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}
    </aside>
  );
}
