import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  try {
    const session = await verifySession(token);
    if (session.role !== "CLIENT")
      return NextResponse.json({ error: "Client access required." }, { status: 403 });
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true, phone: true, emailVerifiedAt: true, phoneVerifiedAt: true },
    });
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }
}
