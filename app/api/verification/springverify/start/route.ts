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
    const result = await verificationService.initiateSpringVerifyBgv(current.userId);
    return NextResponse.json({
      success: true,
      checkId: result.checkId,
      status: result.status,
      candidatePortalUrl: result.candidatePortalUrl,
      message: result.message,
    });
  } catch (error) {
    console.error("verification.springverify.start.failed", {
      userId: current.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initiate background check." },
      { status: 500 },
    );
  }
}

