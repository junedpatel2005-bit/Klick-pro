import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionCookie, verifySession } from "@/lib/auth";
import { isPersonaConfigured } from "@/lib/persona";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "Sign-in is required." }, { status: 401 });
  try {
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL")
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 403 });
    const latest = await db.personaVerification.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { providerStatus: true, providerInquiryId: true },
    });
    return NextResponse.json({
      enabled: isPersonaConfigured(),
      providerStatus: latest?.providerStatus,
      inquiryId: latest?.providerInquiryId,
    });
  } catch {
    return NextResponse.json({ error: "Sign-in is required." }, { status: 401 });
  }
}
