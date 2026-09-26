import "server-only";
import crypto from "node:crypto";
import { personaAdapter } from "@/lib/verification/adapters/persona.adapter";
import { verificationService } from "@/services/verification.service";
import type { VerificationUser } from "@/lib/verification/types";

export type PersonaUser = VerificationUser;

export function personaConfig() {
  return personaAdapter.getConfig();
}

export function isPersonaConfigured(): boolean {
  return personaAdapter.isConfigured();
}

export async function createPersonaInquiry(user: PersonaUser) {
  return personaAdapter.createInquiry(user, `servio-persona-${user.id}-${crypto.randomUUID()}`);
}

export async function getPersonaInquiry(inquiryId: string) {
  return personaAdapter.getInquiry(inquiryId);
}

export async function handlePersonaWebhook(rawBody: string, signature: string | null) {
  return verificationService.processWebhook(rawBody, signature);
}
