"use client";

/**
 * Shared client-side reader for /api/portal/notifications.
 *
 * AppHeader, AppSidebar, AppMobileNavigation, and RealtimeNotifications all
 * query this endpoint simultaneously. This caches the result for a brief TTL
 * and collapses concurrent in-flight requests into a single network call.
 */

export type PortalNotification = {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  readAt: string | null;
  href?: string | null;
  type?: string;
  metadata?: Record<string, unknown> | null;
};

const TTL_MS = 3_000;
let cached: PortalNotification[] | null = null;
let cachedAt = 0;
let inflight: Promise<PortalNotification[]> | null = null;

export function invalidateNotificationsCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export function fetchPortalNotifications(options?: {
  force?: boolean;
}): Promise<PortalNotification[]> {
  if (options?.force) invalidateNotificationsCache();
  if (cached && Date.now() - cachedAt < TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = fetch("/api/portal/notifications", { cache: "no-store" })
    .then((response) => (response.ok ? (response.json() as Promise<PortalNotification[]>) : []))
    .then((data) => {
      cached = Array.isArray(data) ? data : [];
      cachedAt = Date.now();
      return cached;
    })
    .catch(() => [])
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
