"use client";

import { useCallback, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";

type AdminRealtimeNotification = {
  id?: number;
  type?: string;
  title: string;
  description?: string;
  href?: string;
  createdAt?: string;
};

export function AdminRealtime() {
  const seenKeys = useRef(new Set<string>());

  const showNotification = useCallback((notification: AdminRealtimeNotification) => {
    let actionLabel = "Review";
    if (notification.href?.includes("/admin/verifications")) actionLabel = "Inspect KYC";
    else if (notification.href?.includes("/admin/operations")) actionLabel = "Open Operations";
    else if (notification.href?.includes("/admin/finance")) actionLabel = "Check Escrow";
    else if (notification.href?.includes("/admin/users")) actionLabel = "View User";

    toast(notification.title || "New admin notification", {
      icon: <CircleCheck className="h-5 w-5 text-emerald-400" />,
      description: notification.description,
      duration: 6000,
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
  }, []);

  useEffect(() => {
    const socket = io(window.location.origin, {
      path: "/api/realtime",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on("connect_error", (error) => {
      console.error("Admin realtime connection failed", error.message);
    });

    const onAdminNotification = (payload: AdminRealtimeNotification) => {
      const key =
        payload.id != null
          ? `id:${payload.id}`
          : `${payload.type}|${payload.title}|${payload.href}`;
      if (seenKeys.current.has(key)) return;
      seenKeys.current.add(key);

      showNotification(payload);
      window.dispatchEvent(new CustomEvent("servio:notification"));
      window.dispatchEvent(new CustomEvent("servio:admin-overview-update"));
    };

    const onVerificationsUpdate = (payload: unknown) => {
      window.dispatchEvent(
        new CustomEvent("servio:admin-verifications-update", { detail: payload }),
      );
      window.dispatchEvent(new CustomEvent("servio:notification"));
      window.dispatchEvent(new CustomEvent("servio:admin-overview-update"));
    };

    const onOperationsUpdate = (payload: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:admin-operations-update", { detail: payload }));
      window.dispatchEvent(new CustomEvent("servio:notification"));
      window.dispatchEvent(new CustomEvent("servio:admin-overview-update"));
    };

    const onUsersUpdate = (payload: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:admin-users-update", { detail: payload }));
      window.dispatchEvent(new CustomEvent("servio:notification"));
      window.dispatchEvent(new CustomEvent("servio:admin-overview-update"));
    };

    const onOverviewUpdate = (payload: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:admin-overview-update", { detail: payload }));
      window.dispatchEvent(new CustomEvent("servio:notification"));
    };

    const onMessage = () => {
      window.dispatchEvent(new CustomEvent("servio:message"));
      window.dispatchEvent(new CustomEvent("servio:notification"));
    };

    const onProjectUpdate = (payload?: unknown) => {
      window.dispatchEvent(new CustomEvent("servio:project-update", { detail: payload }));
      window.dispatchEvent(new CustomEvent("servio:admin-operations-update", { detail: payload }));
      window.dispatchEvent(new CustomEvent("servio:admin-overview-update"));
    };

    socket.on("admin:notification", onAdminNotification);
    socket.on("notification:new", onAdminNotification);
    socket.on("admin:verifications-update", onVerificationsUpdate);
    socket.on("admin:operations-update", onOperationsUpdate);
    socket.on("admin:users-update", onUsersUpdate);
    socket.on("admin:overview-update", onOverviewUpdate);
    socket.on("message:new", onMessage);
    socket.on("project:updated", onProjectUpdate);

    return () => {
      socket.off("admin:notification", onAdminNotification);
      socket.off("notification:new", onAdminNotification);
      socket.off("admin:verifications-update", onVerificationsUpdate);
      socket.off("admin:operations-update", onOperationsUpdate);
      socket.off("admin:users-update", onUsersUpdate);
      socket.off("admin:overview-update", onOverviewUpdate);
      socket.off("message:new", onMessage);
      socket.off("project:updated", onProjectUpdate);
      socket.disconnect();
    };
  }, [showNotification]);

  return null;
}
