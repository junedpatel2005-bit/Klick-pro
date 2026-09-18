import "server-only";
import { randomBytes } from "crypto";
import { jwtVerify, SignJWT } from "jose";
import type { AccountRole } from "@/lib/phone-otp-provider";

const phoneVerificationCookie = "servio_phone_verification";
const proofLifetimeSeconds = 10 * 60;
const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);

function normalisePhone(phone: string) {
  return phone.trim();
}

export async function createPhoneVerificationProof(phone: string, role: AccountRole) {
  return new SignJWT({
    phone: normalisePhone(phone),
    role,
    purpose: "signup-phone",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(randomBytes(16).toString("hex"))
    .setExpirationTime(`${proofLifetimeSeconds}s`)
    .sign(secret);
}

export async function hasValidPhoneVerificationProof(
  token: string | undefined,
  phone: string,
  role: AccountRole,
) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (
      payload.purpose === "signup-phone" &&
      payload.phone === normalisePhone(phone) &&
      payload.role === role &&
      typeof payload.exp === "number" &&
      payload.exp * 1000 > Date.now()
    );
  } catch {
    return false;
  }
}

export const phoneProofCookie = phoneVerificationCookie;
export const phoneProofCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: proofLifetimeSeconds,
};
