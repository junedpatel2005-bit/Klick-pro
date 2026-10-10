"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CircleCheck,
  CheckCheck,
  FileText,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

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

function getAdminVisual(type = "", title = "") {
  const upper = `${type} ${title}`.toUpperCase();
  if (upper.includes("DISPUTE")) {
    return {
      Icon: AlertTriangle,
      iconClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      accentGradient: "bg-gradient-to-r from-amber-500/50 via-amber-500 to-amber-500/50",
      pulseColor: "bg-amber-500",
      dotColor: "bg-amber-500",
      categoryLabel: "Dispute Alert",
    };
  }
  if (upper.includes("VERIFICATION") || upper.includes("KYC")) {
    return {
      Icon: ShieldCheck,
      iconClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20",
      accentGradient: "bg-gradient-to-r from-blue-500/50 via-blue-500 to-blue-500/50",
      pulseColor: "bg-blue-500",
      dotColor: "bg-blue-500",
      categoryLabel: "KYC / Verification",
    };
  }
  if (upper.includes("PAYMENT") || upper.includes("ESCROW") || upper.includes("PAYOUT") || upper.includes("WALLET")) {
    return {
      Icon: Wallet,
      iconClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      accentGradient: "bg-gradient-to-r from-emerald-500/50 via-emerald-500 to-emerald-500/50",
      pulseColor: "bg-emerald-500",
      dotColor: "bg-emerald-500",
      categoryLabel: "Finance Update",
    };
  }
  if (upper.includes("JOB") || upper.includes("PROPOSAL")) {
    return {
      Icon: FileText,
      iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
      accentGradient: "bg-gradient-to-r from-indigo-500/50 via-indigo-500 to-indigo-500/50",
      pulseColor: "bg-indigo-500",
      dotColor: "bg-indigo-500",
      categoryLabel: "Marketplace Activity",
    };
  }
  return {
    Icon: CircleCheck,
    iconClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
    accentGradient: "bg-gradient-to-r from-indigo-500/50 via-indigo-600 to-indigo-500/50",
    pulseColor: "bg-indigo-500",
    dotColor: "bg-indigo-500",
    categoryLabel: "Admin Alert",
  };
}

export function AdminRealtime() {
  const router = useRouter();
  const seenKeys = useRef(new Map<string, number>());

  const showNotification = useCallback(
    (notification: AdminRealtimeNotification) => {
      let actionLabel = "Review";
      if (notification.href?.includes("/admin/verifications")) actionLabel = "Inspect KYC";
      else if (notification.href?.includes("/admin/operations")) actionLabel = "Open Operations";
      else if (notification.href?.includes("/admin/finance")) actionLabel = "Check Escrow";
      else if (notification.href?.includes("/admin/users")) actionLabel = "View User";

      const visual = getAdminVisual(notification.type, notification.title);
      const VisualIcon = visual.Icon;

      toast.custom(
        (t) => (
          <div
            data-notification-toast="true"
            data-notification-id={String(t)}
            className="group relative w-full max-w-sm rounded-2xl border border-border/80 bg-background/95 p-4 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.22)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10 transition-all duration-200 animate-in fade-in-50 slide-in-from-top-3"
          >
            {/* Top glowing ambient gradient bar */}
            <div className={`absolute top-0 inset-x-4 h-0.5 rounded-full ${visual.accentGradient} opacity-90`} />

            {/* Header: Live Indicator & Category chip + Close */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${visual.pulseColor}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${visual.dotColor}`} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {visual.categoryLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void dismissSingleNotificationWithAnimation(t, notification.id)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground/70 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Main content */}
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-xs ${visual.iconClass}`}>
                <VisualIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-sm font-bold text-foreground leading-snug">
                  {capitalizeFirst(notification.title || "Admin Notification")}
                </h5>
                {notification.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {capitalizeFirst(notification.description)}
                  </p>
                )}
              </div>
            </div>

            {/* Action Row */}
            <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
              <span className="text-[10px] font-medium text-muted-foreground/60">Just now</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void dismissAllNotificationsWithAnimation()}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Dismiss all"
                  aria-label="Dismiss all"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 font-semibold text-xs text-primary-foreground shadow-xs hover:bg-primary/90 transition-all cursor-pointer active:scale-95"
                  >
                    <span>{actionLabel}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ),
        { duration: 6500, unstyled: true },
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
      const now = Date.now();
      const normTitle = (payload.title || "").toLowerCase().trim();
      const normDesc = (payload.description || "").toLowerCase().trim().slice(0, 40);
      const normHref = (payload.href || "").split("?")[0];
      const key =
        payload.id != null
          ? `id:${payload.id}`
          : `${normTitle}|${normDesc}|${normHref}`;

      const lastSeen = seenKeys.current.get(key);
      if (lastSeen && now - lastSeen < 12000) {
        return; // Suppress duplicate notification within 12 seconds
      }
      seenKeys.current.set(key, now);

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
