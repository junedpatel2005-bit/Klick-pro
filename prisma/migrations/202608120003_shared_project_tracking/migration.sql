-- The original baseline did not create the project-tracking tables, but this
-- migration adds columns to them. Create the base tables first so migration
-- replay works on a clean database as well as on existing databases.
CREATE TABLE IF NOT EXISTS "ProjectRequest" (
  "id" SERIAL NOT NULL,
  "jobId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "professionalId" INTEGER NOT NULL,
  "bidAmount" INTEGER NOT NULL,
  "duration" TEXT NOT NULL,
  "coverLetter" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attachmentsJson" TEXT DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectTracking" (
  "id" SERIAL NOT NULL,
  "requestId" INTEGER NOT NULL,
  "jobId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "professionalId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY_TO_START',
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTracking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProjectTracking_requestId_key" UNIQUE ("requestId")
);

CREATE TABLE IF NOT EXISTS "ProjectMilestone" (
  "id" SERIAL NOT NULL,
  "trackingId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "professionalId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'UPCOMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProjectWorkUpload" (
  "id" SERIAL NOT NULL,
  "trackingId" INTEGER NOT NULL,
  "roundNumber" INTEGER NOT NULL DEFAULT 1,
  "title" TEXT NOT NULL,
  "note" TEXT,
  "fileName" TEXT,
  "fileUrl" TEXT,
  "filesJson" TEXT DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectWorkUpload_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectTracking"
  ADD COLUMN IF NOT EXISTS "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "currentStage" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "ProjectTracking"
  ALTER COLUMN "status" SET DEFAULT 'READY_TO_START';

UPDATE "ProjectTracking"
SET "status" = 'READY_TO_START'
WHERE "status" = 'RUNNING';

ALTER TABLE "ProjectMilestone"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE "ProjectMilestone"
  ALTER COLUMN "status" SET DEFAULT 'UPCOMING';

ALTER TABLE "ProjectWorkUpload"
  ADD COLUMN IF NOT EXISTS "milestoneId" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'UPLOADED';

CREATE TABLE IF NOT EXISTS "ProjectTimelineEvent" (
  "id" SERIAL NOT NULL,
  "trackingId" INTEGER NOT NULL,
  "milestoneId" INTEGER,
  "actorId" INTEGER NOT NULL,
  "actorRole" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "progress" INTEGER,
  "stage" TEXT,
  "attachmentJson" TEXT DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProjectTimelineEvent_trackingId_createdAt_idx"
  ON "ProjectTimelineEvent"("trackingId", "createdAt");
