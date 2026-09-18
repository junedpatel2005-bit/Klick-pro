import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const session = await verifySession(token);
    if (session.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const seenVerifications = request.cookies.get("servio_admin_seen_verifications")?.value;
    const seenOperations = request.cookies.get("servio_admin_seen_operations")?.value;
    const verificationsDate = seenVerifications ? new Date(seenVerifications) : null;
    const operationsDate = seenOperations ? new Date(seenOperations) : null;

    const [newUsers, verification, jobs, notifications, messages] = await Promise.all([
      db.userNotification.count({
        where: { userId: session.userId, type: "NEW_ACCOUNT", readAt: null },
      }),
      db.professionalVerification.count({
        where: {
          status: "PENDING",
          ...(verificationsDate ? { updatedAt: { gt: verificationsDate } } : {}),
        },
      }),
      db.projectDispute.count({
        where: {
          status: "OPEN",
          ...(operationsDate ? { updatedAt: { gt: operationsDate } } : {}),
        },
      }),
      db.userNotification.count({ where: { userId: session.userId, readAt: null } }),
      db.socketMessage.count({ where: { receiverId: session.userId, readAt: null } }),
    ]);
    return NextResponse.json({ newUsers, verification, jobs, notifications, messages });
  } catch {
    return NextResponse.json({ error: "Unable to load sidebar counts." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const session = await verifySession(token);
    if (session.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { section?: string } | null;
    const response = NextResponse.json({ success: true });
    const nowIso = new Date().toISOString();

    if (body?.section === "users") {
      await db.userNotification.updateMany({
        where: { userId: session.userId, type: "NEW_ACCOUNT", readAt: null },
        data: { readAt: new Date() },
      });
    }
    if (body?.section === "verifications" || body?.section === "verification") {
      await db.userNotification.updateMany({
        where: {
          userId: session.userId,
          type: { in: ["VERIFICATION_SUBMITTED", "NEW_VERIFICATION"] },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      response.cookies.set("servio_admin_seen_verifications", nowIso, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    if (body?.section === "operations" || body?.section === "jobs") {
      await db.userNotification.updateMany({
        where: {
          userId: session.userId,
          type: { in: ["NEW_JOB", "DISPUTE_RAISED", "DISPUTE_UPDATED"] },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      response.cookies.set("servio_admin_seen_operations", nowIso, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    if (body?.section === "messages") {
      await db.socketMessage.updateMany({
        where: { receiverId: session.userId, readAt: null },
        data: { readAt: new Date() },
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to update sidebar counts." }, { status: 500 });
  }
}
