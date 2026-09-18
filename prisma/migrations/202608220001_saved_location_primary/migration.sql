ALTER TABLE "ClientSavedLocation" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

WITH first_locations AS (
  SELECT DISTINCT ON ("clientProfileId") id
  FROM "ClientSavedLocation"
  ORDER BY "clientProfileId", "createdAt" ASC, id ASC
)
UPDATE "ClientSavedLocation"
SET "isPrimary" = true
WHERE id IN (SELECT id FROM first_locations);
