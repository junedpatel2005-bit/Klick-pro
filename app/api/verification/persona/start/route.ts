import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verificationService } from "@/services/verification.service";

async function getAuthenticatedProfessional(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "PROFESSIONAL" ? session : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const current = await getAuthenticatedProfessional(request);
  if (!current) {
    return NextResponse.json({ error: "Professional sign-in is required." }, { status: 401 });
  }

  try {
    const result = await verificationService.startVerification(current.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("verification.persona.start.failed", {
      userId: current.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Unable to start document verification. Please try again later." },
      { status: 502 },
    );
  }
}
