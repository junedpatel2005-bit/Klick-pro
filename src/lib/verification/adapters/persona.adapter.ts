import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import type {
  NormalizedWebhookPayload,
  PersonaConfig,
  VerificationInquirySession,
  VerificationUser,
} from "../types";

const PERSONA_API_URL = "https://api.withpersona.com/api/v1";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_WEBHOOK_AGE_SECONDS = 300;

const PersonaInquiryResponseSchema = z.object({
  data: z
    .object({
      id: z.string().min(1),
      attributes: z
        .object({
          status: z.string().min(1),
        })
        .passthrough(),
    })
    .optional(),
  meta: z
    .object({
      "one-time-link": z.string().url().optional(),
    })
    .optional(),
});

const PersonaWebhookEnvelopeSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    attributes: z.object({
      name: z.string().min(1),
      "created-at": z.string().optional(),
      payload: z.object({
        data: z.object({
          id: z.string().min(1),
          attributes: z.object({
            status: z.string().min(1),
          }),
        }),
      }),
    }),
  }),
});

export class PersonaAdapter {
  private config: PersonaConfig;

  constructor(customConfig?: Partial<PersonaConfig>) {
    this.config = {
      enabled: customConfig?.enabled ?? process.env.PERSONA_ENABLED === "true",
      apiKey: customConfig?.apiKey ?? process.env.PERSONA_API_KEY?.trim() ?? "",
      templateId: customConfig?.templateId ?? process.env.PERSONA_TEMPLATE_ID?.trim() ?? "",
      webhookSecret:
        customConfig?.webhookSecret ?? process.env.PERSONA_WEBHOOK_SECRET?.trim() ?? "",
    };
  }

  public getConfig(): PersonaConfig {
    return { ...this.config };
  }

  public isConfigured(): boolean {
    return this.config.enabled && Boolean(this.config.apiKey && this.config.templateId);
  }

  public async createInquiry(
    user: VerificationUser,
    idempotencyKey: string,
  ): Promise<VerificationInquirySession | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(`${PERSONA_API_URL}/inquiries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              "inquiry-template-id": this.config.templateId,
              "reference-id": String(user.id),
              fields: {
                "name-first": user.firstName,
                "name-last": user.lastName,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      const rawJson = (await response.json().catch(() => null)) as unknown;
      const parsed = PersonaInquiryResponseSchema.safeParse(rawJson);

      if (!response.ok || !parsed.success || !parsed.data.data) {
        console.error("persona.adapter.create_inquiry.failed", {
          status: response.status,
          hasData: Boolean(parsed.success && parsed.data.data),
        });
        throw new Error(`Persona inquiry creation failed (${response.status}).`);
      }

      return {
        inquiryId: parsed.data.data.id,
        status: parsed.data.data.attributes.status,
        hostedUrl: parsed.data.meta?.["one-time-link"] ?? null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        console.error("persona.adapter.create_inquiry.timeout");
        throw new Error("Persona inquiry creation timed out.");
      }
      throw error;
    }
  }

  public async getInquiry(
    inquiryId: string,
  ): Promise<{ inquiryId: string; status: string } | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await fetch(
        `${PERSONA_API_URL}/inquiries/${encodeURIComponent(inquiryId)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          cache: "no-store",
        },
      );

      const rawJson = (await response.json().catch(() => null)) as unknown;
      const parsed = PersonaInquiryResponseSchema.safeParse(rawJson);

      if (!response.ok || !parsed.success || !parsed.data.data) {
        console.error("persona.adapter.get_inquiry.failed", {
          status: response.status,
        });
        throw new Error(`Persona inquiry retrieval failed (${response.status}).`);
      }

      return {
        inquiryId: parsed.data.data.id,
        status: parsed.data.data.attributes.status,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        console.error("persona.adapter.get_inquiry.timeout");
        throw new Error("Persona inquiry retrieval timed out.");
      }
      throw error;
    }
  }

  public verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!this.config.enabled || !this.config.webhookSecret || !signatureHeader) {
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
      const parsed = PersonaWebhookEnvelopeSchema.safeParse(rawJson);
      if (!parsed.success) {
        console.warn("persona.adapter.parse_webhook.invalid_schema", parsed.error.issues);
        return null;
      }

      const event = parsed.data.data;
      const inquiry = event.attributes.payload.data;
      const createdAtRaw = event.attributes["created-at"];
      const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;

      return {
        eventId: event.id,
        eventName: event.attributes.name,
        createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
        inquiryId: inquiry.id,
        status: inquiry.attributes.status,
      };
    } catch {
      return null;
    }
  }
}

export const personaAdapter = new PersonaAdapter();
