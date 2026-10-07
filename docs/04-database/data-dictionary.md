# Data Dictionary

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

> Every field of all 69 models in `prisma/schema.prisma`, grouped by domain (same grouping as [database-design.md](./database-design.md) §3). Keys/indexes/relations: [schema.md](./schema.md).
>
> Column conventions:
>
> - **DB column**: physical column name when `@map` differs from the field name; `=` means same as field.
> - **Type**: Prisma type → PostgreSQL (`String`→`TEXT`, `Int`→`INTEGER`, `Float`→`DOUBLE PRECISION`, `DateTime`→`TIMESTAMP(3)`, `Boolean`→`BOOLEAN`, `Json`→`JSONB`).
> - **Null**: `Y` nullable / `N` required.
> - **Default**: Prisma default (`now()`, `autoincrement()`, `cuid()`, `@updatedAt` = set by Prisma Client on every update).
> - **Description**: derived from usage in `app/`, `src/`, `scripts/`, `prisma/seed.ts`. Where usage was not found, marked _(no usage found)_ and description is inferred from the name.
> - Money: all money columns are **whole INR rupees** stored as `INTEGER` (see database-design §6).
> - Relation fields (object/array navigation properties) are listed separately under each model; they have no column.

---

## Enums

| Enum            | Value                              | Meaning (from usage)                                                                               |
| --------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `UserRole`      | `ADMIN`                            | Platform operator; required for `/admin/*` (`proxy.ts`) and admin APIs                             |
|                 | `CLIENT`                           | Posts jobs, hires, funds milestones (default)                                                      |
|                 | `PROFESSIONAL`                     | Offers services, sends proposals, delivers work, receives payouts                                  |
| `JobUrgency`    | `LOW` / `MEDIUM` / `HIGH`          | Client-declared urgency of a job (default `MEDIUM`)                                                |
| `JobWorkMode`   | `ON_SITE` / `REMOTE` / `BOTH`      | Where the job can be performed (default `BOTH`)                                                    |
| `JobStatus`     | `DRAFT`                            | Incomplete job; only drafts can be deleted by the client (`app/api/client/jobs/[id]/route.ts:350`) |
|                 | `OPEN`                             | Published and visible in marketplace (default)                                                     |
|                 | `CLOSED`                           | No longer accepting proposals                                                                      |
| `CmsPageStatus` | `DRAFT` / `PUBLISHED` / `ARCHIVED` | Content lifecycle for DB-backed CMS tables (unused by app; CMS is file-based)                      |

String "enums" (no DB enforcement) are listed in each field description; full inventory: database-design §5 and `project-docs/STATUS_POLICY.md`.

---

## D1. Identity & authentication

### User (`User`)

| Field                               | DB column                | Type     | Null | Default         | Description                                                                                                                                                                                                                                                                                                                                                                                              | Constraints           |
| ----------------------------------- | ------------------------ | -------- | ---- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| id                                  | =                        | Int      | N    | autoincrement() | User identifier; embedded in session JWT as `userId`                                                                                                                                                                                                                                                                                                                                                     | PK                    |
| role                                | =                        | UserRole | N    | CLIENT          | Account role; drives routing and API authorization                                                                                                                                                                                                                                                                                                                                                       | enum                  |
| firstName                           | =                        | String   | N    | —               | Given name                                                                                                                                                                                                                                                                                                                                                                                               |                       |
| lastName                            | =                        | String   | N    | —               | Family name                                                                                                                                                                                                                                                                                                                                                                                              |                       |
| email                               | =                        | String   | N    | —               | Login identifier. Stored **as submitted** at registration, but login lowercases the input before an exact lookup → an account registered with a mixed-case email can never log in by email/password (401 as typed and lowercased, even after verification) (`scripts/full-database-audit.sql` checks `lower(email)` duplicates) `[CORRECTED 2026-09-17 · [V-21](../validation/LOCAL_VALIDATION_LOG.md)]` | UNIQUE                |
| phone                               | =                        | String   | Y    | —               | Phone number (E.164-style, India focus) used for OTP                                                                                                                                                                                                                                                                                                                                                     | UNIQUE                |
| passwordHash                        | =                        | String   | Y    | —               | bcryptjs hash; null for OAuth-only accounts                                                                                                                                                                                                                                                                                                                                                              |                       |
| googleId                            | =                        | String   | Y    | —               | Google account subject id when `authProvider = GOOGLE`                                                                                                                                                                                                                                                                                                                                                   | UNIQUE                |
| avatarUrl                           | =                        | String   | Y    | —               | Profile image URL                                                                                                                                                                                                                                                                                                                                                                                        |                       |
| companyName                         | =                        | String   | Y    | —               | Client company name (duplicated in `ClientProfile`)                                                                                                                                                                                                                                                                                                                                                      |                       |
| companyWebsite                      | =                        | String   | Y    | —               | Client company website                                                                                                                                                                                                                                                                                                                                                                                   |                       |
| industry                            | =                        | String   | Y    | —               | Industry label (also set for professionals by seed)                                                                                                                                                                                                                                                                                                                                                      |                       |
| teamSize                            | =                        | String   | Y    | —               | Team size bucket, e.g. `2-5`                                                                                                                                                                                                                                                                                                                                                                             |                       |
| companyDescription                  | =                        | String   | Y    | —               | Company / professional bio                                                                                                                                                                                                                                                                                                                                                                               |                       |
| address                             | =                        | String   | Y    | —               | Postal address                                                                                                                                                                                                                                                                                                                                                                                           |                       |
| professionalCategory                | =                        | String   | Y    | —               | Legacy free-text primary category name                                                                                                                                                                                                                                                                                                                                                                   |                       |
| professionalCity                    | =                        | String   | Y    | —               | Professional base city                                                                                                                                                                                                                                                                                                                                                                                   |                       |
| professionalSkillsJson              | =                        | String   | Y    | —               | JSON array of skill strings stored as text                                                                                                                                                                                                                                                                                                                                                               |                       |
| experienceYears                     | =                        | Int      | Y    | —               | Years of experience                                                                                                                                                                                                                                                                                                                                                                                      |                       |
| hourlyRate                          | =                        | Int      | Y    | —               | Hourly rate (INR)                                                                                                                                                                                                                                                                                                                                                                                        |                       |
| fixedRate                           | =                        | Int      | Y    | —               | Fixed project rate (INR)                                                                                                                                                                                                                                                                                                                                                                                 |                       |
| portfolioUrl                        | =                        | String   | Y    | —               | Portfolio link                                                                                                                                                                                                                                                                                                                                                                                           |                       |
| workPhotosJson                      | =                        | String   | Y    | —               | JSON array of work photo URLs                                                                                                                                                                                                                                                                                                                                                                            |                       |
| certificationsJson                  | =                        | String   | Y    | —               | JSON array of certifications                                                                                                                                                                                                                                                                                                                                                                             |                       |
| tradeLicenseUrl                     | =                        | String   | Y    | —               | Trade licence document URL                                                                                                                                                                                                                                                                                                                                                                               |                       |
| serviceArea                         | =                        | String   | Y    | —               | Free-text served localities                                                                                                                                                                                                                                                                                                                                                                              |                       |
| workMode                            | =                        | String   | N    | "both"          | Professional work mode; observed `both`, `ON_SITE`, `REMOTE` (mixed casing)                                                                                                                                                                                                                                                                                                                              |                       |
| serviceRadiusKm                     | =                        | Int      | Y    | —               | Service radius used by discovery                                                                                                                                                                                                                                                                                                                                                                         |                       |
| averageRating                       | =                        | Float    | N    | 0               | Aggregate review rating                                                                                                                                                                                                                                                                                                                                                                                  | CHECK 0–5             |
| reviewCount                         | =                        | Int      | N    | 0               | Number of reviews                                                                                                                                                                                                                                                                                                                                                                                        | CHECK ≥ 0             |
| isVerified                          | =                        | Boolean  | N    | false           | Professional verification badge                                                                                                                                                                                                                                                                                                                                                                          |                       |
| availabilityStatus                  | =                        | String   | N    | "available"     | Availability; observed `available`, `this_week` (seed)                                                                                                                                                                                                                                                                                                                                                   |                       |
| savedLocationsJson                  | =                        | String   | Y    | —               | Legacy JSON copy of saved locations                                                                                                                                                                                                                                                                                                                                                                      |                       |
| hiringNeedsJson                     | =                        | String   | Y    | —               | Legacy JSON copy of hiring needs                                                                                                                                                                                                                                                                                                                                                                         |                       |
| authProvider                        | =                        | String   | N    | "LOCAL"         | `LOCAL` or `GOOGLE`                                                                                                                                                                                                                                                                                                                                                                                      |                       |
| isActive                            | =                        | Boolean  | N    | true            | Admin deactivation flag; false revokes sessions and fails session verification                                                                                                                                                                                                                                                                                                                           |                       |
| lastLoginAt                         | =                        | DateTime | Y    | —               | Last successful login                                                                                                                                                                                                                                                                                                                                                                                    |                       |
| createdAt                           | =                        | DateTime | N    | now()           | Created timestamp                                                                                                                                                                                                                                                                                                                                                                                        |                       |
| updatedAt                           | =                        | DateTime | N    | @updatedAt      | Last update                                                                                                                                                                                                                                                                                                                                                                                              |                       |
| professionalLatitude                | =                        | Float    | Y    | —               | Base latitude for geo search                                                                                                                                                                                                                                                                                                                                                                             |                       |
| professionalLongitude               | =                        | Float    | Y    | —               | Base longitude for geo search                                                                                                                                                                                                                                                                                                                                                                            |                       |
| biometricEnabled                    | =                        | Boolean  | N    | false           | Biometric login preference _(no server usage found; mobile-oriented)_                                                                                                                                                                                                                                                                                                                                    |                       |
| biometricType                       | =                        | String   | Y    | —               | Biometric type _(no usage found)_                                                                                                                                                                                                                                                                                                                                                                        |                       |
| browserNotificationsEnabled         | =                        | Boolean  | N    | true            | Preference: browser notifications                                                                                                                                                                                                                                                                                                                                                                        |                       |
| emailNotificationsEnabled           | =                        | Boolean  | N    | true            | Preference: email notifications                                                                                                                                                                                                                                                                                                                                                                          |                       |
| emailVerifiedAt                     | =                        | DateTime | Y    | —               | Set when email verification token consumed; unverified non-admins redirected to `/verify`                                                                                                                                                                                                                                                                                                                |                       |
| projectActivityNotificationsEnabled | =                        | Boolean  | N    | true            | Preference: project activity notifications                                                                                                                                                                                                                                                                                                                                                               |                       |
| phoneVerifiedAt                     | =                        | DateTime | Y    | —               | Set after successful phone OTP                                                                                                                                                                                                                                                                                                                                                                           |                       |
| username                            | =                        | String   | Y    | —               | Username; the admin bootstrap account (`ADMIN_BOOTSTRAP_USERNAME`) is keyed by lower-cased username (`app/api/admin/login/route.ts:18-31`)                                                                                                                                                                                                                                                               | UNIQUE                |
| razorpayAccountId                   | razorpay_account_id      | String   | Y    | —               | Razorpay linked/route account for payouts                                                                                                                                                                                                                                                                                                                                                                | UNIQUE                |
| professionalState                   | =                        | String   | Y    | —               | Indian state for location filtering                                                                                                                                                                                                                                                                                                                                                                      | idx (state, district) |
| professionalDistrict                | =                        | String   | Y    | —               | District                                                                                                                                                                                                                                                                                                                                                                                                 | idx                   |
| professionalCategoryId              | professional_category_id | Int      | Y    | —               | Primary `ServiceCategory`                                                                                                                                                                                                                                                                                                                                                                                | FK SET NULL; idx      |

Relation fields: `clientJobs[]`, `clientProfiles?`, `favoriteJobs[]`, `clientPayments[]`, `professionalPayments[]`, `clientProjectRequests[]`, `professionalProjectRequests[]`, `clientProjectTrackings[]`, `professionalProjectTrackings[]`, `professionalCategoryRecord?`, `services[]`, `verification?`, `auditLogs[]`, `personaVerifications[]`, `sessions[]`.

### Session (`sessions`)

| Field     | DB column  | Type     | Null | Default                                        | Description                                       | Constraints               |
| --------- | ---------- | -------- | ---- | ---------------------------------------------- | ------------------------------------------------- | ------------------------- |
| id        | =          | String   | N    | cuid() (app supplies id, `src/lib/auth.ts:20`) | Session id; embedded in JWT as `sessionId`        | PK                        |
| userId    | user_id    | Int      | N    | —                                              | Owner                                             | FK → User CASCADE         |
| expiresAt | expires_at | DateTime | N    | —                                              | Expiry (7 days, matches cookie)                   |                           |
| revokedAt | revoked_at | DateTime | Y    | —                                              | Set on logout, password reset, admin deactivation | idx (user_id, revoked_at) |
| createdAt | created_at | DateTime | N    | now()                                          | Created                                           |                           |

### ApiToken (`ApiToken`)

| Field     | DB column | Type     | Null | Default         | Description                                                                                     | Constraints        |
| --------- | --------- | -------- | ---- | --------------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| id        | =         | Int      | N    | autoincrement() |                                                                                                 | PK                 |
| userId    | =         | Int      | N    | —               | Token owner (no FK)                                                                             | idx (userId, kind) |
| tokenHash | =         | String   | N    | —               | Hash of a random 32-byte hex token that is emailed raw (`app/api/auth/[action]/route.ts:74-84`) | UNIQUE             |
| kind      | =         | String   | N    | —               | `EMAIL_VERIFICATION` or `PASSWORD_RESET` (`app/api/auth/[action]/route.ts`)                     |                    |
| expiresAt | =         | DateTime | N    | —               | Token expiry (24 h for email verification)                                                      |                    |
| usedAt    | =         | DateTime | Y    | —               | Consumption time (single use)                                                                   |                    |
| createdAt | =         | DateTime | N    | now()           |                                                                                                 |                    |

### OtpCode (`OtpCode`)

| Field      | DB column | Type     | Null | Default         | Description                                                    | Constraints |
| ---------- | --------- | -------- | ---- | --------------- | -------------------------------------------------------------- | ----------- |
| id         | =         | Int      | N    | autoincrement() |                                                                | PK          |
| phone      | =         | String   | N    | —               | Target phone                                                   | idx ×2      |
| codeHash   | =         | String   | N    | —               | Hash of OTP code                                               |             |
| role       | =         | String   | N    | —               | Intended role `CLIENT` / `PROFESSIONAL`                        |             |
| attempts   | =         | Int      | N    | 0               | Verification attempts (atomic increment, max enforced in code) |             |
| expiresAt  | =         | DateTime | N    | —               | Expiry                                                         |             |
| consumedAt | =         | DateTime | Y    | —               | Set on correct code; older codes invalidated on resend         |             |
| createdAt  | =         | DateTime | N    | now()           |                                                                |             |

---

## D2. Client profile & locations

### ClientProfile (`ClientProfile`)

| Field              | DB column | Type     | Null | Default         | Description                                             | Constraints                         |
| ------------------ | --------- | -------- | ---- | --------------- | ------------------------------------------------------- | ----------------------------------- |
| id                 | =         | Int      | N    | autoincrement() |                                                         | PK                                  |
| userId             | =         | Int      | N    | —               | Owning client                                           | UNIQUE; relation Cascade (no DB FK) |
| fullName           | =         | String   | N    | —               | Display name                                            |                                     |
| email              | =         | String   | N    | —               | Contact email (copy of User.email)                      |                                     |
| phone              | =         | String   | N    | —               | Contact phone                                           |                                     |
| companyName        | =         | String   | Y    | —               | Company (nullable since `202608100001` for individuals) |                                     |
| companyWebsite     | =         | String   | Y    | —               |                                                         |                                     |
| industry           | =         | String   | Y    | —               |                                                         |                                     |
| teamSize           | =         | String   | Y    | —               |                                                         |                                     |
| companyDescription | =         | String   | Y    | —               |                                                         |                                     |
| address            | =         | String   | N    | —               | Address                                                 |                                     |
| profilePhotoUrl    | =         | String   | Y    | —               | Photo URL                                               |                                     |
| createdAt          | =         | DateTime | N    | now()           |                                                         |                                     |
| updatedAt          | =         | DateTime | N    | @updatedAt      |                                                         |                                     |

Relation fields: `hiringNeeds[]`, `user`, `savedLocations?` (see schema.md D2 cardinality note).

### ClientSavedLocation (`ClientSavedLocation`)

| Field           | DB column | Type     | Null | Default         | Description                     | Constraints                                                 |
| --------------- | --------- | -------- | ---- | --------------- | ------------------------------- | ----------------------------------------------------------- |
| id              | =         | Int      | N    | autoincrement() |                                 | PK                                                          |
| clientProfileId | =         | Int      | N    | —               | Owning profile                  | partial UNIQUE where isPrimary; relation Cascade (no DB FK) |
| label           | =         | String   | N    | —               | e.g. "Home", "Office"           |                                                             |
| address         | =         | String   | N    | —               | Address text                    |                                                             |
| createdAt       | =         | DateTime | N    | now()           |                                 |                                                             |
| isPrimary       | =         | Boolean  | N    | false           | At most one primary per profile | enforced by partial unique index                            |

### ClientHiringNeed (`ClientHiringNeed`) — _no app usage_

| Field           | DB column | Type     | Null | Default         | Description       | Constraints                 |
| --------------- | --------- | -------- | ---- | --------------- | ----------------- | --------------------------- |
| id              | =         | Int      | N    | autoincrement() |                   | PK                          |
| clientProfileId | =         | Int      | N    | —               | Owning profile    | relation Cascade (no DB FK) |
| value           | =         | String   | N    | —               | Hiring need label |                             |
| createdAt       | =         | DateTime | N    | now()           |                   |                             |

---

## D3. Service catalogue

### ServiceCategory (`ServiceCategory`)

| Field       | DB column | Type     | Null | Default         | Description                                          | Constraints                             |
| ----------- | --------- | -------- | ---- | --------------- | ---------------------------------------------------- | --------------------------------------- |
| id          | =         | Int      | N    | autoincrement() |                                                      | PK                                      |
| name        | =         | String   | N    | —               | Category name                                        | UNIQUE                                  |
| slug        | =         | String   | N    | —               | URL slug; seed upsert key                            | UNIQUE                                  |
| description | =         | String   | N    | ""              |                                                      |                                         |
| iconName    | =         | String   | N    | ""              | Lucide icon name (e.g. `FileCheck`)                  |                                         |
| sortOrder   | =         | Int      | N    | 0               | Display order                                        |                                         |
| createdAt   | =         | DateTime | N    | now()           |                                                      |                                         |
| updatedAt   | =         | DateTime | N    | now()           | **Not** `@updatedAt` — only changes when app sets it |                                         |
| segment     | =         | String   | N    | "RESIDENTIAL"   | Top-level market segment                             | CHECK RESIDENTIAL/COMMERCIAL/INDUSTRIAL |
| parentId    | =         | Int      | Y    | —               | Parent category (null = root); 3-tier tree           | FK self CASCADE; idx                    |

Relation fields: `services[]`, `parent?`, `children[]`, `professionalUsers[]`.

### Service (`Service`)

| Field          | DB column | Type     | Null | Default         | Description                                                          | Constraints                      |
| -------------- | --------- | -------- | ---- | --------------- | -------------------------------------------------------------------- | -------------------------------- |
| id             | =         | Int      | N    | autoincrement() |                                                                      | PK                               |
| categoryId     | =         | Int      | N    | —               | Category offered                                                     | FK RESTRICT                      |
| professionalId | =         | Int      | N    | —               | Offering professional                                                | relation Cascade (no DB FK); idx |
| name           | =         | String   | N    | —               | Service title                                                        |                                  |
| description    | =         | String   | N    | —               |                                                                      |                                  |
| price          | =         | Int      | Y    | —               | Price (INR)                                                          |                                  |
| imageUrl       | =         | String   | Y    | —               |                                                                      |                                  |
| isActive       | =         | Boolean  | N    | true            | Used in discovery filters (`services: { some: { isActive: true } }`) |                                  |
| createdAt      | =         | DateTime | N    | now()           |                                                                      |                                  |
| updatedAt      | =         | DateTime | N    | @updatedAt      |                                                                      |                                  |

---

## D4. Jobs

### ClientJob (`ClientJob`)

| Field            | DB column | Type        | Null | Default         | Description                                            | Constraints                 |
| ---------------- | --------- | ----------- | ---- | --------------- | ------------------------------------------------------ | --------------------------- |
| id               | =         | Int         | N    | autoincrement() | Job id                                                 | PK                          |
| userId           | =         | Int         | N    | —               | Posting client                                         | relation Cascade (no DB FK) |
| category         | =         | String      | Y    | —               | Category name (free text, not FK); nullable for drafts |                             |
| title            | =         | String      | Y    | —               | Title; required by API for OPEN                        |                             |
| description      | =         | String      | Y    | —               |                                                        |                             |
| budgetMin        | =         | Int         | Y    | —               | Min budget (INR)                                       | CHECK ≤ budgetMax           |
| budgetMax        | =         | Int         | Y    | —               | Max budget (INR)                                       |                             |
| urgency          | =         | JobUrgency  | N    | MEDIUM          |                                                        | enum                        |
| jobDate          | =         | DateTime    | Y    | —               | Desired start date                                     |                             |
| deadline         | =         | DateTime    | Y    | —               | Deadline                                               |                             |
| workMode         | =         | JobWorkMode | N    | BOTH            |                                                        | enum                        |
| locationLabel    | =         | String      | Y    | —               | Short location label ("Remote" / city)                 |                             |
| locationAddress  | =         | String      | Y    | —               | Full address                                           |                             |
| locationLat      | =         | Float       | Y    | —               | Latitude                                               |                             |
| locationLng      | =         | Float       | Y    | —               | Longitude                                              |                             |
| status           | =         | JobStatus   | N    | OPEN            | Lifecycle                                              | enum                        |
| createdAt        | =         | DateTime    | N    | now()           |                                                        |                             |
| updatedAt        | =         | DateTime    | N    | @updatedAt      |                                                        |                             |
| hourlyRate       | =         | Int         | Y    | —               | Hourly rate when `timingType = HOURLY`                 |                             |
| timingType       | =         | String      | N    | "FIXED"         | `FIXED` / `HOURLY`                                     |                             |
| paymentMethod    | =         | String      | N    | "WALLET"        | `WALLET` (in-platform escrow) / `OFFLINE`              |                             |
| locationState    | =         | String      | Y    | —               | Indian state                                           | idx (state, district)       |
| locationDistrict | =         | String      | Y    | —               | District                                               | idx                         |

Relation fields: `user`, `attachments[]`, `favoriteJobs[]`, `payments[]`, `projectRequests[]`, `projectTrackings[]`, `milestones[]` (ClientJobMilestone).

### ClientJobAttachment (`ClientJobAttachment`)

| Field      | DB column | Type     | Null | Default         | Description          | Constraints                 |
| ---------- | --------- | -------- | ---- | --------------- | -------------------- | --------------------------- |
| id         | =         | Int      | N    | autoincrement() |                      | PK                          |
| jobId      | =         | Int      | N    | —               | Job                  | relation Cascade (no DB FK) |
| fileName   | =         | String   | N    | —               | Original file name   |                             |
| fileType   | =         | String   | Y    | —               | MIME type            |                             |
| fileSize   | =         | Int      | Y    | —               | Bytes                |                             |
| previewUrl | =         | String   | Y    | —               | Preview/download URL |                             |
| createdAt  | =         | DateTime | N    | now()           |                      |                             |

### ClientJobMilestone (`ClientJobMilestone`)

| Field       | DB column | Type     | Null | Default         | Description                                                                                                                                                                                                                           | Constraints     |
| ----------- | --------- | -------- | ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| id          | =         | Int      | N    | autoincrement() |                                                                                                                                                                                                                                       | PK              |
| jobId       | =         | Int      | N    | —               | Job                                                                                                                                                                                                                                   | FK CASCADE; idx |
| title       | =         | String   | N    | —               | Planned milestone title                                                                                                                                                                                                               |                 |
| description | =         | String   | Y    | —               |                                                                                                                                                                                                                                       |                 |
| percentage  | =         | Int      | N    | —               | Share of job budget (%); validation in `app/api/client/jobs/[id]/route.ts` enforces sum **≤ 100**, not = 100 (60%+60% → 400; 30%+30% → 201, 40% unallocated) `[CORRECTED 2026-09-17 · [V-48](../validation/LOCAL_VALIDATION_LOG.md)]` | no CHECK        |
| amount      | =         | Int      | Y    | —               | Derived amount (INR)                                                                                                                                                                                                                  |                 |
| sortOrder   | =         | Int      | N    | 0               | Order                                                                                                                                                                                                                                 |                 |
| createdAt   | =         | DateTime | N    | now()           |                                                                                                                                                                                                                                       |                 |
| updatedAt   | =         | DateTime | N    | @updatedAt      |                                                                                                                                                                                                                                       |                 |

Set is replaced wholesale on job update (`deleteMany` + `createMany`, `route.ts:317-319`).

### FavoriteJob (`FavoriteJob`)

| Field     | DB column | Type     | Null | Default         | Description                    | Constraints           |
| --------- | --------- | -------- | ---- | --------------- | ------------------------------ | --------------------- |
| id        | =         | Int      | N    | autoincrement() |                                | PK                    |
| userId    | =         | Int      | N    | —               | Professional who saved the job | UNIQUE(userId, jobId) |
| jobId     | =         | Int      | N    | —               | Saved job                      |                       |
| createdAt | =         | DateTime | N    | now()           |                                |                       |

---

## D5. Proposals / hire requests

### ProjectRequest (`ProjectRequest`)

| Field           | DB column | Type     | Null | Default         | Description                                                                                  | Constraints                                |
| --------------- | --------- | -------- | ---- | --------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| id              | =         | Int      | N    | autoincrement() |                                                                                              | PK                                         |
| jobId           | =         | Int      | N    | —               | Target job                                                                                   | FK RESTRICT                                |
| clientId        | =         | Int      | N    | —               | Job owner                                                                                    | FK RESTRICT                                |
| professionalId  | =         | Int      | N    | —               | Professional                                                                                 | FK RESTRICT                                |
| bidAmount       | =         | Int      | N    | —               | Offered price (INR)                                                                          |                                            |
| duration        | =         | String   | N    | —               | Free-text duration                                                                           |                                            |
| coverLetter     | =         | String   | N    | —               | Proposal / hire message                                                                      |                                            |
| status          | =         | String   | N    | "PENDING"       | `PENDING`, `ACCEPTED`, `REJECTED` (`src/lib/project-request-actions.ts`)                     |                                            |
| attachmentsJson | =         | String   | Y    | "[]"            | JSON array of attachment descriptors                                                         |                                            |
| createdAt       | =         | DateTime | N    | now()           |                                                                                              |                                            |
| updatedAt       | =         | DateTime | N    | @updatedAt      |                                                                                              |                                            |
| origin          | =         | String   | N    | "CLIENT_HIRE"   | `CLIENT_HIRE` (client invited professional) / `PROFESSIONAL_PROPOSAL` (professional applied) | idx (jobId, origin, status) migration-only |

### ProjectNegotiation (`ProjectNegotiation`)

| Field             | DB column | Type     | Null | Default         | Description                             | Constraints |
| ----------------- | --------- | -------- | ---- | --------------- | --------------------------------------- | ----------- |
| id                | =         | Int      | N    | autoincrement() |                                         | PK          |
| requestId         | =         | Int      | N    | —               | ProjectRequest being negotiated (no FK) | idx         |
| jobId             | =         | Int      | N    | —               | Job                                     |             |
| clientId          | =         | Int      | N    | —               |                                         | idx         |
| professionalId    | =         | Int      | N    | —               |                                         | idx         |
| senderId          | =         | Int      | N    | —               | Author of this counter-offer            |             |
| senderRole        | =         | String   | N    | —               | `CLIENT` / `PROFESSIONAL`               |             |
| bidAmount         | =         | Int      | Y    | —               | Proposed amount (INR)                   |             |
| duration          | =         | String   | Y    | —               | Proposed duration                       |             |
| message           | =         | String   | N    | —               | Message                                 |             |
| createdAt         | =         | DateTime | N    | now()           |                                         |             |
| previousBidAmount | =         | Int      | Y    | —               | Value before this change                |             |
| previousDuration  | =         | String   | Y    | —               |                                         |             |
| previousMessage   | =         | String   | Y    | —               |                                         |             |

---

## D6. Project tracking & delivery

### ProjectTracking (`ProjectTracking`)

| Field          | DB column | Type     | Null | Default          | Description                                                                                                                                                                          | Constraints         |
| -------------- | --------- | -------- | ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| id             | =         | Int      | N    | autoincrement()  | Project id (used in `/project/[projectId]/tracking`)                                                                                                                                 | PK                  |
| requestId      | =         | Int      | N    | —                | Accepted request that created the project                                                                                                                                            | UNIQUE; FK RESTRICT |
| jobId          | =         | Int      | N    | —                |                                                                                                                                                                                      | FK RESTRICT         |
| clientId       | =         | Int      | N    | —                |                                                                                                                                                                                      | FK RESTRICT         |
| professionalId | =         | Int      | N    | —                |                                                                                                                                                                                      | FK RESTRICT         |
| status         | =         | String   | N    | "READY_TO_START" | `READY_TO_START`, `IN_PROGRESS`, `AWAITING_CLIENT_REVIEW`, `REVISION_REQUESTED`, `FINAL_WORK_SUBMITTED`, `AWAITING_PROFESSIONAL_CONFIRMATION`, `COMPLETED`, `CLOSED` (STATUS_POLICY) |                     |
| acceptedAt     | =         | DateTime | N    | now()            | Acceptance time                                                                                                                                                                      |                     |
| createdAt      | =         | DateTime | N    | now()            |                                                                                                                                                                                      |                     |
| updatedAt      | =         | DateTime | N    | @updatedAt       |                                                                                                                                                                                      |                     |
| progress       | =         | Int      | N    | 0                | Percent complete                                                                                                                                                                     | CHECK 0–100         |
| currentStage   | =         | String   | Y    | —                | Title of current milestone (`milestone-payout/route.ts:100`)                                                                                                                         |                     |
| startedAt      | =         | DateTime | Y    | —                |                                                                                                                                                                                      |                     |
| completedAt    | =         | DateTime | Y    | —                |                                                                                                                                                                                      |                     |

Relation fields: `payments[]`, `milestones[]`, `timelineEvents[]`, `client`, `job`, `professional`, `request`, `workUploads[]`.

### ProjectTimelineEvent (`ProjectTimelineEvent`)

| Field          | DB column | Type     | Null | Default         | Description                                                                                                          | Constraints                              |
| -------------- | --------- | -------- | ---- | --------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| id             | =         | Int      | N    | autoincrement() |                                                                                                                      | PK                                       |
| trackingId     | =         | Int      | N    | —               | Project                                                                                                              | FK RESTRICT; idx (trackingId, createdAt) |
| milestoneId    | =         | Int      | Y    | —               | Related milestone (no FK)                                                                                            |                                          |
| actorId        | =         | Int      | N    | —               | User who caused the event                                                                                            |                                          |
| actorRole      | =         | String   | N    | —               | Actor role                                                                                                           |                                          |
| type           | =         | String   | N    | —               | Event type, e.g. `PROJECT_REQUEST`, `PROJECT_COMPLETION_REQUESTED`, `PROJECT_COMPLETED`, `OFFLINE_MILESTONE_PAYMENT` |                                          |
| title          | =         | String   | N    | —               | Display title                                                                                                        |                                          |
| description    | =         | String   | Y    | —               |                                                                                                                      |                                          |
| progress       | =         | Int      | Y    | —               | Progress snapshot                                                                                                    |                                          |
| stage          | =         | String   | Y    | —               | Stage snapshot                                                                                                       |                                          |
| attachmentJson | =         | String   | Y    | "[]"            | JSON attachments                                                                                                     |                                          |
| createdAt      | =         | DateTime | N    | now()           |                                                                                                                      |                                          |

### ProjectMilestone (`ProjectMilestone`)

| Field          | DB column | Type     | Null | Default         | Description                                                                                                                            | Constraints |
| -------------- | --------- | -------- | ---- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| id             | =         | Int      | N    | autoincrement() |                                                                                                                                        | PK          |
| trackingId     | =         | Int      | N    | —               | Project                                                                                                                                | FK RESTRICT |
| clientId       | =         | Int      | N    | —               | Denormalised client (no FK)                                                                                                            |             |
| professionalId | =         | Int      | N    | —               | Denormalised professional (no FK)                                                                                                      |             |
| title          | =         | String   | N    | —               |                                                                                                                                        |             |
| description    | =         | String   | Y    | —               |                                                                                                                                        |             |
| amount         | =         | Int      | N    | —               | Base amount (INR) before fees                                                                                                          |             |
| dueDate        | =         | DateTime | Y    | —               |                                                                                                                                        |             |
| status         | =         | String   | N    | "UPCOMING"      | `UPCOMING`, `IN_PROGRESS`, `AWAITING_CLIENT_REVIEW`, `REVISION_REQUESTED`, `PAYMENT_PROCESSING`, `AWAITING_ADMIN_APPROVAL`, `APPROVED` |             |
| createdAt      | =         | DateTime | N    | now()           |                                                                                                                                        |             |
| updatedAt      | =         | DateTime | N    | @updatedAt      |                                                                                                                                        |             |
| submittedAt    | =         | DateTime | Y    | —               | Work submitted for review                                                                                                              |             |
| approvedAt     | =         | DateTime | Y    | —               | Admin payout approved                                                                                                                  |             |

Relation fields: `tracking`, `payment?` (1:1 via `Payment.milestone_id`), `workUploads[]`.

### ProjectWorkUpload (`ProjectWorkUpload`)

| Field       | DB column | Type     | Null | Default         | Description                                                                    | Constraints |
| ----------- | --------- | -------- | ---- | --------------- | ------------------------------------------------------------------------------ | ----------- |
| id          | =         | Int      | N    | autoincrement() |                                                                                | PK          |
| trackingId  | =         | Int      | N    | —               | Project                                                                        | FK RESTRICT |
| roundNumber | =         | Int      | N    | 1               | Submission round (increments after revision)                                   |             |
| title       | =         | String   | N    | —               |                                                                                |             |
| note        | =         | String   | Y    | —               |                                                                                |             |
| fileName    | =         | String   | Y    | —               | Single-file legacy name                                                        |             |
| fileUrl     | =         | String   | Y    | —               | Single-file legacy URL                                                         |             |
| filesJson   | =         | String   | Y    | "[]"            | JSON array of uploaded attachment descriptors (`project-actions/route.ts:505`) |             |
| createdAt   | =         | DateTime | N    | now()           |                                                                                |             |
| milestoneId | =         | Int      | Y    | —               | Milestone                                                                      | FK RESTRICT |
| status      | =         | String   | N    | "UPLOADED"      | `UPLOADED`, `SUBMITTED`, `FINAL_SUBMITTED`                                     |             |

### ProjectCompletionRequest (`ProjectCompletionRequest`) — _no app usage_

| Field          | DB column | Type     | Null | Default         | Description | Constraints |
| -------------- | --------- | -------- | ---- | --------------- | ----------- | ----------- |
| id             | =         | Int      | N    | autoincrement() |             | PK          |
| trackingId     | =         | Int      | N    | —               | Project     | idx         |
| clientId       | =         | Int      | N    | —               |             |             |
| professionalId | =         | Int      | N    | —               |             |             |
| note           | =         | String   | Y    | —               |             |             |
| status         | =         | String   | N    | "PENDING"       |             |             |
| submittedAt    | =         | DateTime | N    | now()           |             |             |
| updatedAt      | =         | DateTime | N    | @updatedAt      |             |             |

### ProjectRevisionRequest (`ProjectRevisionRequest`)

| Field          | DB column | Type     | Null | Default         | Description                              | Constraints |
| -------------- | --------- | -------- | ---- | --------------- | ---------------------------------------- | ----------- |
| id             | =         | Int      | N    | autoincrement() |                                          | PK          |
| trackingId     | =         | Int      | N    | —               | Project (`project-actions/route.ts:577`) | idx         |
| clientId       | =         | Int      | N    | —               | Requesting client                        |             |
| professionalId | =         | Int      | N    | —               |                                          |             |
| note           | =         | String   | Y    | —               | Revision instructions                    |             |
| status         | =         | String   | N    | "PENDING"       |                                          |             |
| createdAt      | =         | DateTime | N    | now()           |                                          |             |
| updatedAt      | =         | DateTime | N    | @updatedAt      |                                          |             |

### ProjectReviewRequest (`ProjectReviewRequest`) — _no app usage_

| Field          | DB column | Type     | Null | Default         | Description | Constraints |
| -------------- | --------- | -------- | ---- | --------------- | ----------- | ----------- |
| id             | =         | Int      | N    | autoincrement() |             | PK          |
| trackingId     | =         | Int      | N    | —               |             | idx         |
| clientId       | =         | Int      | N    | —               |             |             |
| professionalId | =         | Int      | N    | —               |             |             |
| note           | =         | String   | Y    | —               |             |             |
| createdAt      | =         | DateTime | N    | now()           |             |             |
| updatedAt      | =         | DateTime | N    | @updatedAt      |             |             |

### ProjectReview (`ProjectReview`)

| Field                  | DB column | Type     | Null | Default         | Description                               | Constraints |
| ---------------------- | --------- | -------- | ---- | --------------- | ----------------------------------------- | ----------- |
| id                     | =         | Int      | N    | autoincrement() |                                           | PK          |
| trackingId             | =         | Int      | N    | —               | Reviewed project (one review per project) | UNIQUE      |
| clientId               | =         | Int      | N    | —               | Reviewer                                  | idx         |
| professionalId         | =         | Int      | N    | —               | Reviewee                                  | idx         |
| rating                 | =         | Int      | N    | —               | Star rating                               | CHECK 1–5   |
| comment                | =         | String   | Y    | —               |                                           |             |
| createdAt              | =         | DateTime | N    | now()           |                                           |             |
| updatedAt              | =         | DateTime | N    | @updatedAt      |                                           |             |
| professionalResponse   | =         | String   | Y    | —               | Professional reply                        |             |
| professionalResponseAt | =         | DateTime | Y    | —               |                                           |             |

### StoredFile (`StoredFile`)

| Field      | DB column | Type     | Null | Default         | Description                                          | Constraints |
| ---------- | --------- | -------- | ---- | --------------- | ---------------------------------------------------- | ----------- |
| id         | =         | Int      | N    | autoincrement() | Served at `/api/v1/portal/project-files/{id}`        | PK          |
| ownerId    | =         | Int      | N    | —               | Uploader (no FK)                                     | idx         |
| purpose    | =         | String   | N    | —               | Context key, e.g. `project-work:<trackingId>`        |             |
| fileName   | =         | String   | N    | —               | Original name                                        |             |
| mimeType   | =         | String   | N    | —               | Validated MIME                                       |             |
| sizeBytes  | =         | Int      | N    | —               | Size                                                 |             |
| storageKey | =         | String   | N    | —               | Server-generated object key in S3-compatible storage | UNIQUE      |
| isPublic   | =         | Boolean  | N    | false           | Public access flag                                   |             |
| createdAt  | =         | DateTime | N    | now()           |                                                      |             |

---

## D7. Payments, wallet, ledger, payouts, invoices

### Payment (`Payment`)

| Field                    | DB column                  | Type     | Null | Default         | Description                                                     | Constraints                 |
| ------------------------ | -------------------------- | -------- | ---- | --------------- | --------------------------------------------------------------- | --------------------------- |
| id                       | =                          | Int      | N    | autoincrement() |                                                                 | PK                          |
| clientId                 | =                          | Int      | N    | —               | Payer                                                           | FK RESTRICT                 |
| professionalId           | =                          | Int      | N    | —               | Payee                                                           | FK RESTRICT                 |
| jobId                    | =                          | Int      | Y    | —               | Job                                                             | FK RESTRICT                 |
| amount                   | =                          | Int      | N    | —               | Gross amount charged to client (base + client fee), INR         | CHECK ≥ 0                   |
| commissionAmount         | =                          | Int      | N    | 0               | Legacy commission (seed sets = adminNet)                        |                             |
| currency                 | =                          | String   | N    | "INR"           |                                                                 |                             |
| provider                 | =                          | String   | N    | —               | `wallet`, `offline`, Razorpay                                   |                             |
| providerReference        | =                          | String   | Y    | —               | Provider-side reference                                         |                             |
| status                   | =                          | String   | N    | "PENDING"       | `PENDING`, `FUNDED`, `PAYOUT_PROCESSING`, `COMPLETED`, `FAILED` |                             |
| idempotencyKey           | =                          | String   | N    | —               | Deduplication key, e.g. `seed-milestone-…`                      | UNIQUE                      |
| createdAt                | =                          | DateTime | N    | now()           |                                                                 |                             |
| updatedAt                | =                          | DateTime | N    | @updatedAt      |                                                                 |                             |
| razorpayOrderId          | razorpay_order_id          | String   | Y    | —               | Razorpay order                                                  | UNIQUE                      |
| razorpayPaymentId        | razorpay_payment_id        | String   | Y    | —               | Razorpay payment                                                | UNIQUE                      |
| razorpaySignature        | razorpay_signature         | String   | Y    | —               | Checkout signature                                              |                             |
| projectTrackingId        | project_tracking_id        | Int      | Y    | —               | Project                                                         | FK RESTRICT                 |
| milestoneId              | milestone_id               | Int      | Y    | —               | Milestone paid (one payment per milestone)                      | UNIQUE; relation (no DB FK) |
| capturedAt               | captured_at                | DateTime | Y    | —               | Funds captured/debited                                          |                             |
| failureReason            | failure_reason             | String   | Y    | —               |                                                                 |                             |
| baseAmount               | base_amount                | Int      | N    | 0               | Milestone base amount                                           | CHECK ≥ 0                   |
| clientFeeAmount          | client_fee_amount          | Int      | N    | 0               | ceil(10% of base)                                               | CHECK ≥ 0                   |
| professionalPayoutAmount | professional_payout_amount | Int      | N    | 0               | base − ceil(10% of base)                                        | CHECK ≥ 0                   |
| adminNetAmount           | admin_net_amount           | Int      | N    | 0               | amount − professionalPayout                                     | CHECK ≥ 0                   |

### RazorpayWebhookEvent (`razorpay_webhook_events`)

| Field               | DB column             | Type     | Null | Default         | Description                                                                               | Constraints               |
| ------------------- | --------------------- | -------- | ---- | --------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| id                  | =                     | Int      | N    | autoincrement() |                                                                                           | PK                        |
| eventId             | event_id              | String   | N    | —               | Provider event id (dedupe)                                                                | UNIQUE                    |
| eventName           | event_name            | String   | N    | —               | e.g. `payment.captured`                                                                   |                           |
| payloadJson         | payload_json          | String   | N    | —               | Raw webhook body (contains provider PII)                                                  |                           |
| createdAt           | created_at            | DateTime | N    | now()           |                                                                                           |                           |
| processingStatus    | processing_status     | String   | N    | "RECEIVED"      | `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`; stale `PROCESSING` reclaimed after 5 min | idx (status, received_at) |
| processingAttempts  | processing_attempts   | Int      | N    | 0               | Retry counter                                                                             |                           |
| lastError           | last_error            | String   | Y    | —               | Truncated error (500 chars)                                                               |                           |
| receivedAt          | received_at           | DateTime | N    | now()           |                                                                                           |                           |
| processingStartedAt | processing_started_at | DateTime | Y    | —               | Claim time                                                                                |                           |
| processedAt         | processed_at          | DateTime | Y    | —               |                                                                                           |                           |

### Wallet (`Wallet`)

| Field          | DB column | Type     | Null | Default         | Description                                                            | Constraints    |
| -------------- | --------- | -------- | ---- | --------------- | ---------------------------------------------------------------------- | -------------- |
| id             | =         | Int      | N    | autoincrement() |                                                                        | PK             |
| userId         | =         | Int      | N    | —               | Owner (client, professional or admin treasury)                         | UNIQUE (no FK) |
| currency       | =         | String   | N    | "INR"           |                                                                        |                |
| balance        | =         | Int      | N    | 0               | Available + reserved funds (INR)                                       | no CHECK       |
| pendingBalance | =         | Int      | N    | 0               | Reserved for pending withdrawals; available = balance − pendingBalance |                |
| updatedAt      | =         | DateTime | N    | @updatedAt      |                                                                        |                |

### WalletTransaction (`WalletTransaction`)

| Field             | DB column          | Type     | Null | Default         | Description                                                                                                    | Constraints                     |
| ----------------- | ------------------ | -------- | ---- | --------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| id                | =                  | Int      | N    | autoincrement() |                                                                                                                | PK                              |
| walletId          | =                  | Int      | N    | —               | Wallet                                                                                                         | relation Cascade (no DB FK)     |
| paymentId         | =                  | Int      | Y    | —               | Related payment (no FK)                                                                                        |                                 |
| type              | =                  | String   | N    | —               | `WALLET_TOP_UP`, `MILESTONE_PAYMENT`, `ADMIN_MILESTONE_RECEIPT`, `PROFESSIONAL_PAYOUT`, `MILESTONE_EARNING`, … |                                 |
| amount            | =                  | Int      | N    | —               | Signed INR (negative = debit)                                                                                  |                                 |
| status            | =                  | String   | N    | —               | `PENDING`, `COMPLETED`, `FAILED`                                                                               |                                 |
| description       | =                  | String   | N    | —               | Human-readable                                                                                                 |                                 |
| metadataJson      | =                  | String   | Y    | —               | JSON metadata                                                                                                  |                                 |
| createdAt         | =                  | DateTime | N    | now()           |                                                                                                                |                                 |
| idempotencyKey    | idempotency_key    | String   | N    | —               | e.g. `payment-<id>-client-debit`                                                                               | UNIQUE                          |
| providerReference | provider_reference | String   | Y    | —               | Razorpay order/payment id for top-ups                                                                          | UNIQUE (partial where not null) |

### ProjectTransaction (`ProjectTransaction`)

| Field          | DB column | Type     | Null | Default         | Description                                                                           | Constraints |
| -------------- | --------- | -------- | ---- | --------------- | ------------------------------------------------------------------------------------- | ----------- |
| id             | =         | Int      | N    | autoincrement() |                                                                                       | PK          |
| trackingId     | =         | Int      | N    | —               | Project (no FK)                                                                       | idx         |
| milestoneId    | =         | Int      | Y    | —               | Milestone                                                                             |             |
| completionId   | =         | Int      | Y    | —               | Completion request _(no usage found)_                                                 |             |
| clientId       | =         | Int      | N    | —               |                                                                                       | idx         |
| professionalId | =         | Int      | N    | —               |                                                                                       | idx         |
| amount         | =         | Int      | N    | —               | INR (base amount)                                                                     |             |
| currency       | =         | String   | N    | "INR"           |                                                                                       |             |
| type           | =         | String   | N    | —               | `WALLET_MILESTONE_FUNDED`, `WALLET_MILESTONE_PAYMENT`, `OFFLINE_MILESTONE_PAYMENT`, … |             |
| status         | =         | String   | N    | "COMPLETED"     | `COMPLETED`, `PENDING_ADMIN_PAYOUT`                                                   | idx         |
| description    | =         | String   | N    | —               |                                                                                       |             |
| createdAt      | =         | DateTime | N    | now()           |                                                                                       |             |
| updatedAt      | =         | DateTime | N    | @updatedAt      |                                                                                       |             |

### ProjectWithdrawal (`ProjectWithdrawal`)

| Field              | DB column            | Type     | Null | Default         | Description                                         | Constraints |
| ------------------ | -------------------- | -------- | ---- | --------------- | --------------------------------------------------- | ----------- |
| id                 | =                    | Int      | N    | autoincrement() |                                                     | PK          |
| professionalId     | =                    | Int      | N    | —               | Requesting user (no FK)                             | idx         |
| amount             | =                    | Int      | N    | —               | INR; reserved in `Wallet.pendingBalance` at request |             |
| currency           | =                    | String   | N    | "INR"           |                                                     |             |
| destinationType    | =                    | String   | N    | —               | e.g. `BANK`                                         |             |
| destinationLabel   | =                    | String   | Y    | —               | Masked destination label                            |             |
| status             | =                    | String   | N    | "PENDING"       | `PENDING` → `COMPLETED` / `FAILED` (admin)          |             |
| note               | =                    | String   | Y    | —               |                                                     |             |
| createdAt          | =                    | DateTime | N    | now()           |                                                     |             |
| updatedAt          | =                    | DateTime | N    | @updatedAt      |                                                     |             |
| paymentId          | payment_id           | Int      | Y    | —               | Related payment                                     | idx         |
| providerTransferId | provider_transfer_id | String   | Y    | —               | Razorpay transfer/payout id                         |             |
| failureReason      | failure_reason       | String   | Y    | —               |                                                     |             |
| processedAt        | processed_at         | DateTime | Y    | —               |                                                     |             |

### Invoice (`invoices`)

| Field            | DB column         | Type     | Null | Default         | Description                     | Constraints |
| ---------------- | ----------------- | -------- | ---- | --------------- | ------------------------------- | ----------- |
| id               | =                 | Int      | N    | autoincrement() |                                 | PK          |
| invoiceNumber    | invoice_number    | String   | N    | —               | e.g. `INV-SEED-000123`          | UNIQUE      |
| paymentId        | payment_id        | Int      | N    | —               | One invoice per payment (no FK) | UNIQUE      |
| clientId         | client_id         | Int      | N    | —               |                                 | idx         |
| professionalId   | professional_id   | Int      | N    | —               |                                 | idx         |
| amount           | =                 | Int      | N    | —               | Gross charged (INR)             |             |
| commissionAmount | commission_amount | Int      | N    | 0               | Platform fees                   |             |
| netAmount        | net_amount        | Int      | N    | —               | Professional payout             |             |
| currency         | =                 | String   | N    | "INR"           |                                 |             |
| status           | =                 | String   | N    | "ISSUED"        |                                 |             |
| issuedAt         | issued_at         | DateTime | N    | now()           |                                 |             |
| createdAt        | created_at        | DateTime | N    | now()           |                                 |             |

PDF rendered on demand by `app/api/portal/invoices/[paymentId]/route.tsx`.

---

## D8. Disputes

### ProjectDispute (`ProjectDispute`)

| Field           | DB column | Type     | Null | Default         | Description               | Constraints |
| --------------- | --------- | -------- | ---- | --------------- | ------------------------- | ----------- |
| id              | =         | Int      | N    | autoincrement() |                           | PK          |
| trackingId      | =         | Int      | N    | —               | Disputed project          | idx         |
| reporterId      | =         | Int      | N    | —               | Raising user              |             |
| reporterRole    | =         | String   | N    | —               | `CLIENT` / `PROFESSIONAL` |             |
| clientId        | =         | Int      | N    | —               |                           | idx         |
| professionalId  | =         | Int      | N    | —               |                           | idx         |
| issueType       | =         | String   | N    | —               | Free-form issue category  |             |
| priority        | =         | String   | N    | "MEDIUM"        | `LOW`/`MEDIUM`/`HIGH`     |             |
| message         | =         | String   | N    | —               | Description               |             |
| attachmentsJson | =         | String   | Y    | "[]"            | JSON attachments          |             |
| status          | =         | String   | N    | "OPEN"          | `OPEN` / `RESOLVED`       |             |
| createdAt       | =         | DateTime | N    | now()           |                           |             |
| updatedAt       | =         | DateTime | N    | @updatedAt      |                           |             |

### ProjectDisputeMessage (`project_dispute_messages`)

| Field       | DB column    | Type     | Null | Default         | Description                      | Constraints                    |
| ----------- | ------------ | -------- | ---- | --------------- | -------------------------------- | ------------------------------ |
| id          | =            | Int      | N    | autoincrement() |                                  | PK                             |
| disputeId   | dispute_id   | Int      | N    | —               | Dispute (no FK)                  | idx (dispute_id, created_at)   |
| senderId    | sender_id    | Int      | N    | —               | Sender                           |                                |
| senderRole  | sender_role  | String   | N    | —               | `ADMIN` (admin → party messages) |                                |
| recipientId | recipient_id | Int      | N    | —               | Recipient                        | idx (recipient_id, created_at) |
| message     | =            | String   | N    | —               |                                  |                                |
| createdAt   | created_at   | DateTime | N    | now()           |                                  |                                |

---

## D9. Messaging

### SocketConversation (`SocketConversation`)

| Field          | DB column | Type     | Null | Default          | Description                      | Constraints |
| -------------- | --------- | -------- | ---- | ---------------- | -------------------------------- | ----------- |
| id             | =         | String   | N    | — (app)          | Conversation id (app-generated)  | PK          |
| userAId        | =         | Int      | N    | —                | Participant A                    | idx         |
| userBId        | =         | Int      | N    | —                | Participant B                    | idx         |
| userAName      | =         | String   | N    | —                | Denormalised display name        |             |
| userBName      | =         | String   | N    | —                |                                  |             |
| userAAvatarUrl | =         | String   | Y    | —                |                                  |             |
| userBAvatarUrl | =         | String   | Y    | —                |                                  |             |
| job            | =         | String   | N    | "Direct message" | Context label (job title)        |             |
| createdAt      | =         | DateTime | N    | now()            |                                  |             |
| updatedAt      | =         | DateTime | N    | @updatedAt       | Bumped on new message (ordering) |             |

### SocketMessage (`SocketMessage`)

| Field          | DB column | Type     | Null | Default | Description  | Constraints     |
| -------------- | --------- | -------- | ---- | ------- | ------------ | --------------- |
| id             | =         | String   | N    | — (app) | Message id   | PK              |
| conversationId | =         | String   | N    | —       |              | FK CASCADE; idx |
| senderId       | =         | Int      | N    | —       |              | idx             |
| receiverId     | =         | Int      | N    | —       |              | idx             |
| body           | =         | String   | N    | —       | Message text |                 |
| kind           | =         | String   | N    | "text"  | Message kind |                 |
| createdAt      | =         | DateTime | N    | now()   |              |                 |
| readAt         | =         | DateTime | Y    | —       | Read receipt |                 |

### SocketConversationClear (`SocketConversationClear`) — _no app usage_

| Field          | DB column | Type     | Null | Default | Description                                  | Constraints               |
| -------------- | --------- | -------- | ---- | ------- | -------------------------------------------- | ------------------------- |
| conversationId | =         | String   | N    | —       | Conversation                                 | PK part; relation Cascade |
| userId         | =         | Int      | N    | —       | User who cleared history                     | PK part                   |
| clearedAt      | =         | DateTime | N    | now()   | Messages before this are hidden for the user |                           |

### CallSession (`CallSession`) — _no app usage_

| Field          | DB column | Type     | Null | Default    | Description               | Constraints |
| -------------- | --------- | -------- | ---- | ---------- | ------------------------- | ----------- |
| conversationId | =         | String   | N    | —          | One call per conversation | PK          |
| startedBy      | =         | Int      | N    | —          | Caller                    |             |
| mode           | =         | String   | N    | —          | Audio/video (inferred)    |             |
| status         | =         | String   | N    | "PENDING"  |                           |             |
| offerSdp       | =         | String   | Y    | —          | WebRTC offer              |             |
| answerSdp      | =         | String   | Y    | —          | WebRTC answer             |             |
| createdAt      | =         | DateTime | N    | now()      |                           |             |
| updatedAt      | =         | DateTime | N    | @updatedAt |                           |             |

### MessageConversation (`MessageConversation`)

| Field          | DB column | Type     | Null | Default    | Description                              | Constraints |
| -------------- | --------- | -------- | ---- | ---------- | ---------------------------------------- | ----------- |
| id             | =         | String   | N    | cuid()     |                                          | PK          |
| clientId       | =         | Int      | N    | —          |                                          | idx         |
| professionalId | =         | Int      | N    | —          |                                          | idx         |
| contractId     | =         | String   | Y    | —          | Legacy `hire_contracts.id` reference     |             |
| jobTitle       | =         | String   | Y    | —          |                                          |             |
| createdAt      | =         | DateTime | N    | now()      |                                          |             |
| updatedAt      | =         | DateTime | N    | @updatedAt |                                          |             |
| lastMessageAt  | =         | DateTime | Y    | —          | Sort key in `portal/[resource]?messages` |             |

### Message (`Message`)

| Field          | DB column | Type     | Null | Default | Description | Constraints           |
| -------------- | --------- | -------- | ---- | ------- | ----------- | --------------------- |
| id             | =         | String   | N    | cuid()  |             | PK                    |
| conversationId | =         | String   | N    | —       |             | relation Cascade; idx |
| senderId       | =         | Int      | N    | —       |             | idx                   |
| body           | =         | String   | N    | —       |             |                       |
| createdAt      | =         | DateTime | N    | now()   |             |                       |
| readAt         | =         | DateTime | Y    | —       |             |                       |

---

## D10. Notifications

### UserNotification (`UserNotification`)

| Field       | DB column | Type     | Null | Default         | Description                                                                                                                                                                                                                                                                                               | Constraints |
| ----------- | --------- | -------- | ---- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| id          | =         | Int      | N    | autoincrement() |                                                                                                                                                                                                                                                                                                           | PK          |
| userId      | =         | Int      | N    | —               | Recipient (no FK)                                                                                                                                                                                                                                                                                         | idx         |
| type        | =         | String   | N    | —               | e.g. `NEW_PROPOSAL`, `NEW_JOB`, `NEW_ACCOUNT`, `REQUEST_ACCEPTED`, `REQUEST_DECLINED`, `REQUEST_COUNTERED`, `MILESTONE_FUNDED`, `MILESTONE_PAYOUT_APPROVED`, `DISPUTE_RAISED`, `DISPUTE_MESSAGE`, `NEW_MESSAGE`, `VERIFICATION_SUBMITTED`, `VERIFICATION_UPDATE` (`src/lib/marketplace-notifications.ts`) |             |
| title       | =         | String   | N    | —               |                                                                                                                                                                                                                                                                                                           |             |
| description | =         | String   | Y    | —               |                                                                                                                                                                                                                                                                                                           |             |
| href        | =         | String   | Y    | —               | Deep link                                                                                                                                                                                                                                                                                                 |             |
| createdAt   | =         | DateTime | N    | now()           |                                                                                                                                                                                                                                                                                                           | idx         |
| readAt      | =         | DateTime | Y    | —               |                                                                                                                                                                                                                                                                                                           |             |
| clearedAt   | =         | DateTime | Y    | —               | Hidden by user                                                                                                                                                                                                                                                                                            |             |

### UserNotificationState (`UserNotificationState`) — _no app usage_

| Field           | DB column | Type     | Null | Default | Description                                    | Constraints |
| --------------- | --------- | -------- | ---- | ------- | ---------------------------------------------- | ----------- |
| userId          | =         | Int      | N    | —       |                                                | PK part     |
| notificationKey | =         | String   | N    | —       | Key of a computed (non-persisted) notification | PK part     |
| readAt          | =         | DateTime | Y    | —       |                                                |             |
| clearedAt       | =         | DateTime | Y    | —       |                                                |             |

### BrowserSubscription (`BrowserSubscription`) — _no app usage_

| Field     | DB column | Type     | Null | Default         | Description       | Constraints |
| --------- | --------- | -------- | ---- | --------------- | ----------------- | ----------- |
| id        | =         | Int      | N    | autoincrement() |                   | PK          |
| userId    | =         | Int      | N    | —               |                   | idx         |
| endpoint  | =         | String   | N    | —               | Web Push endpoint | UNIQUE      |
| p256dh    | =         | String   | N    | —               | Push public key   |             |
| auth      | =         | String   | N    | —               | Push auth secret  |             |
| createdAt | =         | DateTime | N    | now()           |                   |             |

---

## D11. Verification / KYC

### ProfessionalVerification (`ProfessionalVerification`)

| Field              | DB column | Type     | Null | Default    | Description                       | Constraints                     |
| ------------------ | --------- | -------- | ---- | ---------- | --------------------------------- | ------------------------------- |
| userId             | =         | Int      | N    | —          | Professional (PK = user id)       | PK; relation Cascade (no DB FK) |
| governmentIdUrl    | =         | String   | Y    | —          | Uploaded ID document              |                                 |
| licenseUrl         | =         | String   | Y    | —          | Licence document                  |                                 |
| certificationsJson | =         | String   | Y    | —          | JSON certifications               |                                 |
| insuranceUrl       | =         | String   | Y    | —          | Insurance document                |                                 |
| selfieUrl          | =         | String   | Y    | —          | Selfie                            |                                 |
| status             | =         | String   | N    | "PENDING"  | `PENDING`, `APPROVED`, `REJECTED` |                                 |
| updatedAt          | =         | DateTime | N    | @updatedAt |                                   |                                 |

### VerificationDocumentReview (`verification_document_reviews`)

| Field       | DB column | Type     | Null | Default         | Description                                                                                                                                | Constraints                      |
| ----------- | --------- | -------- | ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| id          | =         | Int      | N    | autoincrement() |                                                                                                                                            | PK                               |
| userId      | =         | Int      | N    | —               | Professional                                                                                                                               | UNIQUE(userId, documentKey); idx |
| documentKey | =         | String   | N    | —               | Name of the `ProfessionalVerification` column reviewed: `governmentIdUrl`, `licenseUrl`, `certificationsJson`, `insuranceUrl`, `selfieUrl` |                                  |
| status      | =         | String   | N    | "PENDING"       | `APPROVED` / `REJECTED` per document                                                                                                       |                                  |
| reviewedAt  | =         | DateTime | Y    | —               |                                                                                                                                            |                                  |
| createdAt   | =         | DateTime | N    | now()           |                                                                                                                                            |                                  |
| updatedAt   | =         | DateTime | N    | @updatedAt      |                                                                                                                                            |                                  |

### PersonaVerification (`persona_verifications`)

| Field               | DB column              | Type     | Null | Default         | Description                               | Constraints     |
| ------------------- | ---------------------- | -------- | ---- | --------------- | ----------------------------------------- | --------------- |
| id                  | =                      | Int      | N    | autoincrement() |                                           | PK              |
| userId              | user_id                | Int      | N    | —               | Verified user                             | FK CASCADE; idx |
| provider            | =                      | String   | N    | "persona"       |                                           |                 |
| providerInquiryId   | provider_inquiry_id    | String   | N    | —               | Persona inquiry id                        | UNIQUE          |
| providerStatus      | provider_status        | String   | N    | —               | Persona-reported status (provider values) | idx             |
| lastProviderEventAt | last_provider_event_at | DateTime | Y    | —               | Out-of-order webhook guard                |                 |
| adminStatus         | admin_status           | String   | N    | "PENDING"       | `PENDING`, `APPROVED`, `REJECTED`         | idx             |
| submittedAt         | submitted_at           | DateTime | Y    | —               |                                           |                 |
| reviewedAt          | reviewed_at            | DateTime | Y    | —               |                                           |                 |
| reviewedBy          | reviewed_by            | Int      | Y    | —               | Admin user id (no FK)                     |                 |
| createdAt           | created_at             | DateTime | N    | now()           |                                           |                 |
| updatedAt           | updated_at             | DateTime | N    | @updatedAt      |                                           |                 |

### PersonaWebhookEvent (`persona_webhook_events`)

| Field           | DB column         | Type     | Null | Default         | Description                   | Constraints |
| --------------- | ----------------- | -------- | ---- | --------------- | ----------------------------- | ----------- |
| id              | =                 | Int      | N    | autoincrement() |                               | PK          |
| provider        | =                 | String   | N    | "persona"       |                               |             |
| providerEventId | provider_event_id | String   | N    | —               | Dedupe key for webhook replay | UNIQUE      |
| eventName       | event_name        | String   | N    | —               |                               |             |
| createdAt       | created_at        | DateTime | N    | now()           |                               |             |

---

## D12. CMS, website content & support

### CmsPage (`cms_pages`) — _no app usage_

| Field           | DB column | Type          | Null | Default                          | Description           | Constraints |
| --------------- | --------- | ------------- | ---- | -------------------------------- | --------------------- | ----------- |
| id              | =         | Int           | N    | autoincrement()                  |                       | PK          |
| title           | =         | String        | N    | —                                |                       |             |
| slug            | =         | String        | N    | —                                |                       | UNIQUE      |
| content         | =         | String        | N    | ""                               | HTML/body             |             |
| metaTitle       | =         | String        | N    | ""                               | SEO                   |             |
| metaDescription | =         | String        | N    | ""                               | SEO                   |             |
| status          | =         | CmsPageStatus | N    | DRAFT                            |                       | enum        |
| pageKey         | =         | String        | N    | ""                               |                       |             |
| sections        | =         | String        | N    | "{}"                             | JSON sections as text |             |
| keywords        | =         | String        | N    | ""                               |                       |             |
| ogTitle         | =         | String        | N    | ""                               |                       |             |
| ogDescription   | =         | String        | N    | ""                               |                       |             |
| ogImage         | =         | String        | N    | ""                               |                       |             |
| canonicalUrl    | =         | String        | N    | ""                               |                       |             |
| createdAt       | =         | DateTime      | N    | — (DB default CURRENT_TIMESTAMP) |                       |             |
| updatedAt       | =         | DateTime      | N    | — (not @updatedAt)               |                       |             |

### CmsPageVersion (`cms_page_versions`) — _no app usage_

| Field     | DB column  | Type     | Null | Default         | Description            | Constraints                 |
| --------- | ---------- | -------- | ---- | --------------- | ---------------------- | --------------------------- |
| id        | =          | Int      | N    | autoincrement() |                        | PK                          |
| pageId    | page_id    | Int      | N    | —               | `cms_pages.id` (no FK) | UNIQUE(page_id, version_no) |
| versionNo | version_no | Int      | N    | —               |                        |                             |
| content   | =          | String   | N    | —               | Snapshot               |                             |
| createdBy | created_by | Int      | Y    | —               | Author user id         |                             |
| createdAt | created_at | DateTime | N    | —               |                        |                             |

### CmsMedia (`cms_media`) — _no app usage_

| Field     | DB column | Type     | Null | Default         | Description | Constraints |
| --------- | --------- | -------- | ---- | --------------- | ----------- | ----------- |
| id        | =         | Int      | N    | autoincrement() |             | PK          |
| name      | =         | String   | N    | —               |             |             |
| mimeType  | =         | String   | N    | —               |             |             |
| url       | =         | String   | N    | —               |             |             |
| createdBy | =         | Int      | Y    | —               |             |             |
| createdAt | =         | DateTime | N    | —               |             |             |

### WebsitePage (`WebsitePage`) — _no app usage_

| Field     | DB column | Type          | Null | Default | Description     | Constraints |
| --------- | --------- | ------------- | ---- | ------- | --------------- | ----------- |
| pageKey   | pageKey   | String        | N    | —       | Page identifier | PK          |
| path      | =         | String        | N    | —       | Route path      | UNIQUE      |
| title     | =         | String        | N    | —       |                 |             |
| content   | =         | String        | N    | ""      |                 |             |
| status    | =         | CmsPageStatus | N    | DRAFT   |                 | enum        |
| updatedAt | =         | DateTime      | N    | —       |                 |             |
| css       | =         | String        | N    | ""      | Page CSS        |             |

### LegalPage (`LegalPage`) — _no app usage_

| Field     | DB column | Type          | Null | Default   | Description         | Constraints |
| --------- | --------- | ------------- | ---- | --------- | ------------------- | ----------- |
| slug      | slug      | String        | N    | —         | e.g. terms, privacy | PK          |
| title     | =         | String        | N    | —         |                     |             |
| content   | =         | String        | N    | ""        |                     |             |
| status    | =         | CmsPageStatus | N    | PUBLISHED |                     | enum        |
| updatedAt | =         | DateTime      | N    | —         |                     |             |

### PageConfiguration (`page_configurations`) — _no app usage_

| Field           | DB column | Type     | Null | Default         | Description           | Constraints |
| --------------- | --------- | -------- | ---- | --------------- | --------------------- | ----------- |
| id              | =         | Int      | N    | autoincrement() |                       | PK          |
| pageId          | =         | String   | N    | —               | Page key              | idx         |
| config          | =         | String   | N    | —               | Draft config JSON     |             |
| publishedConfig | =         | String   | Y    | —               | Published config JSON |             |
| status          | =         | String   | N    | "DRAFT"         |                       |             |
| createdAt       | =         | DateTime | N    | now()           |                       |             |
| updatedAt       | =         | DateTime | N    | @updatedAt      |                       |             |
| publishedAt     | =         | DateTime | Y    | —               |                       |             |

### WebsitePageOverride (`website_page_overrides`) — _no app usage_

| Field     | DB column | Type     | Null | Default         | Description                        | Constraints |
| --------- | --------- | -------- | ---- | --------------- | ---------------------------------- | ----------- |
| id        | =         | Int      | N    | autoincrement() |                                    | PK          |
| title     | =         | String   | N    | —               |                                    |             |
| path      | =         | String   | N    | —               | Route path overridden (not unique) |             |
| html      | =         | String   | Y    | —               |                                    |             |
| css       | =         | String   | Y    | —               |                                    |             |
| status    | =         | String   | N    | "DRAFT"         |                                    |             |
| createdAt | =         | DateTime | N    | now()           |                                    |             |
| updatedAt | =         | DateTime | N    | @updatedAt      |                                    |             |

### PageTextOverride (`page_text_overrides`) — _no app usage_

| Field      | DB column | Type     | Null | Default | Description          | Constraints |
| ---------- | --------- | -------- | ---- | ------- | -------------------- | ----------- |
| pagePath   | =         | String   | N    | —       | Route path           | PK part     |
| elementKey | =         | String   | N    | —       | Editable element key | PK part     |
| text       | =         | String   | N    | —       | Replacement text     |             |
| updatedAt  | =         | DateTime | N    | —       |                      |             |

### Faq (`Faq`)

| Field        | DB column | Type     | Null | Default         | Description                                             | Constraints |
| ------------ | --------- | -------- | ---- | --------------- | ------------------------------------------------------- | ----------- |
| id           | =         | Int      | N    | autoincrement() |                                                         | PK          |
| question     | =         | String   | N    | —               |                                                         |             |
| answer       | =         | String   | N    | —               |                                                         |             |
| displayOrder | =         | Int      | N    | 0               | Sort order (`src/lib/queries/faq.ts`, admin data route) |             |
| status       | =         | String   | N    | "PUBLISHED"     | Publication state                                       |             |
| category     | =         | String   | Y    | —               | Grouping                                                |             |
| createdAt    | =         | DateTime | N    | now()           |                                                         |             |
| updatedAt    | =         | DateTime | N    | @updatedAt      |                                                         |             |

Managed by `app/api/admin/support/route.ts` (create/update/hard delete).

### ContactRequest (`ContactRequest`)

| Field     | DB column | Type     | Null | Default         | Description                               | Constraints |
| --------- | --------- | -------- | ---- | --------------- | ----------------------------------------- | ----------- |
| id        | =         | Int      | N    | autoincrement() |                                           | PK          |
| name      | =         | String   | N    | —               | Sender name                               |             |
| email     | =         | String   | N    | —               | Sender email                              |             |
| subject   | =         | String   | N    | —               |                                           |             |
| message   | =         | String   | N    | —               |                                           |             |
| status    | =         | String   | N    | "OPEN"          | Handling state (no update endpoint found) |             |
| createdAt | =         | DateTime | N    | now()           |                                           |             |
| updatedAt | =         | DateTime | N    | @updatedAt      |                                           |             |

Created by public `POST /api/contact` (`app/api/contact/route.ts:15`); listed in admin data route.

---

## D13. Audit

### AuditLog (`audit_logs`)

| Field      | DB column | Type     | Null | Default         | Description                      | Constraints                           |
| ---------- | --------- | -------- | ---- | --------------- | -------------------------------- | ------------------------------------- |
| id         | =         | Int      | N    | autoincrement() |                                  | PK                                    |
| actorId    | =         | Int      | Y    | —               | Acting user (null = system)      | FK SET NULL                           |
| action     | =         | String   | N    | —               | Action verb/code                 | idx (action, createdAt)               |
| entityType | =         | String   | N    | —               | Affected entity type             | idx (entityType, entityId, createdAt) |
| entityId   | =         | String   | N    | —               | Affected entity id (stringified) |                                       |
| requestId  | =         | String   | Y    | —               | `x-request-id` correlation       |                                       |
| metadata   | =         | Json     | Y    | —               | Structured context (JSONB)       |                                       |
| createdAt  | =         | DateTime | N    | now()           |                                  | idx (actorId, createdAt)              |

---

## D14. Legacy / import archive (no application writes)

### HireJob (`hire_jobs`)

| Field       | DB column   | Type     | Null | Default | Description                     | Constraints |
| ----------- | ----------- | -------- | ---- | ------- | ------------------------------- | ----------- |
| id          | =           | String   | N    | —       | Legacy id                       | PK          |
| clientId    | client_id   | String   | N    | —       | Legacy client id (string)       |             |
| title       | =           | String   | N    | —       |                                 |             |
| description | =           | String   | Y    | —       |                                 |             |
| budgetMin   | budget_min  | Int      | Y    | —       | INR (rounded by `202608200005`) |             |
| budgetMax   | budget_max  | Int      | Y    | —       |                                 |             |
| currency    | =           | String   | N    | "INR"   |                                 |             |
| jobType     | job_type    | String   | Y    | —       |                                 |             |
| city        | =           | String   | Y    | —       |                                 |             |
| jobDate     | job_date    | DateTime | Y    | —       |                                 |             |
| deadline    | =           | DateTime | Y    | —       |                                 |             |
| urgency     | =           | String   | Y    | —       |                                 |             |
| status      | =           | String   | N    | "draft" | lower-case legacy values        |             |
| createdAt   | created_at  | DateTime | N    | now()   |                                 |             |
| categoryId  | category_id | Int      | Y    | —       | ServiceCategory id (no FK)      |             |

### HireContract (`hire_contracts`)

| Field           | DB column         | Type     | Null | Default    | Description                             | Constraints                 |
| --------------- | ----------------- | -------- | ---- | ---------- | --------------------------------------- | --------------------------- |
| id              | =                 | String   | N    | —          |                                         | PK                          |
| jobId           | job_id            | String   | N    | —          | HireJob                                 | relation Cascade (no DB FK) |
| clientId        | client_id         | String   | N    | —          |                                         |                             |
| professionalId  | professional_id   | String   | N    | —          |                                         |                             |
| clientProjectId | client_project_id | Int      | Y    | —          | Link to `ClientJob.id` (inferred)       |                             |
| trackingId      | tracking_id       | Int      | Y    | —          | Link to `ProjectTracking.id` (inferred) |                             |
| totalAmount     | total_amount      | Int      | Y    | —          | INR                                     |                             |
| platformFee     | platform_fee      | Int      | Y    | —          | INR                                     |                             |
| status          | =                 | String   | N    | "pending"  |                                         |                             |
| startDate       | start_date        | DateTime | Y    | —          |                                         |                             |
| endDate         | end_date          | DateTime | Y    | —          |                                         |                             |
| updatedAt       | updated_at        | DateTime | N    | @updatedAt |                                         |                             |

### HireAttachment (`hire_job_attachments`)

| Field      | DB column   | Type   | Null | Default | Description    | Constraints                 |
| ---------- | ----------- | ------ | ---- | ------- | -------------- | --------------------------- |
| id         | =           | String | N    | —       |                | PK                          |
| jobId      | job_id      | String | N    | —       | HireJob        | relation Cascade (no DB FK) |
| fileUrl    | file_url    | String | Y    | —       |                |                             |
| fileType   | file_type   | String | Y    | —       |                |                             |
| uploadedBy | uploaded_by | String | Y    | —       | Legacy user id |                             |

### HireMilestone (`hire_milestones`)

| Field          | DB column       | Type     | Null | Default   | Description    | Constraints                 |
| -------------- | --------------- | -------- | ---- | --------- | -------------- | --------------------------- |
| id             | =               | String   | N    | —         |                | PK                          |
| contractId     | contract_id     | String   | N    | —         | HireContract   | relation Cascade (no DB FK) |
| title          | =               | String   | Y    | —         |                |                             |
| amount         | =               | Int      | Y    | —         | INR            |                             |
| dueDate        | due_date        | DateTime | Y    | —         |                |                             |
| status         | =               | String   | N    | "pending" |                |                             |
| completedProof | completed_proof | String   | Y    | —         | Proof URL/text |                             |

### DirectHireNegotiation (Prisma table `DirectHireNegotiation`; migrations created `direct_hire_negotiations`)

| Field          | DB column | Type     | Null | Default         | Description                                    | Constraints |
| -------------- | --------- | -------- | ---- | --------------- | ---------------------------------------------- | ----------- |
| id             | =         | Int      | N    | autoincrement() |                                                | PK          |
| contractId     | =         | String   | N    | —               | HireContract id                                | idx         |
| jobId          | =         | String   | N    | —               | HireJob id                                     |             |
| clientId       | =         | String   | N    | —               |                                                |             |
| professionalId | =         | String   | N    | —               |                                                | idx         |
| senderId       | =         | String   | N    | —               |                                                |             |
| senderRole     | =         | String   | N    | —               |                                                |             |
| bidAmount      | =         | Float    | Y    | —               | **Float in schema, INTEGER in migrated table** |             |
| duration       | =         | String   | Y    | —               |                                                |             |
| message        | =         | String   | N    | —               |                                                |             |
| createdAt      | =         | DateTime | N    | now()           |                                                |             |

### LegacyUser (`legacy_users`)

| Field           | DB column | Type     | Null | Default | Description                      | Constraints |
| --------------- | --------- | -------- | ---- | ------- | -------------------------------- | ----------- |
| id              | =         | String   | N    | —       | Legacy user id                   | PK          |
| role            | =         | String   | Y    | —       |                                  |             |
| email           | =         | String   | Y    | —       |                                  |             |
| phone           | =         | String   | Y    | —       |                                  |             |
| passwordHash    | =         | String   | Y    | —       | Legacy password hash (sensitive) |             |
| googleId        | =         | String   | Y    | —       |                                  |             |
| isEmailVerified | =         | Boolean  | Y    | —       |                                  |             |
| isPhoneVerified | =         | Boolean  | Y    | —       |                                  |             |
| status          | =         | String   | Y    | —       |                                  |             |
| createdAt       | =         | DateTime | Y    | —       |                                  |             |
| updatedAt       | =         | DateTime | Y    | —       |                                  |             |
| lastLogin       | =         | DateTime | Y    | —       |                                  |             |

### LegacyUserProfile (`legacy_user_profiles`)

| Field        | DB column | Type   | Null | Default | Description                                                      | Constraints |
| ------------ | --------- | ------ | ---- | ------- | ---------------------------------------------------------------- | ----------- |
| userId       | =         | String | N    | —       | Legacy user id; matched to `String(User.id)` in admin data route | PK          |
| fullName     | =         | String | Y    | —       | Used as display-name fallback                                    |             |
| companyName  | =         | String | Y    | —       |                                                                  |             |
| profilePhoto | =         | String | Y    | —       |                                                                  |             |
| address      | =         | String | Y    | —       |                                                                  |             |
| bio          | =         | String | Y    | —       |                                                                  |             |
| timezone     | =         | String | Y    | —       |                                                                  |             |
| language     | =         | String | Y    | —       |                                                                  |             |

### LegacyProfessionalDetail (`legacy_professional_details`)

| Field              | DB column | Type    | Null | Default | Description | Constraints |
| ------------------ | --------- | ------- | ---- | ------- | ----------- | ----------- |
| userId             | =         | String  | N    | —       |             | PK          |
| hourlyRate         | =         | Int     | Y    | —       | INR         |             |
| fixedRate          | =         | Int     | Y    | —       | INR         |             |
| experienceYears    | =         | Int     | Y    | —       |             |             |
| skills             | =         | String  | Y    | —       |             |             |
| serviceType        | =         | String  | Y    | —       |             |             |
| serviceRadiusKm    | =         | Int     | Y    | —       |             |             |
| availabilityStatus | =         | String  | Y    | —       |             |             |
| portfolioUrl       | =         | String  | Y    | —       |             |             |
| isVerified         | =         | Boolean | Y    | —       |             |             |

### LegacyLocation (`legacy_locations`)

| Field           | DB column | Type    | Null | Default | Description | Constraints |
| --------------- | --------- | ------- | ---- | ------- | ----------- | ----------- |
| id              | =         | String  | N    | —       |             | PK          |
| userId          | =         | String  | Y    | —       |             |             |
| lat             | =         | Float   | Y    | —       |             |             |
| lng             | =         | Float   | Y    | —       |             |             |
| city            | =         | String  | Y    | —       |             |             |
| state           | =         | String  | Y    | —       |             |             |
| country         | =         | String  | Y    | —       |             |             |
| addressApprox   | =         | String  | Y    | —       |             |             |
| serviceRadiusKm | =         | Int     | Y    | —       |             |             |
| isBaseLocation  | =         | Boolean | Y    | —       |             |             |

### LegacyVerification (`legacy_verifications`)

| Field          | DB column | Type     | Null | Default | Description | Constraints |
| -------------- | --------- | -------- | ---- | ------- | ----------- | ----------- |
| id             | =         | String   | N    | —       |             | PK          |
| professionalId | =         | String   | Y    | —       |             |             |
| documentType   | =         | String   | Y    | —       |             |             |
| documentUrl    | =         | String   | Y    | —       |             |             |
| status         | =         | String   | Y    | —       |             |             |
| reviewedBy     | =         | String   | Y    | —       |             |             |
| reviewedAt     | =         | DateTime | Y    | —       |             |             |
| notes          | =         | String   | Y    | —       |             |             |

### SQLiteMigrationTableArchive (`SQLiteMigrationTableArchive`)

| Field       | DB column | Type     | Null | Default | Description                                    | Constraints |
| ----------- | --------- | -------- | ---- | ------- | ---------------------------------------------- | ----------- |
| sourceTable | =         | String   | N    | —       | SQLite source table name                       | PK          |
| rows        | =         | Json     | N    | —       | Archived rows (JSONB) — may contain legacy PII |             |
| sourceCount | =         | Int      | N    | —       | Rows in source                                 |             |
| migratedAt  | =         | DateTime | N    | now()   |                                                |             |

### SQLiteMigrationAudit (`SQLiteMigrationAudit`)

| Field         | DB column | Type     | Null | Default | Description                              | Constraints |
| ------------- | --------- | -------- | ---- | ------- | ---------------------------------------- | ----------- |
| sourceTable   | =         | String   | N    | —       |                                          | PK          |
| sourceCount   | =         | Int      | N    | —       | Rows in source                           |             |
| archivedCount | =         | Int      | N    | —       | Rows archived (should equal sourceCount) |             |
| migratedAt    | =         | DateTime | N    | now()   |                                          |             |
