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

    toast.custom(
      (t) => (
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                {notification.title || "New Admin Notification"}
              </h5>
              {notification.description && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {notification.description}
                </p>
              )}
            </div>
          </div>

          {/* 2 Buttons placed below */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => toast.dismiss(t)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
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
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      ),
      { duration: 6000 },
    );
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
