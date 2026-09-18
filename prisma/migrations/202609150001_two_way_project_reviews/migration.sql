-- A project can be reviewed independently by both participants. Existing
-- ratings are client-to-professional reviews, so preserve and timestamp them.
ALTER TABLE "ProjectReview"
  ALTER COLUMN "rating" DROP NOT NULL,
  ADD COLUMN "clientReviewedAt" TIMESTAMP(3),
  ADD COLUMN "professionalRating" INTEGER,
  ADD COLUMN "professionalComment" TEXT,
  ADD COLUMN "professionalReviewedAt" TIMESTAMP(3);

UPDATE "ProjectReview"
SET "clientReviewedAt" = "createdAt"
WHERE "rating" IS NOT NULL;

ALTER TABLE "ProjectReview"
  ADD CONSTRAINT "ProjectReview_professionalRating_check"
  CHECK ("professionalRating" IS NULL OR "professionalRating" BETWEEN 1 AND 5);
