"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchCurrentUser } from "@/lib/current-user";
import { io } from "socket.io-client";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellRing,
  CircleCheck,
  FileText,
  Flag,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  dismissAllNotificationsWithAnimation,
  dismissSingleNotificationWithAnimation,
} from "@/lib/notification-dismiss";
import { fetchPortalNotifications, invalidateNotificationsCache } from "@/lib/notifications-client";

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
  const userIdRef = useRef<number | null>(null);
  const seenNotifications = useRef(new Set<string>());
  const notificationsInitialized = useRef(false);

  const showNotification = useCallback((notification: RealtimeNotification) => {
    let actionLabel = "View";
    if (notification.href?.includes("/project/")) actionLabel = "View Project";
    else if (notification.href?.includes("/job/")) actionLabel = "Review Job";
    else if (notification.type.includes("PROPOSAL")) actionLabel = "Review Proposal";
    else if (notification.type.includes("DISPUTE")) actionLabel = "Check Dispute";
    else if (notification.type.includes("VERIFICATION")) actionLabel = "Inspect Status";

    const { Icon, iconClass } = getNotificationVisual(notification.type, notification.title);

    let titleContent: React.ReactNode = notification.title;
    if (notification.title.includes(" · ")) {
      const [projectName, ...actionParts] = notification.title.split(" · ");
      titleContent = (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-foreground text-sm leading-snug">{projectName}</span>
          <span className="text-xs font-semibold text-primary">{actionParts.join(" · ")}</span>
        </div>
      );
    } else {
      titleContent = (
        <span className="font-bold text-foreground text-sm leading-snug">{notification.title}</span>
      );
    }

    toast.custom(
      (t) => (
        <div
          data-notification-toast="true"
          data-notification-id={String(t)}
          className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl ring-1 ring-black/5 dark:ring-white/10 space-y-3 animate-in fade-in-50 slide-in-from-top-3 duration-200"
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl ${iconClass}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              {titleContent}
              {notification.description && (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {notification.description}
                </p>
              )}
            </div>
          </div>

          {/* 2 Buttons placed below */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <button
              type="button"
              onClick={() => void dismissAllNotificationsWithAnimation()}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              Dismiss All
            </button>
            {notification.href && (
              <button
                type="button"
                onClick={() => {
                  void dismissSingleNotificationWithAnimation(
                    t,
                    notification.id,
                    notification.href,
                  );
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      ),
      { duration: 6500 },
    );
  }, []);

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
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl ring-1 ring-black/5 dark:ring-white/10 space-y-3 animate-in fade-in-50 slide-in-from-top-3 duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground text-sm leading-snug">
                    Notifications
                  </span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                    {totalCount} new
                  </span>
                </div>
                <div className="mt-1.5 rounded-xl bg-muted/50 p-2.5 border border-border/50">
                  <p className="text-xs font-semibold text-foreground truncate">{latest.title}</p>
                  {latest.description && (
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {latest.description}
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground font-medium">
                  + {totalCount - 1} other update{totalCount > 2 ? "s" : ""} waiting in your inbox
                </p>
              </div>
            </div>

            {/* 2 Buttons placed below */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => void dismissAllNotificationsWithAnimation()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                Dismiss All
              </button>
              <button
                type="button"
                onClick={() => {
                  void dismissSingleNotificationWithAnimation(t, undefined, "/notifications");
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
              >
                View All ({totalCount})
              </button>
            </div>
          </div>
        ),
        { duration: 7500 },
      );
    },
    [showNotification],
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
