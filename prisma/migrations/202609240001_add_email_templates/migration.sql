DO $$ BEGIN
  CREATE TYPE "EmailAudience" AS ENUM ('CLIENT', 'PROFESSIONAL', 'ADMIN', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "audience" "EmailAudience" NOT NULL DEFAULT 'CLIENT',
  "category" TEXT NOT NULL DEFAULT 'General',
  "subject" TEXT NOT NULL,
  "heading" TEXT NOT NULL,
  "bodyText" TEXT NOT NULL,
  "actionText" TEXT,
  "actionUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isCustomized" BOOLEAN NOT NULL DEFAULT false,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_templates_key_key" ON "email_templates"("key");
CREATE INDEX IF NOT EXISTS "email_templates_audience_idx" ON "email_templates"("audience");
CREATE INDEX IF NOT EXISTS "email_templates_category_idx" ON "email_templates"("category");

