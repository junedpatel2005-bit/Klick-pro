import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import type {
  BgvCheckSession,
  NormalizedWebhookPayload,
  SpringVerifyConfig,
  VerificationUser,
} from "../types";

const SPRINGVERIFY_API_URL = process.env.SPRINGVERIFY_API_URL ?? "https://api.springverify.com/v1";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_WEBHOOK_AGE_SECONDS = 300;

const SpringVerifyWebhookSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  timestamp: z.string().optional(),
  payload: z.object({
    candidate_id: z.string().min(1),
    status: z.string().min(1),
    report_url: z.string().url().optional(),
  }),
});

export class SpringVerifyAdapter {
  private config: SpringVerifyConfig;

  constructor(customConfig?: Partial<SpringVerifyConfig>) {
    this.config = {
      enabled: customConfig?.enabled ?? process.env.SPRINGVERIFY_ENABLED === "true",
      apiKey: customConfig?.apiKey ?? process.env.SPRINGVERIFY_API_KEY?.trim() ?? "",
      webhookSecret:
        customConfig?.webhookSecret ?? process.env.SPRINGVERIFY_WEBHOOK_SECRET?.trim() ?? "",
      isDevelopment: process.env.NODE_ENV !== "production",
    };
  }

  public getConfig(): SpringVerifyConfig {
    return { ...this.config };
  }

  public isConfigured(): boolean {
    return this.config.enabled && Boolean(this.config.apiKey);
  }

  public async initiateBgvCheck(user: VerificationUser): Promise<BgvCheckSession> {
    const checkId = `sv_chk_${user.id}_${crypto.randomUUID().slice(0, 8)}`;

    // Live mode if configured with non-test key
    if (this.isConfigured() && !this.config.apiKey.startsWith("test_")) {
      try {
        const response = await fetch(`${SPRINGVERIFY_API_URL}/candidates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            name: `${user.firstName} ${user.lastName}`.trim(),
            email: user.email,
            phone: user.phone,
            reference_id: `servio-pro-${user.id}`,
            packages: ["identity_check", "court_record_check", "criminal_check"],
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const data = (await response.json().catch(() => null)) as {
          id?: string;
          status?: string;
          portal_url?: string;
          error?: string;
        } | null;

        if (!response.ok || !data?.id) {
          console.error("springverify.create_candidate.failed", { status: response.status });
          throw new Error(
            data?.error ?? `SpringVerify candidate creation failed (${response.status}).`,
          );
        }

        return {
          checkId: data.id,
          status: data.status ?? "pending",
          candidatePortalUrl: data.portal_url ?? null,
          message: "Background verification check initiated with SpringVerify.",
        };
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          throw new Error("SpringVerify candidate creation request timed out.");
        }
        throw error;
      }
    }

    // Development / Sandbox simulation mode
    if (this.config.isDevelopment || this.config.enabled) {
      return {
        checkId,
        status: "pending",
        candidatePortalUrl: `/verification?springverify=simulated&checkId=${checkId}`,
        message: "SpringVerify background check initiated (Development / Sandbox Mode).",
      };
    }

    throw new Error("SpringVerify background verification is not enabled.");
  }

  public async getBgvCheckStatus(
    checkId: string,
  ): Promise<{ checkId: string; status: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(
        `${SPRINGVERIFY_API_URL}/candidates/${encodeURIComponent(checkId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        id?: string;
        status?: string;
      } | null;

      if (!response.ok || !data?.id || !data.status) {
        throw new Error(`SpringVerify check status retrieval failed (${response.status}).`);
      }

      return {
        checkId: data.id,
        status: data.status,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error("SpringVerify check status request timed out.");
      }
      throw error;
    }
  }

  public verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!this.config.webhookSecret || !signatureHeader) {
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
      const parsed = SpringVerifyWebhookSchema.safeParse(rawJson);
      if (!parsed.success) {
        return null;
      }

      const timestampRaw = parsed.data.timestamp;
      const createdAt = timestampRaw ? new Date(timestampRaw) : null;

      // Map SpringVerify check statuses (e.g. CLEAR -> approved, IN_PROGRESS -> pending, DISCREPANCY -> failed)
      let normalizedStatus = parsed.data.payload.status.toLowerCase();
      if (normalizedStatus === "clear") normalizedStatus = "approved";
      if (normalizedStatus === "in_progress") normalizedStatus = "pending";

      return {
        eventId: parsed.data.id,
        eventName: parsed.data.event,
        createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
        inquiryId: parsed.data.payload.candidate_id,
        status: normalizedStatus,
      };
    } catch {
      return null;
    }
  }
}

export const springVerifyAdapter = new SpringVerifyAdapter();
