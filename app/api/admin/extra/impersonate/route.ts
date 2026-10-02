import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ENABLE_ADMIN_EXTRA_SECTION } from "@/config/extra-features";

const IMPERSONATOR_COOKIE = "klick_admin_impersonator_token";

const impersonateSchema = z.object({
  userId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  if (!ENABLE_ADMIN_EXTRA_SECTION) {
    return NextResponse.json({ error: "Feature disabled" }, { status: 403 });
  }

  const currentToken = request.cookies.get(sessionCookie)?.value;
  if (!currentToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const adminSession = await verifySession(currentToken);
    if (adminSession.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can impersonate users" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsed = impersonateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid target user ID" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: {
        id: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
        emailVerifiedAt: true,
        isActive: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: "Cannot impersonate inactive or suspended user" },
        { status: 400 },
      );
    }

    // Create session for target user
    const targetToken = await createSession({
      userId: targetUser.id,
      role: targetUser.role,
      emailVerifiedAt: targetUser.emailVerifiedAt,
    });

    // Record audit log
    await db.auditLog.create({
      data: {
        actorId: adminSession.userId,
        action: "IMPERSONATE_USER",
        entityType: "User",
        entityId: String(targetUser.id),
        metadata: {
          impersonatedEmail: targetUser.email,
          impersonatedRole: targetUser.role,
          targetName: `${targetUser.firstName} ${targetUser.lastName}`,
        },
      },
    });

    const redirectUrl =
      targetUser.role === "PROFESSIONAL" ? "/professional/dashboard" : "/dashboard";

    const response = NextResponse.json({
      success: true,
      redirectUrl,
      targetUser: {
        id: targetUser.id,
        name: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
        role: targetUser.role,
      },
    });

    // Save admin original token for one-click return
    response.cookies.set(IMPERSONATOR_COOKIE, currentToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 4, // 4 hours
      sameSite: "lax",
    });

    // Switch active session to target user
    response.cookies.set(sessionCookie, targetToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Impersonation error:", error);
    return NextResponse.json({ error: "Failed to impersonate user" }, { status: 500 });
  }
}

// Exit impersonation and restore Admin session
export async function DELETE(request: NextRequest) {
  const originalAdminToken = request.cookies.get(IMPERSONATOR_COOKIE)?.value;
  if (!originalAdminToken) {
    return NextResponse.json({ error: "No active impersonation session found" }, { status: 400 });
  }

  try {
    const adminSession = await verifySession(originalAdminToken);
    if (adminSession.role !== "ADMIN") {
      return NextResponse.json({ error: "Invalid admin token" }, { status: 403 });
    }

    const response = NextResponse.json({
      success: true,
      redirectUrl: "/admin/users",
    });

    // Restore original admin token as active session
    response.cookies.set(sessionCookie, originalAdminToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
    });

    // Clear impersonation cookie
    response.cookies.delete(IMPERSONATOR_COOKIE);

    return response;
  } catch (error) {
    console.error("Failed to restore admin session:", error);
    return NextResponse.json({ error: "Failed to restore admin session" }, { status: 500 });
  }
}

// Check impersonation status
export async function GET(request: NextRequest) {
  const isImpersonating = Boolean(request.cookies.get(IMPERSONATOR_COOKIE)?.value);
  return NextResponse.json({ isImpersonating });
}
