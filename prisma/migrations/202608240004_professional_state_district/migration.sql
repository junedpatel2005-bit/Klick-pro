ALTER TABLE "User"
ADD COLUMN "professionalState" TEXT,
ADD COLUMN "professionalDistrict" TEXT;

CREATE INDEX "User_professionalState_professionalDistrict_idx"
ON "User" ("professionalState", "professionalDistrict");
