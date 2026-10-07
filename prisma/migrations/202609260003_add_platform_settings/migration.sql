-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_key" ON "platform_settings"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_settings_category_idx" ON "platform_settings"("category");

-- Seed default settings idempotently
INSERT INTO "platform_settings" ("key", "value", "description", "category", "updated_at")
VALUES
    ('commission_rate', '20', 'Platform commission percentage charged to professionals on milestone payouts (e.g. 20%)', 'FINANCE', CURRENT_TIMESTAMP),
    ('max_dispute_rounds', '5', 'Maximum number of dispute appeal rounds allowed per project contract (e.g. 5 rounds)', 'DISPUTES', CURRENT_TIMESTAMP),
    ('dispute_limit', '5', 'Maximum number of disputes a client or pro can raise per project (e.g. 5 disputes)', 'DISPUTES', CURRENT_TIMESTAMP),
    ('min_withdrawal_amount', '500', 'Minimum withdrawal amount in INR for professionals to cash out to bank', 'FINANCE', CURRENT_TIMESTAMP),
    ('auto_resolve_days', '7', 'Days of inactivity before an unresolved dispute can be auto-escalated or settled', 'DISPUTES', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

