# Database Audit

## Executive Summary

Overall health: **POOR**

Scope: static, read-only review of `prisma/schema.prisma`, all checked-in Prisma migrations, API/database client code, scripts, generated Prisma output, configuration names, and repository documentation. No production database connection or mutating SQL was used. The `supabase` directory contains no SQL/config artifacts; Supabase-specific runtime permissions and RLS therefore need verification in the deployed project.

Critical issues: 1  
High issues: 5  
Medium issues: 5  
Low issues: 2  
Optimization opportunities: 4

| ID     | Severity | Area               | Table/File                                                                            | Issue                                                                                                                                                                                    | Risk                                                                                                                                              | Recommended Fix                                                                                                                       |
| ------ | -------- | ------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| DB-001 | CRITICAL | Migration          | `prisma/migrations/0_init/migration.sql`                                              | The baseline migration is empty while the Prisma schema defines approximately 60 models.                                                                                                 | A fresh environment cannot be reconstructed from migration history; deployment may start without required tables or depend on undocumented state. | Establish a verified baseline or create a complete forward migration after comparing against a schema dump.                           |
| DB-002 | HIGH     | Security           | `app/api/auth/[action]/route.ts:445-459, 568-618`                                     | Login paths set a valid session cookie even when `emailVerifiedAt` is null and return HTTP 403.                                                                                          | Any endpoint that checks only session presence can be reached by an unverified account.                                                           | Do not issue the normal session until email verification succeeds, or enforce verification in one shared authorization helper.        |
| DB-003 | HIGH     | Integrity          | `prisma/schema.prisma:272-425, 621-725`                                               | Project, payment, invoice, dispute, and withdrawal ID columns lack database relations/FKs.                                                                                               | Orphans, cross-user references, and inconsistent financial/project records are possible through scripts, admin tooling, or future code paths.     | Add FKs after read-only orphan checks and reconcile existing data first.                                                              |
| DB-004 | HIGH     | Migration          | `202608200005_integer_money_fields/migration.sql`                                     | `ROUND(value)::INTEGER` changes monetary values silently during type conversion.                                                                                                         | Existing fractional amounts can be altered without an approval report or reversible archive.                                                      | Preflight fractional rows, choose explicit policy, archive exceptions, then convert in a controlled migration.                        |
| DB-005 | HIGH     | Integrity/security | `prisma/schema.prisma`                                                                | Money, progress, ratings, balances, and status strings have no DB CHECK constraints.                                                                                                     | Invalid negative amounts, out-of-range ratings/progress, and unsupported states can enter through non-API writers.                                | Add checks and use enums/reference tables where the lifecycle is stable.                                                              |
| DB-006 | HIGH     | Consistency        | `app/api/portal/project-actions/route.ts`                                             | Many state changes create events/notifications in separate transactions; the read-then-write workflow is not atomic as a whole.                                                          | A timeout can leave the project state changed but audit/event/notification records missing; concurrent requests can race.                         | Use a transaction for state plus durable event/outbox writes and conditional updates.                                                 |
| DB-007 | MEDIUM   | Schema             | `ClientSavedLocation.isPrimary`                                                       | Migration backfills one primary location but no partial unique index prevents two primaries per client.                                                                                  | UI assumptions can be violated by concurrent or direct writes.                                                                                    | Add a unique partial index on `clientProfileId WHERE isPrimary`.                                                                      |
| DB-008 | MEDIUM   | Relationships      | `Service.categoryId`, `DirectHireNegotiation`, `Project*` models                      | Several relationship-like columns have no FK or Prisma relation, including `Service.categoryId`, `ProjectRequest.jobId`, `ProjectTracking.requestId`, and `ProjectMilestone.trackingId`. | Invalid references and inability to safely cascade or join.                                                                                       | Model the relationships explicitly; retain nullable FKs only where the lifecycle truly permits absence.                               |
| DB-009 | MEDIUM   | Security           | `src/lib/auth.ts:8-16`                                                                | A bearer-equivalent JWT session is valid for seven days with no server-side session/revocation record; role is trusted from the token.                                                   | A stolen token remains usable until expiry, and role changes/deactivation are not immediately reflected.                                          | Use shorter expiry plus rotation/revocation, and check active user/role for sensitive operations.                                     |
| DB-010 | MEDIUM   | Safety             | `scripts/apply-professional-proposals.ts`, `scripts/apply-shared-project-tracking.ts` | Operational scripts call `$executeRawUnsafe`, even though their current statements appear fixed.                                                                                         | Future edits can turn maintenance scripts into injection or accidental DDL/DML tools.                                                             | Use migrations/typed Prisma operations or `$executeRaw` with fixed `Prisma.sql` fragments, and require an explicit environment guard. |
| DB-011 | MEDIUM   | Verification       | `npm run typecheck`                                                                   | Typecheck fails: missing `vitest` declarations/import resolution and missing `@types/nodemailer`.                                                                                        | Database-related tests and generated-type consistency are not currently proven by CI.                                                             | Repair dependency installation/configuration, then run typecheck and tests in CI.                                                     |
| DB-012 | LOW      | Maintainability    | schema/migrations                                                                     | Many statuses and roles are free-form `TEXT`/`String` despite Prisma enums existing for only a subset.                                                                                   | Drift between UI, API, scripts, and stored values.                                                                                                | Centralize lifecycle values and add DB checks/reference tables incrementally.                                                         |
| DB-013 | LOW      | Health             | `AuditLog`, webhook, OTP, message, upload tables                                      | No retention/archival strategy is visible for append-heavy records.                                                                                                                      | Unbounded growth increases storage, index size, and query cost.                                                                                   | Define retention, partition/archive policy, and monitoring.                                                                           |

## DB-001 — Empty migration baseline

Severity: Critical  
Confidence: High

Location:

- `prisma/migrations/0_init/migration.sql:1` (0 bytes)
- `prisma/schema.prisma`

Problem: The first migration is empty, while the current schema defines models such as `User`, `ClientJob`, `Payment`, `Wallet`, messaging, verification, and legacy tables. Later migrations use `ALTER TABLE` against those tables, so the repository migration chain is not self-contained.

Evidence: `Get-Item prisma/migrations/0_init/migration.sql` reports length 0; `prisma validate` passes only because validation does not apply migrations.

How to verify safely:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;
```

Recommended fix: compare a production schema dump to the Prisma schema and migration history. Generate a documented baseline for new environments, then test `prisma migrate deploy` against an empty disposable database. Do not apply this to production until the diff is reviewed.

Risk of fix: baseline replacement or table creation can lock objects and may fail on existing environments; use a new controlled migration or a separately documented baseline process.

## DB-002 — Unverified login receives a session

Severity: High  
Confidence: High

Location: `app/api/auth/[action]/route.ts:445-459`, `568-618`.

Problem: When `emailVerifiedAt` is null, the route returns 403 but still calls `createSession` and sets `servio_session`. The shared `verifySession` helper validates signature/expiry but does not enforce email verification or current user state.

Impact: Any protected route that checks only for a valid session can be used before email verification. This is a confirmed authorization-boundary weakness; the practical exposure depends on downstream route checks.

How to verify: In a disposable test environment, create an unverified non-admin account, log in, retain the response cookie, and request a protected endpoint. Confirm whether the endpoint rejects based on verification rather than only session presence.

Recommended fix: issue a restricted pre-verification token with a distinct claim, or do not set the normal session. Add a shared `requireVerifiedSession` helper and tests for every protected route.

## DB-003 — Missing integrity FKs in core domain

Severity: High  
Confidence: High

Location: `prisma/schema.prisma:272-425`, `621-798`.

Problem: `ProjectTransaction`, `ProjectNegotiation`, `ProjectRequest`, `ProjectTracking`, `ProjectTimelineEvent`, `ProjectMilestone`, `ProjectWorkUpload`, `Payment`, `ProjectWithdrawal`, `Invoice`, `ProjectDispute`, and request tables contain IDs that are not declared as relations. `Payment.clientId`, `Payment.professionalId`, `Payment.jobId`, and `Payment.projectTrackingId` are especially important examples.

Safe verification queries:

```sql
SELECT p.id
FROM "Payment" p
LEFT JOIN "User" c ON c.id = p."clientId"
LEFT JOIN "User" pr ON pr.id = p."professionalId"
WHERE c.id IS NULL OR pr.id IS NULL;

SELECT pt.id
FROM "ProjectTracking" pt
LEFT JOIN "ProjectRequest" r ON r.id = pt."requestId"
WHERE r.id IS NULL;

SELECT pm.id
FROM "ProjectMilestone" pm
LEFT JOIN "ProjectTracking" pt ON pt.id = pm."trackingId"
WHERE pt.id IS NULL;
```

Recommended fix: first run all orphan checks and reconcile results. Add explicit FKs with deliberately chosen `ON DELETE` behavior; avoid blanket cascades for financial history.

## DB-004 — Risky fractional-to-integer money conversion

Severity: High  
Confidence: High

Location: `prisma/migrations/202608200005_integer_money_fields/migration.sql`.

Problem: `ROUND("budget_min")::INTEGER` and similar expressions alter existing values. The migration has no preflight count, exception archive, or verification output.

Safe verification:

```sql
SELECT count(*) AS fractional_rows
FROM hire_jobs
WHERE budget_min IS NOT NULL AND budget_min <> trunc(budget_min);
```

Recommended fix: define whether amounts are minor units or whole currency units, report all fractional rows, archive affected IDs/old values, and convert only after approval. Never use a silent rounding conversion for financial data.

## DB-005 — Missing database checks for important invariants

Severity: High  
Confidence: High

Examples from `prisma/schema.prisma`: `Payment.amount`, fee fields, wallet balances, `ProjectMilestone.amount`, `User.averageRating`, `User.reviewCount`, progress fields, and numerous status strings.

Safe verification:

```sql
SELECT id, amount FROM "Payment" WHERE amount < 0;
SELECT id, "averageRating" FROM "User" WHERE "averageRating" < 0 OR "averageRating" > 5;
SELECT id, progress FROM "ProjectTracking" WHERE progress < 0 OR progress > 100;
SELECT id, rating FROM "ProjectReview" WHERE rating < 1 OR rating > 5;
SELECT status, count(*) FROM "Payment" GROUP BY status ORDER BY status;
```

Recommended fix: add checks such as non-negative amounts and `progress BETWEEN 0 AND 100`; add lifecycle checks/reference tables after enumerating all legitimate values. Keep application validation too.

## DB-006 — Non-atomic project workflow writes

Severity: High  
Confidence: Medium

Location: `app/api/portal/project-actions/route.ts`, especially state update followed by `event()` and notifications.

Problem: A project update, timeline event, notifications, and realtime emission are commonly separate operations. Some payment paths use a transaction, but the general workflow does not.

How to verify: inject a failure after the project update in a disposable environment, then inspect whether the event and notification exist.

Recommended fix: transactionally write the authoritative state and an outbox/event row; deliver notifications asynchronously and idempotently. Use conditional `UPDATE ... WHERE status = old_status` for concurrent transitions.

## DB-007 — Multiple primary saved locations are possible

Severity: Medium  
Confidence: High

Safe verification:

```sql
SELECT "clientProfileId", count(*) AS primary_count
FROM "ClientSavedLocation"
WHERE "isPrimary" = true
GROUP BY "clientProfileId"
HAVING count(*) > 1;
```

Proposed SQL for a future migration, after cleanup:

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ClientSavedLocation_one_primary_idx"
ON "ClientSavedLocation" ("clientProfileId")
WHERE "isPrimary" = true;
```

Risk: concurrent index creation is safer for production but cannot run inside a transaction and still consumes resources.

## DB-008 — Relationship columns without declared relationships

`Service.categoryId` has no relation to `ServiceCategory`; `DirectHireNegotiation` has free-form job/contract/user IDs; and multiple project child tables have no Prisma relation. This prevents database-enforced ownership and makes safe cascades impossible. Confirm intended legacy boundaries before adding FKs, especially where `Hire*` IDs are `String` while the main `User` IDs are `Int`.

## DB-009 — Long-lived, non-revocable sessions

`src/lib/auth.ts` creates HS256 tokens with a seven-day expiry and no session table or revocation check. This is not proof of a breach, but it is a confirmed limitation: logout only clears the browser cookie and cannot invalidate a copied token. Use short-lived access tokens plus rotating/revocable sessions for sensitive financial/admin actions.

## DB-010 — Unsafe raw SQL maintenance scripts

The application wallet query uses parameterized `Prisma.sql`; no application SQL injection was confirmed. The two maintenance scripts use `$executeRawUnsafe`, which is unnecessary for fixed migration statements and creates a future footgun. Keep these scripts behind explicit environment checks and replace with migrations or parameterized raw calls.

## DB-011 — Typecheck is currently red

`npm run typecheck` completed with errors: `vitest` could not be resolved from two test files and `@types/nodemailer` was missing. This blocks reliable verification of generated database types and database tests. `npx prisma validate` passed.

## DB-012 — Free-form lifecycle fields

`status`, `type`, `role`, `kind`, `provider`, `currency`, and similar fields remain strings in many models. This is a drift risk rather than a confirmed bad row. Prefer database checks or lookup tables for externally written data.

## DB-013 — Retention and growth

Audit logs, webhook events, OTP codes, messages, uploads, and timeline events are append-heavy. No retention/partitioning policy was found in the repository. Needs verification against operational requirements.

## Security Findings

- Confirmed: unverified email login receives a normal session cookie (DB-002).
- Confirmed limitation: copied JWTs are not server-revocable before seven-day expiry (DB-009).
- No hard-coded secret values were included in this report; `.env` contains secret-bearing variable names and is not treated as report evidence of exposure.
- No Supabase client, RLS SQL, storage policy SQL, or `SECURITY DEFINER` function was found in the repository. Deployed Supabase Data API grants, RLS state, storage policies, and database roles are **Needs verification**.
- Application routes generally scope portal reads/writes by `session.userId`; no confirmed IDOR was established from the reviewed routes. Test both client and professional identities against every ID-based endpoint.
- No confirmed SQL injection was found in application code. `$executeRawUnsafe` remains a maintenance-script risk.

## Data Integrity Findings

The strongest confirmed risks are missing FKs, absent checks, and duplicate-primary-location possibility. Run the queries in “Safe Verification Queries” before proposing cleanup. Do not infer orphan/duplicate counts from code alone.

## Performance Findings

- Existing useful indexes include user ownership indexes, `ProjectTimelineEvent(trackingId, createdAt)`, and payment/provider uniqueness indexes.
- Candidate composite indexes: `ProjectMilestone(trackingId, status, createdAt)` for active/next milestone queries; `ProjectWorkUpload(trackingId, milestoneId, createdAt)` for project file history; `OtpCode(phone, role, consumedAt, expiresAt)` if verification queries filter all four fields.
- Existing single-column indexes should be checked for actual usage before removal; no live `pg_stat_user_indexes` evidence was available.
- Portal project reads use bounded child queries but perform multiple round trips; an outbox/transaction design should preserve correctness before optimizing.

## Schema Design Findings

- The design mixes PascalCase table names, snake_case mapped tables, and legacy string-ID tables. This is workable but increases migration and query drift risk.
- JSON stored as `String` (`sections`, attachment/file metadata, profile arrays) prevents JSON validation and efficient querying. Use `Json`/`JSONB` where querying or validation is required.
- Financial amounts are integers, which is appropriate only if they consistently represent the smallest currency unit; document and enforce that convention.
- `ClientProfile.userId` is not unique, although the application appears to assume one profile per user. Verify duplicates before adding a unique constraint.

## Migration Findings

- `0_init` is empty and is the highest-risk migration issue.
- Several migrations contain data updates and `ALTER TABLE` operations without explicit preflight checks or rollback strategy.
- `202608200005_integer_money_fields` can change values through rounding.
- `202608220001_saved_location_primary` backfills a primary but does not enforce uniqueness.
- `202608170002_add_service_category_parent` uses `ON DELETE CASCADE` for a hierarchy; verify that deleting a parent is intended to delete all descendants and dependent business references.

## Application/Database Mismatches

- Prisma schema validation passes, but migration reproducibility is not established because the baseline is empty.
- Application and database statuses are mostly strings; mismatches can be stored without a database error.
- `Service.categoryId` is required in the model but has no database relation.
- Generated Prisma output exists, but full type verification is blocked by the current TypeScript errors.
- Docs describe Supabase/PostGIS concepts, but the active implementation uses Prisma/PostgreSQL scalar latitude/longitude fields and no checked-in Supabase/PostGIS migration. Treat those docs as architectural intent, not deployed-schema evidence.

## Recommended Indexes

| Table                 | Columns                              | Type                  | Query Benefited                        | Priority | Tradeoff                                         |
| --------------------- | ------------------------------------ | --------------------- | -------------------------------------- | -------- | ------------------------------------------------ |
| `ProjectMilestone`    | `trackingId, status, createdAt`      | B-tree                | Find active/next milestone per project | Medium   | Extra write/storage cost; validate with EXPLAIN  |
| `ProjectWorkUpload`   | `trackingId, milestoneId, createdAt` | B-tree                | Project/milestone upload history       | Medium   | More index maintenance                           |
| `ClientSavedLocation` | `clientProfileId` WHERE `isPrimary`  | Unique partial B-tree | Enforce one primary location           | High     | Requires duplicate cleanup first                 |
| `OtpCode`             | `phone, role, consumedAt, expiresAt` | B-tree                | OTP lookup/expiry filtering            | Low      | May overlap existing indexes; inspect live usage |

## Missing Constraints

Prioritized candidates:

- FKs for project, payment, invoice, dispute, withdrawal, service-category, and user ownership IDs.
- `CHECK` for non-negative monetary values, balances, fees, `progress` 0–100, ratings 1–5, and non-negative counters.
- Unique partial index for one primary saved location per profile.
- Unique `ClientProfile.userId` if one profile per user is the invariant.
- Checks or lookup tables for status/type/provider/currency values.
- Consider `CHECK (budgetMin <= budgetMax)` and date ordering where both values exist.

## RLS / Authorization Matrix

No checked-in Supabase/RLS artifacts were found. This matrix is therefore a deployment verification checklist, not a claim about current live state.

| Table                             | RLS Enabled        | SELECT             | INSERT             | UPDATE             | DELETE             | Problem                                                                              |
| --------------------------------- | ------------------ | ------------------ | ------------------ | ------------------ | ------------------ | ------------------------------------------------------------------------------------ |
| Public/exposed application tables | Needs verification | Needs verification | Needs verification | Needs verification | Needs verification | Confirm RLS, grants, and policies in the deployed Supabase project                   |
| Storage objects/buckets           | Needs verification | Needs verification | Needs verification | Needs verification | Needs verification | Confirm private buckets and owner/project policy                                     |
| `auth.users` relationships        | Needs verification | N/A                | N/A                | N/A                | N/A                | Repository uses custom `User`/JWT auth rather than visible Supabase Auth integration |

## Safe Verification Queries

All queries below are read-only. Replace table names only after confirming the deployed naming/casing.

```sql
-- Tables, columns, nullability, defaults
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Constraints and indexes
SELECT conrelid::regclass AS table_name, conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY 1, 2;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Orphan and invariant checks
SELECT p.id FROM "Payment" p LEFT JOIN "User" u ON u.id=p."clientId" WHERE u.id IS NULL;
SELECT "clientProfileId", count(*) FROM "ClientSavedLocation" WHERE "isPrimary" GROUP BY "clientProfileId" HAVING count(*) > 1;
SELECT id FROM "ProjectTracking" WHERE progress NOT BETWEEN 0 AND 100;
SELECT id FROM "ProjectReview" WHERE rating NOT BETWEEN 1 AND 5;
SELECT id FROM "Payment" WHERE amount < 0 OR "professionalPayoutAmount" < 0 OR "adminNetAmount" < 0;

-- Migration state
SELECT migration_name, started_at, finished_at, rolled_back_at, logs
FROM "_prisma_migrations"
ORDER BY started_at;

-- Index usage (do not drop based on this alone; reset/restart history affects results)
SELECT schemaname, relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

-- RLS/policy inventory for Supabase/PostgreSQL
SELECT n.nspname AS schema_name, c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind='r' AND n.nspname='public'
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, policyname;
```

## Recommended Fix Order

### Fix Immediately

- Repair the migration baseline/reproducibility process before any new deployment.
- Stop issuing normal sessions to unverified users.
- Inventory and protect payment/project relationships; run orphan queries first.

### Fix Before Next Release

- Replace silent money rounding with an approved, auditable conversion.
- Add transactional state/outbox handling for project workflows.
- Add checks and FKs after data preflight; verify Supabase RLS/grants in the deployed project.

### Schedule

- Enforce one primary saved location and one client profile per user where confirmed.
- Improve session revocation/rotation and status centralization.
- Add targeted composite indexes based on `EXPLAIN (ANALYZE, BUFFERS)` in staging.

### Cleanup

- Remove or isolate unsafe maintenance scripts.
- Define retention/archival for append-heavy tables.
- Standardize naming and replace queryable stringified JSON with JSONB.

## Database Scorecard

| Category          | Score /10 | Basis                                                                                     |
| ----------------- | --------- | ----------------------------------------------------------------------------------------- |
| Security          | 5         | Good route scoping evidence, but verification bypass/session revocation weakness          |
| Data integrity    | 3         | Core relationship FKs and invariant checks are incomplete                                 |
| Schema quality    | 5         | Broad model coverage, but mixed conventions and free-form lifecycles                      |
| Query performance | 6         | Several useful indexes and bounded reads; live plans unavailable                          |
| Indexing          | 6         | Ownership indexes are present; composite/partial opportunities remain                     |
| Migrations        | 2         | Empty baseline and risky conversion are major concerns                                    |
| Authorization     | 5         | Most reviewed routes scope by user ID; RLS/deployed grants unknown                        |
| Maintainability   | 5         | Prisma centralizes access, but typecheck and migration reproducibility are currently weak |

Overall score: **4.6/10**
