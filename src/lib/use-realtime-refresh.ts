"use client";

import { useEffect, useRef } from "react";

/**
 * Every `servio:*` event the app dispatches. The Socket.IO connection already
 * lives in the shells (PortalShell, AdminPortal, AppShell), so pages never open
 * their own socket: they only need to listen for the event their data cares
 * about and re-run their existing loader.
 */
export type RealtimeEvent =
  | "servio:notification"
  | "servio:message"
  | "servio:message-read"
  | "servio:notifications-read"
  | "servio:project-update"
  | "servio:proposal"
  | "servio:job-posted"
  | "servio:profile-updated"
  | "servio:settings-update"
  | "servio:admin-overview-update"
  | "servio:admin-operations-update"
  | "servio:admin-users-update"
  | "servio:admin-verifications-update";

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Re-runs `refresh` whenever one of `events` fires. A single server action
 * often emits several events at once (for example `admin:users-update` also
 * emits `admin:overview-update`), so the callback is debounced to avoid
 * refetching the same data multiple times.
 *
 * `refresh` is held in a ref, so passing an inline arrow function does not
 * re-register the listeners on every render.
 */
export function useRealtimeRefresh(
  events: RealtimeEvent[],
  refresh: () => void,
  debounceMs = DEFAULT_DEBOUNCE_MS,
) {
  const refreshRef = useRef(refresh);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventsKey = events.join("|");

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const names = eventsKey ? eventsKey.split("|") : [];
    if (names.length === 0) return;

    const handler =
      debounceMs <= 0
        ? () => refreshRef.current()
        : () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              timerRef.current = null;
              refreshRef.current();
            }, debounceMs);
          };

    for (const name of names) window.addEventListener(name, handler);

    return () => {
      for (const name of names) window.removeEventListener(name, handler);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [eventsKey, debounceMs]);
}
