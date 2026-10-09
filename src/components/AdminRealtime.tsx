"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { ArrowRight, CircleCheck, CheckCheck, X } from "lucide-react";

import {
  dismissAllNotificationsWithAnimation,
  dismissSingleNotificationWithAnimation,
} from "@/lib/notification-dismiss";
import { capitalizeFirst } from "@/lib/utils";

type AdminRealtimeNotification = {
  id?: number;
  type?: string;
  title: string;
  description?: string;
  href?: string;
  createdAt?: string;
};

export function AdminRealtime() {
  const router = useRouter();
  const seenKeys = useRef(new Set<string>());

  const showNotification = useCallback(
    (notification: AdminRealtimeNotification) => {
      let actionLabel = "Review";
      if (notification.href?.includes("/admin/verifications")) actionLabel = "Inspect KYC";
      else if (notification.href?.includes("/admin/operations")) actionLabel = "Open Operations";
      else if (notification.href?.includes("/admin/finance")) actionLabel = "Check Escrow";
      else if (notification.href?.includes("/admin/users")) actionLabel = "View User";

      toast.custom(
        (t) => (
          <div
            data-notification-toast="true"
            data-notification-id={String(t)}
            className="group relative w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-[0_12px_36px_-6px_rgba(0,0,0,0.16)] backdrop-blur-xl ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900/95 space-y-2.5 animate-in fade-in-50 slide-in-from-top-3 duration-200"
          >
            {/* Top subtle indigo glow accent bar */}
            <div className="absolute top-0 inset-x-5 h-0.5 rounded-full bg-gradient-to-r from-indigo-500/40 via-indigo-600 to-indigo-500/40 opacity-80" />

            {/* Close button at top-right */}
            <button
              type="button"
              onClick={() => void dismissSingleNotificationWithAnimation(t, notification.id)}
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-start gap-3 pr-5">
              <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                <CircleCheck className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {capitalizeFirst(notification.title || "New Admin Notification")}
                </h5>
                {notification.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {capitalizeFirst(notification.description)}
                  </p>
                )}
              </div>
            </div>

            {/* Action Row */}
            <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-[10.5px] font-medium text-slate-400">Admin Alert</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void dismissAllNotificationsWithAnimation()}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Dismiss all"
                  aria-label="Dismiss all"
                >
                  <CheckCheck className="h-4 w-4" />
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
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1 font-semibold text-white shadow-xs hover:bg-indigo-700 transition-all cursor-pointer active:scale-95"
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
