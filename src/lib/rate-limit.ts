import "server-only";

type RateLimitEntry = {
  count: number;
  reset: number;
};

// Use a global singleton across serverless warm invocations
const globalForRateLimit = global as unknown as {
  rateLimitMap?: Map<string, RateLimitEntry>;
  rateLimitLastCleanup?: number;
};

const attempts = globalForRateLimit.rateLimitMap ?? new Map<string, RateLimitEntry>();
if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.rateLimitMap = attempts;
}

// Periodic garbage collection every 5 minutes to prevent memory leaks
function cleanupExpired() {
  const now = Date.now();
  if (
    globalForRateLimit.rateLimitLastCleanup &&
    now - globalForRateLimit.rateLimitLastCleanup < 300_000
  ) {
    return;
  }
  globalForRateLimit.rateLimitLastCleanup = now;
  for (const [key, entry] of attempts.entries()) {
    if (entry.reset < now) {
      attempts.delete(key);
    }
  }
}

export function rateLimit(key: string, limit = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  cleanupExpired();

  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

export function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 60_000,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  cleanupExpired();

  const entry = attempts.get(key);
  if (!entry || entry.reset < now) {
    attempts.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetMs: Math.max(0, entry.reset - now) };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetMs: Math.max(0, entry.reset - now) };
}

/** Clear a successful credential attempt so a previous typo cannot lock a user out. */
export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
