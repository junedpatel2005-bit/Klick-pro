import { jwtVerify } from "jose";

/**
 * Signature-only session decoding for the proxy.
 *
 * Deliberately free of any database or `server-only` import: the proxy runs on
 * every request, including prefetches, so it must not issue a query. Revocation
 * and account-status checks stay authoritative in layouts and route handlers,
 * which call verifySession() in `@/lib/auth`.
 */
const authSecret = process.env.AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET is required.");
const secret = new TextEncoder().encode(authSecret);

export const sessionCookie = "servio_session";

export type DecodedSessionToken = {
  userId: number;
  role: string;
  sessionId: string;
};

export async function decodeSessionToken(token: string): Promise<DecodedSessionToken | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sessionId !== "string") return null;
    const userId = Number(payload.userId);
    if (!Number.isSafeInteger(userId) || userId < 1) return null;
    if (typeof payload.role !== "string") return null;
    return { userId, role: payload.role, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}
