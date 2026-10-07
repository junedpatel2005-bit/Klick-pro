import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verificationService } from "@/services/verification.service";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) {
    return NextResponse.json({ error: "Sign-in is required." }, { status: 401 });
  }

  try {
    const session = await verifySession(token);
    if (session.role !== "PROFESSIONAL") {
      return NextResponse.json({ error: "Professional sign-in is required." }, { status: 403 });
    }

    const status = await verificationService.getVerificationStatus(session.userId);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "Sign-in is required." }, { status: 401 });
  }
}
