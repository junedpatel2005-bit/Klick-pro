import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/generated/prisma/client";
import { db } from "./db";

const authSecret = process.env.AUTH_SECRET;
if (!authSecret) throw new Error("AUTH_SECRET is required.");
const secret = new TextEncoder().encode(authSecret);
export const sessionCookie = "servio_session";
export type Session = { userId: number; role: UserRole; emailVerifiedAt?: Date | null };
export async function createSession(session: Session) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + sessionOptions.maxAge * 1000);
  const token = await new SignJWT({ userId: session.userId, role: session.role, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  await db.session.create({ data: { id: sessionId, userId: session.userId, expiresAt } });
  return token;
}
export async function verifySession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  if (typeof payload.sessionId !== "string") throw new Error("Invalid session.");
  const userId = Number(payload.userId);
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error("Invalid session user.");
  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: { select: { id: true, role: true, isActive: true, emailVerifiedAt: true } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date())
    throw new Error("Inactive session.");
  const user = session.user;
  if (user.id !== userId || !user.isActive) throw new Error("Inactive session user.");
  return {
    userId: user.id,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export async function revokeSession(token: string) {
  const { payload } = await jwtVerify(token, secret);
  if (typeof payload.sessionId !== "string") return false;
  const result = await db.session.updateMany({
    where: { id: payload.sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export async function requireAuthenticatedUser(token: string) {
  return verifySession(token);
}

export async function requireVerifiedUser(token: string) {
  const session = await verifySession(token);
  if (!session.emailVerifiedAt) throw new Error("Email verification required.");
  return session;
}
export const sessionOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
