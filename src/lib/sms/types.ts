export type SmsAudience = "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM";

export type SmsCategory =
  | "Account & Auth"
  | "Jobs & Proposals"
  | "Projects & Milestones"
  | "Disputes & Support"
  | "Financial & Payments"
  | "General";

export interface SmsTemplateVariable {
  key: string;
  label: string;
  description: string;
  sample: string;
}

export interface SmsTemplateDefinition {
  key: string;
  name: string;
  description: string;
  audience: SmsAudience;
  category: SmsCategory;
  defaultBodyText: string;
  defaultSenderId?: string;
  defaultDltTemplateId?: string;
  variables: SmsTemplateVariable[];
  sampleData: Record<string, string>;
}

export interface HydratedSmsTemplate {
  key: string;
  name: string;
  description: string;
  audience: SmsAudience;
  category: SmsCategory;
  bodyText: string;
  senderId?: string | null;
  dltTemplateId?: string | null;
  isActive: boolean;
  isCustomized: boolean;
  updatedAt?: string;
  variables: SmsTemplateVariable[];
  sampleData: Record<string, string>;
}

export interface SmsSendOptions {
  to: string;
  templateKey?: string;
  body?: string;
  variables?: Record<string, string | number | undefined | null>;
  senderId?: string;
  dltTemplateId?: string;
}

export interface SmsSendResult {
  ok: boolean;
  messageId?: string;
  provider?: "twilio" | "simulated" | "noop";
  error?: string;
  details?: unknown;
}
