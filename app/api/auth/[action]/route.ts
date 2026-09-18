import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import {
  createSession,
  revokeSession,
  sessionCookie,
  sessionOptions,
  verifySession,
} from "@/lib/auth";
import {
  createPhoneVerificationProof,
  hasValidPhoneVerificationProof,
  phoneProofCookie,
  phoneProofCookieOptions,
} from "@/lib/dev-phone-otp";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/phone-otp-provider";
import { clearRateLimit, rateLimit } from "@/lib/rate-limit";
import { sendAuthEmail } from "@/lib/email";
import { enqueueBackgroundJob } from "@/lib/background-jobs";
import { logServerError } from "@/lib/server-logger";
import {
  notifyAdminsOfNewAccount,
  notifyClientsOfNewProfessional,
} from "@/lib/marketplace-notifications";
import { isValidInternationalPhoneNumber } from "@/lib/phone-validation";

const passwordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/);
const registerSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(25).optional(),
  password: passwordSchema,
  role: z.enum(["CLIENT", "PROFESSIONAL"]),
  terms: z.literal(true),
});
const credentials = z.object({ email: z.string().email(), password: z.string().min(1) });
const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
const clientKey = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
const safe = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
export function publicAppOrigin(request: NextRequest) {
  // Build links from the host the user actually registered on. This keeps local
  // emails on localhost and makes preview/production emails use their Vercel URL.
  // APP_URL is only a fallback for runtimes that do not expose the public host.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host")?.trim();
  const requestProtocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "");

  if (requestHost && requestHost !== "0.0.0.0:3000") {
    try {
      return new URL(`${requestProtocol}://${requestHost}`).origin;
    } catch {
      // Fall through to the configured origin when the proxy host is malformed.
    }
  }

  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to Next.js' request origin.
    }
  }

  return request.nextUrl.origin.replace("0.0.0.0", "localhost");
}
async function createEmailVerificationToken(userId: number) {
  const raw = randomBytes(32).toString("hex");
  await db.apiToken.create({
    data: {
      userId,
      tokenHash: tokenHash(raw),
      kind: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  return raw;
}
async function sendEmailVerificationLink(email: string, raw: string, appOrigin: string) {
  await sendAuthEmail(
    email,
    "Verify your Klick-Pro email",
    "Verify your email",
    `${appOrigin}/verify-email?token=${encodeURIComponent(raw)}`,
    "Verify email",
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  if (action === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = `${publicAppOrigin(request)}/api/v1/auth/google`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/login?oauthError=google-not-configured", request.url));
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      const role =
        request.nextUrl.searchParams.get("role") === "PROFESSIONAL" ? "PROFESSIONAL" : "CLIENT";
      const nextPath = request.nextUrl.searchParams.get("next");
      const state = randomBytes(24).toString("hex");
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", callbackUrl);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("prompt", "select_account");
      url.searchParams.set("state", state);
      const response = NextResponse.redirect(url);
      response.cookies.set("servio_google_oauth", JSON.stringify({ state, role, nextPath }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
      return response;
    }

    try {
      const saved = JSON.parse(request.cookies.get("servio_google_oauth")?.value ?? "{}") as {
        state?: string;
        role?: "CLIENT" | "PROFESSIONAL";
        nextPath?: string | null;
      };
      if (!saved.state || saved.state !== request.nextUrl.searchParams.get("state"))
        throw new Error("Invalid OAuth state");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: "authorization_code",
        }),
      });
      const token = (await tokenResponse.json()) as { access_token?: string };
      if (!tokenResponse.ok || !token.access_token)
        throw new Error("Could not exchange Google authorization code");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      const profile = (await profileResponse.json()) as {
        sub?: string;
        email?: string;
        given_name?: string;
        family_name?: string;
        name?: string;
        email_verified?: boolean;
      };
      if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true)
        throw new Error("Could not read Google profile");
      let user = await db.user.findFirst({
        where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
      });
      let createdAccount = false;
      if (!user) {
        const names = (profile.name ?? "New User").trim().split(/\s+/, 2);
        user = await db.user.create({
          data: {
            googleId: profile.sub,
            authProvider: "GOOGLE",
            email: profile.email,
            firstName: profile.given_name ?? names[0] ?? "New",
            lastName: profile.family_name ?? names[1] ?? "",
            role: saved.role ?? "CLIENT",
            emailVerifiedAt: new Date(),
          },
        });
        createdAccount = true;
      } else if (!user.googleId) {
        user = await db.user.update({
          where: { id: user.id },
          data: { googleId: profile.sub, authProvider: "GOOGLE", emailVerifiedAt: new Date() },
        });
      }
      if (createdAccount && user.role !== "ADMIN") {
        await Promise.all([
          notifyAdminsOfNewAccount(user),
          ...(user.role === "PROFESSIONAL" ? [notifyClientsOfNewProfessional(user)] : []),
        ]);
      }
      const redirect =
        saved.nextPath?.startsWith("/") && !saved.nextPath.startsWith("//")
          ? saved.nextPath
          : user.role === "CLIENT"
            ? "/client-profile"
            : user.role === "PROFESSIONAL"
              ? "/professional-home"
              : "/admin";
      const response = NextResponse.redirect(new URL(redirect, request.url));
      response.cookies.set(
        sessionCookie,
        await createSession({ userId: user.id, role: user.role }),
        sessionOptions,
      );
      response.cookies.set("servio_google_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
      return response;
    } catch {
      const response = NextResponse.redirect(
        new URL("/login?oauthError=google-failed", request.url),
      );
      response.cookies.set("servio_google_oauth", "", { httpOnly: true, path: "/", maxAge: 0 });
      return response;
    }
  }
  // Note: `GET /api/auth/me` is served by the sibling static route at
  // app/api/auth/me/route.ts, which Next.js matches before this dynamic
  // [action] segment — there is intentionally no "me" case here.
  return safe("Not found", 404);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const { action } = await params;
  const body = await request.json().catch(() => null);
  // Credential attempts are scoped to an address as well as the browser IP.
  // In local development every user shares the "local" client key; using only
  // that key locks every account after five attempts from any account.
  const loginEmail =
    action === "login" && typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const rateLimitKey = loginEmail
    ? `${action}:${clientKey(request)}:${loginEmail}`
    : `${action}:${clientKey(request)}`;
  if (!rateLimit(rateLimitKey)) return safe("Too many attempts. Please try again shortly.", 429);
  if (action === "send-phone-otp") {
    const parsed = z
      .object({
        phone: z.string().min(7).max(25),
        role: z.enum(["CLIENT", "PROFESSIONAL"]),
      })
      .refine((value) => isValidInternationalPhoneNumber(value.phone), {
        path: ["phone"],
        message: "Enter a valid phone number for the selected country.",
      })
      .safeParse(body);
    if (!parsed.success) return safe("Enter a valid phone number and account type.");
    const sessionToken = request.cookies.get(sessionCookie)?.value;
    let sessionUserId: number | null = null;
    if (sessionToken) {
      try {
        sessionUserId = (await verifySession(sessionToken)).userId;
      } catch {
        sessionUserId = null;
      }
    }
    const existingUser = await db.user.findFirst({
      where: { phone: parsed.data.phone, ...(sessionUserId ? { id: { not: sessionUserId } } : {}) },
    });
    if (existingUser)
      return NextResponse.json(
        {
          error:
            "This phone number is already registered. Please log in or use a different number.",
        },
        { status: 409 },
      );
    if (
      !rateLimit(`send-phone-otp:${clientKey(request)}:${parsed.data.phone.trim()}`, 3, 10 * 60_000)
    )
      return safe("Too many code requests. Please try again later.", 429);
    const result = await requestPhoneOtp(parsed.data.phone, parsed.data.role);
    if (!result.ok) return safe(result.error, result.status);
    return NextResponse.json({ success: true });
  }
  if (action === "verify-phone") {
    const parsed = z
      .object({
        phone: z.string().min(7).max(25),
        code: z.string().min(1).max(20),
        role: z.enum(["CLIENT", "PROFESSIONAL"]).optional(),
      })
      .refine((value) => isValidInternationalPhoneNumber(value.phone), {
        path: ["phone"],
        message: "Enter a valid phone number for the selected country.",
      })
      .safeParse(body);
    if (!parsed.success) return safe("Enter a valid phone number, account type, and code.");
    if (
      !rateLimit(`verify-phone:${clientKey(request)}:${parsed.data.phone.trim()}`, 5, 10 * 60_000)
    )
      return safe("Too many verification attempts. Please try again later.", 429);
    let role = parsed.data.role;
    const sessionToken = request.cookies.get(sessionCookie)?.value;
    let session: Awaited<ReturnType<typeof verifySession>> | null = null;
    if (sessionToken) {
      try {
        session = await verifySession(sessionToken);
        role = session.role === "CLIENT" || session.role === "PROFESSIONAL" ? session.role : role;
      } catch {
        session = null;
      }
    }
    if (!role || (session && session.role !== role)) return safe("Your account type is invalid.");
    const verifiedRole = role;
    if (session) {
      const duplicate = await db.user.findFirst({
        where: { phone: parsed.data.phone.trim(), id: { not: session.userId } },
        select: { id: true },
      });
      if (duplicate) return safe("This phone number is already registered.", 409);
    }
    const result = await verifyPhoneOtp(parsed.data.phone, parsed.data.code, verifiedRole);
    if (!result.ok) return safe(result.error, result.status);

    if (session) {
      await db.user.update({
        where: { id: session.userId },
        data: { phone: parsed.data.phone.trim(), phoneVerifiedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      phoneProofCookie,
      await createPhoneVerificationProof(parsed.data.phone, verifiedRole),
      phoneProofCookieOptions,
    );
    return response;
  }
  if (action === "check-availability") {
    const parsed = z
      .object({ email: z.string().email().optional(), phone: z.string().min(7).max(25).optional() })
      .refine((value) => !value.phone || isValidInternationalPhoneNumber(value.phone), {
        path: ["phone"],
        message: "Enter a valid phone number for the selected country.",
      })
      .refine((value) => Boolean(value.email || value.phone), {
        message: "Email or phone is required.",
      })
      .safeParse(body);
    if (!parsed.success) {
      return safe("Enter a valid email or phone number.");
    }
    const fields: Record<string, string> = {};
    if (parsed.data.email) {
      const emailTaken = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (emailTaken) fields.email = "Email is already registered.";
    }
    if (parsed.data.phone) {
      const phoneTaken = await db.user.findFirst({ where: { phone: parsed.data.phone } });
      if (phoneTaken) fields.phone = "Phone number is already registered.";
    }
    return NextResponse.json({ fields }, { status: 200 });
  }

  if (action === "register") {
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const fields = Object.fromEntries(
        parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
      );
      return NextResponse.json(
        { error: "Please correct the highlighted fields.", fields },
        { status: 400 },
      );
    }
    const data = parsed.data;
    if (data.phone) {
      const proofToken = request.cookies.get(phoneProofCookie)?.value;
      const hasProof = await hasValidPhoneVerificationProof(proofToken, data.phone, data.role);
      if (!hasProof) {
        return NextResponse.json(
          {
            error: "Phone verification is required before completing registration.",
            fields: { phone: "Please verify your phone number via OTP first." },
          },
          { status: 403 },
        );
      }
    }
    const existingEmailUser = await db.user.findUnique({ where: { email: data.email } });
    const existingPhoneUser = data.phone
      ? await db.user.findFirst({ where: { phone: data.phone } })
      : null;
    const duplicateFields: Record<string, string> = {};
    if (existingEmailUser) duplicateFields.email = "Email is already registered.";
    if (existingPhoneUser) duplicateFields.phone = "Phone number is already registered.";
    if (existingEmailUser || existingPhoneUser) {
      return NextResponse.json(
        {
          error: "An account already exists with that email or phone.",
          fields: duplicateFields,
        },
        { status: 409 },
      );
    }
    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        phoneVerifiedAt: data.phone ? new Date() : null,
        passwordHash: await bcrypt.hash(data.password, 12),
        role: data.role,
      },
    });
    // Registration notifications and verification emails are dispatched in the background
    // so registration completes instantly and does not block or crash if SMTP is slow.
    enqueueBackgroundJob(
      "notifications.new_account",
      async () => {
        await Promise.all([
          notifyAdminsOfNewAccount(user),
          ...(user.role === "PROFESSIONAL" ? [notifyClientsOfNewProfessional(user)] : []),
        ]);
      },
      { userId: user.id },
    );
    const raw = await createEmailVerificationToken(user.id);
    enqueueBackgroundJob(
      "email.verification",
      () => sendEmailVerificationLink(user.email, raw, publicAppOrigin(request)),
      { userId: user.id },
    );
    const response = NextResponse.json(
      {
        success: true,
        redirect: "/verify",
      },
      { status: 201 },
    );
    response.cookies.set(phoneProofCookie, "", { ...phoneProofCookieOptions, maxAge: 0 });
    return response;
  }
  if (action === "login") {
    const parsed = credentials.safeParse(body);
    if (!parsed.success) return safe("Invalid email or password.", 401);
    const email = parsed.data.email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email } });
    if (
      !user?.passwordHash ||
      !user.isActive ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    )
      return safe("Invalid email or password.", 401);

    const isFirstLogin = !user.lastLoginAt;
    const hasClientProfile =
      user.role !== "CLIENT" ||
      Boolean(
        await db.clientProfile.findFirst({ where: { userId: user.id }, select: { id: true } }),
      );
    const nextRedirect =
      user.role === "ADMIN"
        ? "/admin"
        : !user.emailVerifiedAt
          ? "/verify"
          : user.role === "PROFESSIONAL"
            ? user.professionalCategory &&
              user.professionalLatitude !== null &&
              user.professionalLongitude !== null
              ? "/professional-home"
              : "/professional/setup?profileSetup=1"
            : hasClientProfile
              ? "/dashboard"
              : "/client-profile?profileSetup=1";

    if (!user.emailVerifiedAt) {
      const response = NextResponse.json(
        {
          error: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before signing in.",
          redirect: "/verify",
        },
        { status: 403 },
      );
      return response;
    }

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      ...(isFirstLogin
        ? [
            db.userNotification.create({
              data: {
                userId: user.id,
                type: user.role === "PROFESSIONAL" ? "WELCOME_PROFESSIONAL" : "WELCOME_CLIENT",
                title:
                  user.role === "PROFESSIONAL"
                    ? "Welcome to your professional dashboard"
                    : "Welcome to Klick-Pro",
                description:
                  user.role === "PROFESSIONAL"
                    ? "Your profile is ready. Update your setup and start getting matched with clients."
                    : "Your account is ready. Start exploring professionals or post your first project.",
                href: user.role === "PROFESSIONAL" ? "/professional-home" : "/dashboard",
              },
            }),
          ]
        : []),
    ]);

    clearRateLimit(rateLimitKey);
    const sessionToken = await createSession({ userId: user.id, role: user.role });
    const response = NextResponse.json({
      success: true,
      redirect: nextRedirect,
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
    response.cookies.set(sessionCookie, sessionToken, sessionOptions);
    return response;
  }
  if (action === "send-phone-login-otp") {
    const parsed = z
      .object({ phone: z.string().min(7).max(25) })
      .refine((value) => isValidInternationalPhoneNumber(value.phone), {
        path: ["phone"],
        message: "Enter a valid phone number.",
      })
      .safeParse(body);
    if (!parsed.success) return safe("Enter a valid phone number.");
    const user = await db.user.findFirst({
      where: { phone: parsed.data.phone.trim(), isActive: true },
      select: { role: true },
    });
    if (!user || (user.role !== "CLIENT" && user.role !== "PROFESSIONAL"))
      return safe("No active account was found with this phone number.", 404);
    const result = await requestPhoneOtp(parsed.data.phone, user.role);
    if (!result.ok) return safe(result.error, result.status);
    return NextResponse.json({ success: true });
  }
  if (action === "login-phone") {
    const parsed = z
      .object({ phone: z.string().min(7).max(25), code: z.string().min(1).max(20) })
      .refine((value) => isValidInternationalPhoneNumber(value.phone), {
        path: ["phone"],
        message: "Enter a valid phone number.",
      })
      .safeParse(body);
    if (!parsed.success) return safe("Enter a valid phone number and code.", 401);
    const user = await db.user.findFirst({
      where: { phone: parsed.data.phone.trim(), isActive: true },
    });
    if (!user || (user.role !== "CLIENT" && user.role !== "PROFESSIONAL"))
      return safe("Invalid phone number or verification code.", 401);
    const result = await verifyPhoneOtp(parsed.data.phone, parsed.data.code, user.role);
    if (!result.ok) return safe(result.error, result.status);
    const hasClientProfile =
      user.role !== "CLIENT" ||
      Boolean(
        await db.clientProfile.findFirst({ where: { userId: user.id }, select: { id: true } }),
      );
    const nextRedirect = !user.emailVerifiedAt
      ? "/verify"
      : user.role === "PROFESSIONAL"
        ? user.professionalCategory &&
          user.professionalLatitude !== null &&
          user.professionalLongitude !== null
          ? "/professional-home"
          : "/professional/setup?profileSetup=1"
        : hasClientProfile
          ? "/dashboard"
          : "/client-profile?profileSetup=1";
    if (!user.emailVerifiedAt)
      return NextResponse.json(
        {
          error: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before signing in.",
          redirect: "/verify",
        },
        { status: 403 },
      );
    const response = NextResponse.json({ success: true, redirect: nextRedirect });
    response.cookies.set(
      sessionCookie,
      await createSession({ userId: user.id, role: user.role }),
      sessionOptions,
    );
    return response;
  }
  if (action === "login-phone-password") {
    const parsed = z
      .object({ phone: z.string().min(7).max(25), password: z.string().min(1) })
      .refine((value) => isValidInternationalPhoneNumber(value.phone), {
        path: ["phone"],
        message: "Enter a valid phone number.",
      })
      .safeParse(body);
    if (!parsed.success) return safe("Enter a valid phone number and password.", 401);
    const user = await db.user.findFirst({
      where: { phone: parsed.data.phone.trim(), isActive: true },
    });
    if (
      !user ||
      (user.role !== "CLIENT" && user.role !== "PROFESSIONAL") ||
      !user.passwordHash ||
      !(await bcrypt.compare(parsed.data.password, user.passwordHash))
    )
      return safe("Invalid phone number or password.", 401);
    const hasClientProfile =
      user.role !== "CLIENT" ||
      Boolean(
        await db.clientProfile.findFirst({ where: { userId: user.id }, select: { id: true } }),
      );
    const nextRedirect = !user.emailVerifiedAt
      ? "/verify"
      : user.role === "PROFESSIONAL"
        ? user.professionalCategory &&
          user.professionalLatitude !== null &&
          user.professionalLongitude !== null
          ? "/professional-home"
          : "/professional/setup?profileSetup=1"
        : hasClientProfile
          ? "/dashboard"
          : "/client-profile?profileSetup=1";
    const response = NextResponse.json(
      !user.emailVerifiedAt
        ? {
            error:
              "You are registered, but your email is not confirmed. Please confirm your email before continuing.",
            redirect: nextRedirect,
          }
        : { success: true, redirect: nextRedirect },
      !user.emailVerifiedAt ? { status: 403 } : undefined,
    );
    response.cookies.set(
      sessionCookie,
      await createSession({ userId: user.id, role: user.role }),
      sessionOptions,
    );
    return response;
  }
  if (action === "logout") {
    const token = request.cookies.get(sessionCookie)?.value;
    if (token) {
      try {
        await revokeSession(token);
      } catch {
        return safe("Unable to sign out right now.", 500);
      }
    }
    const response = NextResponse.json({ success: true });
    response.cookies.set(sessionCookie, "", { ...sessionOptions, maxAge: 0 });
    return response;
  }
  if (action === "update-email") {
    const parsed = z.object({ email: z.string().email() }).safeParse(body);
    if (!parsed.success) return safe("Enter a valid email address.");
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return safe("Please sign in again.", 401);
    try {
      const session = await verifySession(token);
      const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
      const existingEmailUser = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (existingEmailUser && existingEmailUser.id !== user.id) {
        return NextResponse.json(
          {
            error: "This email address is already registered.",
            fields: { email: "Email is already registered." },
          },
          { status: 409 },
        );
      }
      const raw = randomBytes(32).toString("hex");
      await db.$transaction([
        db.apiToken.updateMany({
          where: {
            userId: user.id,
            kind: "EMAIL_VERIFICATION",
            usedAt: null,
          },
          data: { usedAt: new Date() },
        }),
        db.user.update({
          where: { id: user.id },
          data: { email: parsed.data.email, emailVerifiedAt: null },
        }),
        db.apiToken.create({
          data: {
            userId: user.id,
            tokenHash: tokenHash(raw),
            kind: "EMAIL_VERIFICATION",
            expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          },
        }),
      ]);
      await sendEmailVerificationLink(parsed.data.email, raw, publicAppOrigin(request));
      return NextResponse.json({
        success: true,
        message: "Email updated. A new confirmation link has been sent.",
        email: parsed.data.email,
      });
    } catch {
      return safe("Unable to update your email.", 500);
    }
  }

  if (action === "resend-verification") {
    const token = request.cookies.get(sessionCookie)?.value;
    if (!token) return safe("Please sign in again.", 401);
    try {
      const session = await verifySession(token);
      const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
      if (user.emailVerifiedAt) return NextResponse.json({ success: true });
      const raw = await createEmailVerificationToken(user.id);
      enqueueBackgroundJob(
        "email.verification.resend",
        () => sendEmailVerificationLink(user.email, raw, publicAppOrigin(request)),
        { userId: user.id },
      );
      return NextResponse.json({ success: true });
    } catch {
      return safe("Unable to send a new verification code.", 500);
    }
  }
  if (action === "forgot-password") {
    const parsed = z.object({ email: z.string().email() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: true });
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (user) {
      const raw = randomBytes(32).toString("hex");
      await db.apiToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(raw),
          kind: "PASSWORD_RESET",
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      enqueueBackgroundJob(
        "email.password-reset",
        () =>
          sendAuthEmail(
            user.email,
            "Reset your Klick-Pro password",
            "Reset your password",
            `${publicAppOrigin(request)}/reset-password?token=${encodeURIComponent(raw)}`,
            "Reset password",
          ),
        { userId: user.id },
      );
    }
    return NextResponse.json({ success: true });
  }
  if (action === "forgot-password-phone") {
    const parsed = z.object({ phone: z.string().min(7).max(25) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: true });
    const phone = parsed.data.phone.trim();
    if (!rateLimit(`forgot-password-phone:${clientKey(request)}:${phone}`, 3, 10 * 60_000))
      return safe("Too many code requests. Please try again later.", 429);
    const user = await db.user.findFirst({ where: { phone, isActive: true } });
    if (user && (user.role === "CLIENT" || user.role === "PROFESSIONAL")) {
      const result = await requestPhoneOtp(phone, user.role);
      if (!result.ok) return safe(result.error, result.status);
    }
    return NextResponse.json({ success: true });
  }
  if (action === "verify-forgot-password-phone") {
    const parsed = z
      .object({ phone: z.string().min(7).max(25), code: z.string().min(1).max(20) })
      .safeParse(body);
    if (!parsed.success) return safe("Enter a valid phone number and code.");
    const phone = parsed.data.phone.trim();
    if (!rateLimit(`verify-forgot-password-phone:${clientKey(request)}:${phone}`, 5, 10 * 60_000))
      return safe("Too many verification attempts. Please try again later.", 429);
    const user = await db.user.findFirst({ where: { phone, isActive: true } });
    if (!user || (user.role !== "CLIENT" && user.role !== "PROFESSIONAL"))
      return safe("That verification code is invalid or has expired.");
    const result = await verifyPhoneOtp(phone, parsed.data.code, user.role);
    if (!result.ok) return safe(result.error, result.status);
    const raw = randomBytes(32).toString("hex");
    await db.apiToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(raw),
        kind: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return NextResponse.json({ success: true, token: raw });
  }
  if (action === "verify-email") {
    try {
      const parsed = z.object({ token: z.string().min(32) }).safeParse(body);
      if (!parsed.success) return safe("This verification link is invalid or has expired.");
      const verification = await db.apiToken.findFirst({
        where: {
          tokenHash: tokenHash(parsed.data.token),
          kind: "EMAIL_VERIFICATION",
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!verification) return safe("This verification link is invalid or has expired.");
      const [, user] = await db.$transaction([
        db.apiToken.update({ where: { id: verification.id }, data: { usedAt: new Date() } }),
        db.user.update({
          where: { id: verification.userId },
          data: { emailVerifiedAt: new Date() },
        }),
      ]);
      const response = NextResponse.json({
        success: true,
        redirect:
          user.role === "CLIENT"
            ? "/client-profile?profileSetup=1"
            : user.professionalCategory &&
                user.professionalLatitude !== null &&
                user.professionalLongitude !== null
              ? "/professional-home"
              : "/professional/setup?profileSetup=1",
      });
      response.cookies.set(
        sessionCookie,
        await createSession({ userId: user.id, role: user.role }),
        sessionOptions,
      );
      return response;
    } catch (error) {
      logServerError("auth.email_verification.failed", error);
      return safe("Unable to verify your email right now. Please request a new link.", 500);
    }
  }
  if (action === "reset-password") {
    const parsed = z
      .object({ token: z.string().min(32), password: passwordSchema })
      .safeParse(body);
    if (!parsed.success) {
      const tokenValid = z.string().min(32).safeParse(body?.token).success;
      return safe(
        tokenValid
          ? "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number."
          : "Invalid or expired link.",
      );
    }
    const token = await db.apiToken.findFirst({
      where: {
        tokenHash: tokenHash(parsed.data.token),
        kind: "PASSWORD_RESET",
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!token) return safe("Invalid or expired link.");
    await db.$transaction([
      db.apiToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      db.user.update({
        where: { id: token.userId },
        data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
      }),
      db.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return NextResponse.json({ success: true });
  }
  return safe("Not found", 404);
}
