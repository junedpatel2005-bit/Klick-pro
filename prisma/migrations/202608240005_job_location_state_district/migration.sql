ALTER TABLE "ClientJob"
ADD COLUMN "locationState" TEXT,
ADD COLUMN "locationDistrict" TEXT;

CREATE INDEX "ClientJob_locationState_locationDistrict_idx"
ON "ClientJob" ("locationState", "locationDistrict");
