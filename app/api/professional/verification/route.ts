import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { emitAdminNotification, emitAdminVerificationsUpdate } from "@/lib/realtime";

const input = z.object({
  governmentIdUrl: z.string().max(500).nullable().optional(),
  licenseUrl: z.string().max(500).nullable().optional(),
  certificationsJson: z.string().max(10000).nullable().optional(),
  insuranceUrl: z.string().max(500).nullable().optional(),
  selfieUrl: z.string().max(500).nullable().optional(),
});

async function professionalId(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "PROFESSIONAL" ? session.userId : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const userId = await professionalId(request);
  if (!userId)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
  const [verification, reviews] = await Promise.all([
    db.professionalVerification.findUnique({ where: { userId } }),
    db.verificationDocumentReview.findMany({ where: { userId } }),
  ]);
  return NextResponse.json({ verification, reviews });
}

export async function PUT(request: NextRequest) {
  const userId = await professionalId(request);
  if (!userId)
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid verification details." }, { status: 400 });
  const hasDocument = Boolean(
    parsed.data.governmentIdUrl ||
    parsed.data.licenseUrl ||
    parsed.data.certificationsJson ||
    parsed.data.insuranceUrl ||
    parsed.data.selfieUrl,
  );
  const verification = await db.professionalVerification.upsert({
    where: { userId },
    update: { ...parsed.data, status: hasDocument ? "PENDING" : "PENDING" },
    create: { userId, ...parsed.data, status: "PENDING" },
  });
  if (hasDocument) {
    emitAdminNotification({
      title: "New Verification Submitted",
      description: "A professional has uploaded documents for verification review.",
      href: "/admin/verifications",
      type: "VERIFICATION_SUBMITTED",
    });
    emitAdminVerificationsUpdate({ userId });
  }
  return NextResponse.json({ verification });
}
