# Full Project Audit

## Executive Summary

Overall status: **CRITICAL**

The repository is a strict TypeScript Next.js application using PostgreSQL through Prisma 7 and a `pg` adapter. Static validation is healthy, but production readiness is blocked by the empty initial migration, an unverified migration chain, financial side effects that are not atomic, and missing live verification of database constraints/RLS. Authentication has improved and inactive users are checked during session verification, but sessions remain long-lived and stateless. No production data was changed and no live database was contacted.

Critical: 1 confirmed migration-chain blocker.
High: financial atomicity, migration/integrity deployment, session revocation, test and production-verification gaps.
Medium: webhook ordering, CSP hardening, upload lifecycle, CI coverage, query/index review, maintainability.
Low: lint warnings and minor typing/abstraction cleanup.
Needs Verification: deployed schema, migration history, RLS/grants, orphan/duplicate rows, EXPLAIN plans, backup/restore and runtime proxy compatibility.
Optimization Opportunities: durable outbox/queue, conditional state transitions, pagination/index review, centralized request schemas and service boundaries.

## Overall Score

Security: 6/10  
Authentication: 6/10  
Authorization: 7/10  
Database Integrity: 4/10  
Migrations: 2/10  
Code Quality: 7/10  
Type Safety: 8/10  
API Design: 6/10  
Transactions: 4/10  
Performance: 6/10  
Testing: 4/10  
Production Readiness: 3/10

Overall: 5/10

## Repository Discovery

| Concern            | Finding                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Framework/runtime  | Next.js 16.3.0, App Router, Node.js route handlers, custom `server.mjs`; TypeScript strict mode                      |
| Package manager    | npm; `package-lock.json`; Node 22 in CI                                                                              |
| Database/ORM       | PostgreSQL; Prisma 7.9.1 with `@prisma/adapter-pg`; roughly 60 models                                                |
| Authentication     | Custom HS256 JWT in an HttpOnly cookie; email/password, email verification, phone OTP, Google and admin flows        |
| APIs               | Next route handlers under `app/api`; Socket.IO realtime integration                                                  |
| Storage            | Local development provider; S3-compatible provider for production; private file routes                               |
| Integrations       | Razorpay, Persona, SMTP/Nodemailer, Twilio Verify, Google Maps, Sentry configuration                                 |
| Jobs/events        | In-process background executor, database notification/audit records, realtime emits; no durable outbox identified    |
| Deployment         | Vercel documentation/config plus `.vercel`/Cloudflare-related repository files; deployment target must be reconciled |
| Tests/tooling      | Vitest, ESLint, TypeScript, Next production build; one GitHub Actions quality workflow                               |
| Migration strategy | `prisma migrate deploy`; `prisma/migrations/0_init` is empty and later migrations assume an existing schema          |

## Issue Table

| ID       | Severity | Area                | File/Table                                          | Issue                                                                                                 | Confidence | Status                  |
| -------- | -------- | ------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | ----------------------- |
| MIG-001  | CRITICAL | Migrations          | `prisma/migrations/0_init/migration.sql`            | Empty baseline cannot reproduce the schema from a fresh database                                      | HIGH       | CONFIRMED               |
| FIN-001  | HIGH     | Financial integrity | `app/api/webhooks/razorpay/route.ts`                | Payment and wallet updates are separate writes after event recording                                  | HIGH       | CONFIRMED               |
| DB-001   | HIGH     | Database integrity  | `prisma/schema.prisma`, pending integrity migration | Core relation/constraint guards exist only in an unapplied migration                                  | HIGH       | CONFIRMED               |
| AUTH-001 | HIGH     | Authentication      | `src/lib/auth.ts`                                   | Seven-day stateless sessions have no server-side revocation/version check                             | HIGH       | CONFIRMED               |
| MIG-002  | HIGH     | Migrations/money    | `202608200005_integer_money_fields/migration.sql`   | Historical amount conversion uses `ROUND()` and needs reconciliation evidence                         | HIGH       | CONFIRMED               |
| TEST-001 | HIGH     | Testing             | `tests`, `src/**/*.test.ts`                         | No live-schema, IDOR, financial transaction, webhook replay, or concurrency suite                     | HIGH       | CONFIRMED               |
| SUPA-001 | HIGH     | Supabase/RLS        | `supabase/`, deployed database                      | Repository has no RLS/policy artifacts to verify deployed access controls                             | HIGH       | NEEDS LIVE VERIFICATION |
| API-001  | MEDIUM   | Webhooks            | Razorpay/Persona webhook handlers                   | Razorpay has no timestamp check; Persona stores event before business update                          | HIGH       | CONFIRMED               |
| SEC-001  | MEDIUM   | Security headers    | `next.config.ts`                                    | CSP permits `unsafe-inline` and development permits `unsafe-eval`                                     | HIGH       | CONFIRMED               |
| API-002  | MEDIUM   | APIs                | route handlers                                      | Broad surface has inconsistent error DTOs and limited schema validation                               | MEDIUM     | LIKELY                  |
| FILE-001 | MEDIUM   | Uploads             | `src/lib/project-file-storage.ts`, upload routes    | Storage/database cleanup and file lifecycle are not durable or fully transactional                    | HIGH       | CONFIRMED               |
| TRAN-001 | HIGH     | Transactions/events | project action routes and notification helpers      | Multi-step business transitions can leave state, timeline, audit, and notification records split      | HIGH       | LIKELY                  |
| CON-001  | HIGH     | Concurrency         | OTP and project/payment transitions                 | Several read-then-write paths need conditional-update or lock verification                            | MEDIUM     | LIKELY                  |
| PERF-001 | MEDIUM   | Performance         | project/timeline and marketplace routes             | Potential repeated child queries and unbounded list patterns need query-plan review                   | MEDIUM     | NEEDS LIVE VERIFICATION |
| OPS-001  | MEDIUM   | CI/deployment       | `.github/workflows/quality.yml`, `DEPLOY.md`        | CI omits Prisma/migration/security checks and deployment docs omit restore/rollback/health procedures | HIGH       | CONFIRMED               |
| CODE-001 | LOW      | Maintainability     | route handlers and map components                   | Business orchestration remains concentrated in handlers; six lint warnings remain                     | HIGH       | CONFIRMED               |

## Issue Details

### MIG-001 — Empty baseline migration

Severity: CRITICAL  
Confidence: HIGH  
Status: CONFIRMED

Location: `prisma/migrations/0_init/migration.sql`; all later migration files.

Problem: The first migration is empty while later migrations alter/create objects that are not created by the repository migration chain.

Evidence: Static inspection found a zero-byte baseline and later migrations referring to the application schema. `npx prisma validate` does not prove fresh-database replay.

Why it matters: A new environment cannot be deterministically provisioned from source control.

Production impact: Failed deploys, schema drift, data loss during emergency rebuilds, and inability to reproduce production safely.

Exploit/failure scenario: `npx prisma migrate deploy` on an empty PostgreSQL database applies the empty baseline and then fails when later statements reference missing tables.

How to verify: Run the migration chain against a disposable production-like PostgreSQL database.

Safe verification query/command: `npx prisma migrate deploy` against a disposable database with no application data.

Recommended fix: Reconstruct and review a complete baseline or provide a documented bootstrap migration, then replay every migration on a disposable database.

Suggested code/SQL: Generate a reviewed schema baseline from the intended schema and retain later migrations as a linear, replay-tested chain. Do not edit a deployed history without an approved migration policy.

Risk of fix: Baseline reconstruction can differ from deployed schema and may require a controlled cutover.

Testing required: Fresh install, upgrade from a representative snapshot, and rollback/restore rehearsal.

Deployment considerations: Take a backup, use a maintenance window if required, and record applied migration hashes.

### FIN-001 — Non-atomic payment and wallet side effects

Severity: HIGH  
Confidence: HIGH  
Status: CONFIRMED

Location: `app/api/webhooks/razorpay/route.ts`, `Payment`, `WalletTransaction`.

Problem: The webhook event is recorded, then payment and wallet updates happen in separate database calls. A failure between them returns an error after the event is already present; a retry is treated as a duplicate and will not repair the missing side effect.

Evidence: `razorpayWebhookEvent.create` precedes `payment.updateMany` and `walletTransaction.updateMany`; duplicate event IDs return success immediately.

Why it matters: Payment state and ledger state can disagree.

Production impact: Incorrect balances, unreconciled failed deposits, and manual financial repair.

Exploit/failure scenario: The payment update succeeds and wallet update times out; the provider retries, duplicate detection returns `{received:true}`, leaving the wallet pending.

How to verify: Inject a failure between the two writes in a disposable environment and inspect both records.

Safe verification query/command: Use the read-only script sections for payment, wallet, and webhook inventories; no production mutation.

Recommended fix: Make the durable event ledger and all local financial updates one database transaction, with a retryable processing state or reconciliation job.

Suggested code/SQL: Use `db.$transaction` for local writes; process a unique event record with a status/processed timestamp and retry unprocessed events.

Risk of fix: Long transactions and duplicate provider events require careful isolation and idempotent transitions.

Testing required: duplicate, out-of-order, partial-failure, and concurrent webhook tests.

Deployment considerations: Reconcile existing pending records before enabling the new processor.

### DB-001 — Integrity guards are not deployed

Severity: HIGH  
Confidence: HIGH  
Status: CONFIRMED

Location: `prisma/schema.prisma`; `202608310001_database_integrity_guards/migration.sql`.

Problem: The schema now describes important relations and checks, but the migration that adds foreign keys, uniqueness, and checks is only a repository artifact until deployed.

Evidence: The migration contains preflight checks and adds guards; no live database verification was available.

Why it matters: Application-level assumptions remain unenforced in the actual database.

Production impact: Orphans, duplicate profiles/primary locations, invalid money/progress/rating values, and inconsistent ownership.

Exploit/failure scenario: A concurrent request bypasses an application check and inserts a duplicate or invalid row before the guard exists.

How to verify: Inspect `_prisma_migrations`, `pg_constraint`, indexes, and orphan queries on the target database.

Safe verification query/command: `scripts/full-database-audit.sql`.

Recommended fix: Run the guarded migration only after its preflight is clean and after disposable-database replay.

Suggested code/SQL: Use the existing reviewed migration as the starting point; do not skip its preflight.

Risk of fix: Constraint creation can fail or lock tables when existing data violates assumptions.

Testing required: Preflight against a sanitized production snapshot and concurrent insert tests.

Deployment considerations: Schedule, monitor locks, and have a backup/restore plan.

### AUTH-001 — Stateless sessions are not revocable

Severity: HIGH  
Confidence: HIGH  
Status: CONFIRMED

Location: `src/lib/auth.ts`, session cookie configuration.

Problem: Normal sessions last seven days and are validated cryptographically plus against current user status, but there is no session record, token version, password-change invalidation, or explicit logout revocation.

Evidence: `verifySession` verifies the JWT and user active/verification fields; logout can clear the browser cookie but cannot invalidate a copied token.

Why it matters: A stolen token remains usable until expiry or account deactivation.

Production impact: Extended unauthorized access after cookie theft.

Exploit/failure scenario: An attacker replays an exfiltrated token from another device after the legitimate user logs out.

How to verify: Capture a token in a disposable environment, clear the client cookie, and test whether the token remains accepted.

Safe verification query/command: Existing auth tests plus a disposable integration test; no production access.

Recommended fix: Add a session identifier/version checked server-side, shorten access-token lifetime, and rotate/revoke on logout and credential changes.

Suggested code/SQL: Add a `sessionVersion` or session table and include a revocation check in `verifySession`.

Risk of fix: Every authenticated request gains a database/cache lookup and requires expiry/revocation cleanup.

Testing required: logout, password reset, role change, deactivation, and concurrent session tests.

Deployment considerations: Coordinate cookie/token format rotation and invalidate legacy tokens if needed.

### MIG-002 — Rounded historical money conversion

Severity: HIGH  
Confidence: HIGH  
Status: CONFIRMED

Location: `prisma/migrations/202608200005_integer_money_fields/migration.sql`.

Problem: The historical conversion uses `ROUND()` to move money values to integer minor units. The repository does not establish that all source values were already exact minor-unit values or provide a reconciliation ledger.

Evidence: The migration contains `ROUND()` conversions for financial columns.

Why it matters: Rounding silently changes balances, fees, payouts, or invoice totals.

Production impact: Financial discrepancies and audit disputes.

Exploit/failure scenario: A fractional source amount is rounded differently from an external provider’s amount, causing a payout or balance mismatch.

How to verify: Run fractional-value diagnostics on a pre-migration snapshot and reconcile each affected financial column.

Safe verification query/command: The money diagnostics in `scripts/check-database-baseline.sql` and `scripts/full-database-audit.sql`.

Recommended fix: Prove the unit convention, reject unexpected fractions, and produce an auditable conversion report before applying.

Suggested code/SQL: Use preflight counts/sums and an explicit approved rounding policy; never silently round unknown financial data.

Risk of fix: A corrected conversion may require compensating entries rather than in-place changes.

Testing required: Exact-sum, fee, refund, payout, and boundary-value tests.

Deployment considerations: Backup, reconciliation sign-off, and post-deploy aggregate comparison.

### TEST-001 — Critical behavior lacks integration coverage

Severity: HIGH  
Confidence: HIGH  
Status: CONFIRMED

Location: `src/**/*.test.ts`, `tests/`, Prisma migrations and API routes.

Problem: The runnable suite contains 12 tests in three files, but no disposable PostgreSQL migration test, RLS test, cross-user authorization matrix, financial atomicity test, webhook replay test, upload lifecycle test, or concurrency test was identified.

Evidence: `npm test -- --run` passed 12 tests; repository inspection found no equivalent integration harness.

Why it matters: Passing unit tests does not establish production correctness for database and external-event behavior.

Production impact: Regressions can reach production undetected.

Exploit/failure scenario: A route passes mocked auth tests while an IDOR or missing foreign key only appears with real rows and relationships.

How to verify: Inventory test files and add a disposable database CI job.

Safe verification query/command: `npm test -- --run`; use a separately provisioned disposable database for integration tests.

Recommended fix: Add focused integration tests for authz/IDOR, migrations, constraints, money, webhooks, uploads, and conditional transitions.

Suggested code/SQL: Seed two users and related objects, then assert every ID-bearing route rejects the other user’s objects.

Risk of fix: Integration tests add setup time and require isolated credentials/data.

Testing required: All scenarios listed above, including failure injection.

Deployment considerations: Keep test databases disposable and never point CI at production.

### SUPA-001 — RLS and deployed policy state unavailable

Severity: HIGH  
Confidence: HIGH  
Status: NEEDS LIVE VERIFICATION

Location: `supabase/` repository artifacts and deployed PostgreSQL/Supabase project.

Problem: No repository SQL/policy artifacts were available to prove RLS, grants, Storage policies, Realtime access, or `SECURITY DEFINER` posture.

Evidence: Static repository review found no usable Supabase policy/configuration set; application docs mention Supabase-related deployment concerns.

Why it matters: A correct application authorization check does not compensate for an exposed table, bucket, RPC, or broad anon/authenticated grant.

Production impact: Cross-tenant data access or direct API bypass of route authorization.

Exploit/failure scenario: A client calls a generated data endpoint or Storage API directly if deployed policies permit broader access than intended.

How to verify: Inspect `pg_class`, `pg_policies`, grants, Storage policies, exposed functions, and Realtime publication membership.

Safe verification query/command: `scripts/full-database-audit.sql` plus Supabase dashboard/CLI inspection.

Recommended fix: Version policy/grant definitions and test them with anon/authenticated/service roles.

Suggested code/SQL: Add reviewed policy artifacts only after the deployed schema and access model are confirmed.

Risk of fix: Tightening policies can break legitimate server integrations.

Testing required: Positive and negative access tests for each table, bucket, RPC, and channel.

Deployment considerations: Coordinate policy changes with service credentials and migrations.

### API-001 — Webhook replay and processing boundaries

Severity: MEDIUM  
Confidence: HIGH  
Status: CONFIRMED

Location: `app/api/webhooks/razorpay/route.ts`; `src/lib/persona.ts`.

Problem: Razorpay signature verification authenticates the raw body but has no provider timestamp/age check. Persona has a timestamp check and idempotency, but event persistence occurs before the business update and malformed JSON is handled by the outer 500 path.

Evidence: Razorpay verification hashes only the raw body; Persona inserts the event, then reads and updates verification.

Why it matters: Replayed valid payloads and transient processing failures require stronger retry semantics.

Production impact: Unnecessary replay processing or permanently recorded-but-unprocessed events.

Exploit/failure scenario: A captured valid Razorpay payload is replayed within the provider’s accepted window or a local DB error occurs after event insertion.

How to verify: Send duplicate/out-of-order signed fixtures and inject failures after event creation.

Safe verification query/command: Use signed fixtures in a disposable environment; inspect webhook event rows with the read-only script.

Recommended fix: Enforce provider-supported age/replay controls, durable processing status, and transactional idempotent handlers.

Suggested code/SQL: Store received/processed/error timestamps and retry only unprocessed events.

Risk of fix: Provider retry behavior and event ordering must be modeled precisely.

Testing required: Duplicate, stale, malformed, out-of-order, and partial-failure fixtures.

Deployment considerations: Do not discard existing unprocessed events during rollout.

### SEC-001 — CSP permits inline script execution

Severity: MEDIUM  
Confidence: HIGH  
Status: CONFIRMED

Location: `next.config.ts` headers.

Problem: The Content Security Policy includes `script-src 'self' 'unsafe-inline'`; development additionally permits `unsafe-eval`.

Evidence: Static configuration inspection.

Why it matters: XSS impact is larger when inline script execution is allowed.

Production impact: A separate injection defect has a weaker browser mitigation.

Exploit/failure scenario: User-controlled content reaches an unsafe HTML or script context and executes under the page origin.

How to verify: Inspect response headers in staging and inventory legitimate inline scripts.

Safe verification query/command: `curl -I https://staging.example` after deployment; do not use production mutation.

Recommended fix: Replace inline allowances with nonces/hashes where compatible; keep development policy separate.

Suggested code/SQL: Generate per-request CSP nonces and apply them to approved scripts.

Risk of fix: Third-party maps/payment scripts may require policy adjustments.

Testing required: Auth, payment, maps, and browser smoke tests with CSP reporting.

Deployment considerations: Roll out report-only first if operationally appropriate.

### API-002 — Validation and response-shape inconsistency

Severity: MEDIUM  
Confidence: MEDIUM  
Status: LIKELY

Location: Broad `app/api/**/route.ts` surface, especially generic resource/action routes.

Problem: Not every external JSON/webhook response is parsed through a shared schema; handlers use ad hoc `JSON.parse` assertions and return different `{error}`/status conventions.

Evidence: Webhook handlers cast parsed payloads after `JSON.parse`; route inventory contains many independent handlers.

Why it matters: Malformed or unexpected input can reach business logic, and clients cannot rely on a stable error contract.

Production impact: 500s for client errors, inconsistent retries, and harder incident handling.

Exploit/failure scenario: A third-party payload omits a nested field or a client supplies an extreme numeric/string value not constrained by a route schema.

How to verify: Fuzz each route’s body/query/path inputs in a disposable environment.

Safe verification query/command: Static route inventory plus route-level tests; no production fuzzing.

Recommended fix: Centralize Zod-style request/response schemas, length/range limits, and an error DTO.

Suggested code/SQL: Validate before domain service calls and map expected exceptions to documented statuses.

Risk of fix: Tightened validation may reject legacy clients.

Testing required: malformed JSON, missing fields, boundary numbers, oversized strings, and unknown enum values.

Deployment considerations: Version API contracts and monitor rejected requests.

### FILE-001 — Non-durable file lifecycle

Severity: MEDIUM  
Confidence: HIGH  
Status: CONFIRMED

Location: `src/lib/project-file-storage.ts`; `app/api/portal/project-files/route.ts`; verification upload route.

Problem: Uploads write external storage and metadata in separate operations. Cleanup is best-effort, local storage is process/filesystem scoped, and there is no durable orphan reconciliation or malware scanning.

Evidence: The project upload route stores bytes, inserts metadata, and compensates with best-effort deletion on error; verification uploads return a storage URL without a database metadata record.

Why it matters: Metadata and bytes can diverge, and untrusted documents remain a high-risk input.

Production impact: Orphaned private documents, storage leakage through operational mistakes, and unbounded storage cost.

Exploit/failure scenario: The database insert fails after a successful object upload, or a process restart interrupts cleanup.

How to verify: Inject storage/DB failures and compare object inventory to metadata rows.

Safe verification query/command: Query private metadata with `scripts/full-database-audit.sql`; inspect storage inventory using provider read-only tooling.

Recommended fix: Add durable upload state/reconciliation, enforce private access and signed short-lived reads, and scan/quarantine documents.

Suggested code/SQL: Record pending/ready/deleted states and reconcile objects without metadata.

Risk of fix: Quarantine and reconciliation require operational storage tooling.

Testing required: MIME/signature, traversal, overwrite, authorization, failure cleanup, and expiry tests.

Deployment considerations: Production must use S3-compatible storage; local provider is explicitly disabled in production.

### TRAN-001 — Split project workflow side effects

Severity: HIGH  
Confidence: HIGH  
Status: LIKELY

Location: `app/api/portal/project-actions`, project service helpers, notification/audit/realtime helpers.

Problem: Project state transitions, timeline events, audit records, notifications, email, and realtime delivery are not all one atomic unit. In-process background jobs can be lost on process termination.

Evidence: `enqueueBackgroundJob` executes in the current process and logs failures; realtime emits return when no Socket.IO instance exists; route orchestration performs several operations.

Why it matters: Committed business state can lack its operational evidence or user notification.

Production impact: Missing timeline/audit records, stale user interfaces, and support reconciliation work.

Exploit/failure scenario: The request commits, then the process crashes before notification/email execution.

How to verify: Failure-inject after each local write and before each background task.

Safe verification query/command: Read timeline, audit, notification, and state rows after disposable failure tests.

Recommended fix: Keep required local records in a database transaction and use a durable outbox for external delivery/realtime fanout.

Suggested code/SQL: Add an outbox record within the state transaction; workers process it idempotently.

Risk of fix: Requires worker operations, retry/dead-letter policy, and deduplication keys.

Testing required: commit/failure/retry and duplicate delivery tests.

Deployment considerations: Provision worker/cron capacity before enabling outbox-required flows.

### CON-001 — Read-then-write race surfaces

Severity: HIGH  
Confidence: MEDIUM  
Status: LIKELY

Location: OTP verification and project/payment transition handlers.

Problem: Some flows read a current record, check attempts/status, then issue a separate update. Concurrent requests can both pass the check.

Evidence: `verifyPhoneOtp` reads the latest unconsumed record, increments attempts, then later marks it consumed; project/payment handlers contain state checks around writes.

Why it matters: Authentication challenges and financial/state transitions require single-winner semantics.

Production impact: OTP attempt bypass, duplicate transitions, or inconsistent status histories.

Exploit/failure scenario: Two simultaneous correct OTP requests both observe an unconsumed code before either marks it consumed.

How to verify: Run concurrent requests against a disposable database with artificial latency.

Safe verification query/command: Use a concurrency integration test; inspect attempt/consumed fields afterward.

Recommended fix: Use conditional updates (`consumedAt IS NULL`, attempt bounds, expected status) and check affected row count; use a transaction/lock where needed.

Suggested code/SQL: Update the OTP row atomically with its eligibility predicate and consume only the winning row.

Risk of fix: Legitimate retries may receive a conflict response and need client handling.

Testing required: Two-winner, stale-state, duplicate-submit, and retry tests.

Deployment considerations: Confirm isolation level and indexes support the predicate.

### PERF-001 — Query plan and list-bound review required

Severity: MEDIUM  
Confidence: MEDIUM  
Status: NEEDS LIVE VERIFICATION

Location: Marketplace, project tracking, message, notification, and admin list routes.

Problem: Static review shows many list/read surfaces but no production-like `EXPLAIN (ANALYZE, BUFFERS)` evidence. Potential repeated child loads and unbounded `findMany` calls cannot be safely classified without data shape.

Evidence: Route inventory and Prisma usage; no query-plan artifact or representative row counts in the repository.

Why it matters: Correct queries can still become expensive at production cardinality.

Production impact: Latency, connection pool exhaustion, and high database cost.

Exploit/failure scenario: A user-controlled filter causes a large result set and nested relation loading.

How to verify: Capture representative queries and run plans on a sanitized staging copy.

Safe verification query/command: Read-only `EXPLAIN` on staging; inspect `pg_stat_user_indexes` in the SQL script.

Recommended fix: Add explicit page sizes/cursors, select only needed columns, batch children, and add only evidence-backed indexes.

Suggested code/SQL: Candidate indexes are listed below; validate each with `EXPLAIN` before deployment.

Risk of fix: Additional indexes increase write cost and storage.

Testing required: Load tests at expected cardinality and pool limits.

Deployment considerations: Create indexes with an approved low-lock strategy where supported.

### OPS-001 — CI and deployment safety gaps

Severity: MEDIUM  
Confidence: HIGH  
Status: CONFIRMED

Location: `.github/workflows/quality.yml`; `DEPLOY.md`.

Problem: CI runs lint, typecheck, tests, and build but not Prisma validate/generate, fresh migration replay, dependency/security audit, or RLS checks. Deployment documentation contains basic Vercel steps but no backup, restore, health, migration lock, or rollback procedure.

Evidence: Workflow contents and deployment document were inspected directly.

Why it matters: The most important production blocker—the migration chain—is outside the current gate.

Production impact: Broken fresh deployments and unsafe rollback decisions.

Exploit/failure scenario: A pull request passes CI while its migration fails on an empty database.

How to verify: Review workflow logs and run a disposable migration job.

Safe verification query/command: Existing local checks plus `npx prisma migrate deploy` against disposable PostgreSQL.

Recommended fix: Add migration replay, schema validation, dependency audit, and deployment smoke/rollback documentation.

Suggested code/SQL: Add a CI service database job that creates an empty database and applies the complete chain.

Risk of fix: CI duration and PostgreSQL service maintenance increase.

Testing required: Fresh and upgrade migration jobs, health smoke tests, and restore rehearsal.

Deployment considerations: Never run the new disposable check against production credentials.

### CODE-001 — Handler concentration and lint warnings

Severity: LOW  
Confidence: HIGH  
Status: CONFIRMED

Location: project/action handlers; `src/components/JobsPreviewMap.tsx`, `ProfessionalDiscoveryMap.tsx`, `ProfessionalJobsMap.tsx`, `ProfessionalsPreviewMap.tsx`.

Problem: Domain orchestration remains concentrated in route handlers, and lint reports six React Hook dependency warnings.

Evidence: `npm run lint` exited 0 with six warnings, all in map components.

Why it matters: Warnings can conceal stale map state; large handlers are harder to test for authorization and transaction boundaries.

Production impact: Stale UI view state and slower remediation of correctness bugs.

Exploit/failure scenario: A map effect retains an old callback/center and displays or navigates using stale state.

How to verify: Exercise map filters/center changes and inspect handler complexity.

Safe verification query/command: `npm run lint`; component smoke tests.

Recommended fix: Resolve each warning deliberately, extract domain services, and centralize DTO/error handling.

Suggested code/SQL: Include exact hook dependencies or stabilize callbacks with `useCallback`; do not suppress the rule.

Risk of fix: Dependency corrections can change effect timing and map behavior.

Testing required: Map interaction tests and route service unit tests.

Deployment considerations: Low risk; release with normal frontend smoke testing.

## Critical Security Findings

No confirmed direct authentication bypass or secret value exposure was found in the static scan. The primary security blockers are session revocation, CSP hardening, and unverified deployed RLS/grants. `dangerouslySetInnerHTML` appears in `src/components/ui/chart.tsx`; it should remain limited to trusted generated style content and be reviewed if its inputs become user-controlled.

## Authentication Findings

Normal login/registration no longer issue a normal session before email verification, based on the current auth route and tests. `verifySession` checks the current user, role, active state, and verification state. Remaining concerns are the non-revocable seven-day token, OTP rate limiting depending partly on provider behavior, development OTP configuration risk, and the need for integration coverage across Google, reset, admin, email, and phone flows.

Routes that rely on session presence/role checks include client/professional portal routes, profile routes, wallet routes, verification routes, project actions/files, and admin routes. Each must be tested as a two-user authorization matrix; frontend route guards are not security controls.

## Authorization / IDOR Findings

Static review found ownership predicates in key project/file routes and server-side role checks in professional/admin paths. No confirmed IDOR is asserted from static inspection alone. The route inventory accepts IDs for jobs, project requests, payments/invoices, files, locations, disputes, users, and proposals; these need disposable two-user tests and live policy verification. Findings remain `NEEDS LIVE VERIFICATION` unless a route’s DB predicate is directly proven for every operation.

## API Findings

The API surface is broad and uses route-local validation/error handling. Webhooks, payment verification, project actions, exports, and generic resource routes deserve the highest integration priority. Add request size limits, stable error DTOs, pagination, timeouts for external calls, and idempotency keys for all financial or state-changing external requests.

## Database Findings

The schema has meaningful models and recently added Prisma relations, but repository schema correctness is not deployed-schema correctness. The empty baseline and unapplied guards are the dominant risks. Run the supplied read-only script on a sanitized target and compare migration history, constraints, indexes, orphan counts, status values, RLS, and policy state.

## Migration Findings

All migrations were read chronologically. The empty baseline is a fresh-install blocker. The integer-money migration’s `ROUND()` requires reconciliation. The newer integrity migration has useful orphan/duplicate preflight checks and restrictive foreign keys, but it has not been verified on a live or disposable database in this audit.

## Financial Integrity Findings

Money is represented in integer minor units in the current design, but historical conversion, provider rounding (`Math.round(amountRupees * 100)`), fee/payout aggregates, and multi-record webhook writes need end-to-end reconciliation. Payment, wallet, withdrawal, invoice, refund, and payout paths should have immutable ledger/audit records and idempotent transition keys.

## Relationship / Foreign Key Findings

The current Prisma schema includes relations for many previously relation-like fields, and the pending migration adds database foreign keys with restrictive deletion behavior. Until deployed and queried, orphan risk remains. The relationship matrix below records the important reviewed paths.

| Model                | Column                      | Intended Target                  | Prisma Relation | DB FK                   | ON DELETE | Status                        |
| -------------------- | --------------------------- | -------------------------------- | --------------- | ----------------------- | --------- | ----------------------------- |
| Payment              | `clientId`                  | User                             | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| Payment              | `professionalId`            | User                             | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| Payment              | `jobId`                     | ClientJob                        | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| Payment              | `projectTrackingId`         | ProjectTracking                  | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ProjectRequest       | `jobId`                     | ClientJob                        | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ProjectRequest       | `clientId`/`professionalId` | User                             | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ProjectTracking      | `requestId`/`jobId`         | ProjectRequest/ClientJob         | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ProjectMilestone     | `trackingId`                | ProjectTracking                  | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ProjectTimelineEvent | `trackingId`                | ProjectTracking                  | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ProjectWorkUpload    | `trackingId`/`milestoneId`  | ProjectTracking/ProjectMilestone | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |
| ClientProfile        | `userId`                    | User                             | Yes             | Pending unique/FK guard | RESTRICT  | Needs deployment verification |
| Service              | `categoryId`                | ServiceCategory                  | Yes             | Pending migration       | RESTRICT  | Needs deployment verification |

## Constraint Findings

The pending integrity migration covers important non-null-aware checks for payment amounts, progress, ratings, aggregate counts, and budget ordering. The current inventory still needs live confirmation. Application-only status policies remain vulnerable to drift unless represented by enums/checks or a single authoritative transition service. Remember that SQL checks do not reject NULL unless the column is non-null or the check explicitly handles NULL.

## Transaction Findings

Required local invariants should be grouped in transactions: state transition, timeline record, audit record, and required financial ledger record. Email, SMS, provider calls, and Socket.IO emits should not run inside the database transaction; use an outbox after commit. Current in-process background work is not durable.

## Concurrency Findings

Prior fixes added expected-state predicates to several project transitions, which is a positive control. OTP attempt/consume and some financial/provider paths still require concurrent-request tests. Every winner-takes-state operation should check affected-row count and return a conflict for stale state.

## Performance Findings

No production-like data or EXPLAIN plans were available, so N+1 and index findings remain partly provisional. Audit `findMany` list endpoints for hard limits, relation loading, ordering, and cursor pagination. Use `pg_stat_user_indexes` and representative plans before adding indexes.

## Index Recommendations

| Query pattern                              | Candidate columns/order                                                         | Benefit                                | Trade-off                                        | EXPLAIN required |
| ------------------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------ | ---------------- |
| Unconsumed OTP by phone/role, newest first | `OtpCode(phone, role, createdAt DESC)` with partial predicate if supported      | Faster verification and bounded lookup | Write/storage cost; partial predicate must match | Yes              |
| Project ownership/status lists             | `ProjectTracking(professionalId, status, updatedAt DESC)` and client equivalent | Faster portal lists                    | Extra write work                                 | Yes              |
| Payment by provider order/status           | `Payment(razorpayOrderId, status)`                                              | Faster webhook reconciliation          | Provider key may already be unique               | Yes              |
| Timeline by project chronology             | `ProjectTimelineEvent(trackingId, createdAt ASC)`                               | Faster tracking pages                  | Additional index storage                         | Yes              |
| Notifications by recipient/unread/time     | `(userId, readAt, createdAt DESC)`                                              | Faster notification badge/list queries | More index maintenance                           | Yes              |
| Stored files by owner/purpose              | `(ownerId, purpose, createdAt DESC)`                                            | Faster private file administration     | Moderate storage/write cost                      | Yes              |

## File Upload Findings

Extension, MIME, size, magic-byte, generated-key, and traversal checks are present for supported project files. Remaining concerns are malware scanning, durable orphan cleanup, verification-document metadata, and proving every read route enforces the owning user/role before object retrieval.

## Webhook Findings

Persona has timestamped HMAC verification and unique provider event IDs. Razorpay verifies the raw body and deduplicates IDs but lacks an age check and has the non-atomic financial side effect described above. Both integrations need failure-injection and out-of-order tests.

## Frontend Findings

No server secrets should be prefixed `NEXT_PUBLIC_`; the example environment file follows that boundary for provider credentials. The chart component’s generated style HTML and map components require trusted-input review. User-facing loading/error/duplicate-submit behavior should be verified for payment and project actions.

## TypeScript Findings

`npm run typecheck` passed with strict configuration. No `as any`, `@ts-ignore`, or `@ts-expect-error` was found in application code by the targeted scan. Webhook JSON and provider response casts remain runtime-validation gaps, and a few non-null assertions are used for configured Twilio/auth values; environment validation should replace those assumptions.

## Test Coverage Gaps

Missing high-value suites: two-user IDOR matrix, admin boundary, real Prisma migration replay, RLS/grants, money reconciliation, payment/webhook duplicates, out-of-order provider events, OTP concurrency, project transition concurrency, upload authorization and cleanup, and external timeout/retry behavior.

## CI / Build Findings

| Command                           | Result                                               |
| --------------------------------- | ---------------------------------------------------- |
| `npx prisma format`               | PASS                                                 |
| `npx prisma validate`             | PASS                                                 |
| `npx prisma generate`             | PASS                                                 |
| `npm run typecheck`               | PASS                                                 |
| `npm test -- --run`               | PASS — 12 tests in 3 files                           |
| `npm run lint`                    | PASS WITH WARNINGS — 6 React Hook warnings, 0 errors |
| `npm run build`                   | PASS — Next.js 16.3.0 production build               |
| Fresh `npx prisma migrate deploy` | NOT AVAILABLE — no disposable database was provided  |

CI currently runs lint/typecheck/test/build only. It does not run the Prisma or fresh-database checks above.

## Production Deployment Risks

Do not treat a successful Next build as migration readiness. Reconcile the target schema, run the integrity preflight, test the full chain on disposable PostgreSQL, document backup/restore and rollback, and verify health checks and runtime compatibility of the proxy importing server-side auth/DB code. Production must use configured S3 storage and real OTP/payment provider settings; development fallbacks must be rejected by startup validation.

## Supabase / RLS Findings

The repository lacks enough Supabase policy artifacts to assess anon/authenticated/service-role access, Storage, Realtime, exposed RPCs, or `SECURITY DEFINER` functions. This is `NEEDS DEPLOYED SUPABASE VERIFICATION`, not evidence that RLS is absent or insecure.

## Needs Live Database Verification

- `_prisma_migrations` history and checksum consistency.
- Fresh replay and upgrade replay on a disposable production-like PostgreSQL database.
- Orphans, duplicates, invalid amounts/ranges/statuses, and NULL business-rule violations.
- Actual foreign keys, delete actions, checks, unique indexes, index usage, table sizes, and sequence headroom.
- RLS enablement, policies, grants, Storage policies, Realtime access, and exposed functions.
- Representative `EXPLAIN (ANALYZE, BUFFERS)` plans and production cardinality.
- Backup/restore, lock duration, health checks, and rollback rehearsal.

## Needs Manual Review

- Confirm the deployment target: Vercel documentation versus any Cloudflare/Vercel artifacts.
- Review third-party provider account settings, webhook retry policy, Razorpay route/payout permissions, Persona event contract, and Twilio rate limits.
- Review CSP compatibility with maps/payment scripts and remove inline allowances where possible.
- Review all ID-bearing route handlers with a two-user test matrix.
- Review the trusted generated HTML in `src/components/ui/chart.tsx`.
- Review dependency advisories without automatically upgrading packages.

## Fix Immediately

1. Resolve the empty migration baseline and prove fresh replay on disposable PostgreSQL.
2. Reconcile and safely deploy integrity/foreign-key guards; do not skip preflight.
3. Make payment webhook local financial updates atomic and retryable; reconcile pending records.
4. Add concurrency-safe conditional transitions for OTP and financial/project state changes.
5. Add integration coverage for IDOR, money, webhooks, migrations, and constraints before production.

## Before Next Release

1. Design durable outbox processing for required notifications/events.
2. Add session revocation/versioning and credential-change invalidation.
3. Version and test RLS/grants/Storage policies, or document the authoritative deployed policy source.
4. Complete upload reconciliation/scanning and verify private read authorization.
5. Add migration replay and Prisma validation to CI; document backup/restore/rollback.

## Next Sprint

1. Establish API schemas/error contracts, pagination, timeouts, and idempotency conventions.
2. Capture query plans and add only evidence-backed indexes.
3. Harden CSP with nonces/hashes and review the chart HTML boundary.
4. Extract project domain services from route orchestration.

## Cleanup

1. Resolve the six React Hook warnings.
2. Replace environment non-null assertions with startup/config validation.
3. Remove stale or duplicate documentation/configuration after deployment target is confirmed.

## Hardening Update — Phase 1

`FIN-001` has been implemented in the repository, not production-verified. Razorpay events now have explicit `RECEIVED`, `PROCESSING`, `FAILED`, and `PROCESSED` state, unique-event idempotency, stale-claim recovery, payload validation, provider/local payment identity checks, amount/currency checks when supplied, terminal-state protection, and a transaction around local financial writes. The forward migration is pending deployment and disposable-database replay. Integration and concurrent webhook tests remain required.

## Hardening Update - Phase 2

`CON-001` is partially implemented for development OTP verification. Attempt increment and successful consumption now occur in one parameterized conditional update requiring an unconsumed, unexpired row below the attempt limit. A concurrent request that loses the update cannot also succeed. Twilio verification remains delegated to Twilio Verify and requires provider-backed integration testing. Project transitions remain pending.

NOT PRODUCTION READY
