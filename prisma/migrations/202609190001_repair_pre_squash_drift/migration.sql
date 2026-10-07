-- Repair migration for databases provisioned before the migration history was
-- squashed into 0_init. Those databases are recorded as up to date but lack the
-- ProjectReview review-split columns and two constraints, which made
-- getOpenJob() fail with P2022 ("column ProjectReview.professionalRating does
-- not exist").
--
-- Every statement below is a no-op on a database that already ran 0_init, so
-- this is safe to apply to fresh and legacy databases alike.

ALTER TABLE "ProjectReview"
  ADD COLUMN IF NOT EXISTS "clientReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "professionalRating" INTEGER,
  ADD COLUMN IF NOT EXISTS "professionalComment" TEXT,
  ADD COLUMN IF NOT EXISTS "professionalReviewedAt" TIMESTAMP(3);

-- rating became optional when the review split let either side review first.
ALTER TABLE "ProjectReview" ALTER COLUMN "rating" DROP NOT NULL;

-- Legacy seed data holds Payment rows pointing at ProjectMilestone ids that
-- were never inserted. The column is nullable and the FK is ON DELETE SET NULL,
-- so clearing the dangling reference matches what the FK would have done.
UPDATE "Payment" p
SET "milestone_id" = NULL
WHERE p."milestone_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ProjectMilestone" m WHERE m."id" = p."milestone_id"
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_milestone_id_fkey') THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_milestone_id_fkey" FOREIGN KEY ("milestone_id")
      REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_walletId_fkey') THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId")
      REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProfessionalVerification_userId_fkey') THEN
    ALTER TABLE "ProfessionalVerification"
      ADD CONSTRAINT "ProfessionalVerification_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Service_professionalId_fkey') THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "Service_professionalId_fkey" FOREIGN KEY ("professionalId")
      REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectReview_professionalRating_check') THEN
    ALTER TABLE "ProjectReview"
      ADD CONSTRAINT "ProjectReview_professionalRating_check"
      CHECK ("professionalRating" IS NULL OR "professionalRating" BETWEEN 1 AND 5);
  END IF;
END
$$;
