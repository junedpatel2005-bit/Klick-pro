-- CreateTable
CREATE TABLE IF NOT EXISTS "ClientJobMilestone" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "percentage" INTEGER NOT NULL,
    "amount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientJobMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClientJobMilestone_jobId_idx" ON "ClientJobMilestone"("jobId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ClientJobMilestone_jobId_fkey'
    ) THEN
        ALTER TABLE "ClientJobMilestone" ADD CONSTRAINT "ClientJobMilestone_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ClientJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

