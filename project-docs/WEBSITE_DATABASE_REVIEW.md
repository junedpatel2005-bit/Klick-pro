# Website & Database Review

## Scope and Method

This was a read-only repository review. I inspected the current Next.js/TypeScript application, route handlers, Prisma schema, migrations, database helpers, storage/integration code, tests, CI, deployment documentation, and prior audit/status reports. No production or staging database was accessed, no provider was contacted, and no data or schema was changed.

Evidence labels:

- **CONFIRMED** — directly demonstrated by current repository code/configuration or a locally executed command.
- **POSSIBLE / NEEDS VERIFICATION** — a credible risk that requires a live database, staging, provider, browser, or workload test.
- **NOT OBSERVED** — not found in the inspected repository; this is not proof that the issue cannot exist in deployed infrastructure.

## Overall System Health Summary

The application has a coherent Next.js App Router structure, strict TypeScript, Prisma 7 PostgreSQL access, server-side session and role checks, file signature validation, provider signature validation, and a working local build. The most serious blockers remain database lifecycle and production verification rather than compilation: the initial migration is empty, the integrity/webhook migrations are not deployed or replay-tested, and no live PostgreSQL integration suite has run in this environment. Financial webhook code has improved transaction/idempotency behavior but is not integration-tested. No complete two-user IDOR matrix, session-revocation test, RLS/grants inspection, browser E2E suite, backup/restore rehearsal, or provider staging test was available.

## Critical

### WEB-CRIT-001 — Fresh database provisioning is not reproducible

Severity: Critical  
Status: CONFIRMED

Location: `prisma/migrations/0_init/migration.sql`; all later Prisma migrations.

Evidence: The baseline migration is empty while later migrations assume application tables. No disposable PostgreSQL replay has completed.

Why it is a problem: A clean environment cannot be proven to reach the intended schema using the repository’s migration strategy.

Recommended fix: Compare deployed `_prisma_migrations` and physical schema before any history repair; then prove empty and upgrade replay on disposable PostgreSQL. Do not blindly rewrite `0_init`.

Risk of proposed change: Baseline reconstruction can diverge from the deployed database and requires controlled backup/cutover planning.

### WEB-CRIT-002 — Production database and authorization state are not verified

Severity: Critical  
Status: POSSIBLE / NEEDS VERIFICATION

Location: deployed PostgreSQL/Supabase project; all ID-bearing API routes.

Evidence: No live database results, RLS/grant inventory, two-user negative authorization suite, or browser/API end-to-end run is available.

Why it is a problem: Static route predicates and Prisma schema do not prove deployed row access, grants, or cross-user isolation.

Recommended fix: Run the read-only database audit in staging, execute the Client A/B, Professional A/B, and Admin matrix, and verify Storage/RLS/grants.

Risk of proposed change: Incorrectly tightened policies or route checks could block legitimate business relationships; test against a sanitized environment first.

## High

### WEB-HIGH-001 — Financial webhook behavior lacks real PostgreSQL failure evidence

Severity: High  
Status: CONFIRMED (test gap); implementation risk remains POSSIBLE / NEEDS VERIFICATION

Location: `app/api/webhooks/razorpay/route.ts`; `Payment`; `WalletTransaction`; `RazorpayWebhookEvent`.

Evidence: Source uses processing states, conditional claiming, provider identity/amount/currency checks, and a Prisma transaction. Integration fixtures exist but Docker/PostgreSQL is unavailable, so no database rows were asserted.

Why it is a problem: Transaction and retry correctness cannot be established by typecheck or unit tests alone.

Recommended fix: Run signed local fixtures against disposable PostgreSQL for duplicate, rollback, retry, mismatch, out-of-order, and concurrent requests; inspect event/payment/wallet rows.

Risk of proposed change: Provider retry semantics and event ordering must be modeled correctly before changing production behavior.

### WEB-HIGH-002 — Seven-day stateless sessions cannot be revoked

Severity: High  
Status: CONFIRMED

Location: `src/lib/auth.ts`; auth routes.

Evidence: JWT cookie expiry is seven days and there is no Session table, token version, or server-side revocation check. Clearing a cookie does not invalidate a copied token.

Why it is a problem: A stolen session remains usable until expiry or account deactivation.

Recommended fix: Add a session record or user session version, include a session identifier/version in tokens, revoke on logout/reset/sensitive changes, and test legacy-cookie rollout.

Risk of proposed change: Adds a database/cache lookup and requires careful token migration.

### WEB-HIGH-003 — Required database constraints and relations are only repository artifacts

Severity: High  
Status: CONFIRMED

Location: `202608310001_database_integrity_guards/migration.sql`; `202608310002_razorpay_webhook_processing_state/migration.sql`.

Evidence: Source contains FKs, checks, unique indexes, and webhook state columns; no live migration history or deployed constraint inspection is available.

Why it is a problem: Application assumptions are not yet proven to be enforced in the target database.

Recommended fix: Run read-only orphan/duplicate/range preflights, apply only in disposable/staging first, and inspect actual constraints/indexes.

Risk of proposed change: Existing invalid rows or locks may cause migration failure; do not auto-repair data.

### WEB-HIGH-004 — Project workflows and required events are not fully atomic/durable

Severity: High  
Status: CONFIRMED/POSSIBLE

Location: `app/api/portal/project-actions/route.ts`; `src/lib/background-jobs.ts`; notification/audit/timeline helpers.

Evidence: Some state transitions use expected-state updates, while `enqueueBackgroundJob` is an in-process Promise and realtime/email delivery is outside durable database state. No durable outbox model was found.

Why it is a problem: Process termination can lose required notifications/events, and multi-write workflows may leave partial local records.

Recommended fix: Put required local state/timeline/audit/ledger records in one transaction and create a minimal durable outbox in that transaction. Keep external calls outside it.

Risk of proposed change: Requires worker/retry/dead-letter operations and idempotent delivery.

### WEB-HIGH-005 — No complete authorization/IDOR regression matrix

Severity: High  
Status: CONFIRMED (test gap); vulnerability status POSSIBLE / NEEDS VERIFICATION

Location: ID-bearing routes under `app/api/**`, including projects, jobs, payments, invoices, files, locations, disputes, proposals, and admin resources.

Evidence: Many routes contain session/role/ownership predicates, but no integration suite tests every sensitive operation with two users and cross-role identities.

Why it is a problem: A single unscoped `findUnique`, update, delete, or download can expose another user’s data despite generally good patterns elsewhere.

Recommended fix: Run a real route/service matrix for Client A/B, Professional A/B, and Admin; fix any route whose database predicate is not scoped.

Risk of proposed change: Business rules may intentionally permit some cross-role access and need explicit policy decisions.

## Medium

### WEB-MED-001 — Historical financial conversion uses rounding

Severity: Medium/High financial risk  
Status: CONFIRMED

Location: `202608200005_integer_money_fields/migration.sql`.

Evidence: Historical migration contains `ROUND()` conversions. No sanitized historical-value reconciliation has been run.

Why it is a problem: Values that are not already exact minor units can change silently.

Recommended fix: Run read-only count/sum/fraction/min/max reconciliation and document the internal unit convention. Never rerun rounding as a repair.

Risk of proposed change: Correcting historical records may require auditable compensating entries and financial sign-off.

### WEB-MED-002 — Razorpay replay/age policy is weaker than Persona’s

Severity: Medium  
Status: CONFIRMED/POSSIBLE

Location: `app/api/webhooks/razorpay/route.ts`; `src/lib/persona.ts`.

Evidence: Persona validates timestamp age; Razorpay verifies the raw-body HMAC but has no timestamp header/age enforcement in this code. Razorpay event processing is now stateful and retryable in source.

Why it is a problem: A valid captured payload may be replayed if provider-side replay controls are insufficient.

Recommended fix: Confirm Razorpay’s signed webhook contract and add an age/replay control compatible with it, then test duplicates and stale fixtures.

Risk of proposed change: Rejecting legitimate provider retries if the wrong timestamp policy is assumed.

### WEB-MED-003 — Upload lifecycle is not durably reconciled

Severity: Medium  
Status: CONFIRMED/POSSIBLE

Location: `src/lib/project-file-storage.ts`; project and verification upload/download routes.

Evidence: MIME/extension/magic-byte/size and generated storage-key checks exist. Storage writes and metadata writes are separate; cleanup is best-effort; no orphan reconciliation or malware quarantine exists.

Why it is a problem: Bytes and metadata can diverge, and private documents can accumulate without lifecycle controls.

Recommended fix: Add pending/ready/deleted metadata and a scheduled reconciliation process; verify private ownership on every read and short-lived signed access where applicable. Place malware scanning before ready state if infrastructure is added.

Risk of proposed change: Reconciliation and scanning add operational storage tooling and may quarantine legitimate files.

### WEB-MED-004 — CSP weakens browser XSS mitigation

Severity: Medium  
Status: CONFIRMED

Location: `next.config.ts`; `src/components/ui/chart.tsx`.

Evidence: CSP includes `script-src 'unsafe-inline'`; development includes `unsafe-eval`; chart code uses `dangerouslySetInnerHTML` for generated styles.

Why it is a problem: A separate injection bug has greater impact when inline script execution is permitted.

Recommended fix: Inventory legitimate inline/third-party scripts, use report-only staging, then migrate to nonces/hashes where compatible.

Risk of proposed change: Payment/maps integrations can break if domains/nonces are incomplete.

### WEB-MED-005 — API validation and response contracts are decentralized

Severity: Medium  
Status: CONFIRMED/POSSIBLE

Location: broad `app/api/**` route-handler surface.

Evidence: Some routes use Zod; webhook/provider payloads and many handlers use route-local parsing and different error shapes.

Why it is a problem: Malformed input can produce inconsistent 400/500 behavior and clients cannot rely on one error contract.

Recommended fix: Establish a shared validation/error helper and apply it first to auth, payments, project actions, uploads, and admin routes.

Risk of proposed change: Tightening schemas can affect existing clients; version or monitor contract changes.

### WEB-MED-006 — CI does not yet prove database/deployment safety

Severity: Medium  
Status: CONFIRMED

Location: `.github/workflows/quality.yml`; `DEPLOY.md`.

Evidence: CI runs npm install/lint/typecheck/tests/build and now has isolated integration/migration jobs, but migration replay is expected to fail on MIG-001 and backup/restore, RLS, and security gates are absent. Deployment docs are minimal.

Why it is a problem: A green application build does not prove schema replay, authorization, rollback, or recovery readiness.

Recommended fix: Keep migration replay visibly blocking, add DB integration/security gates after the baseline strategy is known, and document backup/restore/health/rollback.

Risk of proposed change: Longer CI and operational maintenance.

### WEB-MED-007 — Query performance is not proven at production cardinality

Severity: Medium  
Status: POSSIBLE / NEEDS VERIFICATION

Location: marketplace, project tracking, notifications, messages, exports, and admin list routes.

Evidence: Static Prisma query inventory contains many list/relation reads; no representative EXPLAIN plans, production row counts, or load test results are available.

Why it is a problem: Potential N+1/unbounded reads and missing composite indexes cannot be classified safely from source alone.

Recommended fix: Capture staging plans, enforce limits/cursors, batch child reads, and add only evidence-backed indexes.

Risk of proposed change: Indexes increase write/storage cost; pagination changes API behavior.

## Low

### WEB-LOW-001 — Six React Hook lint warnings remain

Severity: Low  
Status: CONFIRMED

Location: four map components under `src/components/`.

Evidence: `npm run lint` exits 0 with six `react-hooks/exhaustive-deps` warnings.

Why it is a problem: Stale callback/center dependencies can produce stale map behavior and warnings can hide future defects.

Recommended fix: Resolve dependencies deliberately with stable callbacks/derived values; do not suppress the rule.

Risk of proposed change: Effect timing and map behavior may change; add interaction smoke tests.

### WEB-LOW-002 — Legacy/scripts/configuration surface is broad

Severity: Low/Medium operational risk  
Status: CONFIRMED

Location: `scripts/**`, legacy Prisma models, mixed documentation/configuration artifacts.

Evidence: Multiple data-manipulation and test scripts read `DATABASE_URL` directly; legacy models/tables and Vercel/Cloudflare-related artifacts coexist.

Why it is a problem: Operators can select the wrong script or environment, and ownership of legacy schema paths is unclear.

Recommended fix: Label scripts by environment, require explicit safety guards for any destructive/test script, and document the authoritative deployment target.

Risk of proposed change: Script restrictions can disrupt legitimate maintenance until replacement workflows exist.

## Website / Frontend Review

### Structure and integration

- Next.js App Router routes are under `app/`; reusable route/client code is under `src/routes` and `src/components`; server libraries are under `src/lib`.
- User-specific route segments are dynamic/server-rendered in the production build; the build output classified protected routes as dynamic.
- No direct database import into the reviewed client components was observed.
- Server authorization is present in many API routes; frontend visibility must not be treated as authorization.

### Forms, validation, and errors

- High-risk routes such as wallet deposit, OTP, and uploads use server-side Zod or explicit validation.
- Validation is not uniform across the entire API surface, and provider JSON is sometimes narrowed by assertions.
- Error responses are generally sanitized, but response shapes are not fully standardized.

### Navigation, buttons, and end-to-end flows

No browser automation or manual browser session was run. Therefore link destinations, button handlers, loading/empty states, responsive breakpoints, payment UI behavior, and complete registration-to-payment-to-completion flows are **NEEDS STAGING VERIFICATION** rather than confirmed working.

### Accessibility and responsive behavior

Static review can identify component structure but cannot establish keyboard order, focus management, screen-reader labels, contrast, touch targets, or viewport behavior. These require browser accessibility and mobile viewport testing.

### SEO

Marketing/static routes exist, but metadata, canonical URLs, structured data, robots, sitemap, and dynamic page indexing were not verified with a deployed crawl. Status: **NEEDS STAGING VERIFICATION**.

## Backend/API Review

The API uses Next route handlers with authentication/role checks distributed per route. The strongest patterns are database-scoped ownership predicates, Zod on several sensitive payloads, sanitized generic errors, and expected-state updates in selected project actions. Main weaknesses are decentralized contracts, incomplete integration coverage, potential partial writes around notifications/events, and lack of universal pagination/timeout/idempotency conventions.

## Authentication and Authorization Assessment

Current code checks user existence, active state, current role, and email verification during session verification. Normal unverified login/registration no longer receives the standard session, and focused tests pass. The copied-token/logout problem remains because sessions are stateless. Authorization cannot be declared fully verified until two-user negative tests cover all ID-bearing reads, writes, deletes, downloads, approvals, payments, and admin boundaries.

## Database Architecture Assessment

The Prisma schema uses PostgreSQL with integer identifiers and integer monetary fields, and core Project/Payment relationships are represented in Prisma. The integrity migration adds important FKs, checks, and uniqueness guards without automatic data cleanup. However, the empty baseline makes fresh replay unproven, several relation-like legacy fields remain weakly enforced, status fields are often strings, and no live constraints/RLS/grants/functions/trigger inventory exists.

Views, functions, triggers, and database permissions cannot be assessed from repository code alone; the supplied read-only audit SQL provides catalog queries for a staging role.

## Website ↔ Database Feature Trace

| Feature                         | UI                         | API/backend                           | Auth/authz                                            | Database                                          | Current conclusion                                                           |
| ------------------------------- | -------------------------- | ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Registration/email verification | Signup/verify routes       | Auth action route                     | Session withheld until verification                   | User and verification token models                | Code path covered by focused tests; full flow needs staging                  |
| Phone OTP                       | Signup/reset UI            | Auth action + OTP provider            | Role and verification proof                           | `OtpCode`                                         | Development consume is atomic in source; PostgreSQL concurrency test not run |
| Jobs/proposals                  | Client/professional pages  | Job/proposal routes                   | Role/ownership predicates present in reviewed paths   | `ClientJob`, `ProjectRequest`, proposal models    | Needs two-user matrix and workflow E2E                                       |
| Project tracking                | Project/tracking pages     | Project actions/files/routes          | Client/professional scope checks present in key paths | Project tracking/milestone/timeline/upload models | Partial transaction/concurrency evidence                                     |
| Wallet/payments                 | Earnings/wallet UI         | Wallet/Razorpay routes                | Client/professional/admin checks                      | Payment, Wallet, WalletTransaction, Invoice       | Financial tests and provider staging required                                |
| File uploads                    | Verification/project UI    | Multipart upload/download routes      | Generated keys and ownership checks in reviewed paths | StoredFile and project upload metadata            | Validation present; lifecycle reconciliation pending                         |
| Messages/notifications          | Message/notification pages | Message/notification/realtime helpers | User-scoped paths require matrix testing              | Message/notification models                       | Durable delivery not proven                                                  |
| Admin/CMS                       | Admin pages                | Admin routes                          | Server admin checks                                   | CMS/admin models                                  | Admin negative tests absent                                                  |

## Security Assessment

### Confirmed strengths

- No executable unsafe Prisma raw SQL pattern was found in application/scripts scan.
- Secrets are read from environment variables; no reviewed new artifact contained secret values.
- Session cookies use HttpOnly, SameSite, and Secure in production.
- Upload keys are generated server-side and local path traversal is checked.
- Razorpay and Persona signatures use raw-body HMAC verification; Persona checks timestamp age.
- Unverified standard sessions are blocked in current auth paths.

### Confirmed weaknesses or gaps

- Seven-day copied JWTs are not revocable.
- CSP permits inline scripts and development eval.
- Six lint warnings remain.
- Complete IDOR/RLS/grant isolation is not proven.
- OTP/provider rate-limit and full auth flow coverage are incomplete.

## Performance Assessment

Static code supports a reasonable PostgreSQL adapter pool configuration and includes several indexes. No production-like cardinality or EXPLAIN output exists. Priority review targets are list endpoints, project child relations, notifications/messages, exports, and admin reports. Do not remove indexes solely because `idx_scan = 0`; PostgreSQL statistics reset and rare indexes may be valid.

## Database and Security Verification Needed

Run only against a sanitized staging/disposable target:

1. `scripts/full-database-audit.sql` for tables, mapped columns, FKs, checks, indexes, migration history, orphans, duplicates, money, RLS, policies, grants, functions, stats, and sequences.
2. `npx prisma migrate deploy` on a completely empty disposable database; record the exact MIG-001 failure without masking it.
3. Integrity migration clean/invalid preflight tests.
4. Two-user route/API matrix and direct Storage access tests.
5. Backup/restore and rollback rehearsal.

## Top 10 Fixes in Priority Order

1. Run the disposable PostgreSQL harness and record the migration-replay result.
2. Resolve MIG-001 from deployed history/schema evidence; do not edit the baseline blindly.
3. Execute FIN-001 database-backed webhook duplicate, rollback, retry, mismatch, ordering, and concurrency tests.
4. Run and expand the integrity FK/CHECK/unique constraint tests.
5. Complete project/payment/OTP concurrency tests and expected-state transitions.
6. Add the two-user IDOR/admin matrix and fix any unscoped route discovered.
7. Implement revocable sessions with logout/reset/disable tests.
8. Add durable outbox processing for must-eventually-run events and notifications.
9. Verify RLS, grants, Storage, Realtime, provider settings, and backup/restore in staging.
10. Resolve CSP/lint issues and use staging EXPLAIN plans to address measured performance problems.

## Recommended Implementation Plan

### Phase 1 — Evidence infrastructure

Run Docker/CI PostgreSQL with `TEST_DATABASE_URL`, keep migration replay separate from current-schema testing, and retain the safety guard. Never use production `DATABASE_URL`.

### Phase 2 — Database and financial proof

Replay migrations, run integrity preflights, reconcile money units, and execute signed local Razorpay fixtures. Keep failed tests visible.

### Phase 3 — Authorization and concurrency

Exercise all sensitive route operations with distinct users and concurrent requests. Convert every verified race to an expected-state/conditional update with conflict handling.

### Phase 4 — Reliability and sessions

Add durable outbox semantics for required events and revocable sessions. Test rollback, restart, retry, logout, reset, role change, and disable behavior.

### Phase 5 — Browser/staging hardening

Run responsive/accessibility/SEO/browser-flow checks, provider sandboxes, CSP report-only, query plans, backup/restore, and deployment smoke tests.

## Local Validation Results

| Command                       | Result             | Evidence                             |
| ----------------------------- | ------------------ | ------------------------------------ |
| `npx prisma format`           | PASS               | Ran locally                          |
| `npx prisma validate`         | PASS               | Ran locally                          |
| `npx prisma generate`         | PASS               | Ran locally                          |
| `npm run typecheck`           | PASS               | Ran locally                          |
| `npm test -- --run`           | PASS               | 12 tests in 3 files                  |
| `npm run lint`                | PASS WITH WARNINGS | 6 React Hook warnings                |
| `npm run build`               | PASS               | Next.js 16.3.0                       |
| PostgreSQL integration suite  | NOT AVAILABLE      | Docker/psql unavailable in workspace |
| Live database audit           | NOT AVAILABLE      | No database access authorized        |
| Browser E2E/accessibility/SEO | NOT RUN            | No browser test session used         |

## Final Assessment

The codebase is suitable for continued controlled engineering and staging preparation, but not safe to classify as production-ready. The decisive blockers are unproven migration reproducibility, missing real PostgreSQL financial/concurrency/authorization tests, non-revocable sessions, incomplete durable event delivery, and absent live database/provider/restore verification.

NOT PRODUCTION READY
