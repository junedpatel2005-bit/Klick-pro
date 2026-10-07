export type VerificationUser = {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
};

export type VerificationInquirySession = {
  inquiryId: string;
  status: string;
  hostedUrl: string | null;
};

export type VerificationStatusResponse = {
  enabled: boolean;
  providerStatus?: string;
  inquiryId?: string;
  adminStatus?: string;
  message?: string;
  provider?: string;
};

export type NormalizedWebhookPayload = {
  eventId: string;
  eventName: string;
  createdAt: Date | null;
  inquiryId: string;
  status: string;
};

export type WebhookProcessResult =
  | { ok: true; status: 200; duplicate?: boolean; stale?: boolean; ignored?: boolean }
  | { ok: false; status: 400 | 401 | 500; error: string };

export type PersonaConfig = {
  enabled: boolean;
  apiKey: string;
  templateId: string;
  webhookSecret: string;
};

export type AuthBridgeConfig = {
  enabled: boolean;
  apiKey: string;
  clientId: string;
  webhookSecret: string;
  isDevelopment: boolean;
};

export type SpringVerifyConfig = {
  enabled: boolean;
  apiKey: string;
  webhookSecret: string;
  isDevelopment: boolean;
};

export type PanVerificationResult = {
  inquiryId: string;
  status: "approved" | "failed";
  maskedPan: string;
  registeredName?: string;
  nameMatchScore?: number;
  message?: string;
};

export type AadhaarVerificationResult = {
  inquiryId: string;
  status: "approved" | "failed";
  maskedAadhaar: string;
  registeredName?: string;
  message?: string;
};

export type BgvCheckSession = {
  checkId: string;
  status: string;
  candidatePortalUrl: string | null;
  message?: string;
};
