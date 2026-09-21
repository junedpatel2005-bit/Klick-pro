# Database ERD

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

> Mermaid entity-relationship diagrams for the PostgreSQL schema in `prisma/schema.prisma`. Details: [database-design.md](../../04-database/database-design.md), [schema.md](../../04-database/schema.md), [data-dictionary.md](../../04-database/data-dictionary.md).

## Notation

| Mermaid                 | Meaning in these diagrams                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `\|\|--o{` solid line   | Relation declared in Prisma **and** FK constraint created by a migration                                |
| `\|\|..o{` dotted line  | Relation declared in Prisma **only** (no FK in any migration, so not enforced in a migrations-built DB) |
| `\|\|--o\|`, `\|o..o\|` | One-to-zero-or-one (FK column is unique)                                                                |
| Label                   | Relation name or FK column, plus `onDelete` action (Cascade / Restrict / SetNull)                       |
| `PK`, `FK`, `UK`        | Primary key, foreign key column, unique                                                                 |

Only relationships declared with `@relation` in `schema.prisma` are drawn. Columns that merely _hold_ another model's id without a Prisma relation (e.g. `Wallet.userId`, `ProjectDispute.trackingId`, `Invoice.payment_id`) are listed under "Logical references (not drawn)" for each domain.

---

## 1. Core overview

Entities: identity, catalogue, jobs, hiring, project delivery and money. Attributes limited to keys.

```mermaid
erDiagram
    User ||--o{ Session : "sessions (Cascade)"
    ServiceCategory |o--o{ User : "professional_category_id (SetNull)"
    ServiceCategory |o--o{ ServiceCategory : "parentId (Cascade)"
    ServiceCategory ||--o{ Service : "categoryId (Restrict)"
    User ||..o{ Service : "professionalId (Cascade, no FK)"
    User ||..o| ClientProfile : "userId (Cascade, no FK)"
    User ||..o{ ClientJob : "userId (Cascade, no FK)"
    ClientJob ||--o{ ClientJobMilestone : "jobId (Cascade)"
    ClientJob ||--o{ ProjectRequest : "jobId (Restrict)"
    User ||--o{ ProjectRequest : "clientId / professionalId (Restrict)"
    ProjectRequest ||--o| ProjectTracking : "requestId UK (Restrict)"
    ClientJob ||--o{ ProjectTracking : "jobId (Restrict)"
    User ||--o{ ProjectTracking : "clientId / professionalId (Restrict)"
    ProjectTracking ||--o{ ProjectMilestone : "trackingId (Restrict)"
    ProjectTracking ||--o{ ProjectTimelineEvent : "trackingId (Restrict)"
    ProjectTracking ||--o{ ProjectWorkUpload : "trackingId (Restrict)"
    ProjectMilestone |o--o{ ProjectWorkUpload : "milestoneId (Restrict)"
    User ||--o{ Payment : "clientId / professionalId (Restrict)"
    ClientJob |o--o{ Payment : "jobId (Restrict)"
    ProjectTracking |o--o{ Payment : "project_tracking_id (Restrict)"
    ProjectMilestone |o..o| Payment : "milestone_id UK (no FK)"
    Wallet ||..o{ WalletTransaction : "walletId (Cascade, no FK)"
    User ||..o| ProfessionalVerification : "userId PK (Cascade, no FK)"
    User ||--o{ PersonaVerification : "user_id (Cascade)"
    User |o--o{ AuditLog : "actorId (SetNull)"

    User {
        int id PK
    }
    Session {
        string id PK
    }
    ServiceCategory {
        int id PK
    }
    Service {
        int id PK
    }
    ClientProfile {
        int id PK
    }
    ClientJob {
        int id PK
    }
    ClientJobMilestone {
        int id PK
    }
    ProjectRequest {
        int id PK
    }
    ProjectTracking {
        int id PK
    }
    ProjectMilestone {
        int id PK
    }
    ProjectTimelineEvent {
        int id PK
    }
    ProjectWorkUpload {
        int id PK
    }
    Payment {
        int id PK
    }
    Wallet {
        int id PK
    }
    WalletTransaction {
        int id PK
    }
    ProfessionalVerification {
        int userId PK
    }
    PersonaVerification {
        int id PK
    }
    AuditLog {
        int id PK
    }
```

Explanation: a CLIENT `User` posts a `ClientJob` (optionally with a planned `ClientJobMilestone` split). A `ProjectRequest` (either a client hire invitation or a professional proposal, `origin`) links job, client and professional; accepting it creates exactly one `ProjectTracking` (unique `requestId`). Delivery happens through `ProjectMilestone`, `ProjectWorkUpload` and `ProjectTimelineEvent`. Money flows through `Payment` (one per milestone) and the wallet ledger. The finance core (`ProjectRequest`, `ProjectTracking`, `Payment`, project children) is FK-protected with `RESTRICT`; the job/profile layer relies on Prisma-only relations.

---

## 2. Identity, profile and catalogue

```mermaid
erDiagram
    User ||--o{ Session : "user_id (Cascade)"
    User ||..o| ClientProfile : "userId UK (Cascade, no FK)"
    ClientProfile ||..o{ ClientSavedLocation : "clientProfileId (Cascade, no FK; Prisma types as 1:1)"
    ClientProfile ||..o{ ClientHiringNeed : "clientProfileId (Cascade, no FK)"
    ServiceCategory |o--o{ ServiceCategory : "CategoryHierarchy parentId (Cascade)"
    ServiceCategory |o--o{ User : "ProfessionalPrimaryCategory (SetNull)"
    ServiceCategory ||--o{ Service : "categoryId (Restrict)"
    User ||..o{ Service : "ProfessionalServices (Cascade, no FK)"

    User {
        int id PK
        UserRole role
        string email UK
        string phone UK
        string username UK
        string googleId UK
        string razorpay_account_id UK
        int professional_category_id FK
        boolean isActive
        datetime emailVerifiedAt
    }
    Session {
        string id PK
        int user_id FK
        datetime expires_at
        datetime revoked_at
    }
    ClientProfile {
        int id PK
        int userId FK, UK
        string fullName
    }
    ClientSavedLocation {
        int id PK
        int clientProfileId FK
        boolean isPrimary "partial UK when true"
    }
    ClientHiringNeed {
        int id PK
        int clientProfileId FK
    }
    ServiceCategory {
        int id PK
        string slug UK
        string segment "CHECK RESIDENTIAL|COMMERCIAL|INDUSTRIAL"
        int parentId FK
    }
    Service {
        int id PK
        int categoryId FK
        int professionalId FK
        boolean isActive
    }
    ApiToken {
        int id PK
        int userId "logical -> User"
        string tokenHash UK
        string kind
    }
    OtpCode {
        int id PK
        string phone
        string role
    }
```

Logical references (not drawn): `ApiToken.userId → User`; `OtpCode` keyed by `phone`+`role`.

---

## 3. Jobs, proposals and project tracking

```mermaid
erDiagram
    User ||..o{ ClientJob : "userId (Cascade, no FK)"
    ClientJob ||..o{ ClientJobAttachment : "jobId (Cascade, no FK)"
    ClientJob ||--o{ ClientJobMilestone : "jobId (Cascade)"
    ClientJob ||..o{ FavoriteJob : "jobId (Cascade, no FK)"
    User ||..o{ FavoriteJob : "userId (Cascade, no FK)"
    ClientJob ||--o{ ProjectRequest : "jobId (Restrict)"
    User ||--o{ ProjectRequest : "ProjectRequestClient (Restrict)"
    User ||--o{ ProjectRequest : "ProjectRequestProfessional (Restrict)"
    ProjectRequest ||--o| ProjectTracking : "requestId UK (Restrict)"
    ClientJob ||--o{ ProjectTracking : "jobId (Restrict)"
    User ||--o{ ProjectTracking : "ProjectTrackingClient (Restrict)"
    User ||--o{ ProjectTracking : "ProjectTrackingProfessional (Restrict)"
    ProjectTracking ||--o{ ProjectMilestone : "trackingId (Restrict)"
    ProjectTracking ||--o{ ProjectTimelineEvent : "trackingId (Restrict)"
    ProjectTracking ||--o{ ProjectWorkUpload : "trackingId (Restrict)"
    ProjectMilestone |o--o{ ProjectWorkUpload : "milestoneId (Restrict)"

    ClientJob {
        int id PK
        int userId FK
        JobStatus status
        JobUrgency urgency
        JobWorkMode workMode
        int budgetMin "CHECK <= budgetMax"
        int budgetMax
        string paymentMethod "WALLET|OFFLINE"
    }
    ClientJobAttachment {
        int id PK
        int jobId FK
    }
    ClientJobMilestone {
        int id PK
        int jobId FK
        int percentage
    }
    FavoriteJob {
        int id PK
        int userId FK "UK(userId,jobId)"
        int jobId FK
    }
    ProjectRequest {
        int id PK
        int jobId FK
        int clientId FK
        int professionalId FK
        string status
        string origin "CLIENT_HIRE|PROFESSIONAL_PROPOSAL"
    }
    ProjectTracking {
        int id PK
        int requestId FK, UK
        int jobId FK
        int clientId FK
        int professionalId FK
        string status
        int progress "CHECK 0-100"
    }
    ProjectMilestone {
        int id PK
        int trackingId FK
        int amount
        string status
    }
    ProjectTimelineEvent {
        int id PK
        int trackingId FK
        string type
    }
    ProjectWorkUpload {
        int id PK
        int trackingId FK
        int milestoneId FK
        string status
    }
```

Logical references (not drawn — no Prisma relation): `ProjectNegotiation.{requestId, jobId, clientId, professionalId, senderId}`; `ProjectReview.{trackingId UK, clientId, professionalId}`; `ProjectCompletionRequest` / `ProjectRevisionRequest` / `ProjectReviewRequest`.`{trackingId, clientId, professionalId}`; `ProjectTimelineEvent.milestoneId`; `ProjectMilestone.{clientId, professionalId}`; `StoredFile.ownerId`.

---

## 4. Payments, wallet, payouts and invoices

```mermaid
erDiagram
    User ||--o{ Payment : "PaymentClient (Restrict)"
    User ||--o{ Payment : "PaymentProfessional (Restrict)"
    ClientJob |o--o{ Payment : "PaymentJob jobId (Restrict)"
    ProjectTracking |o--o{ Payment : "project_tracking_id (Restrict)"
    ProjectMilestone |o..o| Payment : "milestone_id UK (no FK)"
    Wallet ||..o{ WalletTransaction : "walletId (Cascade, no FK)"

    Payment {
        int id PK
        int clientId FK
        int professionalId FK
        int jobId FK
        int project_tracking_id FK
        int milestone_id FK, UK
        string idempotencyKey UK
        string razorpay_order_id UK
        string razorpay_payment_id UK
        int amount "CHECK >= 0"
        int base_amount "CHECK >= 0"
        int client_fee_amount "CHECK >= 0"
        int professional_payout_amount "CHECK >= 0"
        int admin_net_amount "CHECK >= 0"
        string status
    }
    Wallet {
        int id PK
        int userId UK "logical -> User"
        int balance
        int pendingBalance
    }
    WalletTransaction {
        int id PK
        int walletId FK
        int paymentId "logical -> Payment"
        string idempotency_key UK
        string provider_reference UK
        int amount "signed"
    }
    ProjectTransaction {
        int id PK
        int trackingId "logical"
        int milestoneId "logical"
        string type
        string status
    }
    ProjectWithdrawal {
        int id PK
        int professionalId "logical -> User"
        int payment_id "logical -> Payment"
        string status
    }
    Invoice {
        int id PK
        string invoice_number UK
        int payment_id UK "logical -> Payment"
        int client_id "logical"
        int professional_id "logical"
    }
    RazorpayWebhookEvent {
        int id PK
        string event_id UK
        string processing_status
    }
```

Logical references (not drawn): `Wallet.userId → User` (1:1 by unique), `WalletTransaction.paymentId → Payment`, `Invoice.payment_id → Payment` (1:1 by unique), `Invoice.client_id/professional_id → User`, `ProjectWithdrawal.{professionalId, payment_id}`, all `ProjectTransaction` ids. `RazorpayWebhookEvent` links to `Payment`/`WalletTransaction` only through provider ids inside `payload_json`.

---

## 5. Messaging, notifications, disputes, verification, audit

```mermaid
erDiagram
    SocketConversation ||--o{ SocketMessage : "conversationId (Cascade)"
    SocketConversation ||..o{ SocketConversationClear : "conversationId (Cascade, table not migrated)"
    MessageConversation ||..o{ Message : "conversationId (Cascade, table not migrated)"
    User ||..o| ProfessionalVerification : "userId PK (Cascade, no FK)"
    User ||--o{ PersonaVerification : "user_id (Cascade)"
    User |o--o{ AuditLog : "AuditActor actorId (SetNull)"

    SocketConversation {
        string id PK
        int userAId
        int userBId
    }
    SocketMessage {
        string id PK
        string conversationId FK
        int senderId
        int receiverId
        datetime readAt
    }
    SocketConversationClear {
        string conversationId PK, FK
        int userId PK
    }
    MessageConversation {
        string id PK
        int clientId
        int professionalId
    }
    Message {
        string id PK
        string conversationId FK
    }
    ProfessionalVerification {
        int userId PK, FK
        string status
    }
    PersonaVerification {
        int id PK
        int user_id FK
        string provider_inquiry_id UK
        string admin_status
    }
    AuditLog {
        int id PK
        int actorId FK
        string entityType
        string entityId
    }
    User {
        int id PK
    }
```

Not drawn (no Prisma relations at all): `ProjectDispute` and `ProjectDisputeMessage` (`dispute_id` logical), `UserNotification`, `UserNotificationState`, `BrowserSubscription`, `CallSession`, `VerificationDocumentReview` (`userId`+`documentKey` unique), `PersonaWebhookEvent`, `SocketConversation.userAId/userBId`.

---

## 6. CMS and legacy (isolated tables)

```mermaid
erDiagram
    HireJob ||..o{ HireContract : "job_id (Cascade, no FK)"
    HireJob ||..o{ HireAttachment : "job_id (Cascade, no FK)"
    HireContract ||..o{ HireMilestone : "contract_id (Cascade, no FK)"

    HireJob {
        string id PK
        string client_id "legacy string id"
    }
    HireContract {
        string id PK
        string job_id FK
        int tracking_id "logical -> ProjectTracking"
    }
    HireAttachment {
        string id PK
        string job_id FK
    }
    HireMilestone {
        string id PK
        string contract_id FK
    }
```

Isolated tables with no relations: `CmsPage`, `CmsPageVersion` (`page_id` logical), `CmsMedia`, `WebsitePage`, `LegalPage`, `PageConfiguration`, `WebsitePageOverride`, `PageTextOverride`, `Faq`, `ContactRequest`, `DirectHireNegotiation`, `LegacyUser`, `LegacyUserProfile`, `LegacyProfessionalDetail`, `LegacyLocation`, `LegacyVerification`, `SQLiteMigrationTableArchive`, `SQLiteMigrationAudit`.

---

## Key assumptions and limitations

1. **Schema-only verification.** Relationships come from `@relation` in `prisma/schema.prisma` and FK constraints in `prisma/migrations/**/migration.sql`. The live database was not inspected; it may have been built partly with `prisma db push` and could contain FKs/tables that migrations do not (shared/production database `[NEEDS VALIDATION — not testable locally]` via `scripts/full-database-audit.sql`). A local migrations-only database was compared with the schema via `prisma migrate diff` `[VALIDATED 2026-09-17 · V-01]` ([log](../../validation/LOCAL_VALIDATION_LOG.md)).
2. **Dotted lines are unenforced in a migrations-built database.** 16 of 39 relations have no FK (14 between tables that exist, incl. `Payment_milestone_id_fkey`); **28** model tables (including `SocketConversationClear`, `Message`, `MessageConversation`, `StoredFile`, `ApiToken`, `UserNotification`) are not created by any migration, plus `DirectHireNegotiation` whose migration creates `direct_hire_negotiations` while the model (no `@@map`) expects `"DirectHireNegotiation"` (queries fail with P2021); 30 schema indexes are missing on existing tables, and migrations add 2 indexes and 19 timestamp defaults the schema does not declare `[CORRECTED 2026-09-17 · V-01, V-06]`. Because `Payment.milestone_id` has an FK only on non-migration databases, `prisma/seed.ts` fails with P2003 on any database that has it `[FOUND IN VALIDATION 2026-09-17 · SEED]`.
3. **Cardinality follows Prisma typing**, except `ClientProfile → ClientSavedLocation`, drawn as 1:N because the unique index is partial (`isPrimary = true`) while Prisma types the relation as 1:1. At runtime `include: { savedLocations }` returns one arbitrary row (not necessarily the primary) as an object, and admin user detail reads `clientProfiles?.[0]` on an object so client profile data never shows `[VALIDATED 2026-09-17 · V-05, V-05b]`.
4. `User` appears twice in several relations (client and professional roles); Mermaid merges these into one entity box with multiple labelled edges.
5. Legacy `Hire*`, `Legacy*` and `DirectHireNegotiation` use string user ids that cannot reference `User.id` (Int); they are not used by the application.
6. Diagrams show keys and a few governing columns only; full column lists are in the data dictionary.
