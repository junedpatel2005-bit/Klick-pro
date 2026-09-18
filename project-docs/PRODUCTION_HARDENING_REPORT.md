# Production Hardening Report

## Executive Status

Phases 1 and 2 are implemented in source and require migration/deployment verification. Production remains blocked by migration reproducibility, missing integration/concurrency coverage, live database/RLS verification, session revocation, and operational restore rehearsal.

## Fixed

- Razorpay webhook JSON is schema-validated.
- Duplicate processed events return safely; failed and stale events can be retried.
- Local payment and wallet-transaction changes execute in one Prisma transaction.
- Provider order/payment identity, amount, and currency are checked when provider fields are present.
- Payment terminal-state regression is prevented for failed events after completion.
- Development OTP attempts and consumption use one conditional parameterized database update; only one concurrent correct submission can consume a code.

## Implemented — Needs Deployment

- `RazorpayWebhookEvent` processing fields and retry index in `202608310002_razorpay_webhook_processing_state`.
- The forward migration has not been applied to any database in this task.

## Needs Live Database Verification

- Migration history and fresh replay (`MIG-001`).
- Integrity migration preflight and deployed constraints (`MIGRATION_INTEGRITY_REVIEW.md`).
- Existing orphan/duplicate/invalid financial rows.
- RLS, grants, Storage, Realtime, and provider-facing database exposure.

## Needs Production Provider Verification

- Razorpay webhook retry/order amount semantics and event-age policy.
- Razorpay account/environment separation and webhook secret configuration.
- Wallet top-up and payment fixtures in staging.

## Remaining Critical

- Empty initial migration prevents a verified fresh install.

## Remaining High

- Session tokens remain stateless and non-revocable.
- OTP and project transition concurrency tests/fixes remain.
- Durable outbox and full workflow transaction boundaries remain.
- Financial and authorization integration suites remain absent.

## Tests Added

No integration tests were added in Phases 1-2 because no disposable PostgreSQL harness is configured. Existing unit tests remain green; signed webhook, duplicate, rollback, retry, out-of-order, mismatch, and concurrent fixtures are required next. The OTP SQL path is parameterized and covered by type/lint checks, but not by a live concurrent database test.

## Database Migrations

Added the forward-only `202608310002_razorpay_webhook_processing_state` migration. It adds processing state, attempt/error timestamps, and an index. It performs no data cleanup. Do not apply it to production until the baseline and disposable replay are resolved.

## Financial Safety Review

Required local writes for the Razorpay event now share a transaction. Duplicate events do not repeat the effect, failed processing is recoverable, and mismatched local/provider identifiers are rejected. External calls are not made inside the transaction. Wallet crediting remains owned by the existing verified deposit flow and must be covered by integration tests.

## Authentication Safety Review

No authentication changes were made in Phases 1-2. The existing seven-day JWT remains a known high-risk limitation; Phase 5 is pending.

## Authorization / IDOR Matrix

Not implemented in Phases 1-2. Required matrix: User A, User B, Admin, Professional A, and Professional B across every ID-bearing sensitive route.

## Concurrency Review

Webhook event claiming and development OTP consumption use conditional state updates. Project state concurrency remains pending Phase 3.

## Validation Results

| Check                       | Result                                                  |
| --------------------------- | ------------------------------------------------------- |
| `npx prisma format`         | PASS                                                    |
| `npx prisma validate`       | PASS                                                    |
| `npx prisma generate`       | PASS                                                    |
| `npm run typecheck`         | PASS                                                    |
| `npm test -- --run`         | PASS — 12 tests in 3 files                              |
| `npm run lint`              | PASS WITH WARNINGS — 6 pre-existing React Hook warnings |
| `npm run build`             | PASS — Next.js 16.3.0 production build                  |
| Disposable migration replay | NOT AVAILABLE                                           |

## Deployment Preconditions

Resolve and replay the migration baseline, run all database preflights, deploy the two forward migrations in staging, execute signed Razorpay fixtures, and reconcile wallet/payment totals. Do not use production `DATABASE_URL` for migration tests.

## Production Deployment Order

1. Backup and rehearse restore.
2. Verify the target schema and migration history.
3. Replay migrations on disposable and staging databases.
4. Apply the webhook-state migration during an approved window.
5. Deploy application code and run signed webhook/payment smoke tests.
6. Monitor failed/processing webhook events and reconcile before enabling traffic broadly.

## Rollback / Restore Requirements

Rollback requires application rollback plus preservation of the new webhook columns. If the migration has been applied, restore by forward-compatible application rollback or database restore; do not delete migration history or drop columns during incident response. A tested backup and restore procedure is still missing.

NOT PRODUCTION READY
