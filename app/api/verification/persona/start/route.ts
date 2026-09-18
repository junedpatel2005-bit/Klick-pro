import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { createPersonaInquiry, isPersonaConfigured } from "@/lib/persona";

async function session(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    return await verifySession(token);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const current = await session(request);
  if (!current || current.role !== "PROFESSIONAL")
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
  if (!isPersonaConfigured())
    return NextResponse.json({
      enabled: false,
      message: "Document verification is not currently configured.",
    });
  try {
    const user = await db.user.findUnique({
      where: { id: current.userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!user) return NextResponse.json({ error: "User account not found." }, { status: 404 });
    const inquiry = await createPersonaInquiry(user);
    if (!inquiry)
      return NextResponse.json({
        enabled: false,
        message: "Document verification is not currently configured.",
      });
    await db.personaVerification.create({
      data: {
        userId: user.id,
        providerInquiryId: inquiry.inquiryId,
        providerStatus: inquiry.status,
      },
    });
    return NextResponse.json({
      enabled: true,
      inquiryId: inquiry.inquiryId,
      status: inquiry.status,
      hostedUrl: inquiry.hostedUrl,
    });
  } catch (error) {
    console.error("verification.persona.start.failed", error);
    return NextResponse.json({ error: "Unable to start document verification." }, { status: 502 });
  }
}
