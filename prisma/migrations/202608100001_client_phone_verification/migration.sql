-- Phase 1 client onboarding: an individual client may not have a company,
-- and successful phone verification must have an auditable timestamp.
ALTER TABLE "ClientProfile" ALTER COLUMN "companyName" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
