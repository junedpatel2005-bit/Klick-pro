-- Drop unused legacy direct-hire models.
-- Verified empty (0 rows in each) and referenced only by scripts/reset-marketplace-catalog.ts.
-- Safe ordering: children before parents.

DROP TABLE IF EXISTS "DirectHireNegotiation";
DROP TABLE IF EXISTS "hire_milestones";
DROP TABLE IF EXISTS "hire_job_attachments";
DROP TABLE IF EXISTS "hire_contracts";
DROP TABLE IF EXISTS "hire_jobs";
