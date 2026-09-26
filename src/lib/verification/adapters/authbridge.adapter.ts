import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import type {
  AadhaarVerificationResult,
  AuthBridgeConfig,
  NormalizedWebhookPayload,
  PanVerificationResult,
  VerificationUser,
} from "../types";

const AUTHBRIDGE_API_URL = process.env.AUTHBRIDGE_API_URL ?? "https://api.authbridge.com/v1";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_WEBHOOK_AGE_SECONDS = 300;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const AuthBridgeWebhookSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  createdAt: z.string().optional(),
  data: z.object({
    inquiryId: z.string().min(1),
    status: z.string().min(1),
  }),
});

export class AuthBridgeAdapter {
  private config: AuthBridgeConfig;

  constructor(customConfig?: Partial<AuthBridgeConfig>) {
    this.config = {
      enabled: customConfig?.enabled ?? process.env.AUTHBRIDGE_ENABLED === "true",
      apiKey: customConfig?.apiKey ?? (process.env.AUTHBRIDGE_API_KEY?.trim() ?? ""),
      clientId: customConfig?.clientId ?? (process.env.AUTHBRIDGE_CLIENT_ID?.trim() ?? ""),
      webhookSecret:
        customConfig?.webhookSecret ?? (process.env.AUTHBRIDGE_WEBHOOK_SECRET?.trim() ?? ""),
      isDevelopment: process.env.NODE_ENV !== "production",
    };
  }

  public getConfig(): AuthBridgeConfig {
    return { ...this.config };
  }

  public isConfigured(): boolean {
    return this.config.enabled && Boolean(this.config.apiKey);
  }

  public maskPan(pan: string): string {
    const clean = pan.trim().toUpperCase();
    if (clean.length !== 10) return "INVALID_PAN";
    return `${clean.slice(0, 5)}****${clean.slice(9)}`;
  }

  public maskAadhaar(aadhaar: string): string {
    const clean = aadhaar.replace(/[\s-]+/g, "").trim();
    if (clean.length !== 12) return "INVALID_AADHAAR";
    return `XXXX-XXXX-${clean.slice(8)}`;
  }

  public async verifyPan(
    user: VerificationUser,
    rawPanNumber: string,
  ): Promise<PanVerificationResult> {
    const pan = rawPanNumber.trim().toUpperCase();

    if (!PAN_REGEX.test(pan)) {
      throw new Error("Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).");
    }

    const maskedPan = this.maskPan(pan);

    // Live mode if configured with non-test key
    if (this.isConfigured() && !this.config.apiKey.startsWith("test_")) {
      try {
        const response = await fetch(`${AUTHBRIDGE_API_URL}/kyc/pan/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "X-Client-Id": this.config.clientId,
          },
          body: JSON.stringify({
            panNumber: pan,
            name: `${user.firstName} ${user.lastName}`.trim(),
            referenceId: `pro-${user.id}`,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const data = (await response.json().catch(() => null)) as {
          status?: string;
          inquiryId?: string;
          registeredName?: string;
          matchScore?: number;
          error?: string;
        } | null;

        if (!response.ok || !data?.inquiryId) {
          console.error("authbridge.pan_verify.failed", { status: response.status });
          throw new Error(data?.error ?? `PAN verification failed (${response.status}).`);
        }

        const isApproved = data.status === "VALID" || data.status === "approved";

        return {
          inquiryId: data.inquiryId,
          status: isApproved ? "approved" : "failed",
          maskedPan,
          registeredName: data.registeredName,
          nameMatchScore: data.matchScore ?? (isApproved ? 100 : 0),
          message: isApproved ? "PAN verified successfully via NSDL." : "PAN details do not match.",
        };
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error("AuthBridge PAN verification request timed out.");
        }
        throw error;
      }
    }

    // Development / Sandbox simulation mode
    if (this.config.isDevelopment || this.config.enabled) {
      const simulatedInquiryId = `ab_pan_${user.id}_${crypto.randomUUID().slice(0, 8)}`;
      const registeredName = `${user.firstName.toUpperCase()} ${user.lastName.toUpperCase()}`;

      return {
        inquiryId: simulatedInquiryId,
        status: "approved",
        maskedPan,
        registeredName,
        nameMatchScore: 98,
        message: "PAN successfully verified (Sandbox / Development Mode).",
      };
    }

    throw new Error("AuthBridge Indian identity verification is not enabled.");
  }

  public async verifyAadhaar(
    user: VerificationUser,
    rawAadhaarNumber: string,
  ): Promise<AadhaarVerificationResult> {
    const clean = rawAadhaarNumber.replace(/[\s-]+/g, "").trim();

    if (!/^\d{12}$/.test(clean)) {
      throw new Error("Invalid Aadhaar number. Must be a 12-digit number.");
    }

    // Mask Aadhaar: XXXX-XXXX-1234 (never store raw 12 digits per UIDAI/DPDP compliance)
    const maskedAadhaar = this.maskAadhaar(clean);

    if (this.isConfigured() && !this.config.apiKey.startsWith("test_")) {
      try {
        const response = await fetch(`${AUTHBRIDGE_API_URL}/kyc/aadhaar/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "X-Client-Id": this.config.clientId,
          },
          body: JSON.stringify({
            aadhaarNumber: clean,
            referenceId: `pro-adh-${user.id}`,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const data = (await response.json().catch(() => null)) as {
          status?: string;
          inquiryId?: string;
          error?: string;
        } | null;

        if (!response.ok || !data?.inquiryId) {
          throw new Error(data?.error ?? `Aadhaar verification failed (${response.status}).`);
        }

        const isApproved = data.status === "VALID" || data.status === "approved";

        return {
          inquiryId: data.inquiryId,
          status: isApproved ? "approved" : "failed",
          maskedAadhaar,
          registeredName: `${user.firstName} ${user.lastName}`.trim(),
          message: isApproved ? "Aadhaar verified successfully." : "Aadhaar validation failed.",
        };
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error("AuthBridge Aadhaar verification request timed out.");
        }
        throw error;
      }
    }

    // Development / Sandbox simulation mode
    if (this.config.isDevelopment || this.config.enabled) {
      const simulatedInquiryId = `ab_adh_${user.id}_${crypto.randomUUID().slice(0, 8)}`;
      return {
        inquiryId: simulatedInquiryId,
        status: "approved",
        maskedAadhaar,
        registeredName: `${user.firstName.toUpperCase()} ${user.lastName.toUpperCase()}`,
        message: "Aadhaar successfully verified (Sandbox / Development Mode).",
      };
    }

    throw new Error("AuthBridge Indian identity verification is not enabled.");
  }

  public async initiateAadhaarDigiLocker(
    user: VerificationUser,
    returnUrl: string,
  ): Promise<{ inquiryId: string; status: string; redirectionUrl: string }> {
    const inquiryId = `ab_digi_${user.id}_${crypto.randomUUID().slice(0, 8)}`;

    if (this.isConfigured() && !this.config.apiKey.startsWith("test_")) {
      try {
        const response = await fetch(`${AUTHBRIDGE_API_URL}/kyc/digilocker/initiate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "X-Client-Id": this.config.clientId,
          },
          body: JSON.stringify({
            userId: user.id,
            redirectUrl: returnUrl,
            referenceId: inquiryId,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const data = (await response.json().catch(() => null)) as {
          inquiryId?: string;
          redirectionUrl?: string;
        } | null;

        if (!response.ok || !data?.redirectionUrl) {
          throw new Error(`Failed to initiate DigiLocker session (${response.status}).`);
        }

        return {
          inquiryId: data.inquiryId ?? inquiryId,
          status: "pending",
          redirectionUrl: data.redirectionUrl,
        };
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error("AuthBridge DigiLocker session creation timed out.");
        }
        throw error;
      }
    }

    // Development simulation
    return {
      inquiryId,
      status: "pending",
      redirectionUrl: `/verification?authbridge=simulated&inquiryId=${inquiryId}`,
    };
  }

  public verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!this.config.webhookSecret || !signatureHeader) {
      // In dev mode without configured secret, reject unsigned
      return false;
    }

    const timestampMatch = signatureHeader.match(/(?:^|[ ,])t=([^, ]+)/);
    const timestampStr = timestampMatch?.[1];
    if (!timestampStr) return false;

    const timestampNum = Number(timestampStr);
    if (!Number.isFinite(timestampNum)) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampNum) > MAX_WEBHOOK_AGE_SECONDS) {
      return false;
    }

    const expectedHex = crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(`${timestampStr}.${rawBody}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHex, "utf8");

    const signatureMatches = [...signatureHeader.matchAll(/v1=([0-9a-f]+)/g)];
    const signatures = signatureMatches
      .map((match) => match[1])
      .filter((sig): sig is string => Boolean(sig));

    if (signatures.length === 0) return false;

    return signatures.some((sig) => {
      const candidateBuffer = Buffer.from(sig, "utf8");
      if (candidateBuffer.length !== expectedBuffer.length) return false;
      return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
    });
  }

  public parseWebhookPayload(rawBody: string): NormalizedWebhookPayload | null {
    try {
      const rawJson = JSON.parse(rawBody) as unknown;
      const parsed = AuthBridgeWebhookSchema.safeParse(rawJson);
      if (!parsed.success) {
        return null;
      }

      const createdAt = parsed.data.createdAt ? new Date(parsed.data.createdAt) : null;

      return {
        eventId: parsed.data.eventId,
        eventName: parsed.data.eventType,
        createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
        inquiryId: parsed.data.data.inquiryId,
        status: parsed.data.data.status.toLowerCase(),
      };
    } catch {
      return null;
    }
  }
}

export const authBridgeAdapter = new AuthBridgeAdapter();
