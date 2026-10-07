# Database Schema Reference

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

> Source of truth: `prisma/schema.prisma` (69 models, 5 enums) cross-checked with `prisma/migrations/**/migration.sql`. Design rationale, drift analysis and migration history: [database-design.md](./database-design.md). Field-level detail: [data-dictionary.md](./data-dictionary.md). Diagrams: [database-erd.md](../03-architecture/diagrams/database-erd.md).

## Legend

| Column                   | Meaning                                                                                                                                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Table**                | Physical PostgreSQL table name (after `@@map`). Quote it in SQL.                                                                                                                                                                                                                              |
| **PK**                   | Primary key; `serial` = `Int @default(autoincrement())`, `cuid` = `String @default(cuid())`, `app` = application-supplied string                                                                                                                                                              |
| **Unique**               | `@unique` / `@@unique` (physical index name in brackets when it differs from Prisma default or is partial)                                                                                                                                                                                    |
| **Indexes (schema)**     | `@@index` declared in schema                                                                                                                                                                                                                                                                  |
| **Migr.**                | Is the table created by a migration? ✅ yes / ❌ no (see database-design §9.1; the ❌ set — 28 models plus the mis-named `DirectHireNegotiation` — was confirmed with `prisma migrate diff` on a migration-built DB `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]`) |
| **Relation cardinality** | `N:1` child→parent; `1:1` when FK column is unique                                                                                                                                                                                                                                            |
| **onDelete**             | Prisma referential action. Prisma default for a required relation is `Restrict`, for an optional one `SetNull`                                                                                                                                                                                |
| **DB FK**                | ✅ FK constraint exists in migrations (name) / ❌ declared in Prisma only                                                                                                                                                                                                                     |

Missing non-unique indexes (declared in schema but absent from migrations) are marked _(not in migrations)_ / _(nim)_ — 30 on existing tables per `migrate diff` `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]`.

---

## Enums

| Enum            | PostgreSQL type   | Values                            | Columns                                                                                |
| --------------- | ----------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| `UserRole`      | `"UserRole"`      | `ADMIN`, `CLIENT`, `PROFESSIONAL` | `User.role` (default `CLIENT`)                                                         |
| `JobUrgency`    | `"JobUrgency"`    | `LOW`, `MEDIUM`, `HIGH`           | `ClientJob.urgency` (default `MEDIUM`)                                                 |
| `JobWorkMode`   | `"JobWorkMode"`   | `ON_SITE`, `REMOTE`, `BOTH`       | `ClientJob.workMode` (default `BOTH`)                                                  |
| `JobStatus`     | `"JobStatus"`     | `DRAFT`, `OPEN`, `CLOSED`         | `ClientJob.status` (default `OPEN`)                                                    |
| `CmsPageStatus` | `"CmsPageStatus"` | `DRAFT`, `PUBLISHED`, `ARCHIVED`  | `CmsPage.status` (DRAFT), `WebsitePage.status` (DRAFT), `LegalPage.status` (PUBLISHED) |

All created idempotently in `prisma/migrations/0_init/migration.sql:5-34`.

---

## D1. Identity & authentication

| Model      | Table      | PK                                 | Unique                                                          | Indexes (schema)                                                           | Migr.                      |
| ---------- | ---------- | ---------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------- |
| `User`     | `User`     | `id` serial                        | `email`, `phone`, `googleId`, `username`, `razorpay_account_id` | (`professionalState`,`professionalDistrict`); (`professional_category_id`) | ✅ `0_init` + later ALTERs |
| `Session`  | `sessions` | `id` cuid (app passes explicit id) | —                                                               | (`user_id`,`revoked_at`)                                                   | ✅ `202608310003`          |
| `ApiToken` | `ApiToken` | `id` serial                        | `tokenHash`                                                     | (`userId`,`kind`)                                                          | ❌                         |
| `OtpCode`  | `OtpCode`  | `id` serial                        | —                                                               | (`phone`,`role`,`expiresAt`); (`phone`,`role`,`consumedAt`)                | ✅ `202608180001`          |

| Relation                                                                                    | Card.                                   | onDelete          | DB FK                                              |
| ------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------- | -------------------------------------------------- |
| `Session.userId → User.id`                                                                  | N:1                                     | Cascade           | ✅ `sessions_user_id_fkey` (CASCADE)               |
| `User.professionalCategoryId → ServiceCategory.id` (relation `ProfessionalPrimaryCategory`) | N:1 optional                            | SetNull (default) | ✅ `User_professional_category_id_fkey` (SET NULL) |
| `ApiToken.userId` → User                                                                    | logical only                            | —                 | ❌ no relation                                     |
| `OtpCode.phone/role`                                                                        | logical only (keyed by phone, not user) | —                 | ❌                                                 |

CHECK: `User_averageRating_check` (0–5), `User_reviewCount_nonnegative`.

Back-relations on `User`: `clientJobs`, `clientProfiles` (1:1), `favoriteJobs`, `clientPayments`/`professionalPayments`, `clientProjectRequests`/`professionalProjectRequests`, `clientProjectTrackings`/`professionalProjectTrackings`, `services`, `verification` (1:1), `auditLogs`, `personaVerifications`, `sessions`, `professionalCategoryRecord`.

---

## D2. Client profile & locations

| Model                 | Table                 | PK          | Unique                                                                                         | Indexes (schema)                          | Migr. |
| --------------------- | --------------------- | ----------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- | ----- |
| `ClientProfile`       | `ClientProfile`       | `id` serial | `userId` [`ClientProfile_userId_key`, added `202608310001`]                                    | (`userId`) _(not in migrations)_          | ✅    |
| `ClientSavedLocation` | `ClientSavedLocation` | `id` serial | `clientProfileId` **partial** WHERE `isPrimary = true` [`ClientSavedLocation_one_primary_idx`] | (`clientProfileId`) _(not in migrations)_ | ✅    |
| `ClientHiringNeed`    | `ClientHiringNeed`    | `id` serial | —                                                                                              | (`clientProfileId`) _(not in migrations)_ | ✅    |

| Relation                                                 | Card.                                                                                                                                                 | onDelete | DB FK |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| `ClientProfile.userId → User.id`                         | 1:1                                                                                                                                                   | Cascade  | ❌    |
| `ClientSavedLocation.clientProfileId → ClientProfile.id` | Prisma models it as **1:1** (`savedLocations ClientSavedLocation?`) because of the partial unique; physically **1:N** (many non-primary rows allowed) | Cascade  | ❌    |
| `ClientHiringNeed.clientProfileId → ClientProfile.id`    | N:1                                                                                                                                                   | Cascade  | ❌    |

Note: the Prisma 1:1 typing of `ClientProfile.savedLocations` does not match the 1:N data; application code queries `db.clientSavedLocation` directly (19 references). With several rows, `include: { savedLocations: true }` returns **one arbitrary row as an object** (a non-primary row in the test), not an array; a 2nd `isPrimary = true` row is rejected with P2002; nested `savedLocations: { disconnect: true }` → P2014. Consumers affected: `GET /api/profile` (`app/api/profile/route.ts:53`) returns one arbitrary location, and the admin user detail (`app/api/admin/users/[id]/route.ts:115` → `app/admin/users/page.tsx:296`) reads `clientProfiles?.[0]` on an object → `undefined`, so client-profile data is never shown there (no crash) `[VALIDATED 2026-09-17 · [V-05](../validation/LOCAL_VALIDATION_LOG.md), [V-05b](../validation/LOCAL_VALIDATION_LOG.md)]`.

---

## D3. Service catalogue

| Model             | Table             | PK          | Unique         | Indexes (schema)                         | Migr. |
| ----------------- | ----------------- | ----------- | -------------- | ---------------------------------------- | ----- |
| `ServiceCategory` | `ServiceCategory` | `id` serial | `name`, `slug` | (`parentId`)                             | ✅    |
| `Service`         | `Service`         | `id` serial | —              | (`professionalId`) _(not in migrations)_ | ✅    |

| Relation                                                                    | Card.                                                 | onDelete           | DB FK                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------ | -------------------------------------------- |
| `ServiceCategory.parentId → ServiceCategory.id` (`CategoryHierarchy`, self) | N:1 optional (tree: segment → category → subcategory) | Cascade            | ✅ `ServiceCategory_parentId_fkey` (CASCADE) |
| `Service.categoryId → ServiceCategory.id`                                   | N:1                                                   | Restrict (default) | ✅ `Service_categoryId_fkey` (RESTRICT)      |
| `Service.professionalId → User.id` (`ProfessionalServices`)                 | N:1                                                   | Cascade            | ❌                                           |

CHECK: `ServiceCategory_segment_check` (`RESIDENTIAL`,`COMMERCIAL`,`INDUSTRIAL`).

---

## D4. Jobs

| Model                 | Table                 | PK          | Unique             | Indexes (schema)                                                             | Migr.             |
| --------------------- | --------------------- | ----------- | ------------------ | ---------------------------------------------------------------------------- | ----------------- |
| `ClientJob`           | `ClientJob`           | `id` serial | —                  | (`userId`) _(nim)_; (`status`) _(nim)_; (`locationState`,`locationDistrict`) | ✅                |
| `ClientJobAttachment` | `ClientJobAttachment` | `id` serial | —                  | (`jobId`) _(nim)_                                                            | ✅                |
| `ClientJobMilestone`  | `ClientJobMilestone`  | `id` serial | —                  | (`jobId`)                                                                    | ✅ `202609110001` |
| `FavoriteJob`         | `FavoriteJob`         | `id` serial | (`userId`,`jobId`) | (`userId`) _(nim)_; (`jobId`) _(nim)_                                        | ✅                |

_(nim)_ = not in migrations.

| Relation                                   | Card. | onDelete | DB FK                                        |
| ------------------------------------------ | ----- | -------- | -------------------------------------------- |
| `ClientJob.userId → User.id`               | N:1   | Cascade  | ❌                                           |
| `ClientJobAttachment.jobId → ClientJob.id` | N:1   | Cascade  | ❌                                           |
| `ClientJobMilestone.jobId → ClientJob.id`  | N:1   | Cascade  | ✅ `ClientJobMilestone_jobId_fkey` (CASCADE) |
| `FavoriteJob.userId → User.id`             | N:1   | Cascade  | ❌                                           |
| `FavoriteJob.jobId → ClientJob.id`         | N:1   | Cascade  | ❌                                           |

CHECK: `ClientJob_budget_order_check` (`budgetMin <= budgetMax` when both set).

---

## D5. Proposals / hire requests

| Model                | Table                | PK          | Unique | Indexes (schema)                                                                                            | Migr.             |
| -------------------- | -------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------- | ----------------- |
| `ProjectRequest`     | `ProjectRequest`     | `id` serial | —      | (`jobId`), (`clientId`), (`professionalId`) — all _(nim)_; migration-only index (`jobId`,`origin`,`status`) | ✅ `202608120003` |
| `ProjectNegotiation` | `ProjectNegotiation` | `id` serial | —      | (`requestId`), (`clientId`), (`professionalId`)                                                             | ❌                |

| Relation                                                                 | Card.        | onDelete | DB FK                                   |
| ------------------------------------------------------------------------ | ------------ | -------- | --------------------------------------- |
| `ProjectRequest.jobId → ClientJob.id`                                    | N:1          | Restrict | ✅ `ProjectRequest_jobId_fkey`          |
| `ProjectRequest.clientId → User.id` (`ProjectRequestClient`)             | N:1          | Restrict | ✅ `ProjectRequest_clientId_fkey`       |
| `ProjectRequest.professionalId → User.id` (`ProjectRequestProfessional`) | N:1          | Restrict | ✅ `ProjectRequest_professionalId_fkey` |
| `ProjectNegotiation.requestId/jobId/clientId/professionalId/senderId`    | logical only | —        | ❌ no Prisma relation                   |

---

## D6. Project tracking & delivery

| Model                      | Table                      | PK          | Unique       | Indexes (schema)                                      | Migr.       |
| -------------------------- | -------------------------- | ----------- | ------------ | ----------------------------------------------------- | ----------- |
| `ProjectTracking`          | `ProjectTracking`          | `id` serial | `requestId`  | (`jobId`), (`clientId`), (`professionalId`) — _(nim)_ | ✅          |
| `ProjectTimelineEvent`     | `ProjectTimelineEvent`     | `id` serial | —            | (`trackingId`,`createdAt`)                            | ✅          |
| `ProjectMilestone`         | `ProjectMilestone`         | `id` serial | —            | (`trackingId`) _(nim)_                                | ✅          |
| `ProjectWorkUpload`        | `ProjectWorkUpload`        | `id` serial | —            | (`trackingId`) _(nim)_                                | ✅          |
| `ProjectCompletionRequest` | `ProjectCompletionRequest` | `id` serial | —            | (`trackingId`)                                        | ❌          |
| `ProjectRevisionRequest`   | `ProjectRevisionRequest`   | `id` serial | —            | (`trackingId`)                                        | ❌          |
| `ProjectReviewRequest`     | `ProjectReviewRequest`     | `id` serial | —            | (`trackingId`)                                        | ❌          |
| `ProjectReview`            | `ProjectReview`            | `id` serial | `trackingId` | (`clientId`), (`professionalId`)                      | ✅ `0_init` |
| `StoredFile`               | `StoredFile`               | `id` serial | `storageKey` | (`ownerId`)                                           | ❌          |

| Relation                                                                                                                                                                                                       | Card.        | onDelete            | DB FK                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------- | ----------------------------------------- |
| `ProjectTracking.requestId → ProjectRequest.id`                                                                                                                                                                | **1:1**      | Restrict            | ✅ `ProjectTracking_requestId_fkey`       |
| `ProjectTracking.jobId → ClientJob.id`                                                                                                                                                                         | N:1          | Restrict            | ✅ `ProjectTracking_jobId_fkey`           |
| `ProjectTracking.clientId → User.id` (`ProjectTrackingClient`)                                                                                                                                                 | N:1          | Restrict            | ✅ `ProjectTracking_clientId_fkey`        |
| `ProjectTracking.professionalId → User.id` (`ProjectTrackingProfessional`)                                                                                                                                     | N:1          | Restrict            | ✅ `ProjectTracking_professionalId_fkey`  |
| `ProjectTimelineEvent.trackingId → ProjectTracking.id`                                                                                                                                                         | N:1          | Restrict            | ✅ `ProjectTimelineEvent_trackingId_fkey` |
| `ProjectMilestone.trackingId → ProjectTracking.id`                                                                                                                                                             | N:1          | Restrict            | ✅ `ProjectMilestone_trackingId_fkey`     |
| `ProjectWorkUpload.trackingId → ProjectTracking.id`                                                                                                                                                            | N:1          | Restrict            | ✅ `ProjectWorkUpload_trackingId_fkey`    |
| `ProjectWorkUpload.milestoneId → ProjectMilestone.id`                                                                                                                                                          | N:1 optional | Restrict (explicit) | ✅ `ProjectWorkUpload_milestoneId_fkey`   |
| `ProjectTimelineEvent.milestoneId`, `ProjectMilestone.clientId/professionalId`, `ProjectReview.trackingId/clientId/professionalId`, `Project*Request.trackingId/clientId/professionalId`, `StoredFile.ownerId` | logical only | —                   | ❌                                        |

CHECKs: `ProjectTracking_progress_check` (0–100), `ProjectReview_rating_check` (1–5).

---

## D7. Payments, wallet, ledger, payouts, invoices

| Model                  | Table                     | PK          | Unique                                                                                                                                                                                                                                                                                                            | Indexes (schema)                                             | Migr.                             |
| ---------------------- | ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------- |
| `Payment`              | `Payment`                 | `id` serial | `idempotencyKey`, `razorpay_order_id`, `razorpay_payment_id`, `milestone_id`                                                                                                                                                                                                                                      | (`clientId`) _(nim)_, (`professionalId`) _(nim)_             | ✅                                |
| `RazorpayWebhookEvent` | `razorpay_webhook_events` | `id` serial | `event_id`                                                                                                                                                                                                                                                                                                        | (`processing_status`,`received_at`)                          | ✅ `202608200002`, `202608310002` |
| `Wallet`               | `Wallet`                  | `id` serial | `userId`                                                                                                                                                                                                                                                                                                          | —                                                            | ✅                                |
| `WalletTransaction`    | `WalletTransaction`       | `id` serial | `idempotency_key`; `provider_reference` (partial `WHERE provider_reference IS NOT NULL` in schema; migration index `WalletTransaction_provider_reference_key` is not recognised by Prisma — `migrate diff` drops/recreates it `[FOUND IN VALIDATION 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]`) | (`walletId`) _(nim)_                                         | ✅                                |
| `ProjectTransaction`   | `ProjectTransaction`      | `id` serial | —                                                                                                                                                                                                                                                                                                                 | (`trackingId`), (`clientId`), (`professionalId`), (`status`) | ❌                                |
| `ProjectWithdrawal`    | `ProjectWithdrawal`       | `id` serial | —                                                                                                                                                                                                                                                                                                                 | (`professionalId`), (`payment_id`)                           | ✅                                |
| `Invoice`              | `invoices`                | `id` serial | `invoice_number`, `payment_id`                                                                                                                                                                                                                                                                                    | (`client_id`), (`professional_id`)                           | ✅ `202608200004`                 |

| Relation                                                                                                                                               | Card.                     | onDelete            | DB FK                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Payment.clientId → User.id` (`PaymentClient`)                                                                                                         | N:1                       | Restrict            | ✅ `Payment_clientId_fkey`                                                                                                                                                |
| `Payment.professionalId → User.id` (`PaymentProfessional`)                                                                                             | N:1                       | Restrict            | ✅ `Payment_professionalId_fkey`                                                                                                                                          |
| `Payment.jobId → ClientJob.id` (`PaymentJob`)                                                                                                          | N:1 optional              | Restrict (explicit) | ✅ `Payment_jobId_fkey`                                                                                                                                                   |
| `Payment.project_tracking_id → ProjectTracking.id` (`PaymentProjectTracking`)                                                                          | N:1 optional              | Restrict (explicit) | ✅ `Payment_projectTrackingId_fkey`                                                                                                                                       |
| `Payment.milestone_id → ProjectMilestone.id`                                                                                                           | **1:1** optional (unique) | SetNull (default)   | ❌ (`Payment_milestone_id_fkey` added only by `db push`; `prisma/seed.ts` then fails with P2003) `[VALIDATED 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]` |
| `WalletTransaction.walletId → Wallet.id`                                                                                                               | N:1                       | Cascade             | ❌                                                                                                                                                                        |
| `Wallet.userId` → User                                                                                                                                 | logical 1:1 (unique)      | —                   | ❌ no relation                                                                                                                                                            |
| `WalletTransaction.paymentId`, `ProjectTransaction.*Id`, `ProjectWithdrawal.professionalId/payment_id`, `Invoice.payment_id/client_id/professional_id` | logical only              | —                   | ❌                                                                                                                                                                        |

CHECKs: 5 non-negative money checks on `Payment` (see database-design §8).

---

## D8. Disputes

| Model                   | Table                      | PK          | Unique | Indexes (schema)                                           | Migr.             |
| ----------------------- | -------------------------- | ----------- | ------ | ---------------------------------------------------------- | ----------------- |
| `ProjectDispute`        | `ProjectDispute`           | `id` serial | —      | (`trackingId`), (`clientId`), (`professionalId`)           | ❌                |
| `ProjectDisputeMessage` | `project_dispute_messages` | `id` serial | —      | (`dispute_id`,`created_at`); (`recipient_id`,`created_at`) | ✅ `202608200003` |

Relations: none declared. `ProjectDisputeMessage.dispute_id → ProjectDispute.id`, `ProjectDispute.trackingId → ProjectTracking.id`, reporter/client/professional/sender/recipient IDs → `User.id` are **logical only** (no Prisma relation, no FK).

---

## D9. Messaging

| Model                     | Table                     | PK                                    | Unique | Indexes (schema)                                 | Migr.             |
| ------------------------- | ------------------------- | ------------------------------------- | ------ | ------------------------------------------------ | ----------------- |
| `SocketConversation`      | `SocketConversation`      | `id` app string                       | —      | (`userAId`), (`userBId`)                         | ✅ `202608240001` |
| `SocketMessage`           | `SocketMessage`           | `id` app string                       | —      | (`conversationId`), (`senderId`), (`receiverId`) | ✅                |
| `SocketConversationClear` | `SocketConversationClear` | composite (`conversationId`,`userId`) | —      | —                                                | ❌                |
| `CallSession`             | `CallSession`             | `conversationId` (natural)            | —      | —                                                | ❌                |
| `MessageConversation`     | `MessageConversation`     | `id` cuid                             | —      | (`clientId`), (`professionalId`)                 | ❌                |
| `Message`                 | `Message`                 | `id` cuid                             | —      | (`conversationId`), (`senderId`)                 | ❌                |

| Relation                                                                                                                                                                                        | Card.        | onDelete | DB FK                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ------------------------------------------------ |
| `SocketMessage.conversationId → SocketConversation.id`                                                                                                                                          | N:1          | Cascade  | ✅ `SocketMessage_conversationId_fkey` (CASCADE) |
| `SocketConversationClear.conversationId → SocketConversation.id`                                                                                                                                | N:1          | Cascade  | ❌ (table absent)                                |
| `Message.conversationId → MessageConversation.id`                                                                                                                                               | N:1          | Cascade  | ❌ (table absent)                                |
| `SocketConversation.userAId/userBId`, `SocketMessage.senderId/receiverId`, `CallSession.conversationId/startedBy`, `MessageConversation.clientId/professionalId/contractId`, `Message.senderId` | logical only | —        | ❌                                               |

---

## D10. Notifications

| Model                   | Table                   | PK                                     | Unique     | Indexes (schema)          | Migr. |
| ----------------------- | ----------------------- | -------------------------------------- | ---------- | ------------------------- | ----- |
| `UserNotification`      | `UserNotification`      | `id` serial                            | —          | (`userId`), (`createdAt`) | ❌    |
| `UserNotificationState` | `UserNotificationState` | composite (`userId`,`notificationKey`) | —          | —                         | ❌    |
| `BrowserSubscription`   | `BrowserSubscription`   | `id` serial                            | `endpoint` | (`userId`)                | ❌    |

Relations: none (all `userId` columns logical only).

---

## D11. Verification / KYC

| Model                        | Table                           | PK                             | Unique                   | Indexes (schema)                                   | Migr.             |
| ---------------------------- | ------------------------------- | ------------------------------ | ------------------------ | -------------------------------------------------- | ----------------- |
| `ProfessionalVerification`   | `ProfessionalVerification`      | `userId` (shared PK with User) | —                        | —                                                  | ✅ `0_init`       |
| `VerificationDocumentReview` | `verification_document_reviews` | `id` serial                    | (`userId`,`documentKey`) | (`userId`)                                         | ❌                |
| `PersonaVerification`        | `persona_verifications`         | `id` serial                    | `provider_inquiry_id`    | (`user_id`), (`provider_status`), (`admin_status`) | ✅ `202608200001` |
| `PersonaWebhookEvent`        | `persona_webhook_events`        | `id` serial                    | `provider_event_id`      | —                                                  | ✅ `202608200001` |

| Relation                                                               | Card.         | onDelete | DB FK                                             |
| ---------------------------------------------------------------------- | ------------- | -------- | ------------------------------------------------- |
| `ProfessionalVerification.userId → User.id`                            | 1:1 (PK = FK) | Cascade  | ❌                                                |
| `PersonaVerification.user_id → User.id`                                | N:1           | Cascade  | ✅ `persona_verifications_user_id_fkey` (CASCADE) |
| `VerificationDocumentReview.userId`, `PersonaVerification.reviewed_by` | logical only  | —        | ❌                                                |

---

## D12. CMS, website content & support

| Model                 | Table                    | PK                                  | Unique                   | Indexes (schema)                                            | Migr. |
| --------------------- | ------------------------ | ----------------------------------- | ------------------------ | ----------------------------------------------------------- | ----- |
| `CmsPage`             | `cms_pages`              | `id` serial                         | `slug`                   | (`slug`) _(nim, redundant with unique)_, (`status`) _(nim)_ | ✅    |
| `CmsPageVersion`      | `cms_page_versions`      | `id` serial                         | (`page_id`,`version_no`) | (`page_id`) _(nim)_                                         | ✅    |
| `CmsMedia`            | `cms_media`              | `id` serial                         | —                        | (`createdAt`) _(nim)_                                       | ✅    |
| `WebsitePage`         | `WebsitePage`            | `pageKey` natural                   | `path`                   | —                                                           | ✅    |
| `LegalPage`           | `LegalPage`              | `slug` natural                      | —                        | —                                                           | ✅    |
| `PageConfiguration`   | `page_configurations`    | `id` serial                         | —                        | (`pageId`)                                                  | ❌    |
| `WebsitePageOverride` | `website_page_overrides` | `id` serial                         | —                        | —                                                           | ❌    |
| `PageTextOverride`    | `page_text_overrides`    | composite (`pagePath`,`elementKey`) | —                        | —                                                           | ❌    |
| `Faq`                 | `Faq`                    | `id` serial                         | —                        | —                                                           | ❌    |
| `ContactRequest`      | `ContactRequest`         | `id` serial                         | —                        | —                                                           | ❌    |

Relations: none. `CmsPageVersion.page_id → cms_pages.id` and `created_by`/`createdBy → User.id` are logical only.

---

## D13. Audit

| Model      | Table        | PK          | Unique | Indexes (schema)                                                                       | Migr.             |
| ---------- | ------------ | ----------- | ------ | -------------------------------------------------------------------------------------- | ----------------- |
| `AuditLog` | `audit_logs` | `id` serial | —      | (`actorId`,`createdAt`); (`entityType`,`entityId`,`createdAt`); (`action`,`createdAt`) | ✅ `202608140001` |

| Relation                                    | Card.        | onDelete          | DB FK                                   |
| ------------------------------------------- | ------------ | ----------------- | --------------------------------------- |
| `AuditLog.actorId → User.id` (`AuditActor`) | N:1 optional | SetNull (default) | ✅ `audit_logs_actorId_fkey` (SET NULL) |

---

## D14. Legacy / import archive

| Model                         | Table                                                                                  | PK              | Unique | Indexes (schema)                                         | Migr.                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------- | --------------- | ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `HireJob`                     | `hire_jobs`                                                                            | `id` app string | —      | —                                                        | ✅ `0_init`                                                                                                                 |
| `HireContract`                | `hire_contracts`                                                                       | `id` app string | —      | (`client_id`), (`professional_id`), (`job_id`) — _(nim)_ | ✅                                                                                                                          |
| `HireAttachment`              | `hire_job_attachments`                                                                 | `id` app string | —      | (`job_id`) _(nim)_                                       | ✅                                                                                                                          |
| `HireMilestone`               | `hire_milestones`                                                                      | `id` app string | —      | (`contract_id`) _(nim)_                                  | ✅                                                                                                                          |
| `DirectHireNegotiation`       | **`DirectHireNegotiation`** (no `@@map`; migration created `direct_hire_negotiations`) | `id` serial     | —      | (`contractId`), (`professionalId`)                       | ❌ (name mismatch — P2021 on a migration-built DB `[VALIDATED 2026-09-17 · [V-06](../validation/LOCAL_VALIDATION_LOG.md)]`) |
| `LegacyUser`                  | `legacy_users`                                                                         | `id` app string | —      | —                                                        | ❌                                                                                                                          |
| `LegacyUserProfile`           | `legacy_user_profiles`                                                                 | `userId` string | —      | —                                                        | ❌                                                                                                                          |
| `LegacyProfessionalDetail`    | `legacy_professional_details`                                                          | `userId` string | —      | —                                                        | ❌                                                                                                                          |
| `LegacyLocation`              | `legacy_locations`                                                                     | `id` app string | —      | —                                                        | ❌                                                                                                                          |
| `LegacyVerification`          | `legacy_verifications`                                                                 | `id` app string | —      | —                                                        | ❌                                                                                                                          |
| `SQLiteMigrationTableArchive` | `SQLiteMigrationTableArchive`                                                          | `sourceTable`   | —      | —                                                        | ❌                                                                                                                          |
| `SQLiteMigrationAudit`        | `SQLiteMigrationAudit`                                                                 | `sourceTable`   | —      | —                                                        | ❌                                                                                                                          |

| Relation                                                                                                                                                                           | Card.        | onDelete | DB FK |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ----- |
| `HireContract.job_id → HireJob.id`                                                                                                                                                 | N:1          | Cascade  | ❌    |
| `HireAttachment.job_id → HireJob.id`                                                                                                                                               | N:1          | Cascade  | ❌    |
| `HireMilestone.contract_id → HireContract.id`                                                                                                                                      | N:1          | Cascade  | ❌    |
| `HireJob.client_id`, `HireContract.client_id/professional_id` (String), `HireContract.client_project_id/tracking_id` (Int), `HireJob.category_id`, `Legacy*.userId/professionalId` | logical only | —        | ❌    |

---

## Totals

| Metric                         | Count                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Models                         | 69                                                                                                                                                                                                                                                                                                                                    |
| Enums                          | 5                                                                                                                                                                                                                                                                                                                                     |
| Prisma relations (FK side)     | 39                                                                                                                                                                                                                                                                                                                                    |
| — with DB FK constraint        | 23                                                                                                                                                                                                                                                                                                                                    |
| — Prisma-only                  | 16                                                                                                                                                                                                                                                                                                                                    |
| Models with composite PK       | 3                                                                                                                                                                                                                                                                                                                                     |
| Models with `String` PK        | 19 (3 `cuid()` defaults: `Session`, `MessageConversation`, `Message`; 9 app-supplied ids: `SocketConversation`, `SocketMessage`, `Hire*` ×4, `LegacyUser`, `LegacyLocation`, `LegacyVerification`; 7 natural keys: `WebsitePage`, `LegalPage`, `CallSession`, `SQLiteMigration*` ×2, `LegacyUserProfile`, `LegacyProfessionalDetail`) |
| CHECK constraints (migrations) | 11                                                                                                                                                                                                                                                                                                                                    |
| Tables created by migrations   | 43 models (+ orphan table `direct_hire_negotiations`)                                                                                                                                                                                                                                                                                 |
