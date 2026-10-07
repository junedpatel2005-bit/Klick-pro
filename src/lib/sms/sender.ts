import "server-only";
import twilio from "twilio";
import { SmsSendResult } from "./types";

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (accountSid && authToken && accountSid.startsWith("AC")) {
    return twilio(accountSid, authToken);
  }
  return null;
}

/**
 * Normalizes phone numbers to standard E.164 format.
 * If 10 digits are provided without international prefix, assumes +91 (India).
 */
export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, "").trim();
  if (!cleaned) return "";

  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // 10 digits Indian mobile number (e.g. 9876543210)
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // 12 digits starting with 91
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }

  return `+${cleaned}`;
}

export interface SendRawSmsParams {
  to: string;
  body: string;
  senderId?: string;
  dltTemplateId?: string;
}

/**
 * Sends a single SMS message via Twilio or development fallback.
 */
export async function sendRawSms({
  to,
  body,
  senderId,
  dltTemplateId,
}: SendRawSmsParams): Promise<SmsSendResult> {
  const formattedPhone = normalizePhoneNumber(to);
  if (!formattedPhone || formattedPhone.length < 8) {
    return { ok: false, error: "Invalid recipient phone number." };
  }

  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  // If Twilio Messages API is properly configured
  if (client && (fromNumber || messagingServiceSid)) {
    try {
      const messageParams: {
        to: string;
        body: string;
        from?: string;
        messagingServiceSid?: string;
      } = {
        to: formattedPhone,
        body,
      };

      if (messagingServiceSid) {
        messageParams.messagingServiceSid = messagingServiceSid;
      } else if (fromNumber) {
        messageParams.from = fromNumber;
      }

      const res = await client.messages.create(messageParams);

      return {
        ok: true,
        messageId: res.sid,
        provider: "twilio",
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[SMS:Twilio Error] Failed to send SMS to ${formattedPhone}: ${errMsg}`);

      // If development or preview environment, fallback gracefully to simulated success
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[SMS:DEV FALLBACK] Destination: ${formattedPhone} | Header: ${senderId || "KLKPRO"} | DLT: ${dltTemplateId || "N/A"}\nBody: ${body}`,
        );
        return {
          ok: true,
          messageId: `sim_dev_${Date.now()}`,
          provider: "simulated",
          details: { twilioError: errMsg },
        };
      }

      return {
        ok: false,
        error: errMsg,
        provider: "twilio",
      };
    }
  }

  // Simulated provider (Development mode / Test mode / Unconfigured Twilio Phone)
  console.log(
    `[SMS:SIMULATED] To: ${formattedPhone} | SenderId: ${senderId || "KLKPRO"} | DLT: ${dltTemplateId || "N/A"}\nContent: "${body}"`,
  );

  return {
    ok: true,
    messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    provider: "simulated",
  };
}
