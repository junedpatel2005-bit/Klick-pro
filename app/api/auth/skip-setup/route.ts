import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let session;
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Update lastLoginAt so the user is marked as having logged in
  await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: user.lastLoginAt ?? new Date(),
    },
  });

  // If client, ensure a baseline ClientProfile exists so hasClientProfile is true
  if (user.role === "CLIENT") {
    const existing = await db.clientProfile.findFirst({ where: { userId: user.id } });
    if (!existing) {
      await db.clientProfile.create({
        data: {
          userId: user.id,
          fullName: `${user.firstName} ${user.lastName}`.trim() || "Client",
          email: user.email,
          phone: user.phone || "",
          address: user.address || "",
        },
      });
    }
  }

  const destination =
    user.role === "CLIENT"
      ? "/dashboard"
      : user.role === "PROFESSIONAL"
        ? "/professional-home"
        : "/admin";

  const response = NextResponse.json({
    success: true,
    redirect: destination,
  });

  // Set persistent cookie for 1 year
  response.cookies.set("klick_skip_setup", "1", {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
