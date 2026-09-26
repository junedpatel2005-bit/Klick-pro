"use client";

import { useCallback, useEffect, useRef } from "react";
import { fetchCurrentUser } from "@/lib/current-user";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";

type RealtimeNotification = {
  id?: number;
  type: string;
  title: string;
  description: string;
  href?: string;
  createdAt?: string;
  readAt?: string | null;
};

export function RealtimeNotifications() {
  // Held in a ref rather than state: the effect below both sets and reads it, so
  // storing it in state re-ran the effect and doubled every fetch and socket.
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
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl ring-1 ring-black/5 dark:ring-white/10 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="h-4 w-4" />
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
              onClick={() => toast.dismiss(t)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              Dismiss All
            </button>
            {notification.href && (
              <button
                type="button"
                onClick={() => {
                  if (notification.id != null) {
                    void fetch("/api/portal/notifications", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: notification.id }),
                    });
                  }
                  toast.dismiss(t);
                  window.location.assign(notification.href!);
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      ),
      { duration: 6000 },
    );
    window.dispatchEvent(new CustomEvent("servio:notification"));
  }, []);

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
        const response = await fetch("/api/portal/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const notifications = (await response.json()) as RealtimeNotification[];
        let hasNew = false;
        for (const notification of notifications) {
          const key =
            notification.id != null ? `id:${notification.id}` : notificationKey(notification);
          const isNew = !seenNotifications.current.has(key);
          seenNotifications.current.add(key);
          if (showNew && isNew && !notification.readAt) {
            hasNew = true;
            showNotification(notification);
          }
        }
        notificationsInitialized.current = true;
        if (hasNew) {
          window.dispatchEvent(new CustomEvent("servio:notification"));
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

    // Notifications arrive over the socket (notification:new below). This poll
    // is only a safety net for a tab whose socket is down, so it runs rarely
    // and skips entirely while the connection is healthy.
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
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void loadMissed(true);
    };
    const onFocus = () => void loadMissed(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const onNotification = (notification: RealtimeNotification) => {
      const key = notification.id != null ? `id:${notification.id}` : notificationKey(notification);
      if (seenNotifications.current.has(key)) return;
      seenNotifications.current.add(key);
      showNotification(notification);
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
    // Manager-level reconnect only: "connect" would also fire on first mount,
    // duplicating the initial load. A reconnect may have missed live pushes.
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
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [showNotification]);

  return null;
}
