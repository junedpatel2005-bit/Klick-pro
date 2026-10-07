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
      iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    };
  }
  if (upper.includes("VERIFICATION") || upper.includes("KYC")) {
    return {
      Icon: ShieldCheck,
      iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
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
      iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (upper.includes("MILESTONE")) {
    return {
      Icon: Flag,
      iconClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    };
  }
  if (upper.includes("PROPOSAL") || upper.includes("JOB")) {
    return {
      Icon: FileText,
      iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    };
  }
  return {
    Icon: CircleCheck,
    iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
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

      const { Icon, iconClass } = getNotificationVisual(notification.type, notification.title);

      let titleContent: React.ReactNode = capitalizeFirst(notification.title);
      if (notification.title.includes(" · ")) {
        const [projectName, ...actionParts] = notification.title.split(" · ");
        titleContent = (
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-foreground text-sm leading-snug">
              {capitalizeFirst(projectName)}
            </span>
            <span className="text-xs font-semibold text-primary">
              {capitalizeFirst(actionParts.join(" · "))}
            </span>
          </div>
        );
      } else {
        titleContent = (
          <span className="font-bold text-foreground text-sm leading-snug">
            {capitalizeFirst(notification.title)}
          </span>
        );
      }

      toast.custom(
        (t) => (
          <div
            data-notification-toast="true"
            data-notification-id={String(t)}
            className="group relative w-full max-w-sm rounded-2xl border border-border/80 bg-background/95 p-4 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.16)] backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-200 animate-in fade-in-50 slide-in-from-top-3"
          >
            {/* Subtle top indicator bar */}
            <div className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-70" />

            {/* Close button at top-right */}
            <button
              type="button"
              onClick={() => void dismissSingleNotificationWithAnimation(t, notification.id)}
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <div
                className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-xs ${iconClass}`}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                {titleContent}
                {notification.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {capitalizeFirst(notification.description)}
                  </p>
                )}
              </div>
            </div>

            {/* Action Row */}
            <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
              <span className="text-[10.5px] font-medium text-muted-foreground/70">Just now</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void dismissAllNotificationsWithAnimation()}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  Dismiss all
                </button>
                {notification.href && (
                  <button
                    type="button"
                    onClick={() => {
                      void dismissSingleNotificationWithAnimation(
                        t,
                        notification.id,
                        notification.href,
                        (target) => router.push(target),
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
                  >
                    <span>{actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ),
        { duration: 6500 },
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
            className="group relative w-full max-w-sm rounded-2xl border border-border/80 bg-background/95 p-4 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.16)] backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-200 animate-in fade-in-50 slide-in-from-top-3"
          >
            <div className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-70" />

            <button
              type="button"
              onClick={() => void dismissSingleNotificationWithAnimation(t)}
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <BellRing className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-sm leading-snug">
                    Notifications
                  </span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {totalCount} new
                  </span>
                </div>
                <div className="mt-1.5 rounded-xl bg-muted/40 p-2.5 border border-border/50">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {capitalizeFirst(latest.title)}
                  </p>
                  {latest.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {capitalizeFirst(latest.description)}
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">
                  + {totalCount - 1} other update{totalCount > 2 ? "s" : ""} waiting in your inbox
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
              <button
                type="button"
                onClick={() => void dismissAllNotificationsWithAnimation()}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Dismiss all
              </button>
              <button
                type="button"
                onClick={() => {
                  void dismissSingleNotificationWithAnimation(
                    t,
                    undefined,
                    "/notifications",
                    (target) => router.push(target),
                  );
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
              >
                <span>View all ({totalCount})</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ),
        { duration: 7500 },
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
      // Only check missed if at least 15s elapsed and socket is not currently connected
      if (document.visibilityState === "visible" && !socket.connected) {
        if (now - lastActiveCheck > 15000) {
          lastActiveCheck = now;
          void loadMissed(true);
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

    const onReconnect = () => void loadMissed(false);
    socket.io.on("reconnect", onReconnect);
    socket.on("notification:new", onNotification);
    socket.on("message:new", onMessage);
    socket.on("project:updated", onProject);
    socket.on("proposal:new", onProposal);

    return () => {
      socket.io.off("reconnect", onReconnect);
      socket.off("notification:new", onNotification);
      socket.off("message:new", onMessage);
      socket.off("project:updated", onProject);
      socket.off("proposal:new", onProposal);
      socket.disconnect();
      window.clearInterval(poll);
      window.removeEventListener("focus", onActiveChange);
      document.removeEventListener("visibilitychange", onActiveChange);
    };
  }, [showNotification, showGroupedNotification]);

  return null;
}
