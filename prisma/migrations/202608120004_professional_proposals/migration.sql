ALTER TABLE "ProjectRequest"
  ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'CLIENT_HIRE';

CREATE INDEX IF NOT EXISTS "ProjectRequest_jobId_origin_status_idx"
  ON "ProjectRequest"("jobId", "origin", "status");
