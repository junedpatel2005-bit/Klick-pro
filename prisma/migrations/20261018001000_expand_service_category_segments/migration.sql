-- Expand ServiceCategory segment check constraint to include HEALTH_CARE, PERSONAL_CARE, and EDUCATION
ALTER TABLE "ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_segment_check";

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_segment_check"
  CHECK ("segment" IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'HEALTH_CARE', 'PERSONAL_CARE', 'EDUCATION'));
