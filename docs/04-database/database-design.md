# Database Design

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

> Scope: physical and logical design of the Klick-Pro (`servio`) PostgreSQL database as implemented by `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, `prisma.config.ts`, `src/lib/db.ts`, `server.mjs` and `scripts/*.sql`. Written from static analysis; selected claims were then checked on 2026-09-17 against a private local PostgreSQL 18 built with `prisma migrate deploy` / `prisma db push` (see [LOCAL_VALIDATION_LOG](../validation/LOCAL_VALIDATION_LOG.md)) and are tagged `[VALIDATED …]` / `[CORRECTED …]`. Remaining live-state claims are marked `[NEEDS VALIDATION]`.
>
> Companion documents: [schema.md](./schema.md) (keys, relations, indexes per model) · [data-dictionary.md](./data-dictionary.md) (every field) · [database-erd.md](../03-architecture/diagrams/database-erd.md) (Mermaid ERDs).

---

## 1. Summary

| Item | Value | Evidence |
|---|---|---|
| Engine | PostgreSQL. Native local install for development, Postgres 16 service in CI, AWS target undecided. (An earlier "Supabase PgBouncer" note came from a code comment with no supporting configuration; corrected 2026-09-19.) | `prisma/schema.prisma:7-9`, `prisma/migrations/migration_lock.toml`, `.github/workflows/quality.yml`, [aws-target.md](../08-operations/aws-target.md) |
| ORM | Prisma 7.9 (`prisma`, `@prisma/client`, `@prisma/adapter-pg` ^7.9.1), generator `prisma-client` → `generated/prisma` (moved out of `src/` and gitignored, 2026-09-19; imported via the `@generated/*` alias) | `package.json`, `prisma/schema.prisma:1-5`, `tsconfig.json` |
| Preview features | `partialIndexes` (used for two partial unique indexes) | `prisma/schema.prisma:4,220,759` |
| Models / enums | **69 models, 5 enums** | `prisma/schema.prisma` |
| Declared relations (FK side) | **39** Prisma relations; **23** FK constraints actually created by migrations | see §9 |
| Migrations | **1** directory (`0_init`), squashed from 28 in commit `b96d07d`. A fresh replay reproduces `schema.prisma` exactly — `migrate diff` reports no difference (re-measured 2026-09-19, see KI-088). | `prisma/migrations/` |
| Tables created by migrations | **41 of 69** models have a `CREATE TABLE` in some migration (one of them, `DirectHireNegotiation`, under the wrong table name); **28 have no table** `[CORRECTED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` | §9.1 |
| DB CHECK constraints | 11 (all added by migrations; not expressible in Prisma schema) | §8 |
| Triggers / functions / RLS policies / views | **None** in repository migrations | `grep TRIGGER|FUNCTION|POLICY` over `prisma/migrations` = 0 |
| Money representation | `Int` whole Indian rupees (INR); converted ×100 to paise only at the Razorpay boundary | §6 |
| Soft deletion | Not implemented (no `deletedAt`); deactivation/flag fields only | §7 |
| Seeding | `prisma/seed.ts` (idempotent upserts; faker; categories, users, jobs, wallet ledger) | §11 |
| Models with zero application usage | 26 (see §12) | usage scan |

---

## 2. Connection handling

### 2.1 Runtime client (`src/lib/db.ts`) — Implemented

| Aspect | Behaviour | Evidence |
|---|---|---|
| Import guard | `import "server-only"` — cannot be bundled into client components | `src/lib/db.ts:1` |
| Connection string | `DATABASE_URL`; when `NODE_ENV === "test"` uses `TEST_DATABASE_URL`. Throws at import if missing | `src/lib/db.ts:18-26` |
| Driver adapter | `new PrismaPg(pgPool)` using a **shared** `pg.Pool`: passing a config object instead would build a new pool per adapter. `max` is a per-process cap, to be sized against `max_connections` ÷ process count plus the `max: 1` pool in `server.mjs`. | `src/lib/db.ts` |
| Pool settings | `max: 5`, `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 10_000` | `src/lib/db.ts:31-37` |
| Singleton | Stored on `globalThis` (`globalForPrisma.prisma`, `.pgPool`, `.prismaModelFingerprint`) **only when `NODE_ENV !== "production"`** to survive Next.js hot reload. In production each Node process creates one client at module load | `src/lib/db.ts` |
| Hot-reload invalidation | Cached client is reused only if its model-list fingerprint (`Object.keys(Prisma.ModelName)`) matches the generated client. Replaced the hand-maintained `prismaSchemaVersion` string on 2026-09-19, so adding or removing a model now invalidates automatically | `src/lib/db.ts` |
| Exported symbol | `db` (the only app-wide DB handle; "god node" in graphify report) | `src/lib/db.ts:43` |

Observations:
- The hard-coded `prismaSchemaVersion` string must be bumped manually after schema changes; it was last set for the 2026-08-31 sessions migration although later migrations exist (`202609010001`, `202609110001`). Impact is dev-only (stale client after HMR). `[NEEDS VALIDATION]`
- On the non-production path a new `Pool` is still created on every module evaluation when `globalForPrisma.pgPool` is absent; the pool is cached afterwards.

### 2.2 Second pool in the custom server (`server.mjs`) — Implemented

`server.mjs:8-10` creates a separate `pg.Pool` (`max: 2`, `idleTimeoutMillis: 30000`) from `DATABASE_URL` for the Socket.IO handshake. It runs raw SQL `SELECT s.revoked_at, s.expires_at, u."isActive" FROM sessions s JOIN "User" u ...` (`server.mjs:46-50`). Total connections per process are therefore up to **7** (5 Prisma + 2 socket). If `DATABASE_URL` is unset, `dbPool` is `null` and the revocation check is skipped (see [authentication-and-authorization.md](../03-architecture/authentication-and-authorization.md)).

### 2.3 CLI / migrations (`prisma.config.ts`) — Implemented

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | runtime (`src/lib/db.ts`, `server.mjs`), seed (`prisma/seed.ts:21`), scripts | Pooled application connection |
| `DIRECT_URL` | Prisma CLI only (`prisma.config.ts:6-9`) | Session-capable direct connection needed by `migrate deploy` (comment `prisma.config.ts:18-19`). Falls back to `DATABASE_URL`, then to `postgresql://localhost:5432/prisma_validate` so `prisma validate/generate` run without env |
| `TEST_DATABASE_URL` | runtime when `NODE_ENV=test` | Test isolation (no test suite exists in repo — see [testing-strategy.md](../07-development/testing-strategy.md)) |

`prisma.config.ts` also sets `migrations.path = prisma/migrations` and `migrations.seed = "npx tsx ./prisma/seed.ts"`. `npm run build` = `prisma migrate deploy && next build` (`package.json:8`), i.e. **migrations are applied at build time** against whatever `DIRECT_URL`/`DATABASE_URL` the build environment has.

### 2.4 Raw SQL in application code

| Location | SQL | Why raw |
|---|---|---|
| `src/lib/phone-otp-provider.ts:149-158` | Conditional `UPDATE "OtpCode" SET attempts = attempts+1, consumedAt = CASE ...` | Atomic attempt counting / single consumption |
| `app/api/wallet/route.ts:75-80` | `UPDATE "Wallet" SET "pendingBalance" = "pendingBalance" + $amt WHERE id = $id AND balance - pendingBalance >= $amt` | Atomic balance reservation for withdrawals |
| `app/api/admin/database-status/route.ts:28` | `SELECT 1` | Health check |
| `server.mjs:47` | session revocation lookup (above) | Runs outside Next/Prisma |

All use parameterised `Prisma.sql` / tagged templates or `pg` parameters; no `$queryRawUnsafe` in `app/`, `src/` or `scripts/`.

---

## 3. Schema domains

Grouping is by business capability (derived from model names, relations and API usage). Counts in brackets.

| # | Domain | Models | Primary API surface |
|---|---|---|---|
| D1 | Identity & auth [4] | `User`, `Session`, `ApiToken`, `OtpCode` | `app/api/auth/[action]`, `src/lib/auth.ts`, `src/lib/phone-otp-provider.ts` |
| D2 | Client profile & locations [3] | `ClientProfile`, `ClientSavedLocation`, `ClientHiringNeed` | `app/api/profile/**` |
| D3 | Service catalogue [2] | `ServiceCategory`, `Service` | `app/api/admin/services`, `src/lib/queries/marketplace.ts`, `professional-discovery.ts` |
| D4 | Jobs [4] | `ClientJob`, `ClientJobAttachment`, `ClientJobMilestone`, `FavoriteJob` | `app/api/client/jobs/**`, `app/api/professional/favorite-jobs/**` |
| D5 | Proposals / hire requests [2] | `ProjectRequest`, `ProjectNegotiation` | `app/api/professional/proposals`, `src/lib/project-request-actions.ts` |
| D6 | Project tracking & delivery [9] | `ProjectTracking`, `ProjectTimelineEvent`, `ProjectMilestone`, `ProjectWorkUpload`, `ProjectCompletionRequest`, `ProjectRevisionRequest`, `ProjectReviewRequest`, `ProjectReview`, `StoredFile` | `app/api/portal/project-actions`, `project-files/**`, `portal/[resource]` |
| D7 | Payments, wallet, ledger, payouts, invoices [7] | `Payment`, `RazorpayWebhookEvent`, `Wallet`, `WalletTransaction`, `ProjectTransaction`, `ProjectWithdrawal`, `Invoice` | `app/api/wallet/**`, `app/api/webhooks/razorpay`, `app/api/admin/finance/**`, `src/lib/wallet-ledger.ts` |
| D8 | Disputes [2] | `ProjectDispute`, `ProjectDisputeMessage` | `app/api/portal/project-actions`, `app/api/admin/disputes/**` |
| D9 | Messaging [6] | `SocketConversation`, `SocketMessage`, `SocketConversationClear`, `CallSession`, `MessageConversation`, `Message` | `app/api/v1/messages`, `server.mjs`, `app/api/portal/[resource]` (`messages`) |
| D10 | Notifications [3] | `UserNotification`, `UserNotificationState`, `BrowserSubscription` | `src/lib/marketplace-notifications.ts`, `app/api/dashboard` |
| D11 | Verification / KYC [4] | `ProfessionalVerification`, `VerificationDocumentReview`, `PersonaVerification`, `PersonaWebhookEvent` | `app/api/professional/verification`, `app/api/admin/verifications`, `src/lib/persona.ts` |
| D12 | CMS, website content & support [10] | `CmsPage`, `CmsPageVersion`, `CmsMedia`, `WebsitePage`, `LegalPage`, `PageConfiguration`, `WebsitePageOverride`, `PageTextOverride`, `Faq`, `ContactRequest` | `app/api/admin/support`, `app/api/contact`, `src/lib/queries/faq.ts` (CMS itself is file-based JSON, not these tables) |
| D13 | Audit [1] | `AuditLog` | `src/lib/audit-log.ts` |
| D14 | Legacy / import archive [12] | `HireJob`, `HireContract`, `HireAttachment`, `HireMilestone`, `DirectHireNegotiation`, `LegacyUser`, `LegacyUserProfile`, `LegacyProfessionalDetail`, `LegacyLocation`, `LegacyVerification`, `SQLiteMigrationTableArchive`, `SQLiteMigrationAudit` | only `scripts/reset-marketplace-catalog.ts` and one read of `legacyUserProfile` in `app/api/admin/data/[resource]/route.ts:293` |

Core business flow represented by the schema (verified relations):

```text
User(CLIENT) ─< ClientJob ─< ProjectRequest >─ User(PROFESSIONAL)
                    │              │ 1:1
                    │        ProjectTracking ─< ProjectMilestone ─ 0..1 Payment ─ (Invoice by payment_id, no FK)
                    │              ├─< ProjectTimelineEvent
                    │              └─< ProjectWorkUpload
                    └─< ClientJobMilestone (planned split at job-posting time)
User ─ Wallet (userId unique, no FK) ─< WalletTransaction
```

---

## 4. Naming conventions (actual)

The schema mixes three conventions; documents and raw SQL must quote identifiers exactly.

| Convention | Tables | Columns | Examples |
|---|---|---|---|
| A. PascalCase table = model name, camelCase columns (Prisma default) | Majority (`User`, `ClientJob`, `ProjectTracking`, `Payment`, `Wallet`, `OtpCode`, `SocketMessage`, `Faq`, …) | camelCase, quoted (`"userId"`, `"createdAt"`) | `"ClientJob"."budgetMin"` |
| B. snake_case table via `@@map`, snake_case columns via `@map` | `sessions`, `invoices`, `audit_logs`*, `persona_verifications`, `persona_webhook_events`, `razorpay_webhook_events`, `project_dispute_messages`, `verification_document_reviews`*, `cms_page_versions`, `hire_*` | snake_case | `invoices.payment_id` |
| C. snake_case table, camelCase columns | `cms_pages`, `cms_media`, `audit_logs`, `page_configurations`, `website_page_overrides`, `page_text_overrides`, `legacy_*`, `verification_document_reviews` | camelCase | `cms_pages."metaTitle"` |
| D. PascalCase table with **some** snake_case columns | `Payment` (`razorpay_order_id`, `base_amount`, …), `User` (`razorpay_account_id`, `professional_category_id`), `WalletTransaction` (`idempotency_key`, `provider_reference`), `ProjectWithdrawal` (`payment_id`, …) | mixed | `"Payment"."project_tracking_id"` |
| Redundant `@@map` to same name | `ClientJobMilestone`, `ProjectTransaction`, `ProjectNegotiation`, `ProjectReview`, `ProjectRequest`, `ProjectTracking`, `ProjectTimelineEvent`, `ProjectMilestone`, `ProjectWorkUpload`; `@map("pageKey")`/`@map("slug")` on `WebsitePage`/`LegalPage` | — | no effect |

\* `audit_logs` and `verification_document_reviews` use camelCase columns.

Rule of thumb observed in migrations: columns added for external providers (Razorpay, Persona) and in the 2026-08-20..31 migrations use snake_case; earlier columns are camelCase. There is no documented naming standard in code; `project-docs/docs/prisma-schema-coding-standards-review.md` discusses it.

IDs:
- `Int @default(autoincrement())` (`SERIAL`) for almost all current models.
- `String @default(cuid())` for `Session`, `MessageConversation`, `Message`.
- `String @id` without default (application-supplied) for `SocketConversation`, `SocketMessage`, `HireJob`, `HireContract`, `HireAttachment`, `HireMilestone`, `LegacyUser`, `LegacyLocation`, `LegacyVerification`.
- Natural keys: `WebsitePage.pageKey`, `LegalPage.slug`, `CallSession.conversationId`, `SQLiteMigration*.sourceTable`, `ProfessionalVerification.userId`, `LegacyUserProfile.userId`, `LegacyProfessionalDetail.userId`.
- Composite PKs: `SocketConversationClear(conversationId,userId)`, `UserNotificationState(userId,notificationKey)`, `PageTextOverride(pagePath,elementKey)`.
- Legacy `Hire*`/`Legacy*`/`DirectHireNegotiation` store user IDs as `String` whereas `User.id` is `Int` — they cannot carry FKs to `User`.

---

## 5. Status and type fields: enums vs strings

Only 5 Prisma/PostgreSQL enums exist:

| Enum | Values | Used by |
|---|---|---|
| `UserRole` | ADMIN, CLIENT, PROFESSIONAL | `User.role` |
| `JobUrgency` | LOW, MEDIUM, HIGH | `ClientJob.urgency` |
| `JobWorkMode` | ON_SITE, REMOTE, BOTH | `ClientJob.workMode` |
| `JobStatus` | DRAFT, OPEN, CLOSED | `ClientJob.status` |
| `CmsPageStatus` | DRAFT, PUBLISHED, ARCHIVED | `CmsPage.status`, `WebsitePage.status`, `LegalPage.status` |

Every other lifecycle field is a free `String` (no CHECK) except `ServiceCategory.segment` (CHECK `RESIDENTIAL|COMMERCIAL|INDUSTRIAL`). The authoritative inventory of observed values is `project-docs/STATUS_POLICY.md`; this documentation re-verified it and found these additions/corrections:

| Field | Values observed in code (2026-09-16) | Differs from STATUS_POLICY.md |
|---|---|---|
| `Payment.status` | `PENDING`, `FUNDED` (`app/api/wallet/milestone/route.ts:95`), `PAYOUT_PROCESSING` (`app/api/admin/finance/milestone-payout/route.ts:58`), `COMPLETED`, `FAILED` | `FUNDED`, `PAYOUT_PROCESSING` not listed |
| `ProjectMilestone.status` | `UPCOMING`, `IN_PROGRESS`, `AWAITING_CLIENT_REVIEW`, `PAYMENT_PROCESSING`, `AWAITING_ADMIN_APPROVAL` (`app/api/wallet/milestone/route.ts:113`), `APPROVED` (`app/api/admin/finance/milestone-payout/route.ts:75`), `REVISION_REQUESTED` | `AWAITING_ADMIN_APPROVAL` not listed |
| `ProjectTransaction.status` | `COMPLETED`, `PENDING_ADMIN_PAYOUT` (`app/api/wallet/milestone/route.ts:124`) | listed only generically |
| `ProjectTransaction.type` / `WalletTransaction.type` | `WALLET_TOP_UP`, `MILESTONE_PAYMENT`, `ADMIN_MILESTONE_RECEIPT`, `PROFESSIONAL_PAYOUT`, `MILESTONE_EARNING`, `WALLET_MILESTONE_FUNDED`, `WALLET_MILESTONE_PAYMENT`, `OFFLINE_MILESTONE_PAYMENT` | listed only generically |
| `ProjectDispute.status` | `OPEN`, `RESOLVED` (admin zod enum `app/api/admin/disputes/[id]/route.ts:25`) | STATUS_POLICY says `OPEN, CLOSED` — **incorrect** |
| `ProjectWithdrawal.status` | `PENDING` → `COMPLETED` \| `FAILED` (`app/api/admin/finance/withdrawals/[id]/route.ts:17`) | consistent |
| `RazorpayWebhookEvent.processingStatus` | `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED` | not listed |
| `PersonaVerification.adminStatus` / `ProfessionalVerification.status` / `VerificationDocumentReview.status` | `PENDING`, `APPROVED`, `REJECTED` (`app/api/admin/verifications/route.ts:77`) | consistent |
| `ApiToken.kind` | `EMAIL_VERIFICATION`, `PASSWORD_RESET` | not listed |
| `User.authProvider` | `LOCAL`, `GOOGLE` (literal present; Google flow implementation: see auth docs) | consistent |
| `ClientJob.timingType` / `paymentMethod` | `FIXED`, `HOURLY` / `WALLET`, `OFFLINE` | `HOURLY` added |
| `Payment.provider` | `wallet`, `offline`, Razorpay literal (`[NEEDS VALIDATION]` exact casing) | — |

Implication: invalid status strings are accepted by the database; transition rules live only in route handlers (conditional `updateMany` "expected-state" claims, e.g. `app/api/wallet/milestone/route.ts:51-57`).

---

## 6. Money representation

| Rule | Evidence |
|---|---|
| All money columns are `Int` (PostgreSQL `INTEGER`, 32-bit, max ≈ ₹2.1 billion) | schema; `202608200005_integer_money_fields` converted legacy `hire_*`, `direct_hire_negotiations`, `legacy_professional_details` money columns with `ROUND()` |
| Unit = **whole rupees (INR)**, not paise | `src/lib/razorpay.ts:48,80,100` sends `Math.round(amountRupees * 100)`; webhook compares `entity.amount !== payment.amount * 100` (`app/api/webhooks/razorpay/route.ts:107,130`) |
| Currency column defaults `"INR"` on `Payment`, `Wallet`, `ProjectTransaction`, `ProjectWithdrawal`, `Invoice`, `HireJob`; no CHECK | schema |
| Fee split stored per payment: `base_amount`, `client_fee_amount`, `professional_payout_amount`, `admin_net_amount`, plus legacy `commissionAmount` and gross `amount` | `Payment` model; `src/lib/wallet-ledger.ts:8-20` (`calculateMilestoneMoney`: 10% client fee + 10% professional fee, `Math.ceil`) |
| Non-negative CHECKs only on `Payment` money columns | `202608310001_database_integrity_guards` |
| Wallet balance: `Wallet.balance`, `Wallet.pendingBalance` (reserved for pending withdrawals). No CHECK `balance >= 0`; reservation guard is in raw SQL | `app/api/wallet/route.ts:75-80` |
| Ledger entries signed (`WalletTransaction.amount` negative for debits) | `src/lib/wallet-ledger.ts:121`, `prisma/seed.ts` |
| Non-money floats: `User.averageRating`, lat/lng columns (`DOUBLE PRECISION`); `DirectHireNegotiation.bidAmount` is `Float` in schema but `INTEGER` in DB (drift, §9.3) | schema vs `0_init` |

Implication: fractional rupee amounts cannot be represented; Razorpay paise precision is lost on the way in. Treat as a design constraint, not a bug, unless product requires paise. `[NEEDS VALIDATION — not testable locally]` with finance owner.

---

## 7. Soft deletion, deactivation and timestamps

### 7.1 Soft deletion — Not implemented

No `deletedAt`, `isDeleted` or `archivedAt` column exists (grep over schema/app/src = 0). Deletes are **hard**:

| Endpoint | Delete | DB consequence |
|---|---|---|
| `DELETE /api/admin/users/[id]` (`app/api/admin/users/[id]/route.ts:49`) | `db.user.delete` | Cascades via FK only to `sessions`, `persona_verifications`; `audit_logs.actorId` set NULL; `User.professional_category_id` n/a. Blocked (500 "Unable to delete account. It may have related records.", nothing deleted) by RESTRICT FKs from `Payment`, `ProjectRequest`, `ProjectTracking` — in practice admins cannot delete any user with activity. **Tables whose Prisma `onDelete: Cascade` has no DB FK (`ClientProfile`, `ClientJob`, `FavoriteJob`, `Service`, `ProfessionalVerification`) keep orphan rows**; `Wallet`, `UserNotification`, `StoredFile`, `ApiToken` etc. have no relation at all (deleting a freshly registered user → 200 and its `ApiToken` row is left orphaned) `[VALIDATED 2026-09-17 · [V-07](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `DELETE /api/admin/jobs/[id]`, `DELETE /api/client/jobs/[id]` (drafts only) | `db.clientJob.delete` | FK cascade only to `ClientJobMilestone`; RESTRICT from `ProjectRequest`, `ProjectTracking`, `Payment`; `ClientJobAttachment`/`FavoriteJob` rows orphaned (no FK) |
| `DELETE /api/admin/services` (`route.ts:128`) | `db.serviceCategory.delete` | FK cascade to child categories; RESTRICT from `Service`; `User.professional_category_id` SET NULL |
| `app/api/admin/support/route.ts:55` | `db.faq.delete` | none |
| `app/api/portal/project-actions/route.ts:480` | `db.projectMilestone.delete` | RESTRICT from `ProjectWorkUpload` (deleting a funded milestone → 500 "Unable to update the project."); `Payment.milestone_id` has no FK in migrations `[VALIDATED 2026-09-17 · [V-42](../validation/LOCAL_VALIDATION_LOG.md), [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `app/api/portal/project-files/route.ts:85` | `db.storedFile.deleteMany` (compensating rollback after a failed upload batch) | none |
| `app/api/professional/favorite-jobs/[jobId]` | `db.favoriteJob.deleteMany` | none |
| `app/api/profile/locations/[id]` | `tx.clientSavedLocation.delete` | none |
| `app/api/client/jobs/[id]/route.ts:317` | `db.clientJobMilestone.deleteMany` then `createMany` (replace set) | none |

### 7.2 Flag / lifecycle fields that act like soft states

| Field | Meaning | Evidence |
|---|---|---|
| `User.isActive` | Admin deactivation; setting `false` also revokes all open sessions in the same transaction | `app/api/admin/users/[id]/route.ts:16-27` |
| `Session.revokedAt`, `Session.expiresAt` | Revocable server sessions | `src/lib/auth.ts:20-50` |
| `Service.isActive` | Service listing visibility | `src/lib/queries/marketplace.ts:212` |
| `ApiToken.usedAt`, `OtpCode.consumedAt` | One-time token consumption | auth route, OTP provider |
| `UserNotification.readAt/clearedAt`, `SocketMessage.readAt`, `SocketConversationClear.clearedAt` | Per-user read/cleared state | notifications/messages |
| `CmsPageStatus.ARCHIVED`, `Faq.status` | Content lifecycle | schema |

### 7.3 Audit fields and timestamps

| Pattern | Models |
|---|---|
| `createdAt @default(now())` + `updatedAt @updatedAt` | 28 models carry `@updatedAt` (e.g. `User`, `ClientJob`, `ProjectTracking`, `Payment`, `PersonaVerification`) |
| `createdAt` only (append-only) | `Session`, `FavoriteJob`, `ClientJobAttachment`, `ProjectNegotiation`, `ProjectTimelineEvent`, `ProjectWorkUpload`, `SocketMessage`, `Message`, `UserNotification`, `StoredFile`, `AuditLog`, `ApiToken`, `OtpCode`, `BrowserSubscription`, `PersonaWebhookEvent`, `ProjectDisputeMessage`, `Invoice` (+ `issuedAt`) |
| `updatedAt` only | `Wallet`, `ProfessionalVerification`, `WebsitePage`, `LegalPage`, `PageTextOverride`, `HireContract` |
| Required `DateTime` **without default** (app must supply) | `CmsPage.createdAt/updatedAt`, `CmsPageVersion.createdAt`, `CmsMedia.createdAt`, `WebsitePage.updatedAt`, `LegalPage.updatedAt`, `PageTextOverride.updatedAt` (DB has `DEFAULT CURRENT_TIMESTAMP` for the ones created by `0_init`) |
| No timestamps | `SocketConversationClear` (only `clearedAt`), `UserNotificationState`, `HireAttachment`, `HireMilestone`, `Legacy*` (nullable) |
| Actor columns | `CmsPageVersion.createdBy`, `CmsMedia.createdBy`, `PersonaVerification.reviewedBy`, `AuditLog.actorId` (only this one has an FK), `ProjectTimelineEvent.actorId/actorRole`, `ProjectDispute.reporterId/Role` |

All timestamps are `TIMESTAMP(3)` **without time zone**; values are written by Prisma in UTC. **Defect — raw `NOW()` comparisons break when the DB session `TimeZone` is not UTC:** `verifyPhoneOtp` (`src/lib/phone-otp-provider.ts:153-156`) runs `"expiresAt" > NOW()`, and `NOW()` is evaluated in the session time zone. On a database with `TimeZone = Asia/Calcutta` (what `initdb` picks up on an IST Windows machine; the developer's local `klick-pro` DB reports it) a fresh code looks 5 h 20 min expired and verification always returns 400 "Invalid verification code."; with `timezone = 'UTC'` the same flow returns 200. Fix: compare against `now() AT TIME ZONE 'UTC'` or bind a JS `Date`. `[FOUND IN VALIDATION 2026-09-17 · [V-27](../validation/LOCAL_VALIDATION_LOG.md)]` Production impact depends on the deployed DB server time zone `[NEEDS VALIDATION — not testable locally]`.

`AuditLog` (`audit_logs`) is the generic audit trail: `action`, `entityType`, `entityId` (string), `requestId` (from `x-request-id` set in `proxy.ts`), `metadata JSONB`; written via `src/lib/audit-log.ts:22` (errors swallowed — best-effort). Only 1 application file writes it.

---

## 8. Database-level constraints added via raw SQL

These exist only in migrations (Prisma schema cannot express them) and are therefore invisible to `prisma db pull`-less readers.

| Constraint | Table | Definition | Migration |
|---|---|---|---|
| `ServiceCategory_segment_check` | `ServiceCategory` | `segment IN ('RESIDENTIAL','COMMERCIAL','INDUSTRIAL')` | `202608170001_add_service_category_segment` |
| `Payment_amount_nonnegative` | `Payment` | `amount >= 0` | `202608310001_database_integrity_guards` |
| `Payment_base_amount_nonnegative` | `Payment` | `base_amount >= 0` | same |
| `Payment_client_fee_amount_nonnegative` | `Payment` | `client_fee_amount >= 0` | same |
| `Payment_professional_payout_nonnegative` | `Payment` | `professional_payout_amount >= 0` | same |
| `Payment_admin_net_nonnegative` | `Payment` | `admin_net_amount >= 0` | same |
| `ProjectTracking_progress_check` | `ProjectTracking` | `progress BETWEEN 0 AND 100` | same |
| `ProjectReview_rating_check` | `ProjectReview` | `rating BETWEEN 1 AND 5` | same |
| `User_averageRating_check` | `User` | `averageRating BETWEEN 0 AND 5` | same |
| `User_reviewCount_nonnegative` | `User` | `reviewCount >= 0` | same |
| `ClientJob_budget_order_check` | `ClientJob` | `budgetMin IS NULL OR budgetMax IS NULL OR budgetMin <= budgetMax` | same |
| `ClientSavedLocation_one_primary_idx` | `ClientSavedLocation` | UNIQUE (`clientProfileId`) WHERE `isPrimary = true` | same (also in schema via `partialIndexes`) |
| `ClientProfile_userId_key` | `ClientProfile` | UNIQUE (`userId`) | same |
| `WalletTransaction_provider_reference_key` | `WalletTransaction` | UNIQUE (`provider_reference`) — partial `WHERE provider_reference IS NOT NULL` in `202608210001`, but **`0_init` creates it first as a full unique index, so the partial version is skipped by `IF NOT EXISTS` on fresh replay** (functionally equivalent in PostgreSQL because NULLs are distinct) | `0_init`, `202608210001_wallet_earning_flow` |
| `ProjectRequest_jobId_origin_status_idx` | `ProjectRequest` | non-unique (`jobId`,`origin`,`status`) — **not declared in schema** | `202608120004_professional_proposals` |

`202608310001_database_integrity_guards` design (Implemented): a `DO $$` preflight raises `MIGRATION REQUIRES CLEAN PREFLIGHT: ...` if orphan rows, duplicate profiles/primary locations, or CHECK violations exist; it never repairs data. It then adds 16 FKs (Payment ×4, ProjectRequest ×3, ProjectTracking ×4, ProjectMilestone, ProjectTimelineEvent, ProjectWorkUpload ×2, Service.categoryId) with `ON DELETE RESTRICT ON UPDATE CASCADE`, the CHECKs above, and the two unique indexes. Read-only preflight equivalents live in `scripts/check-database-baseline.sql` and `scripts/full-database-audit.sql`.

No triggers, stored functions, views, sequences beyond `SERIAL`, RLS policies or grants are defined in the repository. Supabase RLS state of the deployed DB is `[UNKNOWN]`.

---

## 9. Schema ↔ migration drift (static analysis)

Originally derived by comparing `CREATE TABLE`/`CONSTRAINT`/`INDEX` statements across all 28 `migration.sql` files with `schema.prisma`. On 2026-09-17 a fresh local DB was built with `prisma migrate deploy` (28 migrations applied, 41 app tables) and `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` was run: 29 `CREATE TABLE`, 16 `ADD CONSTRAINT … FOREIGN KEY`, 60 `CREATE INDEX`, 3 drops, 20 `ALTER COLUMN`. Counts below follow that output `[CORRECTED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]`.

### 9.1 Models with no `CREATE TABLE` in any migration (28, plus 1 mis-named)

`SQLiteMigrationTableArchive`, `SQLiteMigrationAudit`, `ProjectTransaction`, `ProjectNegotiation`, `SocketConversationClear`, `CallSession`, `MessageConversation`, `Message`, `UserNotification`, `UserNotificationState`, `ProjectDispute`, `ProjectCompletionRequest`, `ProjectRevisionRequest`, `ProjectReviewRequest`, `VerificationDocumentReview` (`verification_document_reviews`), `StoredFile`, `ApiToken`, `BrowserSubscription`, `Faq`, `ContactRequest`, `PageConfiguration` (`page_configurations`), `WebsitePageOverride` (`website_page_overrides`), `PageTextOverride` (`page_text_overrides`), `LegacyUser`, `LegacyUserProfile`, `LegacyProfessionalDetail`, `LegacyLocation`, `LegacyVerification` — **28 models** `[CORRECTED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]`. Plus `DirectHireNegotiation`* (table exists under another name).

\* `0_init` creates `direct_hire_negotiations`, but the model has no `@@map`, so Prisma expects table `DirectHireNegotiation`; `migrate diff` drops the former and creates the latter. `db.directHireNegotiation.findMany()` on the migration-built DB → P2021 "table does not exist", so `scripts/reset-marketplace-catalog.ts:485` fails there `[VALIDATED 2026-09-17 · [V-06](../validation/LOCAL_VALIDATION_LOG.md)]`.

**Impact (High):** a database built only with `prisma migrate deploy` (e.g. CI `npm run build`, a fresh staging DB) lacks tables that live code writes: `ApiToken` (email verification / password reset), `UserNotification`, `ProjectDispute`, `ProjectTransaction`, `ProjectNegotiation`, `ProjectRevisionRequest`, `StoredFile`, `VerificationDocumentReview`, `Faq`, `ContactRequest`, `MessageConversation`. The shared/production DB presumably has them (likely created earlier with `prisma db push` or the pre-rewrite baseline) — `[NEEDS VALIDATION — not testable locally]` with `scripts/full-database-audit.sql` section 01. The CI build will still pass because it only applies migrations and compiles.

### 9.2 Prisma relations without a DB foreign key (16 of 39)

`migrate diff` adds exactly these 16 FKs: 14 between tables that already exist on a migration-built DB, 2 on tables that are missing (last two rows) `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]`.

| Relation (child.field → parent) | Prisma `onDelete` | DB FK |
|---|---|---|
| `ClientProfile.userId → User` | Cascade | missing |
| `ClientSavedLocation.clientProfileId → ClientProfile` | Cascade | missing |
| `ClientHiringNeed.clientProfileId → ClientProfile` | Cascade | missing |
| `ClientJob.userId → User` | Cascade | missing |
| `FavoriteJob.userId → User` | Cascade | missing |
| `FavoriteJob.jobId → ClientJob` | Cascade | missing |
| `ClientJobAttachment.jobId → ClientJob` | Cascade | missing |
| `Service.professionalId → User` | Cascade | missing |
| `ProfessionalVerification.userId → User` | Cascade | missing |
| `Payment.milestone_id → ProjectMilestone` | (default SetNull) | missing (`Payment_milestone_id_fkey`) — `prisma/seed.ts` inserts `milestoneId` 900001–900003 that reference no milestone, which only works because this FK is absent; on a DB that has the FK the seed fails with P2003 (§11.1) `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `WalletTransaction.walletId → Wallet` | Cascade | missing |
| `HireContract.job_id → HireJob` | Cascade | missing |
| `HireAttachment.job_id → HireJob` | Cascade | missing |
| `HireMilestone.contract_id → HireContract` | Cascade | missing |
| `SocketConversationClear.conversationId → SocketConversation` | Cascade | table missing |
| `Message.conversationId → MessageConversation` | Cascade | table missing |

Prisma (default `relationMode = "foreignKeys"`) does **not** emulate cascades, so documented `onDelete: Cascade` behaviour does not happen in a migrations-built DB.

### 9.3 Other drift

| Item | Schema | Migrations |
|---|---|---|
| Non-unique indexes declared in schema but never created | `cms_pages(slug)`, `cms_pages(status)`, `cms_page_versions(page_id)`, `cms_media(createdAt)`, `ClientProfile(userId)`, `ClientSavedLocation(clientProfileId)`, `ClientHiringNeed(clientProfileId)`, `ClientJob(userId)`, `ClientJob(status)`, `FavoriteJob(userId)`, `FavoriteJob(jobId)`, `ClientJobAttachment(jobId)`, `ProjectRequest(jobId/clientId/professionalId)`, `ProjectTracking(jobId/clientId/professionalId)`, `ProjectMilestone(trackingId)`, `ProjectWorkUpload(trackingId)`, `hire_contracts(×3)`, `hire_job_attachments(job_id)`, `hire_milestones(contract_id)`, `Payment(clientId)`, `Payment(professionalId)`, `WalletTransaction(walletId)`, `Service(professionalId)` | absent — 30 missing indexes on existing tables per `migrate diff`; likely performance impact on the hottest FK lookups `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| Index in DB not in schema | — | `ProjectRequest_jobId_origin_status_idx` and `WalletTransaction_provider_reference_key` (partial unique from `202608210001`) — `migrate diff` drops both `[CORRECTED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `DirectHireNegotiation.bidAmount` | `Float?` | `INTEGER` (and table name mismatch) |
| `@updatedAt` / `createdAt` columns | no DB default | `DEFAULT CURRENT_TIMESTAMP` in `0_init` / `202608120003` / `202609110001` — 19 column-default differences in `migrate diff` `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `SocketConversation.updatedAt` | `@updatedAt` | `NOT NULL` without default (matches Prisma) |
| `hire_*` column types | `Int` | converted from numeric by `202608200005` using `ROUND()` (possible silent value change on legacy data) |

---

## 10. Migration history

`_prisma_migrations` is Prisma's history table. Dates are the directory prefixes (authoring dates), not deploy dates.

| # | Migration id | Date | Purpose (from SQL) | Notes |
|---|---|---|---|---|
| 1 | `0_init` | rewritten 2026-09-12 (last commit 185afc9, 2026-09-15) | Baseline: 5 enums (idempotent `DO $$ ... duplicate_object`), `CREATE TABLE IF NOT EXISTS` for `User`, `ClientProfile`, `ClientSavedLocation`, `ClientHiringNeed`, `ClientJob`, `FavoriteJob`, `ClientJobAttachment`, `ServiceCategory`, `Service`, `ProfessionalVerification`, `cms_pages`, `cms_page_versions`, `cms_media`, `WebsitePage`, `LegalPage`, `hire_jobs`, `hire_contracts`, `hire_job_attachments`, `hire_milestones`, `direct_hire_negotiations`, `ProjectWithdrawal`, `ProjectReview`, `Wallet`, `WalletTransaction`, `Payment`; 18 indexes | Previously empty (per `project-docs/DATABASE_AUDIT.md` DB-001). No FKs. See §10.1 |
| 2 | `202608100001_client_phone_verification` | 2026-08-10 | `ClientProfile.companyName` nullable; add `User.phoneVerifiedAt` | |
| 3 | `202608100002_client_job_drafts` | 2026-08-10 | `ClientJob.category/title/description/deadline` nullable (drafts) | |
| 4 | `202608120003_shared_project_tracking` | 2026-08-12 | Create `ProjectRequest`, `ProjectTracking` (unique `requestId`), `ProjectMilestone`, `ProjectWorkUpload`, `ProjectTimelineEvent`; add progress/stage/started/completed; data fix `RUNNING → READY_TO_START`; milestone `submittedAt/approvedAt`; upload `milestoneId/status` | Header comment: base tables added so replay works. The pre-`6572a99` version fails on an empty DB with 42P01 `relation "ProjectTracking" does not exist` `[VALIDATED 2026-09-17 · [V-02](../validation/LOCAL_VALIDATION_LOG.md)]` |
| 5 | `202608120004_professional_proposals` | 2026-08-12 | `ProjectRequest.origin` (default `CLIENT_HIRE`) + index (`jobId`,`origin`,`status`) | Index not in schema |
| 6 | `202608140001_add_audit_logs` | 2026-08-14 | `audit_logs` + FK `actorId → User ON DELETE SET NULL` + 3 indexes | |
| 7 | `202608150001_add_user_username` | 2026-08-15 | `User.username` + unique | Idempotent (already in `0_init`) |
| 8 | `202608170001_add_service_category_segment` | 2026-08-17 | `ServiceCategory.segment` + CHECK | |
| 9 | `202608170002_add_service_category_parent` | 2026-08-17 | `ServiceCategory.parentId` self-FK `ON DELETE CASCADE` + index | Deleting a parent deletes whole subtree |
| 10 | `202608180001_add_otp_codes` | 2026-08-18 | `OtpCode` + 2 composite indexes | Non-idempotent `CREATE TABLE` |
| 11 | `202608200001_persona_verification` | 2026-08-20 | `persona_verifications` (FK user CASCADE) + `persona_webhook_events` | |
| 12 | `202608200002_razorpay_payments` | 2026-08-20 | Razorpay columns on `Payment`; `User.razorpay_account_id`; unique indexes; `razorpay_webhook_events` | |
| 13 | `202608200003_dispute_admin_messages` | 2026-08-20 | `project_dispute_messages` + 2 indexes | No FK to `ProjectDispute` (which itself is never created) |
| 14 | `202608200004_payouts_invoices` | 2026-08-20 | Payout columns on `ProjectWithdrawal`; `invoices` table | No FKs |
| 15 | `202608200005_integer_money_fields` | 2026-08-20 | Convert legacy money columns to `INTEGER` with `ROUND()` if tables exist | Potential silent rounding (`project-docs/WEBSITE_DATABASE_REVIEW.md` WEB-MED-001) |
| 16 | `202608210001_wallet_earning_flow` | 2026-08-21 | Payment split columns + backfill; `WalletTransaction.idempotency_key` (backfilled `legacy-wallet-transaction-<id>`, NOT NULL, unique) + partial unique `provider_reference` | |
| 17 | `202608220001_saved_location_primary` | 2026-08-22 | `ClientSavedLocation.isPrimary` + backfill earliest per profile | Uniqueness enforced later (#23) |
| 18 | `202608240001_realtime_messaging` | 2026-08-24 (rewritten 2026-09-12 per team memory) | `SocketConversation`, `SocketMessage` (FK CASCADE) + indexes | Checksum drift on shared DB, §10.1 |
| 19 | `202608240002_message_read_state` | 2026-08-24 | `SocketMessage.readAt` | |
| 20 | `202608240003_offline_job_payment_method` | 2026-08-24 | `ClientJob.paymentMethod` default `WALLET` | |
| 21 | `202608240004_professional_state_district` | 2026-08-24 | `User.professionalState/District` + index | |
| 22 | `202608240005_job_location_state_district` | 2026-08-24 | `ClientJob.locationState/District` + index | |
| 23 | `202608310001_database_integrity_guards` | 2026-08-31 | Preflight + 16 FKs + 10 CHECKs + 2 unique indexes (§8) | Aborts on dirty data |
| 24 | `202608310002_razorpay_webhook_processing_state` | 2026-08-31 | Webhook processing state columns + index | Enables retry/claim logic |
| 25 | `202608310003_revocable_sessions` | 2026-08-31 | `sessions` table (FK CASCADE) + index | Resolves former DB-009/WEB-HIGH-002 |
| 26 | `202609010001_professional_category_relation` | 2026-09-01 | `User.professional_category_id` FK → `ServiceCategory ON DELETE SET NULL` + index | |
| 27 | `202609010004_seed_complete_category_hierarchy` | 2026-09-01 | `SELECT 1;` — **no-op** (comment claims hierarchy seeding; actual seeding is in `prisma/seed.ts` / `scripts/seed-category-hierarchy.ts`) | Numbering gap 0002–0003 |
| 28 | `202609110001_add_client_job_milestones` | 2026-09-11 | `ClientJobMilestone` + index + guarded FK `jobId → ClientJob ON DELETE CASCADE` | |

### 10.1 Baseline rewrite and checksum drift — action required

- `0_init/migration.sql` (and `202608240001_realtime_messaging/migration.sql`) were rewritten on 2026-09-12 to repair a baseline that was previously empty. The shared/production database already recorded these migration names in `_prisma_migrations` with the **old checksums**.
- Consequence: **no failure and no warning.** With Prisma CLI 7.9.1, `prisma migrate deploy` (and therefore `npm run build`) and `prisma migrate status` ignore checksum mismatches of already-applied migrations: "No pending migrations to apply." / "Database schema is up to date!", exit 0. `prisma migrate resolve` is **not** required for deploy to proceed. `[CORRECTED 2026-09-17 · [V-02](../validation/LOCAL_VALIDATION_LOG.md)]`
- Real risk: SQL added to an already-applied migration file (e.g. the base tables added to `202608120003_shared_project_tracking`, and whatever the rewritten `0_init` creates) **silently never runs** on that database. Recommended before the next deploy to the shared DB: verify its physical table set against the repaired baseline (`scripts/check-database-baseline.sql`) and create any missing objects under change control; optionally align `_prisma_migrations.checksum` for `0_init` and `202608240001_realtime_messaging` so `prisma migrate dev` does not flag drift (`migrate dev` not tested). **Do not re-run those migrations there.**
- Because of the `IF NOT EXISTS` guards, the rewritten baseline is intended to be a no-op on the existing DB and a real creator on a fresh DB — but see §9.1 for the 28 tables (plus 1 mis-named) it still does not create.

---

## 11. Seeding and data scripts

### 11.1 `prisma/seed.ts` — Implemented

Run with `npm run db:seed` (`tsx prisma/seed.ts`) or `prisma db seed` (config). Uses its own `PrismaClient` + `PrismaPg({ connectionString: DATABASE_URL })` (not `src/lib/db.ts`, which is `server-only`).

| Step | Function | Data |
|---|---|---|
| 1 | `upsertCategories()` (`seed.ts:590+`) | 3-tier `ServiceCategory` hierarchy (segments RESIDENTIAL/COMMERCIAL/INDUSTRIAL → categories → subcategories) upserted by `slug` |
| 2 | client upsert | `seed.client@servio.example` (CLIENT) |
| 3 | `createProfessionals()` | 12 PROFESSIONAL users across Indian cities with faker profiles (rates, skills JSON, ratings, lat/lng), incl. reference `surat.pro@servio.example` |
| 4 | `createJobs()` | 8 `ClientJob` rows (skipped if title exists) |
| 5 | `seedWalletActivity()` | `seed.admin@servio.example` (ADMIN, username `seed-admin`); wallets for client/pro/admin; 2 top-ups; 3 milestone `Payment` + `Invoice` + `ProjectTransaction` + 4 `WalletTransaction` each; 1 pending `ProjectWithdrawal` |

Properties: deterministic faker seed `20260810`; idempotent via upsert/`idempotencyKey` checks; all seed accounts share one password constant defined in the file (value intentionally not reproduced here — treat as a known credential; must never be run against production). Fee math duplicated from `src/lib/wallet-ledger.ts` (`seed.ts:788-803`). Seed payments reference non-existent tracking/milestone IDs (900000+), relying on missing FKs (§9.2). **The seed therefore fails on any DB that has `Payment_milestone_id_fkey`** (e.g. one built with `prisma db push`): P2003 at `prisma/seed.ts:861`, after users, categories and jobs were already written (partial seed, no wallet/payment data). It only completes on DBs without that FK (the local `klick-pro` DB holds 3 such orphan `Payment.milestone_id` rows). `[FOUND IN VALIDATION 2026-09-17 · [S-14](../validation/LOCAL_VALIDATION_LOG.md)]`

### 11.2 `scripts/` touching the database

| Script | Kind | Notes |
|---|---|---|
| `check-database-baseline.sql` | read-only diagnostics | `_prisma_migrations`, table list, orphan/dup/CHECK preflights, status value inventory |
| `full-database-audit.sql` | read-only audit (270 lines) | tables, columns, constraints, FKs, indexes, history, orphans, duplicates, money, RLS/grants |
| `project-db-check.ts` | read-only (`$queryRaw` with `Prisma.sql`) | counts per model, orphan and fee checks, FK/index counts, RLS status |
| `seed-category-hierarchy.ts`, `check-hierarchy-summary.ts` | write / read | category tree |
| `reset-marketplace-catalog.ts` | **destructive** (`deleteMany` across project, hire, service tables) | touches `directHireNegotiation`, which maps to a table name not created by migrations (§9.3) → fails with P2021 on a migration-built DB `[VALIDATED 2026-09-17 · [V-06](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `add-faker-*.ts`, `post-faker-jobs-for-all-clients.ts`, `india-demo-locations.ts` | write (demo data) | npm scripts `db:add-*`, `db:post-faker-jobs` |
| `backfill-admin-notifications.ts`, `backfill-user-notifications.ts` | write (backfill `UserNotification`) | |
| `export-client-credentials.ts` | exports credentials to committed files — security finding owned by [security.md](../08-operations/security.md) | |

---

## 12. Legacy, duplicate and unused models

Usage scan: Prisma delegate calls (`<client>.<model>.<op>`) and relation includes in `app/`, `src/` (excluding `src/generated`), `server.mjs`, plus raw SQL table references.

### 12.1 Models with zero application usage (26)

| Model | Only referenced by | Assessment |
|---|---|---|
| `CmsPage`, `CmsPageVersion`, `CmsMedia` | `scripts/project-db-check.ts` (count) | Superseded by file-based CMS (`data/cms-*.json`, `src/lib/cms-file.ts`) |
| `WebsitePage`, `LegalPage`, `PageConfiguration`, `WebsitePageOverride`, `PageTextOverride` | `src/lib/db.ts` HMR guard (`pageTextOverride` only) | Superseded by file-based CMS; `LegalPage` name collides with React component `src/components/LegalPage` only |
| `SQLiteMigrationTableArchive`, `SQLiteMigrationAudit` | — | One-off SQLite→PostgreSQL import archive |
| `LegacyUser`, `LegacyProfessionalDetail`, `LegacyLocation`, `LegacyVerification` | — | Imported legacy data (string IDs) |
| `HireJob`, `HireContract`, `HireAttachment`, `HireMilestone`, `DirectHireNegotiation` | `scripts/reset-marketplace-catalog.ts` | Legacy "direct hire" flow replaced by `ClientJob` → `ProjectRequest` → `ProjectTracking` → `ProjectMilestone` (and `ProjectNegotiation`) |
| `ProjectCompletionRequest`, `ProjectReviewRequest` | `scripts/reset-marketplace-catalog.ts` | Completion/review now modelled by `ProjectTracking.status` transitions + `ProjectTimelineEvent` `[NEEDS VALIDATION]` |
| `ClientHiringNeed` | `scripts/add-faker-clients.ts` | Duplicates `User.hiringNeedsJson` |
| `SocketConversationClear`, `CallSession` | — | Planned per-user "clear chat" and WebRTC call signalling; no code — Planned/inferred |
| `UserNotificationState` | — | Duplicates `UserNotification.readAt/clearedAt` |
| `BrowserSubscription` | — | Web-push subscription store; no push implementation found |

### 12.2 Partially used / read-only models

| Model | Usage | Note |
|---|---|---|
| `LegacyUserProfile` | 1 read (`app/api/admin/data/[resource]/route.ts:293`) to fill names | table not created by migrations `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `MessageConversation`, `Message` | 1 read (`app/api/portal/[resource]/route.ts:335`, `include: messages`) | Duplicate messaging path; live chat uses `SocketConversation`/`SocketMessage` (`app/api/v1/messages/route.ts`, 13 calls) |
| `Service` | read via relation filters only (`src/lib/queries/marketplace.ts`, `professional-discovery.ts`); no app writes | Writes only in scripts |
| `ClientJobAttachment` | read via `attachments` includes; no app writes | Attachments for jobs may be stored elsewhere `[NEEDS VALIDATION]` |

### 12.3 Duplicated representations (denormalisation)

| Concept | Representations |
|---|---|
| Client profile data | `User.companyName/companyWebsite/industry/teamSize/companyDescription/address` **and** `ClientProfile.*` |
| Saved locations / hiring needs | `User.savedLocationsJson`, `User.hiringNeedsJson` **and** `ClientSavedLocation`, `ClientHiringNeed` |
| Professional category | `User.professionalCategory` (free text) **and** `User.professional_category_id` FK |
| Verification certifications | `User.certificationsJson` **and** `ProfessionalVerification.certificationsJson` |
| Milestones | `ClientJobMilestone` (percentage plan at job level) **and** `ProjectMilestone` (amount at project level) **and** legacy `HireMilestone` |
| Negotiation | `ProjectNegotiation` **and** legacy `DirectHireNegotiation` |
| Money ledger | `WalletTransaction` (per wallet) **and** `ProjectTransaction` (per project) **and** `Payment` |
| JSON-in-text | `*Json` `String` columns (`professionalSkillsJson`, `attachmentsJson`, `filesJson`, `payloadJson`, `metadataJson`, `CmsPage.sections`) instead of `Json`/`JSONB`; only `AuditLog.metadata` and `SQLiteMigrationTableArchive.rows` are `Json` |

---

## 13. Data retention

| Data | Growth pattern | Retention mechanism found |
|---|---|---|
| `audit_logs`, `razorpay_webhook_events` (full payload), `persona_webhook_events`, `ProjectTimelineEvent`, `SocketMessage`, `UserNotification` | append-only | **None** |
| `OtpCode`, `ApiToken`, `sessions` | append; expire via `expiresAt` | Logical expiry only; prior OTPs invalidated via `updateMany` (`src/lib/phone-otp-provider.ts:51`); no purge job |
| `StoredFile` metadata + object storage | per upload | Only rollback deletion on failed multi-file upload (`project-files/route.ts:84-87`); no user-facing delete or orphan reconciliation found |
| Personal data (PII) on user deletion | hard delete of `User` | Incomplete due to missing FKs (§7.1) |

No scheduled jobs, partitioning or TTL exist in the repository (in-memory rate-limit cleanup in `src/lib/rate-limit.ts` is unrelated to DB). Status: **Not implemented**; requirement `[UNKNOWN]`.

---

## 14. Relationship to existing docs

| Existing doc | Status | Reason |
|---|---|---|
| `project-docs/DATABASE_AUDIT.md` | Partially accurate / partly obsolete | DB-001 "empty baseline" is obsolete (baseline rewritten, but 28 model tables still uncreated plus 1 mis-named — new finding, confirmed 2026-09-17 · V-01). DB-007 (multiple primary locations) and "ClientProfile.userId not unique" fixed by `202608310001`. DB-009 non-revocable sessions fixed by `202608310003`. DB-008 "`Service.categoryId` has no relation" obsolete (relation + FK now exist). DB-012/013 still accurate |
| `project-docs/WEBSITE_DATABASE_REVIEW.md` | Partially accurate | WEB-CRIT-001 reframed (baseline no longer empty; replay still incomplete); WEB-HIGH-002 sessions obsolete; WEB-MED-001 rounding accurate |
| `project-docs/MIGRATION_INTEGRITY_REVIEW.md` | Accurate for #23; baseline remark obsolete | |
| `project-docs/STATUS_POLICY.md` | Mostly accurate | Missing values listed in §5; `ProjectDispute.status` `CLOSED` should be `RESOLVED` |
| `project-docs/docs/backend/16.3-database-schema-design-and-setup.md` | Simplified / partly incorrect | Uses conceptual names `Job`, `Proposal`, `Project` (actual: `ClientJob`, `ProjectRequest`, `ProjectTracking`); claims FK-backed integrity and that notifications "point to a recipient and activity source" — `UserNotification` has no FKs; claims migrations make environments identical — contradicted by §9 |
| `project-docs/src/routes/docs/schema.prisma`, `technical-architecture.md` | Obsolete / aspirational | Describe PostGIS/`GeoRepository`/`Unsupported()` geometry; implementation uses plain `Float` lat/lng |
| `docs/_archive/2026-09-14-flat-docs/architecture.md` (earlier AI session) | Superseded by this file for DB content | |
