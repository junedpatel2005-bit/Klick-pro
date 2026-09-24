export type EmailAudience = "CLIENT" | "PROFESSIONAL" | "ADMIN" | "SYSTEM";

export type EmailCategory =
  | "Account & Auth"
  | "Jobs & Proposals"
  | "Projects & Milestones"
  | "Disputes & Support"
  | "Financial & Payments";

export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  sample: string;
}

export interface EmailTemplateDefinition {
  key: string;
  name: string;
  description: string;
  audience: EmailAudience;
  category: EmailCategory;
  defaultSubject: string;
  defaultHeading: string;
  defaultBodyText: string;
  defaultActionText?: string;
  defaultActionUrl?: string;
  variables: TemplateVariable[];
  sampleData: Record<string, string>;
}

export interface HydratedEmailTemplate {
  key: string;
  name: string;
  description: string;
  audience: EmailAudience;
  category: EmailCategory;
  subject: string;
  heading: string;
  bodyText: string;
  actionText?: string | null;
  actionUrl?: string | null;
  isActive: boolean;
  isCustomized: boolean;
  updatedAt?: string;
  variables: TemplateVariable[];
  sampleData: Record<string, string>;
}

