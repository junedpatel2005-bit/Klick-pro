import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { emitRealtimeNotification, emitAdminVerificationsUpdate } from "@/lib/realtime";

async function admin(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}
export async function GET(request: NextRequest) {
  try {
    if (!(await admin(request)))
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    const [verifications, personaVerifications] = await Promise.all([
      db.professionalVerification.findMany({
        where: { status: { in: ["PENDING", "REJECTED"] } },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              professionalCategory: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
      db.personaVerification.findMany({
        where: { adminStatus: "PENDING" },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              professionalCategory: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const reviews = await db.verificationDocumentReview.findMany({
      where: { userId: { in: verifications.map((item) => item.userId) } },
    });
    return NextResponse.json({
      verifications: verifications.map((item) => ({
        ...item,
        reviews: reviews.filter((review) => review.userId === item.userId),
      })),
      personaVerifications,
    });
  } catch (error) {
    console.error("admin.verifications.load.failed", error);
    return NextResponse.json(
      { error: "Unable to load verification records.", verifications: [] },
      { status: 500 },
    );
  }
}
export async function PATCH(request: NextRequest) {
  if (!(await admin(request)))
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const parsed = z
    .object({
      userId: z.number().int().positive(),
      status: z.enum(["APPROVED", "REJECTED"]),
      providerInquiryId: z.string().optional(),
      documentKey: z
        .enum(["governmentIdUrl", "licenseUrl", "certificationsJson", "insuranceUrl", "selfieUrl"])
        .optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid verification decision." }, { status: 400 });
  const currentAdmin = await admin(request);
  if (parsed.data.providerInquiryId) {
    const result = await db.personaVerification.update({
      where: { providerInquiryId: parsed.data.providerInquiryId },
      data: {
        adminStatus: parsed.data.status,
        reviewedBy: currentAdmin!.userId,
        reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ personaVerification: result });
  }
  if (parsed.data.documentKey) {
    const review = await db.verificationDocumentReview.upsert({
      where: {
        userId_documentKey: { userId: parsed.data.userId, documentKey: parsed.data.documentKey },
      },
      create: {
        userId: parsed.data.userId,
        documentKey: parsed.data.documentKey,
        status: parsed.data.status,
        reviewedAt: new Date(),
      },
      update: { status: parsed.data.status, reviewedAt: new Date() },
    });
    return NextResponse.json({ review });
  }
  await db.$transaction([
    db.professionalVerification.update({
      where: { userId: parsed.data.userId },
      data: { status: parsed.data.status },
    }),
    db.user.update({
      where: { id: parsed.data.userId },
      data: { isVerified: parsed.data.status === "APPROVED" },
    }),
  ]);
  emitRealtimeNotification([parsed.data.userId], {
    title:
      parsed.data.status === "APPROVED" ? "Verification Approved" : "Verification Status Updated",
    description:
      parsed.data.status === "APPROVED"
        ? "Congratulations, your professional account is now verified!"
        : "Your verification request has been reviewed.",
    href: "/professional/profile",
    type: "VERIFICATION_UPDATE",
  });
  emitAdminVerificationsUpdate({ userId: parsed.data.userId, status: parsed.data.status });
  return NextResponse.json({ ok: true });
}
