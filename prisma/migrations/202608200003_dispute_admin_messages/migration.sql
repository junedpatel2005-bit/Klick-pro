CREATE TABLE "project_dispute_messages" (
  "id" SERIAL NOT NULL,
  "dispute_id" INTEGER NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "sender_role" TEXT NOT NULL,
  "recipient_id" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_dispute_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_dispute_messages_dispute_id_created_at_idx" ON "project_dispute_messages"("dispute_id", "created_at");
CREATE INDEX "project_dispute_messages_recipient_id_created_at_idx" ON "project_dispute_messages"("recipient_id", "created_at");
