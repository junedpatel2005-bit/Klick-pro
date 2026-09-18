ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "base_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "client_fee_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "professional_payout_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "admin_net_amount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Payment"
SET
  "base_amount" = CASE WHEN "base_amount" = 0 THEN "amount" ELSE "base_amount" END,
  "professional_payout_amount" = CASE
    WHEN "professional_payout_amount" = 0 THEN GREATEST("amount" - "commissionAmount", 0)
    ELSE "professional_payout_amount"
  END,
  "admin_net_amount" = CASE
    WHEN "admin_net_amount" = 0 THEN "commissionAmount"
    ELSE "admin_net_amount"
  END;

ALTER TABLE "WalletTransaction"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "provider_reference" TEXT;

UPDATE "WalletTransaction"
SET "idempotency_key" = 'legacy-wallet-transaction-' || "id"
WHERE "idempotency_key" IS NULL;

ALTER TABLE "WalletTransaction"
  ALTER COLUMN "idempotency_key" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_idempotency_key_key"
  ON "WalletTransaction"("idempotency_key");

CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_provider_reference_key"
  ON "WalletTransaction"("provider_reference")
  WHERE "provider_reference" IS NOT NULL;
