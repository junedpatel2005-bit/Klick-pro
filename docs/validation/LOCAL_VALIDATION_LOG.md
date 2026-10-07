# Local Runtime Validation Log

Purpose: resolve `[NEEDS VALIDATION]` markers in `/docs` by running the application locally against a **local, disposable PostgreSQL** and observing real behaviour (terminal/HTTP/Socket.IO/browser). Documentation is updated **only after** a test has produced evidence; every doc change is listed in §6.

Started: 2026-09-17 · Code under test: commit `cd8f4fb` (same commit the docs describe)

Legend: `[ ]` pending · `[~]` running · `[x]` done · `[!]` blocked · Result: **CONFIRMED** (doc claim true) · **REFUTED** (doc claim false → doc corrected) · **PARTIAL** · **NOT TESTABLE LOCALLY** (stays `[NEEDS VALIDATION]`)

## 0. Results summary (2026-09-17)

| Outcome                                                     | Tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CONFIRMED** (doc claim true, often with sharper evidence) | V-01 (count corrected), V-03, V-03b, V-05, V-06, V-07, V-10, V-11, V-12, V-13, V-20, V-21, V-22, V-23, V-25, V-26, V-27, V-28, V-29, V-30, V-31, V-32, V-33, V-34b/c, V-35, V-40, V-41, V-42 (direction corrected), V-43, V-44, V-45, V-46, V-47, V-50, V-51, V-53, V-54, KI-030                                                                                                                                                                                     |
| **REFUTED / CORRECTED**                                     | V-02 (checksum drift does not fail builds), V-04 (0 lint warnings), V-05b (no crash; profile data never shown), V-34 (companyWebsite not writable), V-48 (percentages ≤ 100), DS-7 (tw-animate inlined), /api/v1/v1 rewrite                                                                                                                                                                                                                                          |
| **PARTIAL**                                                 | V-24 (open-redirect mechanism; callback needs Google), V-52 (socket reconnects not measurable), V-55 (plain toast styling not triggered)                                                                                                                                                                                                                                                                                                                             |
| **New defects found at runtime**                            | OTP verification fails on non-UTC DB time zone; OTP codes logged in non-production; server binds LAN IP when HOSTNAME is pre-set; socket revocation fail-open with .env-only DATABASE_URL; production refuses local file storage (uploads 500); seed.ts fails with Payment→milestone FK; admin user detail never shows client profile; admins cannot delete active users; same-origin 127.0.0.1 rejected by the origin gate; post-login toast burst; DEP0169 warning |
| **Incident**                                                | S-11: two commands hit the developer's local klick-pro DB via the session DATABASE_URL. Assessed read-only; developer chose to keep the 22 added schema objects. Guard wrapper used for everything afterwards.                                                                                                                                                                                                                                                       |
| **Docs after update**                                       | 288 VALIDATED tags, 41 CORRECTED tags; 125 [NEEDS VALIDATION] lines remain (55 explicitly "not testable locally"; the rest are OpenAPI schema-shape notes, legend lines and items no test covered)                                                                                                                                                                                                                                                                   |

### Environment left running (local only)

- App: node server.mjs (development) on 127.0.0.1:3100; SMTP sink on 127.0.0.1:2525; private PostgreSQL on 127.0.0.1:5434 (data dir in the session scratchpad); worktree at <scratchpad>/wt (detached, commit cd8f4fb).
- Stop: end the node processes listening on 3100 and 2525; "pg_ctl -D <scratchpad>/pgdata stop"; "git worktree remove --force <scratchpad>/wt".

---

## 1. Safety rules for this run

| Rule                                       | How it is enforced                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Never touch the shared/production database | App runs from a **separate git worktree** (no copy of the real `.env`, which is gitignored and never read). Worktree gets its own `.env` pointing only to a private PostgreSQL instance on `127.0.0.1:5434`.                               |
| Never call real third-party services       | Worktree `.env` sets `RAZORPAY_ENABLED`, `PERSONA_ENABLED` off (or local test secrets only for HMAC signing), no SMTP host except a local sink, no Twilio, no Sentry DSN except a fake one for CSP testing, no Google keys except dummies. |
| Don't disturb the developer's normal setup | Private PostgreSQL cluster in the session scratchpad (own data dir, port 5434, localhost-only) — the installed `postgresql-x64-18` service on 5432 is not used or modified. App on port **3100** (3000 left free).                         |
| No application code changes                | Tests are external scripts (curl / node) and browser inspection. The main working tree is untouched except `docs/`.                                                                                                                        |
| No secrets in this log                     | Demo credentials found in source are used but never written here; local test secrets are throwaway values.                                                                                                                                 |

## 2. Environment (filled in during setup)

| Item            | Value                                                                                                                                                                                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree        | `git worktree add --detach <scratchpad>/wt cd8f4fb` — clean checkout, **no `.env` copied** (verified absent before creating a local one)                                                                                                                                                                                                                                    |
| Worktree `.env` | Local-only throwaway values: DB → `127.0.0.1:5434`, `APP_URL=http://localhost:3100`, SMTP → local sink `127.0.0.1:2525`, `FILE_STORAGE_PROVIDER=local`, `PHONE_OTP_PROVIDER=development`, dummy Google client id, Razorpay/Persona **test HMAC secrets only** (`rzp_test_localvalidation` key id; no real account), `RAZORPAY_ROUTE_ENABLED=false`, `PERSONA_ENABLED=false` |
| PostgreSQL      | PostgreSQL **18.4** binaries from the local install, **private cluster**: `initdb -A trust` in scratchpad `pgdata`, `pg_ctl -o "-p 5434 -c listen_addresses=127.0.0.1"`. Existing `postgresql-x64-18` service (5432) untouched.                                                                                                                                             |
| Databases       | `servio_migrate` (built only with `prisma migrate deploy`), `servio_app` (runtime tests), `servio_drift` (checksum-drift test)                                                                                                                                                                                                                                              |
| SMTP            | `vt/smtp-sink.cjs` — accepts any AUTH, writes each message to `mail/*.eml` (nothing leaves the machine)                                                                                                                                                                                                                                                                     |
| App server      | `NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3100 node server.mjs` after `next build` (via guard); a development run follows for dev-only checks                                                                                                                                                                                                                            |
| Browser         | Chrome (Claude-in-Chrome), tab on http://localhost:3100 (APP_URL origin)                                                                                                                                                                                                                                                                                                    |
| Node / npm      | v24.16.0 / 11.13.0 (CI uses Node 22)                                                                                                                                                                                                                                                                                                                                        |

## 3. Test catalogue

Grouped from the 185 `[NEEDS VALIDATION]` marker lines (many repeat the same question across documents).

### 3.1 Database & build

| ID    | Question (doc source)                                                                                                                                           | Method                                                                                        | Status | Result                                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| V-01  | Does `prisma migrate deploy` on an empty DB miss the 26 tables? Missing FKs (`Payment.milestone_id`), ~30 indexes? (database-design §9, KI-006/017/044)         | Fresh DB → `migrate deploy` → list tables/FKs; `prisma migrate diff` migrations→schema        | [x]    | PARTIAL: 28 (+1 mis-named) tables missing, not 26; 16 FKs; 30 indexes             |
| V-02  | Prisma 7 behaviour when an applied migration was later edited (checksum drift) (database-design §10, KI-014)                                                    | Apply pre-`185afc9` `0_init` to scratch DB, then `migrate deploy`/`status` with current files | [x]    | REFUTED: Prisma 7.9.1 deploy/status silently ignore checksum drift                |
| V-03  | Is Turbopack the default build? Are marketing pages static despite `force-dynamic` re-export? Is `tw-animate-css` inlined? (solution-architecture, UI-D5, DS-7) | `next build` output + built CSS                                                               | [x]    | Turbopack ✓; /services static ✓; tw-animate inlined (DS-7 refuted); no @font-face |
| V-04  | Current `npm run lint` warning count; typecheck clean? (coding-standards)                                                                                       | run lint/typecheck                                                                            | [x]    | REFUTED: 0 errors / 0 warnings; typecheck exit 0                                  |
| V-05  | `ClientProfile.savedLocations` include with several rows (schema.md)                                                                                            | Prisma script on seeded DB                                                                    | [x]    | CONFIRMED + new defect (admin user detail `.map` on object)                       |
| V-05b | Admin user detail page crashes for clients with a profile (found in V-05)                                                                                       | Chrome: open `/admin/users` → client detail                                                   | [x]    | REFUTED crash; admin detail never shows client profile (object[0])                |
| V-06  | `DirectHireNegotiation` model/table mismatch (KI-044)                                                                                                           | Prisma query on db-pushed vs migrated DB                                                      | [x]    | CONFIRMED (P2021 on migrated DB)                                                  |
| V-07  | Cascade behaviour of admin user delete (api-spec A.3)                                                                                                           | Delete seeded user via API, inspect orphans                                                   | [x]    | CONFIRMED: active user delete 500; fresh user delete leaves orphan ApiToken       |

### 3.2 Server / routing

| ID   | Question                                                                                                            | Method                                                               | Status | Result                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| V-10 | Are `.env` values visible to `server.mjs` before `app.prepare()` (socket auth uses `AUTH_SECRET`)? (environment.md) | `AUTH_SECRET` only in worktree `.env` → authenticated socket connect | [x]    | CONFIRMED: AUTH_SECRET visible; DATABASE_URL not → revocation fail-open |
| V-11 | `HOSTNAME` pre-set by the shell changes bind address (environment.md)                                               | Start from Git Bash (sets `HOSTNAME`) and inspect listener           | [x]    | CONFIRMED: binds LAN IP only; localhost unreachable                     |
| V-12 | engine.io `/api/realtime` bypasses `proxy.ts` (container-architecture)                                              | Polling request: `x-request-id` header / Origin check absent         | [x]    | CONFIRMED                                                               |
| V-13 | `/api/v1` rewrite precedence; `/api/messages` 404; `/api/v1/v1/*` (api-spec B.9)                                    | curl                                                                 | [x]    | CONFIRMED; /api/v1/v1 → 404                                             |

### 3.3 Authentication & security

| ID   | Question                                                                      | Method                                                                   | Status | Result                                                                   |
| ---- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| V-20 | Webhook / Bearer POST without `Origin` → 403 before handler (KI-001)          | curl razorpay & persona webhooks with/without Origin                     | [x]    | CONFIRMED 403; true same-origin 127.0.0.1 also rejected                  |
| V-21 | Mixed-case email registration cannot log in (KI-022)                          | register `Mixed@…` → login                                               | [x]    | CONFIRMED: never able to log in by email                                 |
| V-22 | Can an unverified user get a session and call APIs? (KI-025)                  | register → call client/professional APIs                                 | [x]    | CONFIRMED: login-phone-password gives unverified session; APIs accept it |
| V-23 | `login-phone-password` sets cookie on 403 (KI-020)                            | curl, inspect `Set-Cookie`                                               | [x]    | CONFIRMED: 403 + session cookie                                          |
| V-24 | `next=/\evil` open redirect (KI-021)                                          | runtime URL resolution + Google start flow with dummy client id          | [x]    | PARTIAL: resolves to http://evil.example/                                |
| V-25 | Host-header poisoning of reset/verification links (KI-008)                    | forgot-password with `X-Forwarded-Host`, capture mail in local SMTP sink | [x]    | CONFIRMED: reset link → https://evil.example                             |
| V-26 | Rate limit bypass by rotating `X-Forwarded-For` (KI-023)                      | 10 login attempts, varying header                                        | [x]    | CONFIRMED                                                                |
| V-27 | Dev OTP behaviour without `DEV_PHONE_OTP` in development (KI-004)             | send-phone-otp → verify with fixed code                                  | [x]    | CONFIRMED + OTP logged + OTP broken on non-UTC DB                        |
| V-28 | Socket stays connected after logout / session revocation (KI-026)             | socket.io-client, logout via HTTP, observe                               | [x]    | CONFIRMED: open socket survives logout                                   |
| V-29 | Demo credentials in `login.tsx` work against seeded accounts (KI-003)         | seed → login with in-bundle values (values not logged)                   | [x]    | CONFIRMED locally (client/pro/admin)                                     |
| V-30 | `/api/admin/database-status` unauthenticated outside production (KI-027)      | curl without cookie                                                      | [x]    | CONFIRMED: prod 401, dev 200 unauthenticated                             |
| V-31 | Admin bootstrap skipped without `ADMIN_EMAIL` (KI-053)                        | admin login with bootstrap vars, with/without email                      | [x]    | CONFIRMED (no ADMIN_EMAIL → 401, no admin created)                       |
| V-32 | Session cookie flags (secure/sameSite) in dev (security.md)                   | inspect `Set-Cookie`                                                     | [x]    | CONFIRMED prod: Secure; HttpOnly; SameSite=lax                           |
| V-33 | `/api/v1/auth/google` reachable and redirects (ui-specification)              | curl with dummy client id                                                | [x]    | CONFIRMED 307 → accounts.google.com                                      |
| V-34 | `companyWebsite` accepts `javascript:` scheme (security.md)                   | POST professional profile                                                | [x]    | REFUTED: companyWebsite not writable via API                             |
| V-35 | Local-storage `..` normalisation in verification document keys (api-spec B.4) | crafted GET with encoded `..`                                            | [x]    | CONFIRMED: B reads A's ID document via ..%2F (local storage)             |

### 3.4 Profile, money & project workflow

| ID   | Question                                                                               | Method                                                                        | Status | Result                                                                                              |
| ---- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| V-40 | Avatar upload relative URL → profile save 400; other users cannot load avatar (KI-051) | upload, save profile, fetch as other user                                     | [x]    | CONFIRMED: others 404/401; profile save 400                                                         |
| V-41 | Wallet top-up double credit under concurrent verify (KI-013)                           | PENDING top-up row + N concurrent signed verify calls (local test key secret) | [x]    | CONFIRMED: one 5,000 top-up credited 20,000 / 25,000                                                |
| V-42 | Funded milestone can be re-priced; payout uses current amount (KI-010)                 | fund milestone from wallet → update-milestone → admin payout                  | [x]    | CONFIRMED (corrected): lowering funded milestone underpays professional; payout uses current amount |
| V-43 | `update-progress` reverts any status to IN_PROGRESS (KI-011)                           | project in later state → update-progress                                      | [x]    | CONFIRMED                                                                                           |
| V-44 | Party can accept its own counter-offer (KI-033)                                        | counter as client → accept as client                                          | [x]    | CONFIRMED; milestone = budgetMax not bid                                                            |
| V-45 | Admin milestone payout sets Payment `COMPLETED` (invoice link) (api-spec R4)           | payout → inspect payment                                                      | [x]    | CONFIRMED                                                                                           |
| V-46 | Publishing a draft via PATCH sends no notifications (api-spec C5)                      | create draft → PATCH publish → count notifications                            | [x]    | CONFIRMED (+0 vs +15 notifications)                                                                 |
| V-47 | Route payouts disabled → 503 (integrations INT-02)                                     | POST admin/finance/payouts                                                    | [x]    | CONFIRMED 503                                                                                       |
| V-48 | Milestone `percentage` sum validated = 100? (data-dictionary)                          | POST job with bad percentages                                                 | [x]    | REFUTED: sum ≤ 100 accepted (60%)                                                                   |

### 3.5 Browser (Chrome)

| ID   | Question                                                        | Method                                                        | Status | Result                                                               |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| V-50 | Inter/Poppins actually rendered? (design-system)                | `document.fonts`, computed style                              | [x]    | CONFIRMED: system fallback font                                      |
| V-51 | CSP blocks Sentry browser ingestion (KI-049)                    | fake `NEXT_PUBLIC_SENTRY_DSN`, console CSP violations         | [x]    | CONFIRMED: connect-src violation                                     |
| V-52 | Socket.IO connections per tab; anonymous reconnect loop (UI-D6) | network/WebSocket inspection on public, messages, admin pages | [~]    | PARTIAL: no anonymous poll loop; reconnects not measurable           |
| V-53 | Duplicate admin toasts (api-spec B.10)                          | admin page open, trigger admin notification                   | [x]    | CONFIRMED: 2 toasts per admin event                                  |
| V-54 | White-on-orange CTA contrast (A12)                              | computed colours → WCAG ratio                                 | [x]    | CONFIRMED: 2.57:1                                                    |
| V-55 | Sonner toast effective styling; Radix animations present (DS-7) | trigger toast; check keyframes in CSS                         | [~]    | PARTIAL: admin toasts white custom cards; plain toasts not triggered |

### 3.6 Not testable locally (remain `[NEEDS VALIDATION]`)

Production hosting/CDN and edge header handling · live Razorpay/Persona webhook delivery · deployed `PHONE_OTP_PROVIDER`/`DEV_PHONE_OTP`/`NODE_ENV`/`APP_URL` · existence of demo/seed accounts or Google-matching admin emails in production · DB vendor (Supabase) · whether previews share a DB · Razorpay Route approval · Google OAuth callback end-to-end (needs real Google credentials) · Persona webhook idempotency under provider retries · business/privacy intent (whole-rupee money, invoice contact disclosure, PRI-04, admin file access for disputes) · mobile app plans / `fluter.mp4` content · server-time vs IST day boundaries in production.

## 4. Setup log

| #        | Time (IST)  | Step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Outcome                                         |
| -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| S-1      | 07:05       | Catalogued 185 `[NEEDS VALIDATION]` marker lines → 45 local tests + not-testable list (§3)                                                                                                                                                                                                                                                                                                                                                                                                  | done                                            |
| S-2      | 07:06       | Docker checked as DB option                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Docker Desktop daemon not running → not used    |
| S-3      | 07:07       | `git worktree add --detach` at `cd8f4fb`                                                                                                                                                                                                                                                                                                                                                                                                                                                    | OK; worktree has no `.env`                      |
| S-4      | 07:08       | `initdb` private cluster + `pg_ctl start` on 127.0.0.1:5434                                                                                                                                                                                                                                                                                                                                                                                                                                 | `PostgreSQL 18.4 … ready to accept connections` |
| S-5      | 07:09       | `CREATE DATABASE servio_migrate / servio_app / servio_drift`                                                                                                                                                                                                                                                                                                                                                                                                                                | created                                         |
| S-6      | 07:10       | `npm ci` in worktree (background)                                                                                                                                                                                                                                                                                                                                                                                                                                                           | running                                         |
| S-7      | 07:12       | Wrote SMTP sink + worktree `.env` (local values only)                                                                                                                                                                                                                                                                                                                                                                                                                                       | done                                            |
| S-8      | 07:12       | Observed Git Bash exports `HOSTNAME=<machine name>`                                                                                                                                                                                                                                                                                                                                                                                                                                         | input for V-11                                  |
| S-9      | 07:25       | `npm ci` finished (2068 packages, 15 min)                                                                                                                                                                                                                                                                                                                                                                                                                                                   | OK                                              |
| S-10     | 07:27–07:40 | V-01, V-02, V-04 run with **explicitly exported** `DATABASE_URL`/`DIRECT_URL` → private DBs `servio_migrate` / `servio_drift` (verified in Prisma output: `database "servio_…" at "127.0.0.1:5434"`)                                                                                                                                                                                                                                                                                        | OK                                              |
| **S-11** | **07:38**   | **INCIDENT — wrong database.** Ran `npx prisma db push` then `npm run db:seed` in the worktree **without exporting** the DB variables. The Claude Code session environment already contains `DATABASE_URL`/`DIRECT_URL` → `localhost:5432/klick-pro` (the developer's local database on the existing PostgreSQL service; not set at Windows User/Machine scope). `dotenv`/Next never override existing variables, so the worktree `.env` was ignored and both commands hit **`klick-pro`**. | See §4.1                                        |

| S-12 | 07:52 | Guard wrapper `vt/run.sh`: runs every command under `env -i` with only OS basics + worktree `.env` + forced `DATABASE_URL`/`DIRECT_URL` → `127.0.0.1:5434/<db>`; aborts (exit 97) if host differs. Self-test: `guard ok -> 127.0.0.1:5434/servio_app`, inherited `HOSTNAME` removed | OK |
| S-13 | 07:53 | `run.sh npx prisma db push` → `database "servio_app" … at "127.0.0.1:5434"` → `Your database is now in sync with your Prisma schema.` | OK (full schema, like a db-push-built DB) |
| S-15 | 08:40 | Private test DB only: `ALTER DATABASE servio_app SET timezone TO 'UTC'` to confirm the OTP time-zone defect (V-27) | applied to servio_app |
| S-14 | 07:55 | `run.sh npm run db:seed` → **`seed.failed` P2003 `Foreign key constraint violated on the constraint: Payment_milestone_id_fkey`** at `prisma/seed.ts:861` (`milestoneId = 900_001 + index`). Users (13 PRO, 1 ADMIN, 1 CLIENT), categories and jobs were created before the failure; wallet/payment seed data absent. | **Finding:** seed only works on DBs _without_ that FK (e.g. `klick-pro` has 3 orphan `Payment.milestone_id` rows from it) |

### 4.1 Incident S-11 — impact assessment on `localhost:5432/klick-pro` (read-only queries only)

| Command                   | What happened                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma db push`          | **Partially applied, then failed** at step `AddForeignKey` for `Payment_milestone_id_fkey`: `insert or update on table "Payment" violates foreign key constraint` (3 `Payment` rows reference non-existent milestones). Prisma applied earlier steps individually, so they **persisted**: **12 indexes** and **10 foreign keys** were created. No tables created or dropped, no columns changed, no rows deleted.                                                                                                                                                                                                                                                   | Objects with OID ≥ 336452 have `xmin` 123797–123818, immediately before the seed's row updates (`xmin` 124127–124139); previous objects stop at OID 94086. Remaining `migrate diff` klick-pro → schema: only 4 FKs outstanding. |
| Created indexes (12)      | `Payment_professionalId_idx`, `Service_professionalId_idx`, `WalletTransaction_walletId_idx`, `cms_media_createdAt_idx`, `cms_page_versions_page_id_idx`, `cms_pages_slug_idx`, `cms_pages_status_idx`, `hire_contracts_client_id_idx`, `hire_contracts_professional_id_idx`, `hire_contracts_job_id_idx`, `hire_job_attachments_job_id_idx`, `hire_milestones_contract_id_idx`                                                                                                                                                                                                                                                                                     | `pg_class`                                                                                                                                                                                                                      |
| Created foreign keys (10) | `ClientProfile_userId_fkey`, `ClientSavedLocation_clientProfileId_fkey`, `ClientHiringNeed_clientProfileId_fkey`, `ClientJob_userId_fkey`, `FavoriteJob_jobId_fkey`, `FavoriteJob_userId_fkey`, `ClientJobAttachment_jobId_fkey`, `hire_contracts_job_id_fkey`, `hire_job_attachments_job_id_fkey`, `hire_milestones_contract_id_fkey`                                                                                                                                                                                                                                                                                                                              | `pg_constraint`                                                                                                                                                                                                                 |
| `npm run db:seed`         | Completed (`seed.completed { categories: 6, professionals: 12, jobs: 8 }`). Seed is idempotent: **no new rows** in User, ClientJob, ServiceCategory, Payment, WalletTransaction, Wallet, ProjectWithdrawal (no `createdAt`/`updatedAt` newer than 3 h, UTC-correct). **13 `User` rows had `updatedAt` bumped** — the seeded professionals' upsert re-writes location, city, industry, experience, fixed rate, service area, address, team size to the deterministic seed values (same values as the original seed unless those demo profiles were edited since). Wallet balances untouched (balance updates only run when a new idempotent transaction is created). | read-only queries                                                                                                                                                                                                               |

Status: testing paused; developer informed. **Decision (developer, 07:50): keep the 22 objects** (they match `schema.prisma`); **continue testing with a guard.** Root-cause fix for all further steps: every command runs through a guard wrapper that exports the private DB URLs and aborts unless the resolved host is `127.0.0.1:5434`.

## 5. Test execution log

### V-01 — Database built only from migrations · **PARTIAL (count corrected)**

- Command: `DATABASE_URL=…/servio_migrate npx prisma migrate deploy` → `All migrations have been successfully applied.` (28 rows in `_prisma_migrations`, 41 app tables).
- Command: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (702-line script) → **29 `CREATE TABLE`, 16 `ADD CONSTRAINT … FOREIGN KEY`, 60 `CREATE INDEX`, 3 drops, 20 `ALTER COLUMN`.**
- Breakdown:
  - **28 models have no table at all** (docs said 26): `SQLiteMigrationTableArchive, SQLiteMigrationAudit, ProjectTransaction, ProjectNegotiation, SocketConversationClear, CallSession, MessageConversation, Message, UserNotification, UserNotificationState, ProjectDispute, ProjectCompletionRequest, ProjectRevisionRequest, ProjectReviewRequest, VerificationDocumentReview (verification_document_reviews), StoredFile, ApiToken, BrowserSubscription, Faq, ContactRequest, PageConfiguration, WebsitePageOverride, PageTextOverride, LegacyUser, LegacyUserProfile, LegacyProfessionalDetail, LegacyLocation, LegacyVerification`.
  - **+1 name mismatch:** migrations create `direct_hire_negotiations`; schema model `DirectHireNegotiation` has no `@@map` → diff drops `direct_hire_negotiations` and creates `"DirectHireNegotiation"` (confirms V-06 statically; runtime query in V-06).
  - **Foreign keys:** 16 missing in total, **14 between tables that already exist** — incl. `Payment_milestone_id_fkey` (confirms `Payment.milestone_id` has no FK).
  - **Indexes:** 30 missing on tables that already exist (confirms "~30").
  - **New drift found:** migrations create 2 indexes the schema does not declare (`ProjectRequest_jobId_origin_status_idx`, `WalletTransaction_provider_reference_key`) and 19 `updatedAt`/`createdAt` column defaults that Prisma's schema does not expect.
- Verdict: KI-006 confirmed with corrected count **28 (+1 mis-named)**; KI-017 (16 relations without FK) confirmed; KI-044 (~30 indexes, DirectHireNegotiation mismatch) confirmed.

### V-02 — Edited applied migrations (checksum drift) · **REFUTED (build does not fail)**

- Side finding: the **pre-edit** migration set (commit `3e2e1b1`) fails on an empty DB: `Migration name: 202608120003_shared_project_tracking … ERROR: relation "ProjectTracking" does not exist` (code 42P01) → reproduces the P3018 replay failure documented in troubleshooting (fixed by commit `6572a99`). **CONFIRMED.**
- Simulation of a DB that applied the old files: fresh `servio_drift` ← current migrations; verified stored checksum = SHA-256 of current file; then set `_prisma_migrations.checksum` of `0_init` and `202608120003_shared_project_tracking` to the SHA-256 of the pre-edit files (from `git show 3e2e1b1:…`).
- `npx prisma migrate status` → `Database schema is up to date!` (exit 0). `npx prisma migrate deploy` → `No pending migrations to apply.` (exit 0). No warning/`checksum`/`modified` text in output. Prisma CLI **7.9.1**.
- Verdict: with Prisma 7.9.1, **`migrate deploy` (and therefore `npm run build`) does not fail or warn on checksum drift**; `prisma migrate resolve` is not required for deploy to proceed. Remaining real risk: content added to an edited migration after it was applied (e.g. the 60 lines added to `202608120003`) **never runs** on that database, silently. `prisma migrate dev` (not used in deploy) is expected to flag drift — not tested.

### V-03 — Production build characteristics · **CONFIRMED / 1 REFUTED**

- `run.sh npx next build` → "▲ Next.js 16.3.0 (Turbopack)", "Environments: .env", "✓ Compiled successfully in 71s", exit 0. Installed Next is **16.3.0** (package.json range ^16.1.6). **Turbopack default: CONFIRMED.**
- Route table: 29 static (○), 98 dynamic (ƒ) incl. API. **/services is ○ static** despite `export const dynamic = "force-dynamic"` in src/routes/services.tsx → **UI-D5 CONFIRMED.** Also static: /about, /contact, /pricing, /for-clients, /for-professionals, /how-it-works, /cookies, /privacy-policy, /terms, /blog, /careers and all /admin/* pages except /admin and /admin/cms. / and /faq are dynamic.
- Built CSS (.next/static/chunks/*.css): contains "@keyframes enter" and ".animate-in" → tw-animate-css **is inlined** → **DS-7 REFUTED.** @font-face count **0**; "Inter" only inside font-family stacks → fonts never loaded (**CONFIRMED**, browser check V-50 pending).

### V-11 — HOSTNAME inherited from the shell · **CONFIRMED (worse than documented)**

- Git Bash exports HOSTNAME=ZS44 (machine name). Started NODE_ENV=production PORT=3100 HOSTNAME=ZS44 node server.mjs → log "> Servio ready on http://ZS44:3100"; netstat: **192.168.55.2:3100 LISTENING** only (ZS44 resolves to the LAN IPv4). curl http://127.0.0.1:3100/ and http://localhost:3100/ → connection failure.
- Impact: starting npm run dev / npm start from Git Bash (or any shell/container that pre-sets HOSTNAME) makes the app **unreachable on localhost and exposed on the LAN interface**. All further runs use HOSTNAME=127.0.0.1.
- Side observation: server.mjs emits Node "[DEP0169] DeprecationWarning: url.parse()" on start.

### V-12 — engine.io bypasses proxy.ts · **CONFIRMED**

- GET /api/realtime/?EIO=4&transport=polling → 200 with Access-Control-Allow-Origin: http://localhost:3100 and **no x-request-id** header, while Next-handled routes (e.g. /api/marketplace/categories) return x-request-id. POST /api/realtime/… **without Origin** → engine.io's own 400 {"code":2,"message":"Bad handshake method"}, not the proxy's 403.

### V-13 — /api/v1 rewrite precedence · **CONFIRMED + 1 correction**

| Request                               | Status                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| GET /api/v1/messages                  | 401 "Sign-in required." (physical route)                      |
| GET /api/messages                     | 404 (no twin)                                                 |
| GET /api/v1/professionals             | 200 (physical route)                                          |
| GET /api/professionals                | 404                                                           |
| GET /api/v1/marketplace/categories    | 200 (rewritten)                                               |
| GET /api/v1/v1/marketplace/categories | **404** — not rewritten twice (docs guessed "rewritten once") |

### V-20 — Origin gate on mutating /api/* · **CONFIRMED + new detail**

| Request (production server)                                                                        | Status / body                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| POST /api/webhooks/razorpay, no Origin                                                             | **403** "Request origin is not allowed."          |
| same with Origin: http://localhost:3100 (= APP_URL)                                                | 401 "Invalid Razorpay webhook." (reaches handler) |
| POST /api/webhooks/persona, no Origin                                                              | **403**                                           |
| same with APP_URL Origin                                                                           | 401 "Invalid Persona webhook."                    |
| POST /api/client/jobs with Authorization: Bearer x, no Origin                                      | **403** (Bearer / mobile clients blocked)         |
| POST /api/contact with Origin: http://127.0.0.1:3100 sent **to 127.0.0.1:3100 (true same origin)** | **403**                                           |
| same with Origin http://0.0.0.0:3100 or http://127.0.0.1                                           | 403                                               |
| same with Origin: http://localhost:3100                                                            | 400 (validation — passed the gate)                |

- New detail: under the custom server the "origin === request.nextUrl.origin" branch did **not** match a genuine same-origin request to 127.0.0.1:3100; only the exact APP_URL origin passed. Browser mutations work **only** when users browse at exactly APP_URL. Live provider delivery remains not testable locally.

### V-21 — Mixed-case email registration · **CONFIRMED (worse: can never log in by email)**

- POST /api/auth/register with "V21.Mixed.<ts>@Local.Test" → 201. Verification link captured in the SMTP sink; POST /api/auth/verify-email → 200 and issues a session.
- After verification, POST /api/auth/login with the email **as typed** → **401**, and **lowercased** → **401**. Login lowercases the input; the stored email keeps its case → email/password login is impossible for that account.

### V-22 — Can unverified users obtain a session? · **PARTIAL**

- Register does **not** set a session cookie (201, redirect /verify). verify-email sets one after verifying. Unverified email+password login and phone paths → V-22b / V-23 / V-27.

### V-25 — Host-header poisoning of auth links · **CONFIRMED**

- Control: verification email link origin = http://127.0.0.1:3100 (from Host, **not** APP_URL=http://localhost:3100).
- POST /api/auth/forgot-password for a real account with X-Forwarded-Host: evil.example, X-Forwarded-Proto: https → 200, and the e-mailed reset link is **https://evil.example/reset-password?token=…** (captured by the SMTP sink).
- Google start with X-Forwarded-Host: evil.example → redirect_uri=http://evil.example/api/v1/auth/google (Google rejects unregistered redirect URIs, so this variant mainly breaks sign-in).

### V-26 — Rate limit keyed on X-Forwarded-For · **CONFIRMED**

- 7 failed logins with the same X-Forwarded-For: 10.0.0.1 → 401,401,401,401,401,429,429 (limit 5).
- 7 failed logins rotating X-Forwarded-For → 401 ×7 (**never limited**).

### V-29 — Demo credentials shipped in bundles · **CONFIRMED (local seeded DB)**

- Parsed DEMO_ACCOUNTS from src/routes/login.tsx and the admin autofill from app/admin/login/page.tsx at runtime (values never printed). Against the seeded DB: demo **client → 200 success**, demo **professional → 200 success**, demo **admin → 200 + session**. Existence of these accounts in production remains not testable locally.
- **KI-009 CONFIRMED:** the /api/auth/login JSON response contains "token" (the session JWT).

### V-30 — /api/admin/database-status · **PARTIAL (production half)**

- Production server: no cookie → **401**; admin session → 200. Development half pending.

### V-32 — Session cookie flags · **CONFIRMED (production)**

- Set-Cookie: servio_session=…; Path=/; Max-Age=604800; Secure; HttpOnly; SameSite=lax (no __Host- prefix).

### V-33 — Google sign-in route · **CONFIRMED implemented**

- GET /api/v1/auth/google → **307** to accounts.google.com with redirect_uri=http://127.0.0.1:3100/api/v1/auth/google (derived from Host).

### V-24 — Open redirect via Google next · **PARTIAL (mechanism confirmed; callback needs real Google)**

- GET /api/v1/auth/google?next=/%5Cevil.example → state cookie servio_google_oauth stores "nextPath":"/\\evil.example" unmodified.
- The callback guard startsWith("/") && !startsWith("//") is **true** for "/\evil.example", and new URL(redirect, request.url) resolves to **http://evil.example/** (Node WHATWG URL). Callback not executed end-to-end (needs Google token exchange).

### V-03b — CMS edits vs statically prerendered pages · **CONFIRMED (production server)**

- Script vt/cms-static-test.cjs as admin: for "pricing" and "how-it-works": PUT /api/admin/cms → 200; GET /api/admin/cms shows the new hero title; the public page (/pricing, /how-it-works, both ○ static in the build) **does not show the change** after save. Original content restored afterwards (PUT 200). CMS edits to static marketing pages only appear after a rebuild/redeploy.

### Server mode switch — local file storage is disabled in production · **NEW FINDING**

- On the production server, POST /api/portal/project-files → 500; server log: {"level":"error","event":"project.file.upload.failed","message":"Local file storage is disabled in production. Configure S3-compatible storage."} (src/lib/project-file-storage.ts:43-48). With NODE_ENV=production and FILE_STORAGE_PROVIDER≠s3, every upload (project work files, verification documents, avatars) fails. Remaining tests run on a **development** server (node server.mjs, NODE_ENV unset, HOSTNAME=127.0.0.1).

### V-22b — Unverified email/password login · **CONFIRMED**

- Lower-case registration without verification → POST /api/auth/login → **403 EMAIL_NOT_VERIFIED, no session cookie**.

### V-30 — /api/admin/database-status (development half) · **CONFIRMED**

- Development server, **no cookie** → 200 {"connected":true,"checkedAt":…,"latencyMs":254}.

### V-41 — Wallet top-up double credit · **CONFIRMED (severe)**

- Arrange: PENDING WalletTransaction (amount 5000, provider_reference order_vt…) inserted for the client wallet; signature = HMAC-SHA256("orderId|paymentId", local test key secret).
- Round 1: 8 concurrent POST /api/wallet/deposit/verify → 200 + 6×200 alreadyProcessed + 2×500 → credited 5000 (no double credit that round).
- Round 2: **20 concurrent** → {"200":14,"500":6} → **credited 20,000 for one 5,000 top-up**.
- Round 3: **20 concurrent** → {"200":5,"500":15} → **credited 25,000 for one 5,000 top-up**.
- Server log shows the uncaught "Wallet top-up is invalid or already processed." for the requests that lost (500). Double credit is reproducible with only concurrent browser verify calls (no webhook needed).

### V-44 — Party accepts its own offer / milestone amount source · **CONFIRMED**

- Client sent a hire request (bid 1500), **countered its own request** (PATCH action=counter → 200, bid 1400) and then **accepted it** (PATCH action=accept → 200 ok) → project created without the professional ever responding.
- Project milestone amount = **2000** ("Project Completion") = job budgetMax, while the agreed bid was **1400**.

### V-46 — Publishing a draft via PATCH · **CONFIRMED**

- Direct POST /api/client/jobs mode=publish → 201, **+15 UserNotification rows** (14 active professionals + admin). Draft create → +0. PATCH /api/client/jobs/{id} mode=publish → 200 status OPEN, **+0 notifications**.

### V-48 — Milestone percentage validation · **REFUTED (sum ≤ 100, not = 100)**

- Milestones 60%+60% → 400 "Please review the job details." Milestones 30%+30% with mode=publish → **201** (60% allocated; amounts 600 + 600 of budgetMax 2000). The rule is "sum ≤ 100", unallocated percentage is allowed.

### V-42 — Re-pricing a funded milestone · **CONFIRMED (direction corrected)**

- Project with bid = budgetMax = 2000. Milestone funded from wallet → client charged **2200**, admin wallet +2200, Payment FUNDED (base 2000, proPayout 1800, adminNet 400), milestone AWAITING_ADMIN_APPROVAL.
- **Raise** amount ×10 → 400 "Milestone total cannot exceed the agreed project amount" (cap enforced; increases are limited to the agreed total).
- **Lower** amount 2000 → **500** on the funded milestone → **200 ok**; Payment row unchanged.
- Admin POST /api/admin/finance/milestone-payout → 200 {"paidToProfessional":**450**,"platformEarnings":100}; professional wallet **+450**, admin wallet −450. Ledger: MILESTONE_PAYMENT −2200, ADMIN_MILESTONE_RECEIPT +2200, PROFESSIONAL_PAYOUT −450, MILESTONE_EARNING +450 → the professional is underpaid by 1350 and the platform keeps 1750 more than the recorded split, while Payment still says proPayout 1800. Payout amount comes from the **current** milestone amount (wallet-ledger.ts releaseMilestoneToProfessional ← milestone-payout route baseAmount: milestone.amount).
- delete-milestone on a funded milestone → **500 "Unable to update the project."** (blocked only by the FK) — CONFIRMED.

### V-45 — Payout marks Payment COMPLETED; invoice download · **CONFIRMED**

- After payout, Payment status = COMPLETED; GET /api/v1/portal/invoices/{paymentId} → **200 application/pdf**; one row in invoices. /api/portal/earnings returns the project transaction with status COMPLETED.

### V-43 — update-progress bypasses the state machine · **CONFIRMED**

- ProjectTracking set to COMPLETED (arranged in SQL) → professional POST update-progress → 200 ok → status **IN_PROGRESS**, progress 10.

### V-34b / V-34c — complete-project and submit-review preconditions · **CONFIRMED**

- On a READY_TO_START project with an UPCOMING milestone and no work/payment: client complete-project → **200**, status **AWAITING_PROFESSIONAL_CONFIRMATION**; client submit-review (rating 1) → **200**.

### V-47 — Razorpay Route payouts disabled · **CONFIRMED**

- RAZORPAY_ROUTE_ENABLED=false → POST /api/admin/finance/payouts → **503 "Razorpay Route payouts are not enabled."**

### V-28 — Socket.IO and logout/revocation · **CONFIRMED**

- Script vt/socket-tests.cjs (socket.io-client, websocket transport, Origin = APP_URL), full environment:
  - anonymous connect → rejected "Unauthorized realtime connection";
  - connect with a valid session → CONNECTED;
  - POST /api/auth/logout → 200 (session row revoked);
  - **existing socket 4 s after logout → STILL CONNECTED** (revocation only checked at handshake);
  - new connection reusing the revoked token → rejected.

### V-10 — .env visibility to server.mjs · **CONFIRMED (fail-open in the normal .env setup)**

- Dev server restarted with AUTH_SECRET, DATABASE_URL, DIRECT_URL, REALTIME_ALLOWED_ORIGIN, APP_URL **only in the worktree .env file** (guard VT_SKIP; DB still the private instance).
  - Socket auth with a valid session → CONNECTED ⇒ AUTH_SECRET from .env **is** visible (server.mjs reads it after await app.prepare(), which loads .env).
  - After logout, a **new** connection with the **revoked** token → **CONNECTED (revocation not enforced)** ⇒ the revocation pool is created from DATABASE_URL **before** app.prepare() (server.mjs:9-11), so with DATABASE_URL only in .env the pool is null and the session-row check is skipped (fail-open).
  - REALTIME_ALLOWED_ORIGIN/APP_URL only in .env → polling response has **no Access-Control-Allow-Origin** (Socket.IO CORS not configured).
- Impact: any deployment or local setup that provides configuration through a .env file (rather than real process environment variables) runs Socket.IO without session revocation checks and without CORS configuration.

### V-27 — Development OTP provider · **CONFIRMED + 2 new findings**

- Dev server, PHONE_OTP_PROVIDER=development, DEV_PHONE_OTP unset: POST /api/auth/send-phone-otp → 200; the **code is printed to the server log** ("[phone-otp:development] code for <phone> (<role>): <code>") and equals the **fixed development code** hard-coded in src/lib/phone-otp-provider.ts. POST /api/auth/verify-phone with it → 200 success (after the timezone fix below).
- **NEW defect — OTP verification fails when the database session TimeZone is not UTC:** on the private cluster (TimeZone = Asia/Calcutta, inherited from Windows by initdb) verify-phone with the correct code → **400 "Invalid verification code."** Cause: the atomic UPDATE in verifyPhoneOtp (src/lib/phone-otp-provider.ts, raw SQL "expiresAt" > NOW()) compares a UTC timestamp-without-time-zone with NOW() evaluated in the session time zone → a code expiring in 10 min looks 5 h 20 min expired. Proof: SQL on the fresh OTP row → ("expiresAt" > NOW()) = false, ("expiresAt" > now() at time zone 'UTC') = true. After ALTER DATABASE servio_app SET timezone TO 'UTC' (private test DB only) and a server restart, the same flow → 200. The developer's local klick-pro database also reports TimeZone Asia/Calcutta, so phone OTP verification is expected to fail there as well. Production impact depends on the DB server time zone (Supabase default UTC → unaffected) [production still NEEDS VALIDATION].
- Production-mode note (from code, observed behaviour of send in prod not needed): without DEV_PHONE_OTP and Twilio a random code is stored and never delivered/logged.

### V-23 — login-phone-password for an unverified e-mail · **CONFIRMED**

- Registered via verified phone + unverified e-mail. POST /api/auth/login-phone-password → **403** "email is not confirmed" **and Set-Cookie servio_session** (valid session).
- With that cookie: GET /api/auth/me → 200 user (role CLIENT, emailVerifiedAt null); **POST /api/client/jobs → 201 (job created)**; GET /dashboard → 307 → /verify (pages redirect, APIs do not).
- Phone **OTP** login (login-phone) for the same unverified account → 403 **without** a session (correct).

### V-22 — Unverified users and sessions · **CONFIRMED (final)**

- Email+password login and phone OTP login do not issue sessions to unverified accounts; **login-phone-password does** (V-23), and with it **API calls succeed** (KI-025 confirmed: no API enforces email verification).

### Account enumeration (KI-024) · **CONFIRMED**

- send-phone-login-otp for an unknown phone → 404; send-phone-otp for a registered phone → 409.

### V-40 — Avatar URL and profile save · **CONFIRMED**

- POST /api/profile/avatar (client, PNG) → 200 avatarUrl = **relative** "/api/profile/avatar?key=avatars%2F<userId>%2F<uuid>.png".
- GET that URL: owner **200**; another signed-in user **404**; admin **404**; anonymous **401** → avatars stored as the public avatarUrl cannot be displayed to anyone but the owner.
- POST /api/profile with profilePhotoUrl = that avatarUrl → **400 "Enter a valid photo URL."**; same body with profilePhotoUrl "" → 200. The client profile page cannot save after an avatar upload unless the field is cleared.

### V-34 — companyWebsite scheme · **REFUTED (not writable through the app)**

- POST /api/professional/profile with a **valid** body + companyWebsite "javascript:alert(1)" → 200, User.companyWebsite stays **null**; POST /api/profile (client) with the same field → 200, not stored. Neither zod schema contains companyWebsite (unknown keys stripped); only scripts/add-faker-clients.ts writes it. The href rendering risk exists only for data inserted outside the API.

### KI-030 — passwordHash returned by professional profile save · **CONFIRMED (runtime)**

- POST /api/professional/profile with a valid body → 200 {"profile":{…}} and the response JSON **contains "passwordHash" with a bcrypt value ($2…)**.

### V-35 — Local-storage path traversal on verification documents · **CONFIRMED (cross-user read, local storage only)**

- Professional A uploads a verification document → key verification/<A>/<uuid>.png. GET as A → 200.
- Professional B (another account):
  | Path requested                                             | Status                              |
  | ---------------------------------------------------------- | ----------------------------------- |
  | …/documents/verification/<A>/<uuid>.png                    | 403                                 |
  | …/documents/verification/<B>/../<A>/<uuid>.png             | 403 (router normalises literal ..)  |
  | …/documents/verification/<B>/%2e%2e/<A>/<uuid>.png         | 403                                 |
  | **…/documents/verification/<B>/..%2F<A>%2F<uuid>.png**     | **200 image/png — A's ID document** |
  | **…/documents/verification/<B>/%2e%2e%2f<A>%2f<uuid>.png** | **200 image/png**                   |
- Cause: prefix check on the joined raw key passes ("verification/<B>/…"), then the local provider's path.resolve normalises ".." to A's folder (src/lib/project-file-storage.ts localPath keeps it inside the storage root but not inside the user's folder). Only affects the **local** storage provider (development/non-production; production refuses local storage), S3 keys are literal.

### V-07 — Admin hard delete of a user · **CONFIRMED (two behaviours)**

- User with activity (13 jobs, 3 projects, 3 requests, 2 payments, wallet, 9 notifications, 8 sessions, client profile) on the db-push (full-FK) database: DELETE /api/admin/users/{id} → **500 "Unable to delete account. It may have related records."**, nothing deleted (restricting FKs). Admins cannot delete active users.
- Freshly registered user (1 ApiToken): DELETE → **200 {"ok":true}**, user removed, **ApiToken row left orphaned** (no FK on ApiToken.userId) — confirms Prisma-only relations leave orphans.

### V-31 — Admin bootstrap without ADMIN_EMAIL · **CONFIRMED (part a)**

- Dev server started with ADMIN_BOOTSTRAP_USERNAME=vt-bootstrap-admin and a 17-char ADMIN_BOOTSTRAP_PASSWORD, **no ADMIN_EMAIL**. POST /api/admin/login with those credentials → **401 "Invalid administrator credentials."**; no User row with that username created. Bootstrap silently does nothing when ADMIN_EMAIL is missing.

### V-50 — Fonts actually rendered (Chrome) · **CONFIRMED**

- /pricing: body font-family "Inter, "Open Sans", ui-sans-serif, system-ui, sans-serif", h1 "Poppins, Inter, …". document.fonts contains only Next's internal Geist faces (unloaded); **no Inter/Poppins @font-face**. Canvas text width with "Inter, …", "Poppins, …" and "ui-sans-serif, system-ui" is identical (506.375 px) → text renders in the system fallback font (on a machine without Inter/Poppins installed).

### V-54 — White-on-orange CTA contrast (Chrome) · **CONFIRMED (fails WCAG AA)**

- Computed --cta = lab(66.33% 48.09 75.56), --cta-foreground = lab(98.84% −0.64 −1.75) → contrast ratio **2.57:1** (AA requires 4.5:1 for normal text, 3:1 for large text).

### V-51 — Sentry browser SDK vs CSP (Chrome) · **CONFIRMED**

- Dev server with a **fake, non-resolvable** DSN host (sentry.localtest.invalid; no real Sentry contact). Error thrown in the page → stack shows sentryWrapped (SDK active) → **1 securitypolicyviolation: violatedDirective connect-src, blocked host sentry.localtest.invalid**; no network request left the browser. Real *.ingest.sentry.io hosts are equally absent from connect-src (next.config.ts), so browser error reporting cannot work.

### V-52 — Socket.IO and polling on anonymous pages (Chrome) · **PARTIAL**

- Anonymous /how-it-works for 104 s: /api/auth/me ×2 and /api/portal/notifications ×2 (both 401) — the 15 s notification poll does **not** repeat for anonymous users (it only runs after a successful load).
- src/components/RealtimeNotifications.tsx creates the socket with reconnectionAttempts: Infinity and **no signed-in guard**; WebSocket attempts are not visible to the browser network tool and server-side TIME_WAIT sampling was inconclusive → repeated anonymous reconnects **not proven at runtime**.

### V-05b — Admin user detail with client profile · **REFUTED (no crash) + new defect**

- GET /api/admin/users/1 (admin) returns user.**clientProfiles** as a **single object** (Prisma 1:1) with savedLocations as a single object ({"label":"Primary Address",…,"isPrimary":true}).
- app/admin/users/page.tsx:296 reads const clientProfile = detail?.user.clientProfiles?.[0] → **undefined** for an object, so the optional chain at :527 short-circuits (no TypeError). **Defect:** the admin user detail never displays client-profile data (company, industry fallback, address, saved locations) for any client.

### Browser authentication constraint

- Admin-only browser checks (V-52 admin tab, V-53, V-55) require a signed-in admin in Chrome. The automation may not enter passwords, and the Chrome extension blocks setting the session cookie from page scripts (a plain test cookie could be set; servio_session could not). The developer was asked to sign in manually in the test tab (local server, private DB).

### V-53 — Duplicate admin toasts (Chrome, admin signed in by the developer) · **CONFIRMED**

- Developer signed in manually on /admin/login (demo autofill) in the test tab. A MutationObserver counted [data-sonner-toast] elements.
- Trigger: POST /api/auth/register for a new PROFESSIONAL from the test script (fires notifyAdminsOfNewAccount).
- Result: **2 toasts** with the text "New professional registration — Toast Trigger registered as a professional." (one per listener: global RealtimeNotifications and AdminRealtime); 3 notification titles duplicated among visible toasts.
- Observation: immediately after the manual sign-in, **15 historical notifications were shown as toasts** at once; after a reload of /admin no toasts were shown (16 unread notifications remained in the inbox). The post-login burst was observed once and not investigated further.

### V-55 — Toast styling (Chrome) · **PARTIAL**

- Admin realtime toasts render as a **white card** (background rgb(255,255,255), text rgb(23,23,23), radius 8px, class w-[min(380px,calc(100vw-2rem))]) — i.e. custom toasts, not the forced dark card from src/components/ui/sonner.tsx. Styling of plain toast.success/error calls was not triggered.

### V-52 — Socket connections per admin tab · **PARTIAL (unchanged)**

- WebSocket connections are not exposed by the browser network tool and could not be attributed per component; remains code-evidence only (global RealtimeNotifications + AdminRealtime + MessagesWorkspace each call io()).

### V-04 — Lint and typecheck · **REFUTED (no warnings)**

- `npx eslint . --format json` → 346 files, **0 errors, 0 warnings** (doc cited 6 `react-hooks/exhaustive-deps` warnings from an older report). `npm run typecheck` (`tsc --noEmit`) → exit 0.
- Inline suppressions outside `src/generated`: exactly **1** (`src/routes/professional/pro.$proId.tsx:117`, `react-hooks/exhaustive-deps`) — confirms coding-standards. ESLint ignores `.next`, `node_modules`, `src/generated` (`eslint.config.js:8`).

### V-05 — `ClientProfile.savedLocations` 1:1 typing vs 1:N data · **CONFIRMED + new defect**

- Script `vt-scripts/db-checks.ts v05` (servio_app): created a CLIENT user + `ClientProfile` + 3 `ClientSavedLocation` rows (1 primary).
- Inserting a 2nd `isPrimary=true` row → **rejected P2002** (partial unique `ClientSavedLocation_one_primary_idx` works).
- `db.clientProfile.findUnique({ include: { savedLocations: true } })` with 3 rows → returns **a single object, not an array**, and it was an arbitrary **non-primary** row (`{"id":3,"label":"L3","isPrimary":false}`). Nested `savedLocations: { disconnect: true }` → P2014.
- Code consuming this shape: `app/api/profile/route.ts:53` (`GET /api/profile` returns one arbitrary location as `profile.savedLocations`); `app/api/admin/users/[id]/route.ts:115` selects it and `app/admin/users/page.tsx:527` calls `clientProfile?.savedLocations.map(...)` typed as an array → expected runtime `TypeError` for any client that has a ClientProfile (object or `null` has no `.map`). → browser confirmation queued as **V-05b**.

### V-06 — `DirectHireNegotiation` model/table mismatch · **CONFIRMED**

- `db.directHireNegotiation.findMany()` on `servio_migrate` (migrations only) → **P2021** `The table public.DirectHireNegotiation does not exist in the current database.`; on `servio_app` (db push) → OK.
- Only caller: `scripts/reset-marketplace-catalog.ts:485` (`tx.directHireNegotiation.deleteMany()`) → that script fails on any migration-built database.

## 6. Documentation updates applied after testing

All documentation edits below were made **after** the corresponding tests completed (2026-09-17, 08:55–09:35 IST). Marker legend used in docs: `[VALIDATED 2026-09-17 · V-xx]`, `[CORRECTED 2026-09-17 · V-xx]`, `[PARTIALLY VALIDATED 2026-09-17 · V-xx]`, `[NEEDS VALIDATION — not testable locally]`.

### docs/04-database + docs/05-api (agent U3)

| File                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Test                                                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04-database/database-design.md | Scope note (runtime-checked); 41/69 tables from migrations, full list of 28 missing + DirectHireNegotiation mismatch; §9.2/§9.3 16 FKs (14 existing), 30 indexes, 2 migration-only indexes, 19 default diffs                                                                                                                                                                                                                                                                                                                 | V-01, V-06                                                                                                                                                |
| 04-database/database-design.md | §10.1 checksum drift rewritten (no build failure; edited SQL silently not applied); 42P01 replay confirmed                                                                                                                                                                                                                                                                                                                                                                                                                   | V-02                                                                                                                                                      |
| 04-database/database-design.md | §7.1 admin delete 500 / orphan ApiToken; funded milestone delete 500; §7.3 OTP NOW() timezone defect; §11.1 seed P2003; §12/§14 counts → 28; finance marker "not testable locally"                                                                                                                                                                                                                                                                                                                                           | V-07, V-42, V-27, S-14, V-01                                                                                                                              |
| 04-database/schema.md          | savedLocations include = one arbitrary object; admin detail never shows client profile; legend/DirectHireNegotiation/Payment.milestone_id/provider_reference index tags                                                                                                                                                                                                                                                                                                                                                      | V-05, V-05b, V-01, V-06                                                                                                                                   |
| 04-database/data-dictionary.md | mixed-case email never logs in; milestone percentage ≤100                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | V-21, V-48                                                                                                                                                |
| 05-api/api-specification.md    | Origin guard (same-origin 403, Bearer 403, webhooks), realtime bypass, XFF rate limit, open redirect partial, mixed-case, login-phone-password session + unverified API access, host-header reset link, admin delete, CMS static, database-status, avatar 400, prod uploads 500, PATCH publish, own counter-offer + budgetMax, passwordHash, ..%2F doc read, payout COMPLETED, double credit numbers, /api/v1/v1 404, duplicate toasts, milestone re-price, update-progress, complete-project/submit-review; §B.13 items 1–3 | V-20, V-12, V-26, V-24, V-21, V-22/23, V-25, V-07, V-03b, V-30, V-40, PROD-STORAGE, V-46, V-44, KI-030, V-35, V-45, V-41, V-13, V-53, V-42, V-43, V-34b/c |
| 05-api/openapi.yaml            | Description-only edits (Origin rule, /api/v1/v1, webhooks, login-phone-password, forgot-password host header, database-status, passwordHash, deposit verify concurrency, profilePhotoUrl, document traversal); js-yaml parse ok                                                                                                                                                                                                                                                                                              | same                                                                                                                                                      |
| (left)                         | 6 api-spec markers annotated "not testable locally"; 21 api-spec + 31 openapi schema-shape markers untouched; database-design prismaSchemaVersion, Payment.provider casing, ProjectCompletion/ReviewRequest, ClientJobAttachment                                                                                                                                                                                                                                                                                             | —                                                                                                                                                         |

### docs/01-product + docs/02-requirements (agent U1)

| File                                           | Change                                                                                                                                                                                                                                                                                                                                                                                                | Test                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 01-product/BRD.md                              | ADMIN_EMAIL bootstrap; prod uploads need S3; BR-ACC-03 mixed-case; BR-ACC-04 → Partial (phone+password session); BR-JOB-02 ≤100%; BR-JOB-03 PATCH publish silent; BR-PROP-04 own counter accept; BR-PRJ-02/BR-PAY-03 funded re-price + payout; CMS static; §10 webhook 403 (live not testable); new §10 rows double credit, underpayment, host header, XFF; mobile/PRI-04/D-05 "not testable locally" | V-31, PROD-STORAGE, V-21, V-22/23, V-48, V-46, V-44, V-42/45, V-03b, V-20, V-41, V-25, V-26          |
| 01-product/PRD.md                              | Unverified login corrected; admin delete/detail; CMS static; auth defects; PAY notes; mobile Origin block; turn enforcement; state caveats; webhook/wallet journey; SMS dev code; NEW_JOB trigger                                                                                                                                                                                                     | V-22/23, V-07, V-05b, V-03b, V-21, V-27, V-33, V-41, V-42, V-45, V-47, V-20, V-44, V-34b, V-43, V-46 |
| 01-product/user-stories.md                     | ~32 acceptance-criteria edits across AUTH, ACC, JOB, PROP, PRJ, PAY, VER, ADM, CMS, NOT stories                                                                                                                                                                                                                                                                                                       | V-03b…V-53                                                                                           |
| 02-requirements/functional-requirements.md     | 11 FRs → Partial (AUTH-006, AUTH-007, AUTH-017, ACC-002, JOB-003, PRJ-004, PRJ-011, PAY-003, PAY-008, VER-004, ADM-003); totals now 130 Implemented / 29 Partial / 4 Not implemented; ~30 rows tagged                                                                                                                                                                                                 | V-21, V-27, V-40, V-46, V-42, V-43, V-41, V-35, V-07 …                                               |
| 02-requirements/SRS.md                         | Access, env/HOSTNAME, storage, CMS, Origin, OTP, XFF, API alias, cookie, socket, email links, missing tables, lint 0/0, D-01/D-04/D-15/D-19; §4 counts                                                                                                                                                                                                                                                | V-01, V-04, V-06, V-10, V-11, V-13, V-20, V-25, V-26, V-27, V-28, V-32                               |
| 02-requirements/non-functional-requirements.md | MAINT-003 corrected (checksum drift no failure); migration gaps + seed failure; MAINT-001 lint 0/0; SEC-015 Partial (double credit); SEC-020 Partial (open redirect); many SEC/AVAIL/OBS/USAB/A11Y/I18N/COMP/PORT rows tagged                                                                                                                                                                         | V-02, V-01, V-06, S-14, V-04, V-41, V-24, …                                                          |
| (left)                                         | PRD CAT/Service model, DSP replies, browser-push flags; US-ACC-006; SRS D-19 flag + unused models; FR-AUTH-018, FR-PAY-017, §3.1, §3.4, §2 intro; NFR-OBS-001 withSentryConfig; label-definition lines                                                                                                                                                                                                | —                                                                                                    |

### docs/03-architecture (agent U2)

| File                                  | Change                                                                                                                                                                                                                                                                                                                                                                                      | Test                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| solution-architecture.md              | Next 16.3.0 Turbopack; static marketing pages despite force-dynamic (CORRECTED); CMS static; HOSTNAME LAN bind; socket fail-open/CORS with .env-only config; same-origin 127.0.0.1 rejected; realtime no x-request-id; prod local storage 500; ..%2F traversal; Sentry CSP; XFF rate limit; F-01 partially validated; F-03 validated → Critical; F-04 build does not fail (CORRECTED); F-09 | V-03, V-03b, V-11, V-10, V-28, V-20, V-12, PROD-STORAGE, V-35, V-51, V-26, V-41, V-02, V-31 |
| architecture-decisions.md             | .env fail-open + HOSTNAME; webhook 403; double credit; migrate resolve not needed (CORRECTED); Route 503; OTP log + timezone; storage                                                                                                                                                                                                                                                       | V-10, V-11, V-20, V-41, V-02, V-47, V-27, PROD-STORAGE                                      |
| integrations.md                       | Route 503, Sentry CSP, webhook 403, double credit, host header, .env visibility, database-status, migrations; new OTP timezone risk row                                                                                                                                                                                                                                                     | V-47, V-51, V-20, V-41, V-25, V-10, V-30, V-01, V-27                                        |
| authentication-and-authorization.md   | login-phone-password session, mixed-case, cookie flags, socket revocation, host header, OTP, open redirect, same-origin (CORRECTED), database-status, demo creds, bootstrap, XFF; NV-AUTH-08 resolved                                                                                                                                                                                       | V-23, V-21, V-32, V-10, V-28, V-25, V-27, V-24, V-20, V-30, V-29, V-31, V-26                |
| diagrams/api-flow.md                  | double credit (incl. Note), socket revocation, Origin                                                                                                                                                                                                                                                                                                                                       | V-41, V-28, V-10, V-20                                                                      |
| diagrams/application-flow.md          | webhook 403, double credit                                                                                                                                                                                                                                                                                                                                                                  | V-20, V-41                                                                                  |
| diagrams/authentication-flow.md       | auth flow outcomes                                                                                                                                                                                                                                                                                                                                                                          | V-21, V-22, V-23, V-25, V-26, V-27                                                          |
| diagrams/container-architecture.md    | realtime bypass, HOSTNAME, .env                                                                                                                                                                                                                                                                                                                                                             | V-12, V-11, V-10                                                                            |
| diagrams/system-context.md            | webhook 403                                                                                                                                                                                                                                                                                                                                                                                 | V-20                                                                                        |
| diagrams/user-vs-admin-flow.md        | demo creds partial, database-status, socket                                                                                                                                                                                                                                                                                                                                                 | V-29, V-30, V-10                                                                            |
| diagrams/deployment-architecture.md   | prod storage, CMS static, checksum; new A-9..A-11 (HOSTNAME, .env, Sentry CSP)                                                                                                                                                                                                                                                                                                              | PROD-STORAGE, V-03b, V-02, V-11, V-10, V-51                                                 |
| diagrams/database-erd.md              | 26 → 28 tables + name mismatch + indexes (CORRECTED); single saved location; seed P2003                                                                                                                                                                                                                                                                                                     | V-01, V-06, V-05/05b, S-14                                                                  |
| (left, tagged "not testable locally") | hosting/Vercel, Supabase, Flutter, live webhooks, Razorpay order error UI, Route idempotency, Maps fallbacks, production data/config                                                                                                                                                                                                                                                        | —                                                                                           |

### docs/06-ui + docs/07-development + docs/08-operations (agent U4)

| File                                   | Change                                                                                                                                                                                                                                                                | Test                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 08-operations/troubleshooting.md       | T-01 rewritten (silent drift, no migrate resolve); T-06/07/10/13/15/17/19 runtime evidence; new T-21 replay 42P01, T-22 HOSTNAME, T-23 OTP timezone, T-24 seed P2003, T-25 origin ≠ APP_URL, T-26 CMS vs static pages                                                 | V-02, V-10, V-20, V-27, PROD-STORAGE, V-31, V-26, V-30, V-11, S-14, V-03b                                          |
| 08-operations/environment.md           | .env read order in server.mjs, DATABASE_URL, APP_URL, REALTIME_ALLOWED_ORIGIN, HOSTNAME, FILE_STORAGE_PROVIDER, ADMIN_EMAIL, DEV_PHONE_OTP/OTP logging                                                                                                                | V-10, V-20, V-25, V-11, PROD-STORAGE, V-31, V-27                                                                   |
| 08-operations/security.md              | CSRF/CORS/XSS/rate-limit/cookie/upload/logging rows; RISK-SEC-001/002/004/005/007 (direction corrected)/008/009/010 (partial)/013/015/017/020/024/030; companyWebsite corrected; new RISK-SEC-032 cross-user doc read, 033 double credit (Critical), 034 passwordHash | V-20, V-10, V-26, V-32, V-40, V-27, V-29, V-25, V-42, V-23, V-24, V-28, V-21, V-31, V-30, V-34, V-35, V-41, KI-030 |
| 08-operations/deployment.md            | Turbopack build, static routes, silent drift, bind address, prod local storage refused                                                                                                                                                                                | V-03, V-03b, V-02, V-01, V-11, PROD-STORAGE                                                                        |
| 07-development/coding-standards.md     | lint 0 warnings                                                                                                                                                                                                                                                       | V-04                                                                                                               |
| 07-development/testing-strategy.md     | CI gaps/build result; validation log as manual evidence; §3.1 guarded approach                                                                                                                                                                                        | V-01–V-04, V-20, S-14                                                                                              |
| 07-development/development-workflow.md | setup notes; migration-edit rule; session DATABASE_URL warning                                                                                                                                                                                                        | V-10, V-02, S-14, S-11                                                                                             |
| 06-ui/design-system.md                 | DS-7 refuted; fonts; contrast; toasts                                                                                                                                                                                                                                 | V-03, V-50, V-54, V-55                                                                                             |
| 06-ui/ui-specification.md              | UI-D5, UI-D6, Google route, Sentry/CSP, lint note; new UI-D16/17/18                                                                                                                                                                                                   | V-03, V-03b, V-52, V-53, V-33, V-51, V-04, V-05b, V-40                                                             |
| 06-ui/screen-inventory.md              | admin users + client profile findings, CMS static, demo accounts                                                                                                                                                                                                      | V-05b, V-07, V-40, V-27, V-03b, V-29                                                                               |
| (left)                                 | DIRECT_URL pooler, loading.tsx, redirect-in-try, skeleton, orphaned payouts API, migration method, zod per route, cms-live-editable selector; production-only now "— not testable locally"                                                                            | —                                                                                                                  |

### Orchestrator

| File                                         | Change                                                                                                                                                                                                                                                                                                                                  | Test       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 07-development/known-issues-and-tech-debt.md | Confidence column now includes runtime confirmation; KI-001/003/006/008/009/010/011/012/014/016/017/020–027/030/033/034/039/041/044/049/050/051/053/070/077 updated; KI-013 raised to Critical; new KI-079–KI-091; §4.1 refuted claims table; Q-02/Q-05/Q-06 updated, Q-13 added; change hazards updated (session DATABASE_URL warning) | all        |
| README.md                                    | runtime-validated note; 28 tables + double credit in warning; validation log in map; marker legend (VALIDATED/CORRECTED/PARTIALLY VALIDATED/not testable locally); testing row                                                                                                                                                          | V-01, V-41 |
| memory (outside repo)                        | corrected checksum-drift memory; new memory on session DATABASE_URL → klick-pro                                                                                                                                                                                                                                                         | V-02, S-11 |
