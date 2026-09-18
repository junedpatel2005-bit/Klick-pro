ALTER TABLE "ServiceCategory" ADD COLUMN IF NOT EXISTS "segment" TEXT NOT NULL DEFAULT 'RESIDENTIAL';
ALTER TABLE "ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_segment_check";
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_segment_check" CHECK ("segment" IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL'));
