ALTER TABLE "ServiceCategory" ADD COLUMN IF NOT EXISTS "parentId" INTEGER;
CREATE INDEX IF NOT EXISTS "ServiceCategory_parentId_idx" ON "ServiceCategory"("parentId");
ALTER TABLE "ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_parentId_fkey";
ALTER TABLE "ServiceCategory"
  ADD CONSTRAINT "ServiceCategory_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "ServiceCategory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
