"use client";

/**
 * Shared client-side reader for /api/v1/auth/me.
 *
 * Eleven components used to fetch this endpoint independently, so rendering a
 * single portal page issued the same request five to seven times. This caches
 * the result briefly and collapses concurrent callers onto one in-flight
 * request. Call invalidateCurrentUser() after login, logout or profile edits.
 */
export type CurrentUser = {
  id?: number | string;
  role?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  emailVerifiedAt?: string | null;
  avatarUrl?: string | null;
};

export type CurrentUserResponse = { user: CurrentUser | null };

const TTL_MS = 15_000;
const EMPTY: CurrentUserResponse = { user: null };

let cached: CurrentUserResponse | null = null;
let cachedAt = 0;
let inflight: Promise<CurrentUserResponse> | null = null;

export function invalidateCurrentUser() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export function fetchCurrentUser(options?: { force?: boolean }): Promise<CurrentUserResponse> {
  if (options?.force) invalidateCurrentUser();
  if (cached && Date.now() - cachedAt < TTL_MS) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = fetch("/api/v1/auth/me", { cache: "no-store" })
    .then((response) => (response.ok ? (response.json() as Promise<CurrentUserResponse>) : EMPTY))
    .then((data) => {
      cached = data ?? EMPTY;
      cachedAt = Date.now();
      return cached;
    })
    .catch(() => EMPTY)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
