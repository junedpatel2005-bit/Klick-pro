import { NextResponse } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader.match(new RegExp(`${sessionCookie}=([^;]+)`));
  const token = bearerToken || tokenMatch?.[1];
  if (!token) {
    return NextResponse.json({ user: null });
  }

  try {
    // verifySession returns the joined user row, so the profile fields below
    // need no second query. It throws for revoked sessions and inactive users.
    const session = await verifySession(token);
    return NextResponse.json({
      user: {
        id: String(session.userId),
        role: session.role,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        emailVerifiedAt: session.emailVerifiedAt,
        avatarUrl: session.avatarUrl,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
