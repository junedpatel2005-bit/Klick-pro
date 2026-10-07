# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Project:** Service Marketplace Platform — Web Portal, iOS App, Android App
**Standard:** Adapted from IEEE 830 / ISO-IEC-IEEE 29148
**Traces to:** `Business_Requirements_Document.md` → `Scope_Of_Development_MASTER.md`

---

## DOCUMENT CONTROL

| Field          | Value                               |
| -------------- | ----------------------------------- |
| Document title | Software Requirements Specification |
| Version        | 0.1 — Draft                         |
| Date           | 09 August 2026                      |
| Status         | Draft — pending technical review    |
| Prepared for   | Development vendor / technical lead |

### Approvals

| Role                       | Name | Signature | Date |
| -------------------------- | ---- | --------- | ---- |
| Product Owner              |      |           |      |
| Technical Lead / Architect |      |           |      |
| QA Lead                    |      |           |      |
| Security Reviewer          |      |           |      |

### Relationship to other documents

| Document                       | Answers                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| Scope of Development (Master)  | _What features exist, and in which phase_                     |
| Business Requirements Document | _What the business needs and why_                             |
| **This document (SRS)**        | _What the system must do, precisely enough to build and test_ |

> **Convention:** Every requirement below carries an ID of the form `SRS-<MODULE>-<nn>` and a **Traces to** column referencing the BRD functional requirement ID. Requirements marked **[NEW]** are technical requirements with no BRD parent — they are necessary to make a parent requirement implementable and are listed in Appendix D for approval.

---

# 1. INTRODUCTION

## 1.1 Purpose

This document specifies the software requirements for a two-sided, location-aware service marketplace. It is written for the development vendor, architects, QA, and the product owner. It defines system behaviour, data structures, interfaces, state transitions, validation, and quality attributes in sufficient detail to design, build, test, and accept the system.

## 1.2 Product scope

The platform connects **Clients** posting jobs with **Professionals** delivering them, matched partly by geography. It comprises four applications sharing one backend:

- Public marketing website + authenticated web portal
- iOS mobile application
- Android mobile application
- Administrative back office (internal)

**Phase 1** delivers the marketplace core without on-platform money movement or messaging. **Phase 2** adds payments, wallet, in-app messaging, and the full notification set.

## 1.3 Definitions and abbreviations

| Term                  | Definition                                                               |
| --------------------- | ------------------------------------------------------------------------ |
| Client                | User account type that posts jobs                                        |
| Professional          | User account type that quotes on and delivers jobs                       |
| Job                   | A unit of work posted by a Client; the central domain entity             |
| Quote                 | A Professional's priced, timed offer against a Job                       |
| Appointment           | The act of a Client selecting one Quote, binding a Professional to a Job |
| Milestone             | A checkpoint within a Job, completed and confirmed                       |
| Work proof            | Photo or document evidence uploaded by a Professional                    |
| Verification document | Credential file uploaded by a Professional for admin review              |
| Badge                 | Trust marker derived from approved verification documents                |
| Service radius        | Distance from a Professional's base point within which they accept work  |
| Geofence match        | Determination that a Job falls within a Professional's service radius    |
| OTP                   | One-time password used for phone/email verification                      |
| FR                    | Functional requirement (BRD)                                             |
| SRS-ID                | Requirement identifier in this document                                  |

## 1.4 References

1. `Scope_Of_Development_MASTER.md` — merged feature scope with phase tags
2. `Business_Requirements_Document.md` v0.1 — business and functional requirements
3. Google Maps Platform documentation — Maps SDK, Places API, Distance Matrix API
4. OWASP Application Security Verification Standard (ASVS) — security baseline

## 1.5 Document overview

Section 2 describes the system in context. Section 3 defines architecture. Section 4 defines the data model. Section 5 defines state machines. Section 6 contains detailed functional requirements. Sections 7–11 cover interfaces, permissions, algorithms, quality attributes, and errors. Appendices contain validation tables and open technical decisions.

---

# 2. OVERALL DESCRIPTION

## 2.1 Product perspective

A new, self-contained system with no legacy predecessor. It depends on external services for mapping, OTP delivery, push notification, file storage, and — in Phase 2 — payment processing. All four client applications consume one shared REST API over HTTPS.

## 2.2 User classes and characteristics

| User class    | Technical skill | Frequency            | Primary device | Key needs                                 |
| ------------- | --------------- | -------------------- | -------------- | ----------------------------------------- |
| Visitor       | Low             | One-off              | Mixed          | Understand the offering and fees          |
| Client        | Low–medium      | Occasional (per job) | Mobile-first   | Post a job, compare quotes, track work    |
| Professional  | Low–medium      | Daily                | Mobile-first   | Find nearby jobs, quote fast, manage work |
| Administrator | Medium          | Daily                | Desktop        | Review documents, resolve disputes        |

**Design implication:** Professionals are the highest-frequency users and operate on mobile, often on-site with variable connectivity. The professional mobile experience — job feed, quote submission, work-proof upload — carries the strictest performance and offline-tolerance requirements (see SRS-NFR-14).

## 2.3 Operating environment

| Component         | Environment                                                        |
| ----------------- | ------------------------------------------------------------------ |
| Backend           | _[Stack TO BE CONFIRMED — see OTD-01]_                             |
| Database          | Relational primary store with geospatial index support             |
| Web portal        | Chrome, Safari, Edge, Firefox — current and previous major version |
| iOS app           | iOS _[version TO BE CONFIRMED]_ and above                          |
| Android app       | Android _[version TO BE CONFIRMED]_ and above                      |
| File storage      | Object storage with private-by-default access control              |
| Admin back office | Desktop web only; no mobile requirement                            |

## 2.4 Design and implementation constraints

| ID     | Constraint                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| CON-01 | Feature parity required across web, iOS, Android for all Client and Professional features                       |
| CON-02 | Residential addresses must never reach any public-facing API response (see section 6.21)                        |
| CON-03 | Phase 1 must be independently deployable and launchable without payment modules                                 |
| CON-04 | Architecture must accept Phase 2 payment and messaging modules without schema redesign                          |
| CON-05 | Verification documents constitute sensitive personal data and require encryption at rest and access logging     |
| CON-06 | Google Maps usage is metered and billed; client applications must minimise redundant API calls (see SRS-NFR-06) |

## 2.5 Assumptions and dependencies

Carried from BRD sections 11. Technical additions:

| ID    | Assumption                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------- |
| TA-01 | A single backend serves all four applications; no per-platform business logic                                    |
| TA-02 | Authentication is token-based (JWT or equivalent) with refresh tokens                                            |
| TA-03 | Geospatial queries execute in-database using a spatial index, not in application code                            |
| TA-04 | Distance shown in discovery is straight-line; travel time uses Distance Matrix API only on demand (cost control) |
| TA-05 | Push notification delivery uses a single abstraction over APNs and FCM                                           |
| TA-06 | Media files are served via time-limited signed URLs, never public buckets                                        |

---

# 3. SYSTEM ARCHITECTURE

## 3.1 Logical architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Public Web  │  │  Web Portal  │  │   iOS App    │  │ Android App  │
│  (marketing) │  │(Client/Prof) │  │(Client/Prof) │  │(Client/Prof) │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └─────────────────┴────────┬────────┴─────────────────┘
                                  │ HTTPS / REST + JSON
                        ┌─────────▼──────────┐        ┌─────────────┐
                        │   API Gateway      │◄───────┤ Admin Back  │
                        │  Auth · Rate limit │        │   Office    │
                        └─────────┬──────────┘        └─────────────┘
                                  │
   ┌──────────┬──────────┬────────┼────────┬──────────┬──────────┐
   │ Identity │  Profile │  Job & │ Quote &│ Verifi-  │ Review & │
   │ & Auth   │  Service │  Geo   │  Hiring│ cation   │ Dispute  │
   └──────────┴──────────┴────────┴────────┴──────────┴──────────┘
   ┌──────────┬─────────────────────────────┬────────────────────┐
   │Notifica- │  Payment & Wallet  (Phase 2)│ Messaging (Phase 2)│
   │  tion    │                             │                    │
   └──────────┴─────────────────────────────┴────────────────────┘
                                  │
   ┌──────────────┬───────────────┼──────────────┬────────────────┐
   │  Relational  │    Object     │    Cache     │  Search index  │
   │  DB + GIS    │   Storage     │              │   (optional)   │
   └──────────────┴───────────────┴──────────────┴────────────────┘
                                  │
   ┌──────────┬───────────┬───────┴────┬───────────┬──────────────┐
   │  Google  │  SMS/OTP  │  APNs/FCM  │   Email   │Payment GW(P2)│
   │   Maps   │  Provider │            │  Provider │              │
   └──────────┴───────────┴────────────┴───────────┴──────────────┘
```

## 3.2 Module inventory

| Module           | Phase | Responsibility                                                    |
| ---------------- | ----- | ----------------------------------------------------------------- |
| Identity & Auth  | P1    | Registration, OTP, login, tokens, password reset                  |
| Profile          | P1    | Client and Professional profile data, media                       |
| Job & Geo        | P1    | Job CRUD, geospatial indexing, radius matching, discovery         |
| Quote & Hiring   | P1    | Quote submission, revision, acceptance, appointment               |
| Verification     | P1    | Document upload, admin review workflow, badge derivation          |
| Work & Milestone | P1    | Progress updates, work proof, milestone completion                |
| Review & Dispute | P1    | Ratings, reviews, responses, issue reports, dispute cases         |
| Notification     | P1    | Event fan-out to push and email                                   |
| Admin            | P1    | Verification queue, user management, dispute resolution, taxonomy |
| Payment & Wallet | P2    | Gateway, invoices, escrow release, payouts, commission            |
| Messaging        | P2    | Client–Professional threads                                       |

---

# 4. DATA MODEL

## 4.1 Core entities

### USER

| Attribute               | Type      | Notes                               |
| ----------------------- | --------- | ----------------------------------- |
| user_id                 | UUID PK   |                                     |
| user_type               | ENUM      | CLIENT, PROFESSIONAL, ADMIN         |
| email                   | VARCHAR   | Unique where not null               |
| phone                   | VARCHAR   | E.164 format; unique where not null |
| password_hash           | VARCHAR   | Null when social-auth only          |
| email_verified          | BOOLEAN   |                                     |
| phone_verified          | BOOLEAN   |                                     |
| auth_provider           | ENUM      | LOCAL, GOOGLE                       |
| account_status          | ENUM      | PENDING, ACTIVE, SUSPENDED, DELETED |
| created_at / updated_at | TIMESTAMP |                                     |

### CLIENT_PROFILE

| Attribute            | Type               | Notes                                  |
| -------------------- | ------------------ | -------------------------------------- |
| client_id            | UUID PK, FK → USER |                                        |
| full_name            | VARCHAR            |                                        |
| company_name         | VARCHAR            | Nullable                               |
| profile_photo_id     | UUID FK → MEDIA    | Nullable                               |
| address_line         | VARCHAR            | **Private — never in public response** |
| city                 | VARCHAR            |                                        |
| latitude / longitude | DECIMAL(10,7)      |                                        |

### SAVED_LOCATION

| Attribute                    | Type    | Notes            |
| ---------------------------- | ------- | ---------------- |
| location_id                  | UUID PK |                  |
| client_id                    | UUID FK |                  |
| label                        | VARCHAR | e.g. "Warehouse" |
| address_line, city, lat, lng |         |                  |

### PROFESSIONAL_PROFILE

| Attribute                      | Type               | Notes                                      |
| ------------------------------ | ------------------ | ------------------------------------------ |
| professional_id                | UUID PK, FK → USER |                                            |
| full_name                      | VARCHAR            |                                            |
| profile_picture_id             | UUID FK → MEDIA    |                                            |
| experience_years               | INTEGER            |                                            |
| experience_summary             | TEXT               |                                            |
| hourly_rate                    | DECIMAL            | Nullable                                   |
| fixed_rate                     | DECIMAL            | Nullable                                   |
| rate_currency                  | CHAR(3)            |                                            |
| base_latitude / base_longitude | DECIMAL(10,7)      | **Exact point — never in public response** |
| base_address_line              | VARCHAR            | **Private**                                |
| display_area                   | VARCHAR            | Public — e.g. "Surat"                      |
| service_radius_km              | INTEGER            |                                            |
| work_mode                      | ENUM               | ONSITE, REMOTE, BOTH                       |
| availability_status            | ENUM               | AVAILABLE, BUSY, UNAVAILABLE               |
| trade_licence_number           | VARCHAR            | Nullable                                   |
| avg_rating                     | DECIMAL(2,1)       | Derived                                    |
| review_count                   | INTEGER            | Derived                                    |
| badge_flags                    | BITMASK / JSON     | Derived — see section 9.3                  |

Supporting tables: `PROFESSIONAL_SKILL`, `PROFESSIONAL_CATEGORY`, `PORTFOLIO_ITEM`, `CERTIFICATION`, `AVAILABILITY_SLOT`.

### CATEGORY

| Attribute     | Type    | Notes                                 |
| ------------- | ------- | ------------------------------------- |
| category_id   | UUID PK |                                       |
| parent_id     | UUID FK | Self-referencing — supports hierarchy |
| name, slug    | VARCHAR |                                       |
| is_active     | BOOLEAN |                                       |
| display_order | INTEGER |                                       |

> Taxonomy content is pending (OI-01). The **structure** above is required now so the schema is not blocked; only rows are outstanding. Hierarchy support is specified deliberately — trade taxonomies are almost always two-level.

### JOB

| Attribute                             | Type             | Notes                                          |
| ------------------------------------- | ---------------- | ---------------------------------------------- |
| job_id                                | UUID PK          |                                                |
| client_id                             | UUID FK          |                                                |
| category_id                           | UUID FK          |                                                |
| title                                 | VARCHAR(120)     |                                                |
| description                           | TEXT             |                                                |
| budget_amount                         | DECIMAL          |                                                |
| budget_type                           | ENUM             | FIXED, HOURLY, NEGOTIABLE                      |
| urgency                               | ENUM             | LOW, NORMAL, HIGH, EMERGENCY                   |
| job_date                              | DATE             |                                                |
| deadline                              | DATE             |                                                |
| work_mode                             | ENUM             | ONSITE, REMOTE, BOTH                           |
| latitude / longitude                  | DECIMAL(10,7)    | Exact — visible only to appointed professional |
| display_area                          | VARCHAR          | Public approximation                           |
| location_point                        | GEOGRAPHY(POINT) | Spatially indexed                              |
| status                                | ENUM             | See section 5.1                                |
| appointed_professional_id             | UUID FK          | Nullable                                       |
| created_at / published_at / closed_at | TIMESTAMP        |                                                |

### QUOTE

| Attribute                | Type      | Notes                                  |
| ------------------------ | --------- | -------------------------------------- |
| quote_id                 | UUID PK   |                                        |
| job_id / professional_id | UUID FK   | Unique together where status is active |
| amount                   | DECIMAL   |                                        |
| currency                 | CHAR(3)   |                                        |
| proposed_start_date      | DATE      |                                        |
| proposed_duration_days   | INTEGER   |                                        |
| cover_message            | TEXT      |                                        |
| version                  | INTEGER   | Increments on revision                 |
| status                   | ENUM      | See section 5.2                        |
| submitted_at             | TIMESTAMP |                                        |

### MILESTONE

| Attribute                   | Type           | Notes           |
| --------------------------- | -------------- | --------------- |
| milestone_id                | UUID PK        |                 |
| job_id                      | UUID FK        |                 |
| sequence                    | INTEGER        |                 |
| title / description         | VARCHAR / TEXT |                 |
| status                      | ENUM           | See section 5.4 |
| completed_at / confirmed_at | TIMESTAMP      |                 |

### WORK_PROOF

| Attribute             | Type            | Notes |
| --------------------- | --------------- | ----- |
| proof_id              | UUID PK         |       |
| job_id / milestone_id | UUID FK         |       |
| media_id              | UUID FK → MEDIA |       |
| caption               | VARCHAR         |       |
| uploaded_at           | TIMESTAMP       |       |

### VERIFICATION_DOCUMENT

| Attribute        | Type            | Notes                                                                              |
| ---------------- | --------------- | ---------------------------------------------------------------------------------- |
| document_id      | UUID PK         |                                                                                    |
| professional_id  | UUID FK         |                                                                                    |
| document_type    | ENUM            | GOV_ID, SELFIE, TRADE_CERT, WORK_LICENCE, BACKGROUND_CHECK, SAFETY_CERT, INSURANCE |
| media_id         | UUID FK → MEDIA | Encrypted at rest                                                                  |
| status           | ENUM            | See section 5.3                                                                    |
| rejection_reason | TEXT            |                                                                                    |
| reviewed_by      | UUID FK → USER  |                                                                                    |
| reviewed_at      | TIMESTAMP       |                                                                                    |
| expires_at       | DATE            | Nullable — licences and insurance expire                                           |

### REVIEW

| Attribute              | Type        | Notes                        |
| ---------------------- | ----------- | ---------------------------- |
| review_id              | UUID PK     |                              |
| job_id                 | UUID FK     | One review per party per job |
| author_id / subject_id | UUID FK     |                              |
| direction              | ENUM        | CLIENT_TO_PRO, PRO_TO_CLIENT |
| rating                 | INTEGER 1–5 |                              |
| comment                | TEXT        |                              |
| response_text          | TEXT        | Nullable                     |
| status                 | ENUM        | PUBLISHED, HIDDEN            |

### DISPUTE

| Attribute          | Type    | Notes                                |
| ------------------ | ------- | ------------------------------------ |
| dispute_id         | UUID PK |                                      |
| job_id / raised_by | UUID FK |                                      |
| type               | ENUM    | ISSUE_REPORT, DISPUTE                |
| description        | TEXT    |                                      |
| status             | ENUM    | OPEN, UNDER_REVIEW, RESOLVED, CLOSED |
| resolution_note    | TEXT    |                                      |
| assigned_admin_id  | UUID FK |                                      |

### NOTIFICATION

| Attribute       | Type      | Notes                         |
| --------------- | --------- | ----------------------------- |
| notification_id | UUID PK   |                               |
| user_id         | UUID FK   |                               |
| event_type      | ENUM      | See section 6.19              |
| payload         | JSON      | Deep-link target              |
| read_at         | TIMESTAMP | Nullable                      |
| channels_sent   | JSON      | push / email delivery outcome |

### MEDIA

| Attribute             | Type    | Notes                       |
| --------------------- | ------- | --------------------------- |
| media_id              | UUID PK |                             |
| owner_id              | UUID FK |                             |
| storage_key           | VARCHAR |                             |
| mime_type, size_bytes |         |                             |
| visibility            | ENUM    | PUBLIC, PRIVATE, RESTRICTED |
| virus_scan_status     | ENUM    | PENDING, CLEAN, INFECTED    |

Phase 2 entities — `PAYMENT`, `INVOICE`, `PAYOUT`, `WALLET_TRANSACTION`, `COMMISSION_RULE`, `MESSAGE_THREAD`, `MESSAGE` — are not specified in this version but must be accommodated by the schema per CON-04.

## 4.2 Key relationships

- USER **1:1** CLIENT_PROFILE _or_ PROFESSIONAL_PROFILE (by user_type)
- CLIENT **1:N** JOB
- JOB **1:N** QUOTE · **1:N** MILESTONE · **1:N** WORK_PROOF · **0:1** DISPUTE
- JOB **N:1** appointed PROFESSIONAL (nullable until appointment)
- PROFESSIONAL **1:N** VERIFICATION_DOCUMENT · **N:M** CATEGORY · **N:M** SKILL
- JOB **1:2** REVIEW (one per direction, maximum)

## 4.3 Required indexes

| Index                                                          | Purpose                                 |
| -------------------------------------------------------------- | --------------------------------------- |
| Spatial index on `JOB.location_point`                          | Radius search for professional job feed |
| Spatial index on `PROFESSIONAL_PROFILE` base point             | Nearby-professional search              |
| Composite `(status, category_id, urgency)` on JOB              | Filtered discovery                      |
| Composite `(job_id, status)` on QUOTE                          | Quote listing per job                   |
| Composite `(professional_id, status)` on VERIFICATION_DOCUMENT | Badge derivation, admin queue           |
| `(user_id, read_at)` on NOTIFICATION                           | Unread badge count                      |

---

# 5. STATE MACHINES

## 5.1 Job lifecycle

| From                  | Event                | To                    | Actor        |
| --------------------- | -------------------- | --------------------- | ------------ |
| —                     | Create               | DRAFT                 | Client       |
| DRAFT                 | Publish              | PUBLISHED             | Client       |
| DRAFT                 | Delete               | DELETED               | Client       |
| PUBLISHED             | First quote received | QUOTED                | System       |
| PUBLISHED / QUOTED    | Appoint professional | ASSIGNED              | Client       |
| PUBLISHED / QUOTED    | Cancel               | CANCELLED             | Client       |
| ASSIGNED              | Professional accepts | IN_PROGRESS           | Professional |
| ASSIGNED              | Professional rejects | PUBLISHED             | Professional |
| IN_PROGRESS           | Mark complete        | AWAITING_CONFIRMATION | Professional |
| AWAITING_CONFIRMATION | Request revision     | IN_PROGRESS           | Client       |
| AWAITING_CONFIRMATION | Confirm completion   | COMPLETED             | Client       |
| COMPLETED             | Review window closes | CLOSED                | System       |
| Any active state      | Dispute raised       | DISPUTED              | Either party |
| DISPUTED              | Admin resolves       | Prior state or CLOSED | Admin        |

**SRS-JOB-ST-01 [NEW]** — On transition to ASSIGNED, all other quotes on that job shall automatically transition to NOT_SELECTED, and the job shall stop accepting new quotes. _Implements BRL-03._

**SRS-JOB-ST-02 [NEW]** — Reversion from ASSIGNED to PUBLISHED on professional rejection shall restore prior quotes to SUBMITTED status, so the client is not forced to re-source the job.

> The source scope did not define what happens when an appointed professional rejects the job. This is a real path — SRS-JOB-ST-02 defines it. Confirm at review.

## 5.2 Quote lifecycle

| From      | Event                    | To                                              |
| --------- | ------------------------ | ----------------------------------------------- |
| —         | Submit                   | SUBMITTED                                       |
| SUBMITTED | Professional revises     | SUPERSEDED (new quote v+1 created as SUBMITTED) |
| SUBMITTED | Client rejects           | REJECTED                                        |
| SUBMITTED | Client accepts           | ACCEPTED                                        |
| SUBMITTED | Another quote accepted   | NOT_SELECTED                                    |
| SUBMITTED | Professional withdraws   | WITHDRAWN                                       |
| SUBMITTED | Job cancelled or expired | EXPIRED                                         |

## 5.3 Verification document lifecycle

| From      | Event                  | To        | Actor        |
| --------- | ---------------------- | --------- | ------------ |
| —         | Upload                 | PENDING   | Professional |
| PENDING   | Admin opens for review | REVIEWING | Admin        |
| REVIEWING | Approve                | APPROVED  | Admin        |
| REVIEWING | Reject with reason     | REJECTED  | Admin        |
| REJECTED  | Re-upload              | PENDING   | Professional |
| APPROVED  | Expiry date reached    | EXPIRED   | System       |

**SRS-VER-ST-01 [NEW]** — On transition to APPROVED or EXPIRED, the system shall recompute the professional's badge set within 60 seconds.

**SRS-VER-ST-02 [NEW]** — Licence, insurance, and background-check documents shall carry an expiry date; on expiry the associated badge shall be revoked and the professional notified 30 days in advance.

> Neither source document addressed document expiry. A trade licence that expired last year should not display a permanent "Skill Verified" badge — this materially affects platform trust. Confirm at review.

## 5.4 Milestone lifecycle

PENDING → IN_PROGRESS → SUBMITTED (professional) → CONFIRMED (client) _or_ → REVISION_REQUESTED → IN_PROGRESS

## 5.5 Dispute lifecycle

OPEN → UNDER_REVIEW → RESOLVED → CLOSED

---

# 6. DETAILED FUNCTIONAL REQUIREMENTS

Detail is proportional to complexity. Simple CRUD requirements are specified tabularly; complex flows carry full input–processing–output–error specification.

## 6.1 Public website — SRS-WEB

| SRS-ID               | Requirement                                                                                                                                                                                                    | Traces to |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SRS-WEB-01           | The system shall serve 11 static public pages: Home, About Us, How It Works, Services/Categories, For Clients, For Professionals, Pricing/Fees/Commission, FAQ, Contact Us, Privacy Policy, Terms & Conditions | WEB-01…11 |
| SRS-WEB-02           | Public pages shall render responsively at breakpoints ≤576px, 577–992px, >992px                                                                                                                                | WEB-12    |
| SRS-WEB-03           | The Services/Categories page shall render dynamically from active CATEGORY records, not hard-coded markup                                                                                                      | WEB-04    |
| SRS-WEB-04           | The Contact Us form shall capture name, email, phone, subject, message; validate per Appendix A; and persist an ENQUIRY record                                                                                 | WEB-09    |
| SRS-WEB-05 **[NEW]** | Public pages shall emit server-rendered HTML with title, meta description, and Open Graph tags for search indexing                                                                                             | —         |
| SRS-WEB-06 **[NEW]** | The Contact form shall be protected against automated submission (CAPTCHA or equivalent) and rate-limited to 5 submissions per IP per hour                                                                     | —         |

## 6.2 Registration and authentication — SRS-AUT

**SRS-AUT-01** — Email registration _(traces CRA-01, PRA-03)_

- **Inputs:** email, password, user_type, accept_terms flag
- **Validation:** email RFC 5322 and unique among non-deleted users; password per Appendix A; accept_terms must be true
- **Processing:** create USER with `account_status = PENDING`; hash password with bcrypt/argon2; generate 6-digit OTP with 10-minute expiry; dispatch by email
- **Output:** 201 with user_id and `otp_required = true`; no auth token issued
- **Errors:** 409 email already registered · 422 validation failure · 429 rate limited

**SRS-AUT-02** — Phone registration _(traces CRA-02, PRA-02)_

- **Inputs:** phone in E.164, password, user_type, accept_terms
- **Processing:** as above; OTP dispatched via SMS provider
- **Errors:** 409 phone already registered · 422 malformed number · 503 SMS provider unavailable

**SRS-AUT-03** — OTP verification _(traces CRA-04)_

- **Inputs:** user_id, otp_code
- **Validation:** code matches, unexpired, attempt count < 5
- **Processing:** on success set `email_verified` or `phone_verified` true; if either is true set `account_status = ACTIVE`; issue access + refresh token; invalidate OTP
- **Errors:** 400 incorrect code (increment attempts) · 410 expired · 423 locked after 5 failures, 30-minute cooldown

**SRS-AUT-04 [NEW]** — OTP resend shall be permitted no more than 3 times per hour per user, with a minimum 60-second interval between requests.

**SRS-AUT-05** — Google authentication _(traces CRA-03)_ — The system shall support OAuth 2.0 sign-in with Google. Where the returned email matches an existing local account, the system shall link rather than duplicate, after password confirmation.

**SRS-AUT-06** — Login _(traces CRA-01, PRA-01)_ — Credentials plus password return an access token (expiry _[TBC — OTD-04]_) and refresh token. Accounts in PENDING status shall be redirected to OTP verification; SUSPENDED accounts shall receive 403 with a support reference.

**SRS-AUT-07** — Password reset _(traces CRA-05, PRA-04)_ — A single-use, 30-minute token shall be dispatched to a verified channel. The response shall be identical whether or not the account exists, to prevent account enumeration. All active sessions shall be invalidated on successful reset.

**SRS-AUT-08 [NEW]** — Failed login attempts shall be rate-limited to 10 per account per 15 minutes and 20 per IP per 15 minutes.

**SRS-AUT-09** — Post-registration the system shall route the user into profile setup and shall restrict job posting (Client) and quoting (Professional) until mandatory profile fields are complete _(traces CRA-06, PRA-05)_.

## 6.3 Client profile — SRS-CPR

| SRS-ID               | Requirement                                                                                                                | Traces to |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------- |
| SRS-CPR-01           | The system shall persist client full_name, optional company_name, address, and profile photo                               | CPR-01…04 |
| SRS-CPR-02           | On address entry the system shall geocode to latitude/longitude via Places API and store both the text and the coordinates | CPR-03    |
| SRS-CPR-03           | A client shall be able to store multiple labelled saved locations and select one when posting a job                        | CPR-05    |
| SRS-CPR-04           | Profile photo upload shall accept JPEG/PNG/WebP ≤5MB, and shall generate 64px, 128px, and 512px derivatives                | CPR-04    |
| SRS-CPR-05 **[NEW]** | Client address shall be classified PRIVATE and excluded from every API response consumed by a non-appointed party          | CON-02    |

## 6.4 Job posting — SRS-JOB

**SRS-JOB-01** — Create job _(traces JOB-01…12)_

- **Mandatory inputs:** category_id, title, description, budget_amount, budget_type, urgency, job_date, work_mode, location (lat/lng)
- **Optional inputs:** deadline, media attachments (≤10 files, ≤10MB each), saved_location_id
- **Validation:**
  - title 5–120 characters; description 20–5000 characters
  - budget_amount > 0 and within configured platform bounds
  - job_date ≥ today; deadline ≥ job_date where supplied
  - location mandatory when work_mode is ONSITE or BOTH; optional when REMOTE
  - category_id must reference an active leaf category
- **Processing:** persist JOB in DRAFT; compute `location_point`; derive `display_area` from reverse geocode (city/locality only)
- **Errors:** 422 field validation · 413 attachment too large · 415 unsupported media type

**SRS-JOB-02** — Publish job — Transitions DRAFT → PUBLISHED, sets `published_at`, and triggers the nearby-job notification fan-out (SRS-NOT-02).

**SRS-JOB-03 [NEW]** — A client shall be able to edit a job while in DRAFT or PUBLISHED with no quotes. Once quotes exist, budget, category, and location shall be locked; editing other fields shall notify all quoting professionals.

> Editability after quoting was not addressed in the source scope. Allowing a client to silently change the budget after receiving quotes is an obvious dispute source. Confirm at review.

**SRS-JOB-04 [NEW]** — Uploaded job media shall be virus-scanned before becoming retrievable; files failing the scan shall be quarantined and the uploader notified.

**SRS-JOB-05 [NEW]** — A published job with no appointment by `deadline + 7 days` shall auto-transition to EXPIRED and be removed from discovery.

## 6.5 Professional discovery (client-facing) — SRS-CDS

**SRS-CDS-01** — Search _(traces CDS-01)_ — Free-text search across professional name, skills, and category names, returning paginated results (default 20 per page).

**SRS-CDS-02** — Filters _(traces CDS-02…07)_ — The system shall support combinable filters: category (multi-select), city, distance from a reference point, minimum rating, verification badge, availability status. All filters shall be applicable simultaneously.

**SRS-CDS-03** — Map view _(traces CDS-08)_ — Matching professionals shall render as map markers positioned at an **obfuscated point**, not the true base location — see SRS-PRI-03.

**SRS-CDS-04 [NEW]** — Result ordering shall default to a composite of distance, rating, and verification level. The weighting shall be configurable server-side rather than compiled into clients.

**SRS-CDS-05** — Profile comparison _(traces CDS-09, Phase 2)_ — Side-by-side comparison of up to 3 selected professionals across rate, rating, experience, badges, and distance.

## 6.6 Job discovery (professional-facing) — SRS-PJD

**SRS-PJD-01** — Job feed _(traces PJD-01…08)_ — Returns PUBLISHED and QUOTED jobs matching the professional's categories, ordered by the ranking function in section 9.2, filterable by distance, city, category, budget range, urgency, and work mode.

**SRS-PJD-02 [NEW]** — The default feed shall exclude jobs outside the professional's service radius unless the professional explicitly clears the distance filter. _Implements BRL-09._

**SRS-PJD-03** — Favourites _(traces PJD-09)_ — A professional shall be able to save and unsave jobs, and view saved jobs as a filtered list.

**SRS-PJD-04 [NEW]** — Jobs already quoted on by the professional shall be visually distinguished and filterable, so the professional does not re-open dead ends.

**SRS-PJD-05 [NEW]** — The job feed shall support cursor-based pagination and return the last-updated timestamp, enabling incremental refresh on mobile without full reload.

## 6.7 Quoting — SRS-QUO

**SRS-QUO-01** — Submit quote _(traces PRO-01…04)_

- **Inputs:** job_id, amount, currency, proposed_start_date, proposed_duration_days, cover_message
- **Preconditions:** job in PUBLISHED or QUOTED; professional profile complete; no active quote by this professional on this job
- **Validation:** amount > 0; start date ≥ today; duration ≥ 1 day; cover_message 20–2000 characters
- **Processing:** persist QUOTE v1 as SUBMITTED; transition job PUBLISHED → QUOTED if first quote; notify client (CNT-01)
- **Errors:** 409 active quote exists · 403 job closed to quotes · 422 validation

**SRS-QUO-02** — Revise quote _(traces PRO-05)_ — Supersedes the prior version, increments `version`, retains full history, and notifies the client. This is the Phase 1 substitute for negotiation, pending OI-05.

**SRS-QUO-03 [NEW]** — Withdraw quote — A professional shall be able to withdraw a SUBMITTED quote before appointment.

**SRS-QUO-04 [NEW]** — Quote volume shall be rate-limited to _[TBC — OTD-06]_ per professional per day, to prevent indiscriminate bidding.

## 6.8 Hiring — SRS-HIR

**SRS-HIR-01** — View quotes _(traces HIR-01)_ — Returns all SUBMITTED quotes on a job with professional summary card: name, photo, rating, review count, badges, distance, quoted amount, proposed timeline. Sortable by amount, rating, and distance.

**SRS-HIR-02** — Accept quote _(traces HIR-05, HIR-06)_

- **Preconditions:** requester is job owner; job in PUBLISHED or QUOTED; quote in SUBMITTED
- **Processing (atomic transaction):** quote → ACCEPTED; all sibling quotes → NOT_SELECTED; job → ASSIGNED; `appointed_professional_id` set; contact details released per SRS-PRI-04; notify both parties
- **Errors:** 409 job already assigned · 403 not job owner

**SRS-HIR-03** — Reject quote _(traces HIR-05)_ — Individual rejection with optional reason; notifies the professional.

**SRS-HIR-04** — Shortlist _(traces HIR-04)_ — Non-binding marking of quotes or professionals, visible only to the client.

**SRS-HIR-05 [NEW]** — Acceptance shall be idempotent and concurrency-safe: simultaneous acceptance of two quotes on one job shall result in exactly one appointment, the second returning 409.

## 6.9 Verification — SRS-VER

**SRS-VER-01** — Document upload _(traces VER-01…07)_ — Accepts the 7 document types defined in the data model. Formats JPEG, PNG, PDF; ≤10MB. Stored encrypted at rest with `visibility = RESTRICTED`.

**SRS-VER-02** — Status display _(traces VER-08)_ — Each document shall display its current status per section 5.3, with rejection reason where applicable.

**SRS-VER-03** — Admin review _(traces VER-09)_ — An administrator shall transition documents through REVIEWING → APPROVED/REJECTED, with a mandatory reason on rejection. Every transition shall be written to an immutable audit log capturing admin identity, timestamp, and prior state.

**SRS-VER-04** — Badge derivation _(traces VER-10, VER-11)_ — Badges shall be derived, never manually set, per the rules in section 9.3.

**SRS-VER-05** — Optionality _(traces VER-12)_ — An unverified professional shall retain full ability to quote and work; verification affects badge display and discovery ranking only.

**SRS-VER-06 [NEW]** — Verification document media shall be retrievable only by the owning professional and administrators, via signed URLs expiring within 15 minutes. Under no circumstance shall a verification document be exposed to a client.

## 6.10 Work management and milestones — SRS-WRK

| SRS-ID               | Requirement                                                                                                                                                                | Traces to |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| SRS-WRK-01           | An appointed professional shall accept or reject the appointment within _[TBC — OTD-07]_ hours; non-response shall auto-revert the job per SRS-JOB-ST-02                   | WRK-01    |
| SRS-WRK-02           | A professional shall view active jobs grouped by status with next-action indicators                                                                                        | WRK-02    |
| SRS-WRK-03           | A professional shall post progress updates with free text and optional media, appended to the job timeline                                                                 | WRK-03    |
| SRS-WRK-04           | A professional shall upload work proof (≤20 files per job, ≤10MB each), optionally linked to a milestone                                                                   | WRK-04    |
| SRS-WRK-05           | A professional shall mark a job complete, transitioning it to AWAITING_CONFIRMATION                                                                                        | WRK-05    |
| SRS-WRK-06           | A client shall request a revision with mandatory reason text, returning the job to IN_PROGRESS                                                                             | TRK-04    |
| SRS-WRK-07           | A client shall confirm milestone completion, transitioning the milestone to CONFIRMED                                                                                      | TRK-05    |
| SRS-WRK-08           | The job timeline shall record every state transition, progress update, proof upload, and revision request with actor and timestamp                                         | TRK-02    |
| SRS-WRK-09 **[NEW]** | Milestones shall be definable at appointment time by either party, with agreement recorded; where none are defined the job shall be treated as a single implicit milestone | TRK-05    |

> The source scope referenced milestones without ever specifying who creates them or when. SRS-WRK-09 closes that gap. Confirm at review.

## 6.11 Reviews and disputes — SRS-REV

| SRS-ID               | Requirement                                                                                                                                                                                      | Traces to      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| SRS-REV-01           | A client shall submit a 1–5 star rating and written review once a job reaches COMPLETED                                                                                                          | REV-01, REV-02 |
| SRS-REV-02           | Reviews shall be submittable only within _[TBC — OTD-08]_ days of completion                                                                                                                     | BRL-04         |
| SRS-REV-03           | A professional shall publish one response per review                                                                                                                                             | PRV-03         |
| SRS-REV-04           | Aggregate rating shall be recomputed on every published review per section 9.4                                                                                                                   | PRV-01         |
| SRS-REV-05           | A user shall report an issue against a job, creating a DISPUTE record of type ISSUE_REPORT                                                                                                       | REV-03         |
| SRS-REV-06           | A user shall raise a dispute, creating a DISPUTE of type DISPUTE, transitioning the job to DISPUTED and notifying administrators                                                                 | REV-04         |
| SRS-REV-07 **[NEW]** | Reviews shall be immutable after a 24-hour edit window, and removable only by an administrator with a logged reason                                                                              | —              |
| SRS-REV-08 **[NEW]** | Where the platform supports professional-to-client reviews (pending OI-13), both reviews shall remain hidden until both are submitted or the review window closes, preventing retaliatory rating | —              |

## 6.12 Notifications — SRS-NOT

**SRS-NOT-01** — The system shall implement an event-driven notification service supporting push (APNs/FCM), email, and in-app inbox channels, with per-user per-event-type channel preferences.

**SRS-NOT-02** — Nearby job notification _(traces PNT-01)_ — On job publication, the system shall identify professionals whose service radius contains the job point **and** whose categories include the job category, and dispatch notification asynchronously. Dispatch shall not block the publish response.

**SRS-NOT-03 [NEW]** — Nearby-job notifications shall be capped at _[TBC — OTD-09]_ per professional per day and shall be batchable into a digest, to prevent notification fatigue driving uninstalls.

**SRS-NOT-04** — Event coverage — The system shall emit notifications for: quote received, quote accepted, quote rejected, professional appointed, job started, work proof uploaded, revision requested, job completed, review received, review response, verification approved, verification rejected, badge expiring, dispute status change _(traces CNT-01…06, PNT-01…06)_.

**SRS-NOT-05** — Phase 2 events — payment successful, payment released, message received.

**SRS-NOT-06 [NEW]** — Every notification shall carry a deep link resolving to the relevant screen in web, iOS, and Android.

## 6.13 Maps and geolocation — SRS-MAP

| SRS-ID               | Requirement                                                                                                                                              | Traces to      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| SRS-MAP-01           | The system shall provide map-based pin placement for job location, with draggable marker and reverse-geocoded address confirmation                       | MAP-01         |
| SRS-MAP-02           | Address search shall use Places Autocomplete, debounced at 300ms, session-tokenised for billing efficiency                                               | MAP-02         |
| SRS-MAP-03           | Nearby professionals shall render as clustered markers above 50 results                                                                                  | MAP-03         |
| SRS-MAP-04           | Straight-line distance shall be computed in-database from stored coordinates; no external API call                                                       | MAP-04, MAP-07 |
| SRS-MAP-05           | Travel time shall be fetched from Distance Matrix API **on demand only**, when a user opens a specific job or professional detail — never for list views | MAP-08         |
| SRS-MAP-06           | A professional shall set base location by pin or address, and a service radius of 1–200km, rendered as a circle overlay                                  | MAP-05, MAP-06 |
| SRS-MAP-07           | Map features shall be functionally equivalent on web, iOS, and Android                                                                                   | MAP-09, MAP-10 |
| SRS-MAP-08 **[NEW]** | Geocoding results shall be cached for 30 days keyed on normalised address string, to reduce API cost                                                     | CON-06         |
| SRS-MAP-09 **[NEW]** | Where location permission is denied on mobile, the system shall degrade to manual city selection rather than blocking discovery                          | —              |

## 6.14 Location privacy — SRS-PRI

These requirements are **security-critical**. Each requires a dedicated test case.

**SRS-PRI-01** _(traces PRI-01, PRI-03)_ — No API response accessible to a non-appointed party shall contain: `base_address_line`, exact `base_latitude`/`base_longitude`, `phone`, `email`, or `company_name` of a professional. Enforcement shall be at the serialisation layer, not by client-side omission.

**SRS-PRI-02** _(traces PRI-02)_ — Public professional representation shall consist of display name, photo, skills, rating, badges, `display_area`, service radius, and computed distance, formatted as _"Based in Surat – 12 km away"_.

**SRS-PRI-03 [NEW]** — Map markers for non-appointed professionals shall be positioned at a deterministic obfuscated point within a 1–2km offset of the true base location, stable per professional so it cannot be triangulated across sessions.

> Rendering a marker at true coordinates defeats PRI-01 entirely — the address is readable from the pin. This requirement is essential, not optional.

**SRS-PRI-04** _(traces PRI-04)_ — Exact address and direct contact details shall be released to the appointed professional and the client only upon transition to ASSIGNED, and shall be revoked if the job returns to PUBLISHED.

**SRS-PRI-05 [NEW]** — Job exact coordinates shall be visible only to the job owner and the appointed professional; all other parties receive `display_area` and distance only.

## 6.15 Administration — SRS-ADM

| SRS-ID               | Requirement                                                                                                                                                      | Traces to      |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| SRS-ADM-01           | Verification queue filterable by document type, status, and age, with oldest-first default                                                                       | ADM-01         |
| SRS-ADM-02           | Document approve/reject with mandatory rejection reason from a configurable list plus free text                                                                  | ADM-02         |
| SRS-ADM-03           | User search and detail view; ability to suspend, reinstate, and soft-delete accounts                                                                             | ADM-03, ADM-05 |
| SRS-ADM-04           | Dispute queue with assignment, internal notes, status transitions, and resolution record                                                                         | ADM-04         |
| SRS-ADM-05           | Category taxonomy management — create, rename, reorder, activate/deactivate; deactivation shall not orphan existing jobs                                         | ADM-06         |
| SRS-ADM-06           | Commission rate configuration (Phase 2)                                                                                                                          | ADM-07         |
| SRS-ADM-07 **[NEW]** | All administrative actions shall be written to an immutable audit log retained for _[TBC — OTD-10]_                                                              | CON-05         |
| SRS-ADM-08 **[NEW]** | Administrative access shall require multi-factor authentication                                                                                                  | —              |
| SRS-ADM-09 **[NEW]** | Administrator roles shall be separable — at minimum Verification Reviewer, Dispute Handler, and Super Admin — so document access is limited to staff who need it | CON-05         |

## 6.16 Payments and wallet (Phase 2) — SRS-PAY

Specified at outline level only; a Phase 2 SRS addendum is required before build.

| SRS-ID     | Requirement                                                                            | Traces to              |
| ---------- | -------------------------------------------------------------------------------------- | ---------------------- |
| SRS-PAY-01 | Gateway-integrated client payment with escrow hold until completion confirmation       | PAY-01, PAY-04         |
| SRS-PAY-02 | Invoice generation and PDF retrieval for both parties                                  | PAY-02, ERN-05         |
| SRS-PAY-03 | Payment breakdown display: job amount, platform commission, taxes, net                 | PAY-03, ERN-06         |
| SRS-PAY-04 | Refund initiation and dispute-linked payment hold                                      | PAY-05                 |
| SRS-PAY-05 | Professional wallet: balance, pending payouts, withdrawal to bank                      | ERN-01, ERN-03, ERN-04 |
| SRS-PAY-06 | Commission computed per COMMISSION_RULE at appointment time and frozen against the job | BRL-08                 |
| SRS-PAY-07 | Milestone-linked partial payment release                                               | WRK-06                 |

**SRS-PAY-08 [NEW]** — All monetary values shall be stored as integer minor units with an explicit currency code. Floating-point representation of money is prohibited.

---

# 7. EXTERNAL INTERFACE REQUIREMENTS

## 7.1 User interfaces

| ID        | Requirement                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| SRS-UI-01 | Consistent design system across web, iOS, and Android, with platform-native navigation conventions respected |
| SRS-UI-02 | All destructive actions (cancel job, withdraw quote, delete account) shall require explicit confirmation     |
| SRS-UI-03 | Forms shall validate inline on blur and shall preserve entered data on validation failure                    |
| SRS-UI-04 | All list views shall provide loading, empty, and error states                                                |
| SRS-UI-05 | Media upload shall display per-file progress and allow individual cancellation                               |

## 7.2 Software interfaces

| Interface                  | Purpose                         | Failure behaviour                                     |
| -------------------------- | ------------------------------- | ----------------------------------------------------- |
| Google Maps SDK / JS API   | Map rendering                   | Degrade to list view with distance text               |
| Google Places API          | Address autocomplete, geocoding | Fall back to manual address entry                     |
| Google Distance Matrix API | Travel time                     | Suppress travel time; distance still shown            |
| SMS/OTP provider           | Phone verification              | Offer email verification as alternate path            |
| Email provider             | Transactional email             | Queue and retry with exponential backoff              |
| APNs / FCM                 | Push delivery                   | Fall back to in-app inbox and email                   |
| Object storage             | Media                           | Fail upload with retry; never partial-commit a record |
| Payment gateway (P2)       | Payment processing              | Idempotency keys mandatory on all charge operations   |

**SRS-EXT-01 [NEW]** — Every external dependency shall be wrapped behind an internal interface, so a provider can be substituted without changes to business logic.

**SRS-EXT-02 [NEW]** — No external call shall block a user-facing request beyond 5 seconds; longer operations shall be queued asynchronously.

## 7.3 API requirements

| ID         | Requirement                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| SRS-API-01 | The backend shall expose a versioned REST API over HTTPS returning JSON                                                            |
| SRS-API-02 | Authentication shall use bearer tokens; refresh shall not require re-entry of credentials                                          |
| SRS-API-03 | List endpoints shall support pagination, sorting, and filtering by query parameter                                                 |
| SRS-API-04 | Error responses shall follow a single envelope: HTTP status, machine-readable code, human-readable message, and field-level detail |
| SRS-API-05 | State-changing endpoints shall accept an idempotency key                                                                           |
| SRS-API-06 | The API shall be documented in OpenAPI 3.x, maintained in step with implementation                                                 |

---

# 8. PERMISSION MATRIX

**R** read · **W** write · **—** no access · **C** conditional

| Resource                      | Visitor | Client (owner)     | Client (other) | Professional (quoting) | Professional (appointed) | Admin            |
| ----------------------------- | ------- | ------------------ | -------------- | ---------------------- | ------------------------ | ---------------- |
| Public pages                  | R       | R                  | R              | R                      | R                        | R                |
| Job — public fields           | R       | RW                 | R              | R                      | R                        | RW               |
| Job — exact coordinates       | —       | R                  | —              | —                      | R                        | R                |
| Job — client contact details  | —       | R                  | —              | —                      | R                        | R                |
| Quote (own)                   | —       | R (all on own job) | —              | RW                     | RW                       | R                |
| Quote (others' on same job)   | —       | R                  | —              | —                      | —                        | R                |
| Professional profile — public | R       | R                  | R              | R                      | R                        | RW               |
| Professional — base address   | —       | —                  | —              | —                      | C (own job only)         | R                |
| Verification documents        | —       | —                  | —              | R (own)                | R (own)                  | RW               |
| Badges                        | R       | R                  | R              | R                      | R                        | C (derived only) |
| Work proof                    | —       | R (own job)        | —              | —                      | RW (own job)             | R                |
| Review                        | R       | RW (own)           | R              | R                      | RW (own)                 | RW               |
| Dispute                       | —       | RW (own)           | —              | —                      | RW (own)                 | RW               |
| Audit log                     | —       | —                  | —              | —                      | —                        | R                |

**SRS-SEC-01** — Authorisation shall be enforced server-side on every request. Client-side visibility control is presentation only and shall never be relied upon.

---

# 9. ALGORITHMS AND DERIVED VALUES

## 9.1 Geofence matching

A job **J** matches professional **P** when all hold:

1. `distance(P.base_point, J.location_point) ≤ P.service_radius_km`, computed by spatial index
2. `J.category_id ∈ P.categories`
3. `J.work_mode` compatible with `P.work_mode` (REMOTE jobs bypass condition 1)
4. `J.status ∈ {PUBLISHED, QUOTED}`
5. `P.account_status = ACTIVE` and profile complete

**SRS-ALG-01** — Matching shall execute as a single indexed database query. Application-layer iteration over the professional table is prohibited.

## 9.2 Job feed ranking

Composite score, weights server-configurable:

```
score = w1·proximity + w2·urgency + w3·recency + w4·budget_fit
```

**SRS-ALG-02** — Weights shall be configuration values, not compiled constants, to permit tuning post-launch without a release.

## 9.3 Badge derivation

| Badge              | Condition                                                         |
| ------------------ | ----------------------------------------------------------------- |
| ID Verified        | GOV_ID approved and unexpired                                     |
| Skill Verified     | At least one of TRADE_CERT or WORK_LICENCE approved and unexpired |
| Background Checked | BACKGROUND_CHECK approved and unexpired                           |
| Fully Verified     | All three above **plus** _[definition pending OI-08]_             |

**SRS-ALG-03** — Badges shall be computed from document state, never stored as independently editable flags.

## 9.4 Rating aggregation

**SRS-ALG-04** — `avg_rating` = arithmetic mean of PUBLISHED reviews, one decimal place. Professionals with fewer than _[TBC — OTD-11]_ reviews shall display the review count alongside the rating and shall not be ranked above established professionals on rating alone.

## 9.5 Display area derivation

**SRS-ALG-05** — `display_area` shall be derived by reverse geocoding to locality/city granularity only. Sub-locality, street, and premise components shall be discarded at ingestion, not filtered at output — so a precise address cannot leak through a later code change.

---

# 10. NON-FUNCTIONAL REQUIREMENTS

| ID         | Category        | Requirement                              | Measure                                                                                                        |
| ---------- | --------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| SRS-NFR-01 | Performance     | Search and filter responses              | p95 < 2s, p99 < 4s                                                                                             |
| SRS-NFR-02 | Performance     | Map view with 100 markers                | Render < 3s on mid-tier mobile                                                                                 |
| SRS-NFR-03 | Performance     | Geofence match on job publish            | < 5s for radius fan-out                                                                                        |
| SRS-NFR-04 | Capacity        | Concurrent users at launch               | _[TBC — OI-10]_                                                                                                |
| SRS-NFR-05 | Capacity        | Jobs and professionals at 12 months      | _[TBC — OI-10]_                                                                                                |
| SRS-NFR-06 | Cost            | Google Maps API calls per active session | Budget ceiling _[TBC]_; autocomplete session tokens mandatory                                                  |
| SRS-NFR-07 | Availability    | Uptime excluding scheduled maintenance   | 99.5%                                                                                                          |
| SRS-NFR-08 | Security        | Transport                                | TLS 1.2+ on all endpoints; HSTS                                                                                |
| SRS-NFR-09 | Security        | Password storage                         | bcrypt cost ≥12 or argon2id                                                                                    |
| SRS-NFR-10 | Security        | Verification documents                   | AES-256 at rest; access logged                                                                                 |
| SRS-NFR-11 | Security        | Baseline                                 | OWASP ASVS Level 2                                                                                             |
| SRS-NFR-12 | Privacy         | Regulatory compliance                    | _[Jurisdiction TBC — OI-09]_                                                                                   |
| SRS-NFR-13 | Privacy         | Data subject rights                      | Export and erasure within statutory window                                                                     |
| SRS-NFR-14 | Resilience      | Mobile connectivity                      | Draft quotes and work-proof uploads shall survive app backgrounding and network loss, and resume automatically |
| SRS-NFR-15 | Scalability     | Architecture                             | Horizontally scalable stateless API tier                                                                       |
| SRS-NFR-16 | Maintainability | Test coverage                            | ≥70% unit coverage on business logic                                                                           |
| SRS-NFR-17 | Observability   | Logging                                  | Structured logs, correlation IDs across services, error alerting                                               |
| SRS-NFR-18 | Backup          | Recovery                                 | RPO ≤24h, RTO ≤4h                                                                                              |
| SRS-NFR-19 | Compatibility   | Platforms                                | Per section 2.3                                                                                                |
| SRS-NFR-20 | Accessibility   | Standard                                 | _[TBC — OI-09]_; WCAG 2.1 AA recommended                                                                       |
| SRS-NFR-21 | Localisation    | Architecture                             | Strings externalised from launch even though English-only at release                                           |
| SRS-NFR-22 | Retention       | Verification documents                   | _[TBC — OI-09]_ post account closure                                                                           |

---

# 11. ERROR HANDLING

**SRS-ERR-01** — All errors shall return the standard envelope of SRS-API-04.

**SRS-ERR-02** — User-facing messages shall state what happened and what to do next. Stack traces, SQL, and internal identifiers shall never surface to a client.

**SRS-ERR-03** — Standard HTTP semantics: 400 malformed · 401 unauthenticated · 403 unauthorised · 404 not found · 409 state conflict · 413 payload too large · 415 unsupported media · 422 validation · 429 rate limited · 500 internal · 503 dependency unavailable.

**SRS-ERR-04** — External dependency failure shall degrade gracefully per the table in section 7.2, never with a blank screen.

**SRS-ERR-05** — Multi-step operations (appointment, payment) shall be transactional; partial commitment is prohibited.

---

# APPENDIX A — FIELD VALIDATION

| Field                 | Rule                                                                        |
| --------------------- | --------------------------------------------------------------------------- |
| Email                 | RFC 5322, ≤254 chars, unique among active accounts                          |
| Phone                 | E.164, country code mandatory                                               |
| Password              | ≥8 chars, at least one letter and one number; common-password list rejected |
| Job title             | 5–120 chars                                                                 |
| Job description       | 20–5000 chars                                                               |
| Cover message         | 20–2000 chars                                                               |
| Review comment        | 0–2000 chars                                                                |
| Rating                | Integer 1–5                                                                 |
| Budget / quote amount | > 0, ≤ platform ceiling, 2 decimal places                                   |
| Service radius        | Integer 1–200 km                                                            |
| Coordinates           | Lat −90…90, Lng −180…180, 7 decimal places                                  |
| Profile image         | JPEG/PNG/WebP, ≤5MB                                                         |
| Job attachment        | JPEG/PNG/WebP/PDF, ≤10MB, ≤10 per job                                       |
| Verification document | JPEG/PNG/PDF, ≤10MB                                                         |
| Work proof            | JPEG/PNG/WebP/PDF, ≤10MB, ≤20 per job                                       |

# APPENDIX B — ENUMERATIONS

| Enum                | Values                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| user_type           | CLIENT, PROFESSIONAL, ADMIN                                                                                                      |
| account_status      | PENDING, ACTIVE, SUSPENDED, DELETED                                                                                              |
| job_status          | DRAFT, PUBLISHED, QUOTED, ASSIGNED, IN_PROGRESS, AWAITING_CONFIRMATION, COMPLETED, CLOSED, CANCELLED, EXPIRED, DISPUTED, DELETED |
| quote_status        | SUBMITTED, SUPERSEDED, ACCEPTED, REJECTED, NOT_SELECTED, WITHDRAWN, EXPIRED                                                      |
| document_status     | PENDING, REVIEWING, APPROVED, REJECTED, EXPIRED                                                                                  |
| milestone_status    | PENDING, IN_PROGRESS, SUBMITTED, REVISION_REQUESTED, CONFIRMED                                                                   |
| dispute_status      | OPEN, UNDER_REVIEW, RESOLVED, CLOSED                                                                                             |
| urgency             | LOW, NORMAL, HIGH, EMERGENCY                                                                                                     |
| work_mode           | ONSITE, REMOTE, BOTH                                                                                                             |
| availability_status | AVAILABLE, BUSY, UNAVAILABLE                                                                                                     |

# APPENDIX C — TRACEABILITY SUMMARY

| BRD module | SRS section   |
| ---------- | ------------- |
| WEB-01…12  | 6.1           |
| CRA / PRA  | 6.2           |
| CPR        | 6.3           |
| PPR        | 4.1, 6.3      |
| JOB        | 5.1, 6.4      |
| CDS        | 6.5           |
| PJD        | 6.6, 9.1, 9.2 |
| PRO        | 5.2, 6.7      |
| HIR        | 6.8           |
| VER        | 5.3, 6.9, 9.3 |
| WRK / TRK  | 5.4, 6.10     |
| REV / PRV  | 6.11, 9.4     |
| CNT / PNT  | 6.12          |
| MAP        | 6.13          |
| PRI        | 6.14, 9.5     |
| ADM        | 6.15          |
| PAY / ERN  | 6.16          |

# APPENDIX D — REQUIREMENTS MARKED [NEW]

These 40 requirements have no BRD parent. They were added because a parent requirement is not implementable without them, or because a defined path had no defined behaviour. Each requires product owner approval; none should be treated as vendor scope creep.

**Highest priority for review — these three affect trust or security directly:**

| ID            | Why it matters                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------- |
| SRS-PRI-03    | Without marker obfuscation, the "no exact address" rule (PRI-01) is defeated by reading the map pin |
| SRS-VER-ST-02 | Without document expiry, an expired licence displays a permanent verification badge                 |
| SRS-ADM-09    | Without role separation, every admin can read every government ID on the platform                   |

Remaining [NEW] requirements: SRS-WEB-05, 06 · SRS-AUT-04, 08 · SRS-CPR-05 · SRS-JOB-03, 04, 05, ST-01, ST-02 · SRS-CDS-04 · SRS-PJD-02, 04, 05 · SRS-QUO-03, 04 · SRS-HIR-05 · SRS-VER-06, ST-01 · SRS-WRK-09 · SRS-REV-07, 08 · SRS-NOT-03, 06 · SRS-MAP-08, 09 · SRS-PRI-05 · SRS-ADM-07, 08 · SRS-PAY-08 · SRS-EXT-01, 02 · SRS-ALG-01, 02, 03, 05 · SRS-SEC-01 · SRS-NFR-14, 21

# APPENDIX E — OPEN TECHNICAL DECISIONS

Distinct from the business open items (BRD section 12). These block technical design.

| ID     | Decision                                        | Blocks                       |
| ------ | ----------------------------------------------- | ---------------------------- |
| OTD-01 | Backend stack, hosting, and region              | Everything                   |
| OTD-02 | Native vs cross-platform mobile                 | Mobile estimate and timeline |
| OTD-03 | Relational engine and geospatial extension      | Data layer, section 9.1      |
| OTD-04 | Access token lifetime and refresh strategy      | SRS-AUT-06                   |
| OTD-05 | Search approach — database vs dedicated index   | SRS-CDS-01, SRS-PJD-01       |
| OTD-06 | Daily quote cap per professional                | SRS-QUO-04                   |
| OTD-07 | Appointment acceptance window                   | SRS-WRK-01                   |
| OTD-08 | Review submission window                        | SRS-REV-02                   |
| OTD-09 | Nearby-job notification cap                     | SRS-NOT-03                   |
| OTD-10 | Audit log retention period                      | SRS-ADM-07                   |
| OTD-11 | Minimum review count for rating display         | SRS-ALG-04                   |
| OTD-12 | SMS, email, and push provider selection         | Section 7.2                  |
| OTD-13 | Payment gateway (Phase 2)                       | SRS-PAY-01                   |
| OTD-14 | Environment strategy — dev, staging, production | Deployment                   |

_End of document._
