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

    toast(notification.title, {
      icon: <CircleCheck className="h-5 w-5 text-emerald-400" />,
      description: notification.description,
      action: notification.href
        ? {
            label: actionLabel,
            onClick: () => {
              if (notification.id != null) {
                void fetch("/api/portal/notifications", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: notification.id }),
                });
              }
              window.location.assign(notification.href!);
            },
          }
        : undefined,
      cancel: {
        label: "Dismiss all",
        onClick: () => {
          toast.dismiss();
        },
      },
    });
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
        for (const notification of notifications) {
          const key =
            notification.id != null ? `id:${notification.id}` : notificationKey(notification);
          const isNew = !seenNotifications.current.has(key);
          seenNotifications.current.add(key);
          if (showNew && isNew && !notification.readAt) {
            showNotification(notification);
          }
        }
        // Historical unread notifications belong in the inbox and badge. They
        // are added to the seen set but are not replayed on the initial load.
        notificationsInitialized.current = true;
        window.dispatchEvent(new CustomEvent("servio:notification"));
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
      if (document.visibilityState === "visible") void loadMissed();
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
      window.dispatchEvent(new CustomEvent("servio:notification"));
    };
    // Manager-level reconnect only: "connect" would also fire on first mount,
    // duplicating the initial load. A reconnect may have missed live pushes.
    const onReconnect = () => void loadMissed(true);
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
