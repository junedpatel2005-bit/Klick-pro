-- CreateTable: sms_templates (safe & idempotent)
CREATE TABLE IF NOT EXISTS "sms_templates" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "audience" "EmailAudience" NOT NULL DEFAULT 'CLIENT',
  "category" TEXT NOT NULL DEFAULT 'General',
  "bodyText" TEXT NOT NULL,
  "dlt_template_id" TEXT,
  "sender_id" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isCustomized" BOOLEAN NOT NULL DEFAULT false,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sms_templates_key_key" ON "sms_templates"("key");
CREATE INDEX IF NOT EXISTS "sms_templates_audience_idx" ON "sms_templates"("audience");
CREATE INDEX IF NOT EXISTS "sms_templates_category_idx" ON "sms_templates"("category");

