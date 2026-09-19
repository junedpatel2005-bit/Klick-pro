# Testing Strategy

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

Related: [coding-standards.md](./coding-standards.md) · [development-workflow.md](./development-workflow.md) · [../08-operations/deployment.md](../08-operations/deployment.md) · [../02-requirements/non-functional-requirements.md](../02-requirements/non-functional-requirements.md)

---

## 1. Current state (evidence-based)

| Test level | Status | Evidence |
|---|---|---|
| Unit tests | **Not detected** | No `*.test.*` / `*.spec.*` files, no `__tests__/` or `tests/` directory in the working tree (excluding `node_modules`, `.next`). |
| Integration tests | **Not detected** | Same search; no `vitest.integration.config.ts`, no `docker-compose.test.yml`. |
| End-to-end (E2E) tests | **Not detected** | No Playwright/Cypress config, dependency or `node_modules/.bin` entry. |
| Component tests (React Testing Library) | **Not detected** | No `@testing-library/*` in `package.json` or `node_modules`. |
| Test runner | **Not detected** | No `jest`, `vitest`, `playwright`, `cypress` in `package.json` or `node_modules/.bin`. |
| `npm test` script | **Not present** | `package.json` scripts: `dev, build, start, lint, typecheck, check:razorpay, db:*, format`. |
| Coverage reporting | **Not available** | No coverage tool or report. No coverage percentage can be stated. |
| Flutter tests | Not in working tree | `flutter_app/test/widget_test.dart` was deleted in `185afc9`; entire `flutter_app/` is deleted in the uncommitted working tree. |

### 1.1 History: a test suite existed and was removed

Commit **`185afc9` ("save", 2026-09-15)** — immediately before the latest merge `cd8f4fb` — deleted the whole test infrastructure:

| Removed artifact | What it covered (from `git show 185afc9^:<path>`) |
|---|---|
| `vitest.config.ts`, `vitest.integration.config.ts`, devDependency `vitest ^4.1.10` | Unit/integration runners (`@/` alias, integration folder excluded from unit run) |
| `src/lib/auth.test.ts` (99 lines) | DB-backed sessions: create/verify/revoke, unverified/disabled/deleted users, current role |
| `src/lib/api-response.test.ts` (37 lines) | `apiSuccess`/`apiError` envelope; pagination default and max page size |
| `src/lib/project-file-storage.test.ts` (37 lines) | PDF magic-byte check, extension/byte mismatch rejection, unsupported extensions, size limit |
| `tests/integration/database.integration.test.ts` (315 lines) | Disposable PostgreSQL: single concurrent OTP consumer, expired OTP, Razorpay captured-payment idempotency, mismatch + retry, out-of-order failure, concurrent processing of identical event |
| `tests/integration/authorization.integration.test.ts` (133 lines) | IDOR: job owner vs other users/roles, cross-client mutation, admin-only data API |
| `tests/integration/setup.ts`, `docker-compose.test.yml` | Test DB on `127.0.0.1:55432` (tmpfs) |
| `scripts/test-db.ts`, `test-db-safety.ts`, `test-all-flows.ts` (610 lines), `test-professional-proposal-flow.ts`, `test-project-file-storage.ts` | DB lifecycle (`up/down/integration/migrate-replay`), safety guard against non-test DBs, scripted end-to-end API flows |
| npm scripts `test`, `test:db:up`, `test:db:down`, `test:integration`, `test:migrations`, `test:project-flow`, `test:all-flows` | — |
| CI steps: `npm test`; jobs `integration` and `migration-replay` | `.github/workflows/quality.yml` |
| `project-docs/INTEGRATION_TESTING.md`, `INTEGRATION_TEST_REPORT.md` | Test documentation |

**Consequence:** statements such as "unit suite is now 14 passing tests" (`project-docs/FIX_COMPLETION_REPORT.md`) and "`npm test -- --run` PASS — 12 tests in 3 files" (`project-docs/PRODUCTION_HARDENING_REPORT.md`, `DATABASE_FIX_REPORT.md`) are **obsolete**. Residual hook: `src/lib/db.ts:19-24` still switches to `TEST_DATABASE_URL` when `NODE_ENV=test`. The reason for deletion is **[UNKNOWN]** (commit message is "save"). The deleted files can be restored with `git show 185afc9^:<path>` if the team decides to reinstate them.

Note that the restored `api-response.test.ts` would test `src/lib/api-response.ts`, which currently has **zero importers** (see [coding-standards.md](./coding-standards.md) §5).

---

## 2. What CI verifies today

Workflow `.github/workflows/quality.yml` (on every PR and push to `main`):

| Gate | Command | What it actually proves | What it does NOT prove |
|---|---|---|---|
| Install | `npm ci` | Lockfile consistent | — |
| Lint | `npm run lint` → `eslint .` | JS/TS recommended rules, react-hooks rules, Prettier formatting (via `eslint-plugin-prettier`) | Unused vars (rule disabled), logic |
| Typecheck | `npm run typecheck` → `tsc --noEmit` (strict, `noUncheckedIndexedAccess`) | Type-level correctness of `app/`, `src/`, `proxy.ts` against the committed Prisma client | `server.mjs`, `scripts/`, `prisma/seed.ts` are **outside** `tsconfig.include` → not type-checked; runtime behaviour |
| Build | `npm run build` → `prisma migrate deploy && next build` | All 28 migrations apply in order on an empty Postgres (implicit replay check); Next.js compiles and prerenders | Business rules, authorization, payments, realtime, integrations; that the migrated schema matches `schema.prisma` (locally it did not: 28 models without a table, 16 missing FKs, 30 missing indexes [[V-01](../validation/LOCAL_VALIDATION_LOG.md)]); checksum drift of edited migrations (ignored by Prisma 7.9.1 [[V-02](../validation/LOCAL_VALIDATION_LOG.md)]) |

Lint/typecheck/build outcomes were not executed while writing this document; they were run in the local validation run on commit `cd8f4fb`: lint 0 errors / 0 warnings, typecheck exit 0, `next build` (Next 16.3.0, Turbopack) exit 0 [VALIDATED 2026-09-17 · [V-03](../validation/LOCAL_VALIDATION_LOG.md), [V-04](../validation/LOCAL_VALIDATION_LOG.md)].

---

## 3. Manual / diagnostic verification assets that remain

| Asset | Type | Purpose | Safety |
|---|---|---|---|
| `npm run check:razorpay` (`scripts/check-razorpay-sandbox.ts`) | Config check | Verifies Razorpay env presence, Test Mode key prefix, enabled flag | Read-only (env only) |
| `scripts/project-db-check.ts` | DB audit | Table inventory, `_prisma_migrations` status, row counts, orphan checks | Read-only queries (`$queryRaw` with `Prisma.sql`) |
| `scripts/check-database-baseline.sql` | SQL | Migration history + orphan/CHECK preflights | Read-only |
| `scripts/full-database-audit.sql` | SQL | Schema/constraint/FK/index inventory | Read-only |
| `scripts/check-hierarchy-summary.ts` | DB audit | Prints 3-tier service category tree | Read-only |
| `GET /api/admin/database-status` | Endpoint | DB connectivity + latency | Read-only |
| `prisma/seed.ts` + `db:*` faker scripts | Fixtures | Create demo users/jobs/payments for manual testing. The seed fails with P2003 `Payment_milestone_id_fkey` on any DB that has that FK (e.g. built with `db push`) [FOUND IN VALIDATION 2026-09-17 · SEED] | **Mutating** — see [development-workflow.md](./development-workflow.md) §9 |
| [`docs/validation/LOCAL_VALIDATION_LOG.md`](../validation/LOCAL_VALIDATION_LOG.md) | **Manual runtime evidence** (not an automated test suite) | Record of a one-off local validation run (2026-09-17, commit `cd8f4fb`): ~45 scripted curl/Node/Socket.IO/browser checks of auth, Origin gate, rate limiting, wallet concurrency, milestone payouts, uploads, realtime, build and migrations, each with verdict and observed status codes. Scripts lived in a scratch worktree and are **not committed**; nothing runs in CI | Ran only against a private PostgreSQL; see reusable approach below |

---

### 3.1 Reusable approach for manual runtime validation [FOUND IN VALIDATION 2026-09-17]

The local validation run can be repeated without touching shared data:

1. `git worktree add --detach <scratch>/wt <commit>` — a clean checkout with **no copy of the real `.env`**; write a throwaway `.env` there (local SMTP sink, dummy Google ids, Razorpay/Persona test HMAC secrets only, `PERSONA_ENABLED=false`, `RAZORPAY_ROUTE_ENABLED=false`).
2. Private PostgreSQL cluster (`initdb` in a scratch dir, `pg_ctl` on e.g. `127.0.0.1:5434`), separate from any installed service; set its time zone to UTC (see [troubleshooting T-23](../08-operations/troubleshooting.md)).
3. **Guard every command**: run under `env -i` with only OS basics + the worktree `.env` + forced `DATABASE_URL`/`DIRECT_URL`, and abort if the host is not the private instance. Reason: an inherited `DATABASE_URL` in the shell overrides `.env` (dotenv/Next never override existing variables) — in the run, unguarded `prisma db push`/`db:seed` hit the developer's local database. The guard also removes an inherited `HOSTNAME` ([T-22](../08-operations/troubleshooting.md)).
4. Start with explicit `HOSTNAME=127.0.0.1` and a non-default `PORT`, browse at exactly `APP_URL` ([T-25](../08-operations/troubleshooting.md)). Use a production server (`next build` + `NODE_ENV=production`) for prod-only behaviour and a development server for uploads with local storage.

## 4. Critical untested areas (ranked by risk)

| Rank | Area | Why critical | Key code | Former coverage |
|---|---|---|---|---|
| 1 | **Money: wallet ledger, milestone funding/release, fees** | Real funds; fee math uses `Math.ceil(base * 0.1)` on integer rupees; multi-row transactional writes; payout release | `src/lib/wallet-ledger.ts` (`calculateMilestoneMoney`, `fundMilestoneFromWallet`, `releaseMilestoneToProfessional`, `settleMilestoneFromWallet`, `creditWalletFromVerifiedProvider`), `app/api/wallet/milestone/route.ts`, `app/api/admin/finance/milestone-payout/route.ts`, `app/api/wallet/deposit/*` | None (never had ledger unit tests) |
| 2 | **Payment webhooks (Razorpay) & signature verification** | Idempotency, retry of stale `PROCESSING` events, amount/currency/identity match, out-of-order events | `app/api/webhooks/razorpay/route.ts` (185 lines), `src/lib/razorpay.ts`, `app/api/payments/razorpay/*` | Had 4 integration tests (deleted) |
| 3 | **Authentication & sessions** | Login/signup/OTP/reset/Google OAuth in one ~880-line handler; revocable sessions; admin bootstrap | `app/api/auth/[action]/route.ts`, `src/lib/auth.ts`, `app/api/admin/login/route.ts`, `src/lib/phone-otp-provider.ts`, `src/lib/dev-phone-otp.ts` | Had unit + OTP concurrency tests (deleted) |
| 4 | **Authorization / IDOR** | ~5 duplicated per-route helpers (`getClient`, `requireAdmin`, `getSession`, `getProfessional`, `sessionFromRequest`…); proxy page guard is not role-aware | `app/api/**/route.ts`, `proxy.ts` | Had 3 integration tests (deleted) |
| 5 | **Project state machine** | Conditional `updateMany` transitions (`READY_TO_START → IN_PROGRESS`, milestones, revisions, completion) with 409 on races; statuses are free-form strings (no DB CHECK) | `app/api/portal/project-actions/route.ts` (964 lines), `src/lib/project-request-actions.ts`, `app/api/client/project-requests/[id]/route.ts`, `app/api/professional/project-requests/[id]/route.ts` | None |
| 6 | **Persona KYC webhook** | Verification status drives professional trust badges | `app/api/webhooks/persona/route.ts`, `src/lib/persona.ts` | None |
| 7 | **File upload validation & storage** | Magic-byte checks, path traversal guard (`localPath`), S3 provider | `src/lib/project-file-storage.ts`, `app/api/portal/project-files/*`, `app/api/professional/verification/*` | Had unit tests (deleted) |
| 8 | **Proxy (CSRF origin check, redirects)** | Blocks all mutations if misconfigured; verification redirect | `proxy.ts` | None |
| 9 | **Realtime socket auth** | JWT + revocation check in plain JS outside typecheck | `server.mjs:38-68` | None |
| 10 | **Migrations** | Edited historical migrations; preflight exceptions | `prisma/migrations/**` | Had `migration-replay` CI job (deleted); `build` still replays on empty DB |

---

## 5. How to verify changes today (no automated suite)

Minimum checklist for any change:

1. `npm run lint` and `npm run typecheck` (same as CI).
2. If `prisma/schema.prisma` changed: `npx prisma format`, `npx prisma validate`, `npx prisma generate`; bump `prismaSchemaVersion` in `src/lib/db.ts` when adding models (dev cache guard).
3. `npm run build` **against a disposable local database only** (it runs `migrate deploy`). Never point `DATABASE_URL`/`DIRECT_URL` at shared or production databases while building.
4. Manual smoke test with `npm run dev` (explicit `HOSTNAME`, see [T-22](../08-operations/troubleshooting.md)) and seeded data (`npm run db:seed`; fails on DBs with `Payment_milestone_id_fkey`, see [T-24](../08-operations/troubleshooting.md)) covering the affected role(s): client, professional, admin, unverified user, and a second user of the same role for ownership checks.
5. For API mutations, test from a browser tab opened at exactly `APP_URL` (or send an `Origin` header equal to `APP_URL`) — otherwise `proxy.ts` returns 403, even for a same-origin tab at `127.0.0.1` when `APP_URL` uses `localhost` [VALIDATED 2026-09-17 · [V-20](../validation/LOCAL_VALIDATION_LOG.md)].
6. For payments: Razorpay **Test Mode** keys (`npm run check:razorpay`), signed webhook deliveries from the Razorpay dashboard or CLI; reconcile `Wallet`, `WalletTransaction`, `Payment`, `ProjectTransaction` rows afterwards (`scripts/project-db-check.ts`).
7. For realtime: two browser sessions, verify `notification:new` / `message:new` events arrive without reload.
8. Record what was verified in the PR description (no template exists; see [development-workflow.md](./development-workflow.md) §6).

## 6. Recommended target strategy (Planned / not implemented)

Recommendations only; nothing below exists in the repository.

| Priority | Recommendation | Rationale |
|---|---|---|
| P0 | Restore Vitest + the deleted unit/integration suites from `185afc9^` and re-add `npm test` + CI `integration` job | Fastest route back to prior coverage; files and CI YAML already written |
| P0 | Unit tests for `calculateMilestoneMoney` and ledger functions; integration tests for fund → release → payout with rollback cases | Highest financial risk (rank 1) |
| P1 | Two-user authorization matrix per ID-bearing route (as requested by `PRODUCTION_HARDENING_REPORT.md`) | IDOR risk with duplicated helpers |
| P1 | Table-driven tests for project status transitions incl. concurrent requests expecting 409 | State machine without DB constraints |
| P2 | Playwright E2E for signup → verify → post job → proposal → hire → milestone → completion | No E2E coverage |
| P2 | Add `server.mjs` socket auth tests (or port to TS in `tsconfig.include`) | Currently untyped and untested |

## Relationship to existing docs

| Existing doc | Status |
|---|---|
| `project-docs/FIX_COMPLETION_REPORT.md`, `PRODUCTION_HARDENING_REPORT.md`, `DATABASE_FIX_REPORT.md` (test results) | **Obsolete** — suites deleted in `185afc9`. |
| `project-docs/src/routes/docs/Coding-Standards-Compliance-Review.md` ("No test suite at all", 2026-08-10) | Accurate again today, although tests existed between those dates. |
| `project-docs/CODING_STANDARDS.md` §32–34, §44 and `Coding Standards & Engineering Rules.md` §41–42, §49 | Normative targets; **not met** (no tests, no test CI gate). |
