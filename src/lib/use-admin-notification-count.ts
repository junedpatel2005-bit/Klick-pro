"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Unread admin notification count.
 *
 * Reads the same /api/portal/notifications endpoint the notifications page
 * uses, so this number can never drift from what that page actually lists.
 * /api/admin/sidebar-counts applies a different filter set, which is why the
 * sidebar badge and the list could previously disagree.
 *
 * The Socket.IO connection already lives in AdminPortal (AdminRealtime), so
 * this only listens for the window events that connection dispatches.
 */
export function useAdminNotificationCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data)) return;
      setUnreadCount(data.filter((item) => !item?.readAt).length);
    } catch {
      // Keep the last known count rather than flashing to zero on a blip.
    }
  }, []);

  useEffect(() => {
    void load();

    // Coalesced so a burst of admin events triggers a single refetch.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void load();
      }, 250);
    };

    window.addEventListener("servio:notification", schedule);
    window.addEventListener("servio:notifications-read", schedule);
    return () => {
      window.removeEventListener("servio:notification", schedule);
      window.removeEventListener("servio:notifications-read", schedule);
      if (timer) clearTimeout(timer);
    };
  }, [load]);

  return { unreadCount, refresh: load };
}
