import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { verificationService } from "@/services/verification.service";

const PanInputSchema = z.object({
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      "Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).",
    ),
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
  const parsed = PanInputSchema.safeParse(rawJson);

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid PAN number format.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  try {
    const result = await verificationService.verifyIndianPan(current.userId, parsed.data.panNumber);
    return NextResponse.json({
      success: true,
      inquiryId: result.inquiryId,
      status: result.status,
      maskedPan: result.maskedPan,
      registeredName: result.registeredName,
      message: result.message,
    });
  } catch (error) {
    console.error("verification.pan.failed", {
      userId: current.userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PAN verification failed." },
      { status: 500 },
    );
  }
}
