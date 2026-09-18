ALTER TABLE "Payment" ADD COLUMN "razorpay_order_id" TEXT;
ALTER TABLE "Payment" ADD COLUMN "razorpay_payment_id" TEXT;
ALTER TABLE "Payment" ADD COLUMN "razorpay_signature" TEXT;
ALTER TABLE "Payment" ADD COLUMN "project_tracking_id" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "milestone_id" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "captured_at" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "failure_reason" TEXT;
ALTER TABLE "User" ADD COLUMN "razorpay_account_id" TEXT;
CREATE UNIQUE INDEX "Payment_razorpay_order_id_key" ON "Payment"("razorpay_order_id");
CREATE UNIQUE INDEX "Payment_razorpay_payment_id_key" ON "Payment"("razorpay_payment_id");
CREATE UNIQUE INDEX "Payment_milestone_id_key" ON "Payment"("milestone_id");
CREATE UNIQUE INDEX "User_razorpay_account_id_key" ON "User"("razorpay_account_id");
CREATE TABLE "razorpay_webhook_events" (
  "id" SERIAL NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "razorpay_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "razorpay_webhook_events_event_id_key" ON "razorpay_webhook_events"("event_id");
