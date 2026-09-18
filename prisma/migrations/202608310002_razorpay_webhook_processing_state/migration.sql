ALTER TABLE "razorpay_webhook_events"
  ADD COLUMN "processing_status" TEXT NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "processing_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_error" TEXT,
  ADD COLUMN "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processing_started_at" TIMESTAMP(3),
  ADD COLUMN "processed_at" TIMESTAMP(3);

CREATE INDEX "razorpay_webhook_events_processing_status_received_at_idx"
  ON "razorpay_webhook_events" ("processing_status", "received_at");
