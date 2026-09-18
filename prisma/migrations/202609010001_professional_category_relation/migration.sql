ALTER TABLE "User"
  ADD COLUMN "professional_category_id" INTEGER;

CREATE INDEX "User_professional_category_id_idx"
  ON "User"("professional_category_id");

ALTER TABLE "User"
  ADD CONSTRAINT "User_professional_category_id_fkey"
  FOREIGN KEY ("professional_category_id") REFERENCES "ServiceCategory"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
