-- 01 Schema inventory
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;

-- 02 Columns
SELECT table_schema, table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default, identity_generation
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;

-- 03 Constraints
SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
       CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'u' THEN 'UNIQUE'
         WHEN 'f' THEN 'FOREIGN KEY' WHEN 'c' THEN 'CHECK' ELSE con.contype::text END AS kind,
       pg_get_constraintdef(con.oid) AS definition,
       con.convalidated AS is_valid,
       CASE WHEN NOT con.convalidated THEN 'NOT VALID' ELSE 'VALID' END AS validation_status
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname, con.conname;

-- 04 Foreign keys
SELECT tc.table_schema, tc.table_name, tc.constraint_name,
       kcu.column_name, ccu.table_schema AS referenced_schema,
       ccu.table_name AS referenced_table, ccu.column_name AS referenced_column,
       rc.delete_rule, rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_schema = tc.table_schema
 AND kcu.table_name = tc.table_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_schema = tc.constraint_schema
 AND rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- 05 Indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, indexname;

-- 06 Prisma migration history
-- Prisma-specific: this relation is absent until Prisma has initialized the database.
SELECT migration_name, started_at, finished_at, rolled_back_at,
       applied_steps_count, logs
FROM _prisma_migrations
ORDER BY started_at, migration_name;

-- 07 Relationship/orphan checks
SELECT 'Payment.clientId' AS check_name, p.id AS row_id, p."clientId" AS reference_id
FROM "Payment" p LEFT JOIN "User" u ON u.id = p."clientId"
WHERE u.id IS NULL;

SELECT 'Payment.professionalId' AS check_name, p.id AS row_id, p."professionalId" AS reference_id
FROM "Payment" p LEFT JOIN "User" u ON u.id = p."professionalId"
WHERE u.id IS NULL;

SELECT 'Payment.jobId' AS check_name, p.id AS row_id, p."jobId" AS reference_id
FROM "Payment" p LEFT JOIN "ClientJob" j ON j.id = p."jobId"
WHERE p."jobId" IS NOT NULL AND j.id IS NULL;

SELECT 'Payment.projectTrackingId' AS check_name, p.id AS row_id, p.project_tracking_id AS reference_id
FROM "Payment" p LEFT JOIN "ProjectTracking" t ON t.id = p.project_tracking_id
WHERE p.project_tracking_id IS NOT NULL AND t.id IS NULL;

SELECT 'ProjectRequest.clientId' AS check_name, r.id AS row_id, r."clientId" AS reference_id
FROM "ProjectRequest" r LEFT JOIN "User" u ON u.id = r."clientId"
WHERE u.id IS NULL;

SELECT 'ProjectRequest.professionalId' AS check_name, r.id AS row_id, r."professionalId" AS reference_id
FROM "ProjectRequest" r LEFT JOIN "User" u ON u.id = r."professionalId"
WHERE u.id IS NULL;

SELECT 'ProjectRequest.jobId' AS check_name, r.id AS row_id, r."jobId" AS reference_id
FROM "ProjectRequest" r LEFT JOIN "ClientJob" j ON j.id = r."jobId"
WHERE j.id IS NULL;

SELECT 'ProjectTracking.requestId' AS check_name, t.id AS row_id, t."requestId" AS reference_id
FROM "ProjectTracking" t LEFT JOIN "ProjectRequest" r ON r.id = t."requestId"
WHERE r.id IS NULL;

SELECT 'ProjectTracking.jobId' AS check_name, t.id AS row_id, t."jobId" AS reference_id
FROM "ProjectTracking" t LEFT JOIN "ClientJob" j ON j.id = t."jobId"
WHERE j.id IS NULL;

SELECT 'ProjectMilestone.trackingId' AS check_name, m.id AS row_id, m."trackingId" AS reference_id
FROM "ProjectMilestone" m LEFT JOIN "ProjectTracking" t ON t.id = m."trackingId"
WHERE t.id IS NULL;

SELECT 'ProjectTimelineEvent.trackingId' AS check_name, e.id AS row_id, e."trackingId" AS reference_id
FROM "ProjectTimelineEvent" e LEFT JOIN "ProjectTracking" t ON t.id = e."trackingId"
WHERE t.id IS NULL;

SELECT 'ProjectWorkUpload.trackingId' AS check_name, w.id AS row_id, w."trackingId" AS reference_id
FROM "ProjectWorkUpload" w LEFT JOIN "ProjectTracking" t ON t.id = w."trackingId"
WHERE t.id IS NULL;

SELECT 'ProjectWorkUpload.milestoneId' AS check_name, w.id AS row_id, w."milestoneId" AS reference_id
FROM "ProjectWorkUpload" w LEFT JOIN "ProjectMilestone" m ON m.id = w."milestoneId"
WHERE w."milestoneId" IS NOT NULL AND m.id IS NULL;

SELECT 'ClientProfile.userId' AS check_name, p.id AS row_id, p."userId" AS reference_id
FROM "ClientProfile" p LEFT JOIN "User" u ON u.id = p."userId"
WHERE u.id IS NULL;

SELECT 'Service.categoryId' AS check_name, s.id AS row_id, s."categoryId" AS reference_id
FROM "Service" s LEFT JOIN "ServiceCategory" c ON c.id = s."categoryId"
WHERE c.id IS NULL;

-- 08 Duplicate checks
SELECT 'User duplicate email' AS check_name, lower(email) AS normalized_email, count(*) AS row_count
FROM "User"
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1;

SELECT 'ClientProfile duplicate user' AS check_name, "userId", count(*) AS row_count
FROM "ClientProfile"
GROUP BY "userId"
HAVING count(*) > 1;

SELECT 'ClientSavedLocation duplicate primary' AS check_name,
       "clientProfileId", count(*) AS row_count
FROM "ClientSavedLocation"
WHERE "isPrimary" = true
GROUP BY "clientProfileId"
HAVING count(*) > 1;

-- 09 Financial integrity
SELECT 'Payment negative money' AS check_name, id, amount, base_amount,
       client_fee_amount, professional_payout_amount, admin_net_amount
FROM "Payment"
WHERE amount < 0 OR base_amount < 0 OR client_fee_amount < 0
   OR professional_payout_amount < 0 OR admin_net_amount < 0;

SELECT 'Payment unexpected required NULL' AS check_name, id
FROM "Payment"
WHERE amount IS NULL OR base_amount IS NULL OR client_fee_amount IS NULL
   OR professional_payout_amount IS NULL OR admin_net_amount IS NULL;

SELECT 'Payment charge reconciliation' AS check_name, id, amount, base_amount,
       client_fee_amount, professional_payout_amount, admin_net_amount
FROM "Payment"
WHERE amount <> base_amount + client_fee_amount
   OR professional_payout_amount + admin_net_amount <> amount;

-- 10 Range/business-rule checks
SELECT 'ProjectTracking invalid progress' AS check_name, id, progress
FROM "ProjectTracking"
WHERE progress IS NULL OR progress < 0 OR progress > 100;

SELECT 'ProjectReview invalid rating' AS check_name, id, rating
FROM "ProjectReview"
WHERE rating IS NULL OR rating < 1 OR rating > 5;

SELECT 'User invalid rating aggregate' AS check_name, id, "averageRating", "reviewCount"
FROM "User"
WHERE "averageRating" IS NULL OR "averageRating" < 0 OR "averageRating" > 5
   OR "reviewCount" IS NULL OR "reviewCount" < 0;

SELECT 'ClientJob invalid budget' AS check_name, id, "budgetMin", "budgetMax"
FROM "ClientJob"
WHERE "budgetMin" < 0 OR "budgetMax" < 0
   OR ("budgetMin" IS NOT NULL AND "budgetMax" IS NOT NULL AND "budgetMin" > "budgetMax");

SELECT 'ProjectTracking invalid lifecycle dates' AS check_name, id, "startedAt", "completedAt"
FROM "ProjectTracking"
WHERE "startedAt" IS NOT NULL AND "completedAt" IS NOT NULL
  AND "completedAt" < "startedAt";

-- 11 Status inventories
SELECT 'ProjectTracking status inventory' AS check_name, status, count(*) AS row_count
FROM "ProjectTracking" GROUP BY status ORDER BY status;

SELECT 'Payment status inventory' AS check_name, status, count(*) AS row_count
FROM "Payment" GROUP BY status ORDER BY status;

SELECT 'WalletTransaction status inventory' AS check_name, status, count(*) AS row_count
FROM "WalletTransaction" GROUP BY status ORDER BY status;

-- 12 RLS
SELECT n.nspname AS schemaname, c.relname AS tablename,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS forced_for_owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;

-- 13 Policies
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS schemaname, c.relname AS tablename, c.relrowsecurity,
       count(p.policyname) AS policy_count,
       CASE WHEN c.relrowsecurity THEN 'ENABLED'
            WHEN count(p.policyname) > 0 THEN 'NEEDS ARCHITECTURE VERIFICATION'
            ELSE 'DISABLED_WITHOUT_POLICIES' END AS review_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
GROUP BY n.nspname, c.relname, c.relrowsecurity
ORDER BY n.nspname, c.relname;

-- 14 Grants
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, grantee, privilege_type;

-- 15 Functions/security definer
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_userbyid(p.proowner) AS owner,
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END AS execution_security,
       p.proconfig AS configuration,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, p.proname, arguments;

-- 16 Index usage
-- idx_scan = 0 is not proof that an index is removable; statistics reset and rare indexes are valid.
SELECT schemaname, relname AS table_name, indexrelname AS index_name,
       idx_scan, idx_tup_read, idx_tup_fetch,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- 17 Table/storage stats
SELECT schemaname, relname AS table_name, n_live_tup, n_dead_tup,
       last_analyze, last_autoanalyze, last_vacuum, last_autovacuum,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_total_relation_size(relid) AS total_size_bytes
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- 18 Sequences/identity
SELECT schemaname, sequencename, data_type, start_value, min_value,
       max_value, increment_by, cycle, last_value,
       CASE WHEN last_value IS NULL OR max_value IS NULL THEN NULL
            ELSE max_value - last_value END AS remaining_headroom
FROM pg_sequences
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, sequencename;

SELECT table_schema, table_name, column_name, data_type,
       identity_generation, identity_start, identity_increment
FROM information_schema.columns
WHERE identity_generation IS NOT NULL
ORDER BY table_schema, table_name, ordinal_position;

-- 19 Manual verification notes
-- The migration-history query is Prisma-specific and may be absent before initialization.
-- RLS disabled is not automatically a vulnerability; verify whether direct data APIs expose the table.
-- Run this script with a role that can read catalogs and application tables.
-- Confirm PostgreSQL version support for pg_sequences, pg_policies, and pg_stat_user_tables.
