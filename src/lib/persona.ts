import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";

const apiUrl = "https://api.withpersona.com/api/v1";
const config = {
  enabled: process.env.PERSONA_ENABLED === "true",
  apiKey: process.env.PERSONA_API_KEY?.trim() ?? "",
  templateId: process.env.PERSONA_TEMPLATE_ID?.trim() ?? "",
  webhookSecret: process.env.PERSONA_WEBHOOK_SECRET?.trim() ?? "",
};

export type PersonaUser = { id: number; firstName: string; lastName: string };
type PersonaInquiryResponse = {
  data?: { id?: string; attributes?: { status?: string } };
  meta?: { "one-time-link"?: string };
};

export function personaConfig() {
  return { ...config };
}

export function isPersonaConfigured() {
  return config.enabled && Boolean(config.apiKey && config.templateId);
}

export async function createPersonaInquiry(user: PersonaUser) {
  if (!isPersonaConfigured()) return null;
  const response = await fetch(`${apiUrl}/inquiries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": `servio-persona-${user.id}-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          "inquiry-template-id": config.templateId,
          "reference-id": String(user.id),
          fields: { "name-first": user.firstName, "name-last": user.lastName },
        },
      },
    }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as PersonaInquiryResponse | null;
  if (!response.ok || !body?.data?.id || !body.data.attributes?.status) {
    throw new Error(`Persona inquiry creation failed (${response.status}).`);
  }
  return {
    inquiryId: body.data.id,
    status: body.data.attributes.status,
    hostedUrl: body.meta?.["one-time-link"] ?? null,
  };
}

export async function getPersonaInquiry(inquiryId: string) {
  if (!isPersonaConfigured()) return null;
  const response = await fetch(`${apiUrl}/inquiries/${encodeURIComponent(inquiryId)}`, {
    headers: { Authorization: `Bearer ${config.apiKey}`, Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as PersonaInquiryResponse | null;
  if (!response.ok || !body?.data?.id || !body.data.attributes?.status) {
    throw new Error(`Persona inquiry retrieval failed (${response.status}).`);
  }
  return { inquiryId: body.data.id, status: body.data.attributes.status };
}

function validSignature(rawBody: string, header: string, secret: string) {
  const timestamp = header.match(/(?:^|[ ,])t=([^, ]+)/)?.[1];
  if (!timestamp || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  const signatures = [...header.matchAll(/v1=([0-9a-f]+)/g)]
    .map((match) => match[1])
    .filter((signature): signature is string => Boolean(signature));
  return signatures.some((signature) => {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export async function handlePersonaWebhook(rawBody: string, signature: string | null) {
  if (
    !config.enabled ||
    !config.webhookSecret ||
    !signature ||
    !validSignature(rawBody, signature, config.webhookSecret)
  ) {
    return { ok: false as const, status: 401 };
  }
  const payload = JSON.parse(rawBody) as {
    data?: {
      id?: string;
      attributes?: {
        name?: string;
        "created-at"?: string;
        payload?: { data?: { id?: string; attributes?: { status?: string } } };
      };
    };
  };
  const eventId = payload.data?.id;
  const event = payload.data?.attributes;
  const inquiry = event?.payload?.data;
  if (!eventId || !event?.name || !inquiry?.id || !inquiry.attributes?.status)
    return { ok: false as const, status: 400 };
  try {
    await db.personaWebhookEvent.create({
      data: { providerEventId: eventId, eventName: event.name },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      return { ok: true as const, duplicate: true };
    throw error;
  }
  const existing = await db.personaVerification.findUnique({
    where: { providerInquiryId: inquiry.id },
  });
  if (!existing) return { ok: true as const, ignored: true };
  const eventCreatedAt = event["created-at"] ? new Date(event["created-at"]) : null;
  if (
    eventCreatedAt &&
    existing.lastProviderEventAt &&
    eventCreatedAt <= existing.lastProviderEventAt
  )
    return { ok: true as const, stale: true };
  await db.personaVerification.update({
    where: { id: existing.id },
    data: {
      providerStatus: inquiry.attributes.status,
      lastProviderEventAt: eventCreatedAt ?? existing.lastProviderEventAt,
      submittedAt:
        inquiry.attributes.status === "pending" && !existing.submittedAt
          ? eventCreatedAt
          : existing.submittedAt,
    },
  });
  return { ok: true as const };
}
