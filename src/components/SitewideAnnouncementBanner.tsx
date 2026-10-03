"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, AlertTriangle, AlertCircle, CheckCircle2, X, ArrowRight } from "lucide-react";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";
import { capitalizeFirst } from "@/lib/utils";

type BannerData = {
  enabled: boolean;
  message: string;
  type: "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";
  target: "ALL" | "CLIENT" | "PROFESSIONAL";
  link: string;
  dismissible: boolean;
};

export function SitewideAnnouncementBanner() {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!ENABLE_ADMIN_EXTRA_SECTION) return;

    let mounted = true;
    fetch("/api/admin/extra/announcements", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: BannerData | null) => {
        if (!mounted || !data || !data.enabled || !data.message.trim()) return;

        // Check if user already dismissed this specific announcement
        const storageKey = `dismissed_announcement_${encodeURIComponent(data.message.slice(0, 30))}`;
        if (sessionStorage.getItem(storageKey) === "true") {
          setDismissed(true);
        } else {
          setBanner(data);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  if (!ENABLE_ADMIN_EXTRA_SECTION || !banner || dismissed || !banner.enabled) {
    return null;
  }

  function handleDismiss() {
    if (!banner) return;
    const storageKey = `dismissed_announcement_${encodeURIComponent(banner.message.slice(0, 30))}`;
    sessionStorage.setItem(storageKey, "true");
    setDismissed(true);
  }

  const styles = {
    INFO: {
      bg: "bg-indigo-600 text-white",
      icon: Info,
      linkBg: "bg-white/20 hover:bg-white/30 text-white",
    },
    WARNING: {
      bg: "bg-amber-500 text-amber-950 font-medium",
      icon: AlertTriangle,
      linkBg: "bg-black/10 hover:bg-black/20 text-amber-950",
    },
    CRITICAL: {
      bg: "bg-rose-600 text-white font-medium",
      icon: AlertCircle,
      linkBg: "bg-white/20 hover:bg-white/30 text-white",
    },
    SUCCESS: {
      bg: "bg-emerald-600 text-white font-medium",
      icon: CheckCircle2,
      linkBg: "bg-white/20 hover:bg-white/30 text-white",
    },
  }[banner.type] || {
    bg: "bg-indigo-600 text-white",
    icon: Info,
    linkBg: "bg-white/20 hover:bg-white/30 text-white",
  };

  const Icon = styles.icon;

  return (
    <div
      role="alert"
      className={`relative z-50 w-full px-4 py-2.5 text-xs transition-all ${styles.bg} shadow-sm`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate sm:whitespace-normal font-semibold">
            {capitalizeFirst(banner.message)}
          </span>
          {banner.link && (
            <Link
              href={banner.link}
              className={`ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide transition ${styles.linkBg}`}
            >
              Learn more <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {banner.dismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss banner"
            className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition focus:outline-none"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
