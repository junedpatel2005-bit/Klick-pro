import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, sessionCookie, sessionOptions } from "@/lib/auth";
import { clearRateLimit, rateLimit } from "@/lib/rate-limit";

const credentials = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

function clientKey(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function createBootstrapAdmin() {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!username || !email || !password || password.length < 12) return null;
  const validEmail = z.string().email().safeParse(email);
  if (!validEmail.success) return null;

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return existing.role === "ADMIN" ? existing : null;
  const emailOwner = await db.user.findUnique({ where: { email } });

  return db.user.create({
    data: {
      username,
      email: emailOwner ? `${username}@admin.local` : email,
      firstName: "Platform",
      lastName: "Administrator",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
      authProvider: "LOCAL",
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });
}

export async function POST(request: NextRequest) {
  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid admin username and password." },
      { status: 400 },
    );
  }

  const key = `admin-login:${clientKey(request)}:${parsed.data.username}`;
  if (!rateLimit(key, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many sign-in attempts. Please try again later." },
      { status: 429 },
    );
  }

  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  const user =
    adminCount === 0
      ? await createBootstrapAdmin()
      : await db.user.findFirst({ where: { username: parsed.data.username, role: "ADMIN" } });

  if (
    !user?.passwordHash ||
    !user.isActive ||
    !(await bcrypt.compare(parsed.data.password, user.passwordHash))
  ) {
    return NextResponse.json({ error: "Invalid administrator credentials." }, { status: 401 });
  }

  clearRateLimit(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    sessionCookie,
    await createSession({ userId: user.id, role: "ADMIN" }),
    sessionOptions,
  );
  return response;
}
