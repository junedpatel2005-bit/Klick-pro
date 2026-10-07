"use client";

/**
 * Shared client-side reader for unread message counts from /api/v1/messages.
 *
 * AppSidebar and AppMobileNavigation both mount at the same time in PortalShell
 * and AppShell. This collapses concurrent in-flight requests into a single network call.
 */

let cachedCount: number | null = null;
let cachedAt = 0;
let inflight: Promise<number> | null = null;
const TTL_MS = 3_000;

export function invalidateMessagesCache() {
  cachedCount = null;
  cachedAt = 0;
  inflight = null;
}

export function fetchUnreadMessagesCount(options?: { force?: boolean }): Promise<number> {
  if (options?.force) invalidateMessagesCache();
  if (cachedCount !== null && Date.now() - cachedAt < TTL_MS) {
    return Promise.resolve(cachedCount);
  }
  if (inflight) return inflight;

  inflight = fetch("/api/v1/messages", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { contacts?: { unreadCount?: number }[] } | null) => {
      const total =
        data?.contacts?.reduce((sum, contact) => sum + (contact.unreadCount ?? 0), 0) ?? 0;
      cachedCount = total;
      cachedAt = Date.now();
      return total;
    })
    .catch(() => 0)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
