-- Allow genuinely incomplete DRAFT jobs. OPEN jobs are validated by the API.
ALTER TABLE "ClientJob" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "ClientJob" ALTER COLUMN "title" DROP NOT NULL;
ALTER TABLE "ClientJob" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "ClientJob" ALTER COLUMN "deadline" DROP NOT NULL;
