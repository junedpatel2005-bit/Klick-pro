CREATE TABLE "persona_verifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'persona',
    "provider_inquiry_id" TEXT NOT NULL,
    "provider_status" TEXT NOT NULL,
    "last_provider_event_at" TIMESTAMP(3),
    "admin_status" TEXT NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "persona_verifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "persona_verifications_provider_inquiry_id_key" ON "persona_verifications"("provider_inquiry_id");
CREATE INDEX "persona_verifications_user_id_idx" ON "persona_verifications"("user_id");
CREATE INDEX "persona_verifications_provider_status_idx" ON "persona_verifications"("provider_status");
CREATE INDEX "persona_verifications_admin_status_idx" ON "persona_verifications"("admin_status");
ALTER TABLE "persona_verifications" ADD CONSTRAINT "persona_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "persona_webhook_events" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'persona',
    "provider_event_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "persona_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "persona_webhook_events_provider_event_id_key" ON "persona_webhook_events"("provider_event_id");
