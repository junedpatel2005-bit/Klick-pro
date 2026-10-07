import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verificationService } from "@/services/verification.service";

const AadhaarInputSchema = z.object({
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^[\d\s-]{12,16}$/, "Invalid Aadhaar format. Must be a 12-digit number."),
});

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

  const rawJson = (await request.json().catch(() => null)) as unknown;
  const parsed = AadhaarInputSchema.safeParse(rawJson);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid Aadhaar number format.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  try {
    const result = await verificationService.verifyIndianAadhaar(
      current.userId,
      parsed.data.aadhaarNumber,
    );
    return NextResponse.json({
      success: true,
      inquiryId: result.inquiryId,
      status: result.status,
      maskedAadhaar: result.maskedAadhaar,
      registeredName: result.registeredName,
      message: result.message,
    });
  } catch (error) {
    console.error("verification.aadhaar.failed", {
      userId: current.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Aadhaar verification failed." },
      { status: 500 },
    );
  }
}
