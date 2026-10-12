-- AlterTable ClientJobMilestone: add validity_days
ALTER TABLE "ClientJobMilestone" ADD COLUMN IF NOT EXISTS "validity_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable ProjectMilestone: add validity_days, release_at, auto_release_status
ALTER TABLE "ProjectMilestone" ADD COLUMN IF NOT EXISTS "validity_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ProjectMilestone" ADD COLUMN IF NOT EXISTS "release_at" TIMESTAMP(3);
ALTER TABLE "ProjectMilestone" ADD COLUMN IF NOT EXISTS "auto_release_status" TEXT;
