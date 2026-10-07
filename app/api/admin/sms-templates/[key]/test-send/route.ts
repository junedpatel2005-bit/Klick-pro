import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionCookie, verifySession } from "@/lib/auth";
import { getSmsTemplateByKey, interpolateVariables } from "@/lib/sms/engine";
import { sendRawSms, normalizePhoneNumber } from "@/lib/sms/sender";

async function getAdminSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookie)?.value;
  if (!token) return null;
  try {
    const session = await verifySession(token);
    return session.role === "ADMIN" ? session : null;
  } catch {
    return null;
  }
}

const testSendSchema = z.object({
  phone: z.string().trim().min(7, "Please provide a valid phone number"),
  overrideBody: z.string().trim().optional(),
  overrideSenderId: z.string().trim().optional(),
  overrideDltTemplateId: z.string().trim().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: "Admin authorization required." }, { status: 403 });
  }

  const { key } = await params;
  const template = await getSmsTemplateByKey(key);
  if (!template) {
    return NextResponse.json({ error: "SMS template not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = testSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid test payload.", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { phone, overrideBody, overrideSenderId, overrideDltTemplateId } = parsed.data;

  // Use override body or template body with sample variables
  const rawText = overrideBody || template.bodyText;
  const messageText = interpolateVariables(rawText, template.sampleData);
  const senderId = overrideSenderId || template.senderId || "KLKPRO";
  const dltTemplateId = overrideDltTemplateId || template.dltTemplateId || undefined;

  const formattedPhone = normalizePhoneNumber(phone);
  if (!formattedPhone) {
    return NextResponse.json(
      {
        error:
          "Invalid phone number format. Please provide a valid 10-digit number or E.164 phone.",
      },
      { status: 400 },
    );
  }

  const result = await sendRawSms({
    to: formattedPhone,
    body: messageText,
    senderId,
    dltTemplateId,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error || "Failed to send test SMS.",
        details: result.details,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    provider: result.provider,
    deliveredTo: formattedPhone,
    message:
      result.provider === "simulated"
        ? `Simulated test SMS delivered to ${formattedPhone} (Logged in development server).`
        : `Live test SMS dispatched via Twilio to ${formattedPhone}.`,
  });
}
