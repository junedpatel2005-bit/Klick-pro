ALTER TABLE "ProjectWithdrawal"
  ADD COLUMN "payment_id" INTEGER,
  ADD COLUMN "provider_transfer_id" TEXT,
  ADD COLUMN "failure_reason" TEXT,
  ADD COLUMN "processed_at" TIMESTAMP(3);

CREATE INDEX "ProjectWithdrawal_payment_id_idx" ON "ProjectWithdrawal"("payment_id");

CREATE TABLE "invoices" (
  "id" SERIAL NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "payment_id" INTEGER NOT NULL,
  "client_id" INTEGER NOT NULL,
  "professional_id" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "commission_amount" INTEGER NOT NULL DEFAULT 0,
  "net_amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");
CREATE UNIQUE INDEX "invoices_payment_id_key" ON "invoices"("payment_id");
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");
CREATE INDEX "invoices_professional_id_idx" ON "invoices"("professional_id");
