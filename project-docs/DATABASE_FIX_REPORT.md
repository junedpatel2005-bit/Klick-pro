# Database Fix Report

## Executive Status

Overall status: **READY FOR STAGING VERIFICATION**

Repository code and migration artifacts validate locally. Production readiness is not claimed because no live-data preflight or disposable PostgreSQL `migrate deploy` run has been performed.

## Status Matrix

| ID         | Issue                       | Implementation                                                | Tests                       | Live DB Verification      | Final Status |
| ---------- | --------------------------- | ------------------------------------------------------------- | --------------------------- | ------------------------- | ------------ |
| DB-001     | Empty migration baseline    | Diagnostics added; baseline not rewritten                     | N/A                         | Required                  | NOT FIXED    |
| DB-002     | Unverified login session    | Normal session withheld; current user checked from DB         | 4 focused tests             | N/A for code fix          | FIXED        |
| DB-003/008 | Missing core relationships  | Prisma relations and guarded forward migration added          | Prisma validation           | Required before deploy    | IMPLEMENTED  |
| DB-004     | Historical money conversion | Diagnostics added; historical migration unchanged             | N/A                         | Required                  | NOT FIXED    |
| DB-005     | Missing CHECK constraints   | Guarded CHECK constraints added                               | Disposable DB test required | Required                  | IMPLEMENTED  |
| DB-006     | Non-atomic workflow writes  | Race-safe transitions improved; full outbox atomicity remains | Pending integration tests   | Required                  | PARTIAL      |
| DB-007     | Multiple primary locations  | Guarded partial unique index added                            | Disposable DB test required | Required                  | IMPLEMENTED  |
| DB-009     | Non-revocable JWT           | Current user/activity/role checks added                       | Session tests               | Required for deployment   | PARTIAL      |
| DB-010     | Unsafe raw SQL              | Unsafe repository-owned calls removed                         | Typecheck/lint              | N/A                       | IMPLEMENTED  |
| DB-011     | Broken validation setup     | Dependencies/tooling repaired                                 | Full suite passes           | N/A                       | FIXED        |
| DB-012     | Free-form lifecycle fields  | Inventory and policy document added                           | N/A                         | Status inventory required | PARTIAL      |

## Newly Fixed

- DB-002: registration and email/phone login no longer issue `servio_session` before email verification. Session validation rejects missing/inactive users and uses the current database role.
- DB-011: Prisma, TypeScript, tests, lint, and build tooling now run successfully.
- Project start, completion request, and completion confirmation now use expected-state updates and return HTTP 409 on races.

## Implemented but Not Deployed

- `202608310001_database_integrity_guards` adds supported project/payment/service FKs, non-negative/range/order CHECK constraints, one-primary-location uniqueness, and one-profile-per-user uniqueness.
- The migration aborts with `MIGRATION REQUIRES CLEAN PREFLIGHT` on orphan, duplicate, or CHECK violations. It does not delete, update, round, merge, or backfill rows.
- Prisma relation declarations match the added FK targets and use `RESTRICT` for historical/financial relationships.

## Needs Live Database Verification

- Whether `0_init` is recorded in deployed environments and what schema exists.
- Relationship orphan queries, duplicate checks, money-conversion diagnostics, and CHECK preflights in [check-database-baseline.sql](D:/new/scripts/check-database-baseline.sql).
- Whether nullable `budgetMin`/`budgetMax` semantics are correct. The CHECK rejects ordering violations only when both values exist.
- Whether exactly one `ClientProfile` per `User` is true for all data.
- Supabase/PostgreSQL RLS, grants, storage policies, and roles.
- Disposable empty-database migration reconstruction.

## Remaining Engineering Work

- Complete the project workflow transaction/outbox design so state, timeline, and durable event writes commit together; deliver external notifications after commit.
- Add disposable-PostgreSQL integration tests for FK/CHECK/UNIQUE rejection and transaction rollback.
- Design server-side revocable sessions separately; copied JWTs remain valid until expiry.
- Decide stable status enforcement from [STATUS_POLICY.md](D:/new/STATUS_POLICY.md) after live-value review.
- Validate the migration baseline strategy without modifying deployed history.

## Migration Review

| Constraint                                                  | Table                                                     | Purpose                                 | Preflight                         | Deployment Risk                     | Status                                   |
| ----------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------- | --------------------------------- | ----------------------------------- | ---------------------------------------- |
| `Payment_clientId_fkey`                                     | `Payment.clientId`                                        | `User.id` reference                     | Payment client orphan query       | ALTER TABLE lock; RESTRICT          | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `Payment_professionalId_fkey`                               | `Payment.professionalId`                                  | `User.id` reference                     | Payment professional orphan query | ALTER TABLE lock; RESTRICT          | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `Payment_jobId_fkey`                                        | `Payment.jobId`                                           | Optional `ClientJob.id` reference       | Payment job orphan query          | Lock; nullable                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `Payment_projectTrackingId_fkey`                            | `Payment.projectTrackingId`                               | Optional `ProjectTracking.id` reference | Payment tracking orphan query     | Lock; nullable                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectRequest_*_fkey`                                     | `ProjectRequest.jobId/clientId/professionalId`            | ClientJob/User references               | Request orphan queries            | Lock; RESTRICT                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectTracking_*_fkey`                                    | `ProjectTracking.requestId/jobId/clientId/professionalId` | Request/ClientJob/User references       | Tracking orphan queries           | Lock; RESTRICT                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectMilestone_trackingId_fkey`                          | `ProjectMilestone.trackingId`                             | ProjectTracking reference               | Milestone orphan query            | Lock; history preserved             | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectTimelineEvent_trackingId_fkey`                      | `ProjectTimelineEvent.trackingId`                         | ProjectTracking reference               | Timeline orphan query             | Lock; RESTRICT                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectWorkUpload_*_fkey`                                  | `ProjectWorkUpload.trackingId/milestoneId`                | Tracking/Milestone references           | Upload orphan queries             | Lock; RESTRICT                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `Service_categoryId_fkey`                                   | `Service.categoryId`                                      | ServiceCategory reference               | Service category orphan query     | Lock; RESTRICT                      | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `Payment_*_nonnegative`                                     | Payment amount/fee/payout columns                         | Reject negative financial values        | Payment CHECK query               | Table lock; no rewrite              | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectTracking_progress_check`                            | `ProjectTracking.progress`                                | Enforce 0–100                           | Progress CHECK query              | Table lock                          | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ProjectReview_rating_check`                                | `ProjectReview.rating`                                    | Enforce 1–5                             | Rating CHECK query                | Table lock                          | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `User_averageRating_check` / `User_reviewCount_nonnegative` | User aggregates                                           | Enforce ranges                          | User CHECK query                  | Table lock                          | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ClientJob_budget_order_check`                              | `ClientJob.budgetMin/budgetMax`                           | Reject min > max; NULL allowed          | Budget CHECK query                | Table lock                          | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ClientSavedLocation_one_primary_idx`                       | `ClientSavedLocation.clientProfileId`                     | At most one primary                     | Duplicate-primary query           | Unique index build resources        | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |
| `ClientProfile_userId_key`                                  | `ClientProfile.userId`                                    | One profile per user                    | Duplicate-profile query           | Unique index; semantic confirmation | IMPLEMENTED — NEEDS LIVE DB VERIFICATION |

Safety review: no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE`, `UPDATE`, rounding, or silent repair exists in the new migration. It uses `RESTRICT`, not `CASCADE`, for new historical/financial relationships. CHECK NULL semantics are intentional: nullable budget fields remain nullable.

## Tests Added

- `src/lib/auth.test.ts`: current-role, unverified, disabled, and deleted-user session cases.
- Existing suite: 12 tests across 3 files pass.
- Database constraint, outbox, and transaction integration tests remain pending without disposable PostgreSQL.

## Validation Results

- `npx prisma format` — **PASS**
- `npx prisma validate` — **PASS**
- `npx prisma generate` — **PASS**
- `npm run typecheck` — **PASS**
- `npm test -- --run` — **PASS** (12 tests)
- `npm run lint` — **PASS WITH WARNINGS** (6 warnings)
- `npm run build` — **PASS**
- Disposable `npx prisma migrate deploy` — **NOT AVAILABLE**

## Lint Warnings

Six existing React hook warnings remain: one each in `JobsPreviewMap.tsx`, `ProfessionalDiscoveryMap.tsx`, and `ProfessionalsPreviewMap.tsx`, plus three in `ProfessionalJobsMap.tsx`. No lint errors remain.

## Deployment Risks

- Empty `0_init` means clean reconstruction through `migrate deploy` is not established.
- The new migration intentionally fails on dirty data and can take table/unique-index locks.
- `RESTRICT` may make parent deletion fail where historical children exist.
- Copied stateless JWTs remain usable until expiry.
- Full workflow event atomicity is incomplete.

## Production Deployment Order

1. Review code and migration diffs.
2. Run the read-only preflight and archive results.
3. Confirm deployed `_prisma_migrations` and schema state; do not rewrite `0_init`.
4. Restore a production backup into disposable PostgreSQL.
5. Resolve violations only through separately approved data work.
6. Run `npx prisma migrate deploy` on disposable PostgreSQL and smoke-test the application.
7. Review locks and integration-test constraints.
8. Schedule production deployment with backup, monitoring, and rollback approval.
9. Apply the forward migration through canonical Prisma deployment.
10. Rerun diagnostics and authorization checks for client, professional, admin, unverified, disabled, and deleted users.

## Rollback / Restore Plan

- Never edit `_prisma_migrations` or rewrite deployed migration files manually.
- If preflight fails, stop and investigate; do not delete, merge, or round rows automatically.
- If deployment is unacceptable, stop rollout and restore the verified pre-deployment backup using the provider’s tested procedure.
- For code-only auth rollback, deploy the previous immutable application release; retain the database migration unless a tested reverse migration exists.
