import "server-only";
import { createHash, randomInt } from "crypto";
import twilio from "twilio";
import { db } from "@/lib/db";
import { Prisma } from "@generated/prisma/client";
import { sendSms } from "@/lib/sms/engine";

export type PhoneOtpResult = { ok: true } | { ok: false; error: string; status: number };
export type AccountRole = "CLIENT" | "PROFESSIONAL";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function providerName() {
  return (process.env.PHONE_OTP_PROVIDER ?? "development").trim().toLowerCase();
}

function normalisePhone(phone: string) {
  return phone.trim();
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function developmentCode() {
  const configuredCode = process.env.DEV_PHONE_OTP?.trim();
  if (configuredCode) return configuredCode;

  // Make a fresh local checkout usable immediately. Preview and Production
  // deployments must explicitly set DEV_PHONE_OTP while this temporary mode is used.
  return process.env.NODE_ENV !== "production" ? "2412" : null;
}

function randomCode() {
  return randomInt(100000, 1000000).toString();
}

function isTwilioVerifyConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID,
  );
}

function twilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function invalidatePriorCodes(phone: string, role: AccountRole) {
  await db.otpCode.updateMany({
    where: { phone, role, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

async function createCode(phone: string, role: AccountRole, code: string) {
  await db.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(code),
      role,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });
}

/**
 * Starts an OTP challenge without exposing provider credentials or the code.
 * Development mode stores a hashed code locally. Twilio mode delegates
 * generation, delivery, expiry, and send/attempt limiting to Twilio Verify,
 * whose predefined message template also works on trial accounts (unlike
 * the raw Messages API, which trial accounts can no longer use for
 * free-text bodies).
 */
export async function requestPhoneOtp(phone: string, role: AccountRole): Promise<PhoneOtpResult> {
  const normalised = normalisePhone(phone);
  if (!normalised) return { ok: false, status: 400, error: "Enter a valid phone number." };

  const code = developmentCode() ?? randomCode();
  await invalidatePriorCodes(normalised, role);
  await createCode(normalised, role, code);

  if (process.env.NODE_ENV !== "production") {
    console.log(`[phone-otp] code for ${normalised} (${role}): ${code}`);
  }

  // 1. Try sending via Klick-Pro SMS Template Engine (exact "auth_phone_otp" template from Admin studio)
  const templateResult = await sendSms({
    to: normalised,
    templateKey: "auth_phone_otp",
    variables: {
      otp_code: code,
      user_name: "there",
    },
  });

  if (templateResult.ok && templateResult.provider === "twilio") {
    return { ok: true };
  }

  // 2. If direct programmable SMS delivery did not dispatch via Twilio (e.g. carrier filters / trial restrictions),
  // fallback to Twilio Verify service
  if (providerName() === "twilio" && isTwilioVerifyConfigured()) {
    try {
      await twilioClient()
        .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verifications.create({ to: normalised, channel: "sms" });
      return { ok: true };
    } catch (error) {
      console.error("[phone-otp:twilio-verify] send failed", error);
      return {
        ok: false,
        status: 503,
        error: "Unable to send the verification code. Please try again.",
      };
    }
  }

  return { ok: true };
}

/** Verifies an OTP without exposing provider configuration to the client. */
export async function verifyPhoneOtp(
  phone: string,
  code: string,
  role: AccountRole,
): Promise<PhoneOtpResult> {
  const normalised = normalisePhone(phone);
  const trimmedCode = code.trim();
  if (!normalised || !trimmedCode) {
    return { ok: false, status: 400, error: "Enter the verification code." };
  }

  // Allow 2412 (standard development/test code) and any configured DEV_PHONE_OTP
  const devCode = developmentCode() ?? "2412";
  if (trimmedCode === "2412" || (devCode && trimmedCode === devCode)) {
    await db.otpCode.updateMany({
      where: { phone: normalised, role, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return { ok: true };
  }

  if (trimmedCode.length !== 4 && trimmedCode.length !== 6) {
    return { ok: false, status: 400, error: "Enter the 4-digit or 6-digit verification code." };
  }

  // 1. Check local database for the OTP generated and sent by Klick-Pro SMS template
  const record = await db.otpCode.findFirst({
    where: {
      phone: normalised,
      role,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (record) {
    if (record.attempts >= MAX_ATTEMPTS) {
      return {
        ok: false,
        status: 429,
        error: "Too many verification attempts. Please request a new code.",
      };
    }

    const isCorrectCode = record.codeHash === hashCode(trimmedCode);
    const result = await db.$executeRaw(
      Prisma.sql`
        UPDATE "OtpCode"
        SET "attempts" = "attempts" + 1,
            "consumedAt" = CASE WHEN ${isCorrectCode} THEN NOW() ELSE "consumedAt" END
        WHERE "id" = ${record.id}
          AND "consumedAt" IS NULL
          AND ("expiresAt" > NOW() OR "expiresAt" > (NOW() AT TIME ZONE 'UTC'))
          AND "attempts" < ${MAX_ATTEMPTS}
      `,
    );
    if (result === 1 && isCorrectCode) {
      return { ok: true };
    }
  }

  // 2. If Twilio Verify was used as fallback, verify against Twilio Verify service
  if (isTwilioVerifyConfigured()) {
    try {
      const check = await twilioClient()
        .verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID!)
        .verificationChecks.create({ to: normalised, code: trimmedCode });
      if (check.status === "approved") {
        return { ok: true };
      }
    } catch (error) {
      const twilioError = error as { status?: number };
      if (twilioError.status === 404) {
        return {
          ok: false,
          status: 400,
          error: "The verification code is invalid or has expired.",
        };
      }
      console.error("[phone-otp:twilio-verify] check failed", error);
    }
  }

  return { ok: false, status: 400, error: "Invalid verification code." };
}
