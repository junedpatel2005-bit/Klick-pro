"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser } from "@/lib/current-user";
import { io } from "socket.io-client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCheck,
  CircleCheck,
  FileText,
  Flag,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import {
  dismissAllNotificationsWithAnimation,
  dismissSingleNotificationWithAnimation,
} from "@/lib/notification-dismiss";
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

function getNotificationVisual(type = "", title = "") {
  const upper = `${type} ${title}`.toUpperCase();
  if (upper.includes("DISPUTE")) {
    return {
      Icon: AlertTriangle,
      iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      accentGradient: "bg-gradient-to-r from-amber-500/50 via-amber-500 to-amber-500/50",
      pulseColor: "bg-amber-500",
      dotColor: "bg-amber-500",
      categoryLabel: "Dispute Update",
    };
  }
  if (upper.includes("VERIFICATION") || upper.includes("KYC")) {
    return {
      Icon: ShieldCheck,
      iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      accentGradient: "bg-gradient-to-r from-blue-500/50 via-blue-500 to-blue-500/50",
      pulseColor: "bg-blue-500",
      dotColor: "bg-blue-500",
      categoryLabel: "Verification Status",
    };
  }
  if (
    upper.includes("PAYMENT") ||
    upper.includes("WALLET") ||
    upper.includes("EARNING") ||
    upper.includes("FUNDED")
  ) {
    return {
      Icon: Wallet,
      iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      accentGradient: "bg-gradient-to-r from-emerald-500/50 via-emerald-500 to-emerald-500/50",
      pulseColor: "bg-emerald-500",
      dotColor: "bg-emerald-500",
      categoryLabel: "Wallet & Payment",
    };
  }
  if (upper.includes("MILESTONE")) {
    return {
      Icon: Flag,
      iconClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20",
      accentGradient: "bg-gradient-to-r from-purple-500/50 via-purple-500 to-purple-500/50",
      pulseColor: "bg-purple-500",
      dotColor: "bg-purple-500",
      categoryLabel: "Milestone Alert",
    };
  }
  if (upper.includes("PROPOSAL") || upper.includes("JOB")) {
    return {
      Icon: FileText,
      iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
      accentGradient: "bg-gradient-to-r from-indigo-500/50 via-indigo-500 to-indigo-500/50",
      pulseColor: "bg-indigo-500",
      dotColor: "bg-indigo-500",
      categoryLabel: "Project Opportunity",
    };
  }
  return {
    Icon: CircleCheck,
    iconClass: "bg-primary/15 text-primary border border-primary/20",
    accentGradient: "bg-gradient-to-r from-primary/50 via-primary to-primary/50",
    pulseColor: "bg-primary",
    dotColor: "bg-primary",
    categoryLabel: "Platform Notification",
  };
}

export function RealtimeNotifications() {
  const router = useRouter();
  const userIdRef = useRef<number | null>(null);
  const seenNotifications = useRef(new Set<string>());
  const notificationsInitialized = useRef(false);

  const showNotification = useCallback(
    (notification: RealtimeNotification) => {
      let actionLabel = "View";
      if (notification.href?.includes("/project/")) actionLabel = "View Project";
      else if (notification.href?.includes("/job/")) actionLabel = "Review Job";
      else if (notification.type.includes("PROPOSAL")) actionLabel = "Review Proposal";
      else if (notification.type.includes("DISPUTE")) actionLabel = "Check Dispute";
      else if (notification.type.includes("VERIFICATION")) actionLabel = "Inspect Status";

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

      toast.custom(
        (t) => (
          <div
            data-notification-toast="true"
            data-notification-id={String(t)}
            className="group relative flex w-full max-w-sm items-start gap-3 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-lg shadow-black/5 dark:shadow-black/30 backdrop-blur-xl transition-all duration-200 hover:border-foreground/20 hover:shadow-xl"
          >
            {/* Minimal Icon Badge */}
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
                if (notification.href) {
                  void dismissSingleNotificationWithAnimation(
                    t,
                    notification.id,
                    notification.href,
                    (target) => router.push(target),
                  );
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && notification.href) {
                  void dismissSingleNotificationWithAnimation(
                    t,
                    notification.id,
                    notification.href,
                    (target) => router.push(target),
                  );
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

            {/* Subtle Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void dismissSingleNotificationWithAnimation(t, notification.id);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
        { duration: 5500, unstyled: true },
      );
    },
    [router],
  );

  const showGroupedNotification = useCallback(
    (notifications: RealtimeNotification[]) => {
      if (!notifications.length) return;
      const first = notifications[0];
      if (!first) return;
      if (notifications.length === 1) {
        showNotification(first);
        return;
      }

      const latest = first;
      const totalCount = notifications.length;

      toast.custom(
        (t) => (
          <div
            data-notification-toast="true"
            data-notification-id={String(t)}
            className="group relative flex w-full max-w-sm items-start gap-3 rounded-xl border border-border/80 bg-background/95 p-3.5 shadow-lg shadow-black/5 dark:shadow-black/30 backdrop-blur-xl transition-all duration-200 hover:border-foreground/20 hover:shadow-xl"
          >
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <BellRing className="h-4 w-4" />
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                void dismissSingleNotificationWithAnimation(
                  t,
                  undefined,
                  "/notifications",
                  (target) => router.push(target),
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void dismissSingleNotificationWithAnimation(
                    t,
                    undefined,
                    "/notifications",
                    (target) => router.push(target),
                  );
                }
              }}
              className="min-w-0 flex-1 text-left cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold tracking-wide text-primary uppercase">
                  Notifications ({totalCount})
                </span>
                <span className="text-[10px] text-muted-foreground/60">· Just now</span>
              </div>
              <p className="mt-0.5 text-sm font-semibold text-foreground truncate">
                {capitalizeFirst(latest.title)}
              </p>
              {latest.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {capitalizeFirst(latest.description)}
                </p>
              )}
              <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-primary group-hover:underline">
                <span>View all ({totalCount})</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void dismissSingleNotificationWithAnimation(t);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
        { duration: 6500, unstyled: true },
      );
    },
    [showNotification, router],
  );

  const notificationKey = (notification: RealtimeNotification) =>
    [notification.type, notification.title, notification.description, notification.href].join("|");

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
        if (newUnread.length > 1) {
          showGroupedNotification(newUnread);
        } else if (newUnread.length === 1 && newUnread[0]) {
          showNotification(newUnread[0]);
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

    const SAFETY_POLL_MS = 5 * 60 * 1000;
    const poll = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        notificationsInitialized.current &&
        !socket.connected
      ) {
        void loadMissed(true);
      }
    }, SAFETY_POLL_MS);

    let lastActiveCheck = 0;
    const onActiveChange = () => {
      const now = Date.now();
      // Only check missed if at least 30s elapsed and socket is not currently connected
      if (document.visibilityState === "visible" && !socket.connected) {
        if (now - lastActiveCheck > 30000) {
          lastActiveCheck = now;
          void loadMissed(false);
        }
      }
    };
    window.addEventListener("focus", onActiveChange);
    document.addEventListener("visibilitychange", onActiveChange);

    const onNotification = (notification: RealtimeNotification) => {
      const key = notification.id != null ? `id:${notification.id}` : notificationKey(notification);
      if (seenNotifications.current.has(key)) return;
      seenNotifications.current.add(key);
      showNotification(notification);
      invalidateNotificationsCache();
      window.dispatchEvent(new CustomEvent("servio:notification"));
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

    const onReconnect = () => void loadMissed(false);
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
  }, [showNotification, showGroupedNotification]);

  return null;
}
