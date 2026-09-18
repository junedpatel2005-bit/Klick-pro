-- Read-only baseline diagnostics. Run with psql against the target database.
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Read-only preflight for relationship constraints.
SELECT p.id
FROM "Payment" p
LEFT JOIN "User" c ON c.id = p."clientId"
WHERE c.id IS NULL;

SELECT p.id
FROM "Payment" p
LEFT JOIN "User" u ON u.id = p."professionalId"
WHERE u.id IS NULL;

SELECT pt.id
FROM "ProjectTracking" pt
LEFT JOIN "ProjectRequest" pr ON pr.id = pt."requestId"
WHERE pr.id IS NULL;

SELECT pm.id
FROM "ProjectMilestone" pm
LEFT JOIN "ProjectTracking" pt ON pt.id = pm."trackingId"
WHERE pt.id IS NULL;

SELECT e.id FROM "ProjectTimelineEvent" e
LEFT JOIN "ProjectTracking" pt ON pt.id = e."trackingId"
WHERE pt.id IS NULL;

SELECT w.id FROM "ProjectWorkUpload" w
LEFT JOIN "ProjectTracking" pt ON pt.id = w."trackingId"
WHERE pt.id IS NULL;

SELECT w.id FROM "ProjectWorkUpload" w
LEFT JOIN "ProjectMilestone" pm ON pm.id = w."milestoneId"
WHERE w."milestoneId" IS NOT NULL AND pm.id IS NULL;

SELECT s.id FROM "Service" s
LEFT JOIN "ServiceCategory" c ON c.id = s."categoryId"
WHERE c.id IS NULL;

SELECT "clientProfileId", COUNT(*) AS primary_count
FROM "ClientSavedLocation"
WHERE "isPrimary" = true
GROUP BY "clientProfileId"
HAVING COUNT(*) > 1;

SELECT "userId", COUNT(*) AS profile_count
FROM "ClientProfile"
GROUP BY "userId"
HAVING COUNT(*) > 1;

-- Every column converted by 202608200005_integer_money_fields.
SELECT id, budget_min, 'hire_jobs.budget_min' AS source_column
FROM hire_jobs
WHERE budget_min IS NOT NULL AND budget_min <> trunc(budget_min)
UNION ALL
SELECT id, budget_max, 'hire_jobs.budget_max'
FROM hire_jobs
WHERE budget_max IS NOT NULL AND budget_max <> trunc(budget_max)
UNION ALL
SELECT id, total_amount, 'hire_contracts.total_amount'
FROM hire_contracts
WHERE total_amount IS NOT NULL AND total_amount <> trunc(total_amount)
UNION ALL
SELECT id, platform_fee, 'hire_contracts.platform_fee'
FROM hire_contracts
WHERE platform_fee IS NOT NULL AND platform_fee <> trunc(platform_fee)
UNION ALL
SELECT id, amount, 'hire_milestones.amount'
FROM hire_milestones
WHERE amount IS NOT NULL AND amount <> trunc(amount)
UNION ALL
SELECT id, "bidAmount", 'direct_hire_negotiations.bidAmount'
FROM direct_hire_negotiations
WHERE "bidAmount" IS NOT NULL AND "bidAmount" <> trunc("bidAmount")
UNION ALL
SELECT id, "hourlyRate", 'legacy_professional_details.hourlyRate'
FROM legacy_professional_details
WHERE "hourlyRate" IS NOT NULL AND "hourlyRate" <> trunc("hourlyRate")
UNION ALL
SELECT id, "fixedRate", 'legacy_professional_details.fixedRate'
FROM legacy_professional_details
WHERE "fixedRate" IS NOT NULL AND "fixedRate" <> trunc("fixedRate");

-- CHECK preflight queries.
SELECT id FROM "Payment"
WHERE amount < 0
   OR "base_amount" < 0
   OR "client_fee_amount" < 0
   OR "professional_payout_amount" < 0
   OR "admin_net_amount" < 0;

SELECT id FROM "ProjectTracking" WHERE progress NOT BETWEEN 0 AND 100;
SELECT id FROM "ProjectReview" WHERE rating NOT BETWEEN 1 AND 5;
SELECT id FROM "User"
WHERE "averageRating" NOT BETWEEN 0 AND 5 OR "reviewCount" < 0;
SELECT id, "budgetMin", "budgetMax" FROM "ClientJob"
WHERE "budgetMin" IS NOT NULL AND "budgetMax" IS NOT NULL AND "budgetMin" > "budgetMax";

-- Stored-value inventory for stable/internal lifecycle values and providers.
SELECT 'User.role' AS field, role AS value, count(*) FROM "User" GROUP BY role
UNION ALL SELECT 'ClientJob.status', status, count(*) FROM "ClientJob" GROUP BY status
UNION ALL SELECT 'ClientJob.paymentMethod', "paymentMethod", count(*) FROM "ClientJob" GROUP BY "paymentMethod"
UNION ALL SELECT 'ProjectTracking.status', status, count(*) FROM "ProjectTracking" GROUP BY status
UNION ALL SELECT 'ProjectMilestone.status', status, count(*) FROM "ProjectMilestone" GROUP BY status
UNION ALL SELECT 'Payment.status', status, count(*) FROM "Payment" GROUP BY status
UNION ALL SELECT 'Payment.provider', provider, count(*) FROM "Payment" GROUP BY provider
UNION ALL SELECT 'Payment.currency', currency, count(*) FROM "Payment" GROUP BY currency
UNION ALL SELECT 'ProjectDispute.status', status, count(*) FROM "ProjectDispute" GROUP BY status
UNION ALL SELECT 'ProjectDispute.priority', priority, count(*) FROM "ProjectDispute" GROUP BY priority;
