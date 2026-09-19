# Business Requirements Document (BRD) — Klick-Pro (as implemented)

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

| Field | Value |
|---|---|
| Product brand | Klick-Pro (user-facing emails and UI, e.g. `app/api/auth/[action]/route.ts` "Verify your Klick-Pro email") |
| Package / internal name | `servio` (`package.json`, cookie `servio_session`, `server.mjs` log "Servio ready") |
| Document type | Reverse-engineered BRD. It describes the business as the code implements it, not as originally planned. |
| Source precedence | IMPLEMENTATION > EXISTING DOCS > ASSUMPTION |
| Status labels | **Implemented**, **Partial** (partially implemented), **Planned** (specified in older docs, no code), **Unknown** |
| Related docs | [PRD](./PRD.md), [User stories](./user-stories.md), [SRS](../02-requirements/SRS.md), [Functional requirements](../02-requirements/functional-requirements.md), [Solution architecture](../03-architecture/solution-architecture.md), [Integrations](../03-architecture/integrations.md), [Database design](../04-database/database-design.md), [Screen inventory](../06-ui/screen-inventory.md), [Security](../08-operations/security.md) |

---

## 1. Executive summary

Klick-Pro is a two-sided **services marketplace for India**. It connects:

- **Clients**: individuals or businesses who post jobs.
- **Professionals**: tradespeople, freelancers and service providers who send proposals and deliver the work.

**Administrators** run the platform. They verify professionals, moderate jobs and users, resolve disputes, approve milestone payouts and withdrawals, and maintain the service catalogue and marketing content.

The implemented business flow works like this:

1. A client posts a job with a location, a budget and milestones.
2. A professional sends a proposal, or the client sends a hire request.
3. Both sides can negotiate with counter-offers.
4. When one side accepts, a tracked project is created.
5. Work runs milestone by milestone.
6. The client pays each milestone. Payment is either (a) from a prepaid wallet funded through Razorpay, with platform fees, or (b) confirmed as an offline payment, with no fees.
7. For wallet payments, an admin approves the payout to the professional's wallet.
8. The professional can then request a withdrawal.
9. After completion, both parties confirm, the client leaves a review, and either party can raise a dispute.

Evidence for the core flow:

- `src/lib/project-request-actions.ts`
- `app/api/portal/project-actions/route.ts`
- `app/api/wallet/milestone/route.ts`
- `app/api/admin/finance/milestone-payout/route.ts`
- `src/lib/wallet-ledger.ts`

---

## 2. Business context and problem statement

| # | Problem (from older BRD `project-docs/src/routes/docs/Business_Requirements_Document.md` §3) | How the code addresses it | Status |
|---|---|---|---|
| P-1 | Clients cannot confirm that a provider is credible | Professional document upload, optional Persona KYC, admin approval that sets `User.isVerified`, a public "verified" flag in discovery | Implemented (single badge only, see §8) |
| P-2 | Clients cannot compare quotes in a structured way | Proposals and hire requests (`ProjectRequest`), counter-offers (`ProjectNegotiation`), a per-job proposal list on `/job/[jobId]` | Implemented (no side-by-side profile comparison) |
| P-3 | Clients cannot track work | `ProjectTracking`, `ProjectMilestone`, `ProjectTimelineEvent`, `ProjectWorkUpload`, `/project/[projectId]/tracking` | Implemented |
| P-4 | Professionals lack a low-cost channel to nearby clients | Radius-filtered job feed (`app/api/portal/[resource]/route.ts` `professional-jobs`), new-job broadcast notifications | Implemented |
| P-5 | Professionals lack tools for quotes, progress and payment | Proposals, milestone submissions, wallet, withdrawals, PDF invoices and reports | Implemented |

---

## 3. Stakeholders and actors

### 3.1 System actors (verified from `prisma/schema.prisma` `enum UserRole { ADMIN CLIENT PROFESSIONAL }`)

| Actor | Code identity | How the account is created | Primary surfaces |
|---|---|---|---|
| Public visitor | No session | n/a | Marketing pages `app/(marketing)/*`, `/pro/[proId]`, `/login`, `/signup`, `/blog`, `/careers` |
| Client | `User.role = CLIENT` | Self-registration: `POST /api/auth/register`, or Google OAuth `GET /api/auth/google` with `role` defaulting to CLIENT | `app/(portal)/(client)/*`, `/project/[projectId]/tracking`, `/earnings` (wallet view) |
| Professional | `User.role = PROFESSIONAL` | Self-registration, or Google OAuth with `?role=PROFESSIONAL` | `app/(portal)/professional/*`, `/professional/setup`, `/professional-profile`, `/verification`, `/earnings` |
| Administrator | `User.role = ADMIN` | Not self-service. The first admin is bootstrapped from `ADMIN_BOOTSTRAP_USERNAME` / `ADMIN_BOOTSTRAP_PASSWORD` **and `ADMIN_EMAIL`** when no ADMIN exists (`app/api/admin/login/route.ts` `createBootstrapAdmin`). Without `ADMIN_EMAIL` the bootstrap silently does nothing and admin login returns 401 [CORRECTED 2026-09-17 · V-31]. [UNKNOWN] how further admins are created: no admin-creation API was found. | `app/admin/*` |

No finer-grained admin permission model exists. Every ADMIN has full back-office access. See [authentication-and-authorization.md](../03-architecture/authentication-and-authorization.md).

### 3.2 External parties

| Party | Business role | Evidence |
|---|---|---|
| Razorpay | Collects client wallet top-ups (INR). Optional Route transfers for payouts. | `src/lib/razorpay.ts`, `app/api/wallet/deposit/*`, `app/api/webhooks/razorpay/route.ts`, `app/api/admin/finance/payouts/route.ts` |
| Persona | Optional identity-document verification for professionals | `src/lib/persona.ts`, `app/api/verification/persona/*`, `app/api/webhooks/persona/route.ts` |
| Twilio Verify / generic SMS API | Phone OTP | `src/lib/phone-otp-provider.ts` |
| Google | OAuth sign-in, Maps JS, geocoding | `app/api/auth/[action]/route.ts` (`action === "google"`), `src/components/Google*Map*.tsx`, `app/api/geocode/route.ts` |
| SMTP provider | Transactional and notification email | `src/lib/email.ts` |
| S3-compatible storage | Verification documents, project work files and avatars. With `NODE_ENV=production` and `FILE_STORAGE_PROVIDER≠s3`, every upload returns 500 "Local file storage is disabled in production." [FOUND IN VALIDATION 2026-09-17 · PROD-STORAGE] | `src/lib/project-file-storage.ts` |

### 3.3 Business stakeholders (from older BRD §5; not verifiable from code)

Business Owner, Product Owner, Development Vendor, Verification/Operations team, Legal & Compliance. Names and owners: [UNKNOWN].

---

## 4. Business objectives

The older BRD (§2) defined objectives BO-01 to BO-05, and all its success targets were "TO BE CONFIRMED". The table below maps each objective to what is actually built.

| ID | Objective | Implementation evidence | Measurable in product today? |
|---|---|---|---|
| BO-01 | Trusted marketplace to find and hire verified local professionals | Discovery `GET /api/v1/professionals` (`src/lib/queries/professional-discovery.ts`) with a verified filter, rating filter and distance filter. Hire requests. | Partial. Admin overview shows client and professional counts (`GET /api/admin/data/overview`). No target is defined. |
| BO-02 | Give professionals a channel to find nearby work and manage jobs end to end | Radius-filtered feed, proposals, milestone workflow, earnings | Partial. Counts are only available via admin reports (PDF). |
| BO-03 | Build trust via verification and reviews | `ProfessionalVerification`, `PersonaVerification`, `ProjectReview`, `User.averageRating` / `reviewCount` | Partial. The pending-verification count and the open-dispute count are on the admin overview. |
| BO-04 | Revenue via commission | Fee model in `src/lib/wallet-ledger.ts` (see §6) | Yes. Admin finance page computes platform commission (`app/admin/finance/page.tsx`). |
| BO-05 | Fast Phase 1 that defers payments | Not followed. On-platform wallet payments were built (they were Phase 2 in the old scope). | n/a |

Quantitative success metrics (GMV targets, take-rate targets, SLAs): **[UNKNOWN]**. None exist in code or config.

---

## 5. Geographic, currency and language scope

| Dimension | Implemented behaviour | Evidence |
|---|---|---|
| Country | India. The location taxonomy covers 36 states and union territories with district lists. | `src/lib/india-locations.ts` (`getAllStates`, `getDistrictsByState`, `matchIndiaLocation`, `inferLocationFromAddress`) |
| Location fields | Jobs store `locationState`, `locationDistrict`, lat/lng. Professionals store `professionalState`, `professionalDistrict`, `professionalCity`, lat/lng, `serviceRadiusKm` (1–500). | `prisma/schema.prisma` `ClientJob`, `User`; `app/api/professional/profile/route.ts` |
| Currency | INR only. Razorpay orders are created with `currency: "INR"`, amounts are integer rupees (converted to paise × 100), and UI formatting uses `en-IN`. | `src/lib/razorpay.ts`, `app/api/wallet/milestone/route.ts` |
| Phone numbers | +91 is listed first, but 15 international dialling codes are accepted | `src/lib/country-codes.ts`, `src/lib/phone-validation.ts` |
| Language | English only. No i18n library or translation files were found. | Repository search for `i18n` or `language`: no results |
| Privacy of location | Public job views show an approximate address (last 1–2 address segments) and a map point deterministically offset by 1.2–2.0 km. Offsetting requires `GEO_OBFUSCATION_SALT`; without it, no map point is returned. | `src/lib/geo.ts` `approximateAddress`, `createDisplayPoint`; `src/lib/queries/marketplace.ts` `getOpenJob` |

---

## 6. Revenue and fee model (as implemented)

### 6.1 Fee constants

`src/lib/wallet-ledger.ts:5-20`:

```ts
export const CLIENT_FEE_RATE = 0.1;
export const PROFESSIONAL_FEE_RATE = 0.1;
// clientFeeAmount = ceil(base * 0.1); professionalFeeAmount = ceil(base * 0.1)
// clientChargeAmount = base + clientFee; professionalPayoutAmount = max(0, base - professionalFee)
// adminNetAmount = clientChargeAmount - professionalPayoutAmount
```

### 6.2 Fee rules by payment method

A job's payment method is `ClientJob.paymentMethod`, either `WALLET` (default) or `OFFLINE`, and is set when the job is posted (`app/api/client/jobs/route.ts`).

| Rule ID | Rule | Evidence |
|---|---|---|
| BR-FEE-01 | For WALLET jobs, the client pays the milestone base amount **plus a 10% client convenience fee**, rounded up to a whole rupee | `calculateMilestoneMoney`, `app/api/wallet/milestone/route.ts:45-80` |
| BR-FEE-02 | For WALLET jobs, the professional receives the base amount **minus a 10% professional commission**, rounded up to a whole rupee | same |
| BR-FEE-03 | The platform keeps both fees (`adminNetAmount`), about 20% of the base amount | same |
| BR-FEE-04 | For OFFLINE jobs, no fees apply. The payment row is recorded with `clientFeeAmount = 0`, `commissionAmount = 0`, `adminNetAmount = 0`. | `app/api/portal/project-actions/route.ts:597-722` |
| BR-FEE-05 | Fee rates are hard-coded. No admin setting exists to change them. | No config or DB field found. The older ADM-07 "configure commission rate" is **Planned**. |
| BR-FEE-06 | No subscription, listing, featured-placement or proposal fees are implemented | Repository search. The pricing page CMS copy advertises "Starter / Pro / Business" tiers, but no code backs them (see §10). |

**Worked example** (base milestone ₹10,000, WALLET job):

| Party | Amount | Ledger entry |
|---|---|---|
| Client wallet debit | ₹11,000 | `WalletTransaction.type = MILESTONE_PAYMENT` (−11,000) |
| Admin (platform) wallet credit | ₹11,000 | `ADMIN_MILESTONE_RECEIPT` (+11,000) |
| Admin wallet debit when payout is approved | ₹9,000 | `PROFESSIONAL_PAYOUT` (−9,000) |
| Professional wallet credit | ₹9,000 | `MILESTONE_EARNING` (+9,000) |
| Platform retained | ₹2,000 | Stored as `Payment.adminNetAmount` |

### 6.3 Money flow (implemented)

```mermaid
sequenceDiagram
  autonumber
  participant C as Client
  participant RZP as Razorpay
  participant P as Platform (wallet-ledger)
  participant A as Admin
  participant PRO as Professional
  C->>P: POST /api/wallet/deposit/order (amount 1..1,000,000 INR)
  P->>RZP: create order (INR)
  C->>RZP: Checkout
  C->>P: POST /api/wallet/deposit/verify (HMAC signature)
  P-->>C: Client wallet +amount (WALLET_TOP_UP COMPLETED)
  Note over P,RZP: The Razorpay webhook can also credit a PENDING top-up
  C->>P: POST /api/wallet/milestone (milestone AWAITING_CLIENT_REVIEW)
  P-->>P: Client −(base+10%) and admin wallet +(base+10%); Payment FUNDED; Invoice issued; milestone AWAITING_ADMIN_APPROVAL
  A->>P: POST /api/admin/finance/milestone-payout
  P-->>PRO: Admin wallet −(base−10%) and pro wallet +(base−10%); Payment COMPLETED; milestone APPROVED
  PRO->>P: POST /api/wallet (withdrawal: BANK/CARD/UPI label)
  P-->>P: Wallet.pendingBalance += amount; ProjectWithdrawal PENDING
  A->>P: PATCH /api/admin/finance/withdrawals/{id} COMPLETED|FAILED<br/>or POST /api/admin/finance/payouts (Razorpay Route transfer)
```

### 6.4 Settlement account rule

- The platform's funds sit in the wallet of **the first ADMIN user that `findFirst` returns** (`src/lib/wallet-ledger.ts:116,150`). No ordering is applied, so the choice is non-deterministic when several admins exist.
- The finance dashboard works around this by adding up all admin wallets (`app/api/admin/data/[resource]/route.ts:225-235`).
- Settlement fails with "No admin account is configured for settlement." if no admin exists.

---

## 7. Business rules evidenced in code

| ID | Rule | Evidence (path + symbol) | Status |
|---|---|---|---|
| BR-ACC-01 | A self-registered role must be CLIENT or PROFESSIONAL. ADMIN cannot self-register. | `registerSchema.role` in `app/api/auth/[action]/route.ts:37` | Implemented |
| BR-ACC-02 | Password: at least 8 characters, with an uppercase letter, a lowercase letter and a digit. Terms must be accepted (`terms: true`). | `passwordSchema`, `registerSchema` | Implemented |
| BR-ACC-03 | Email and phone must be unique. If a phone number is supplied at registration, it must first be OTP-verified (phone-proof cookie). Emails are stored as typed, but login lowercases the input, so an account registered with upper-case letters in its email can never log in by email/password (401 both as typed and lowercased, even after verification) [FOUND IN VALIDATION 2026-09-17 · V-21]. | `action === "register"` | Implemented (defect: mixed-case email) |
| BR-ACC-04 | Email/password login and phone OTP login are blocked until the email is verified (`EMAIL_NOT_VERIFIED`, 403, no session cookie). Unverified sessions are redirected to `/verify` on pages. **However**, `login-phone-password` returns 403 **and** sets a valid session cookie for an unverified email, and APIs accept that session (e.g. `POST /api/client/jobs` → 201) [CORRECTED 2026-09-17 · V-22, V-23]. | `action === "login"`; `proxy.ts` | Partial |
| BR-ACC-05 | The email verification token expires after 24 h. A password reset token expires after 1 h (email) or 30 min (phone OTP). A password reset revokes all sessions. | `createEmailVerificationToken`, `forgot-password`, `verify-forgot-password-phone`, `reset-password` | Implemented |
| BR-ACC-06 | When an admin deactivates a user, all of that user's sessions are revoked. Inactive users cannot log in or authenticate. | `PATCH /api/admin/users/[id]`; `src/lib/auth.ts` `verifySession` | Implemented |
| BR-JOB-01 | Publishing a job requires a title, a category that exists in `ServiceCategory`, a description and a deadline. Non-REMOTE jobs also require an address with lat/lng. FIXED jobs require a budget range (min ≤ max). HOURLY jobs require an hourly rate. The deadline must be on or after `jobDate`. | `publishErrors` in `app/api/client/jobs/route.ts` | Implemented |
| BR-JOB-02 | Milestone percentages are integers from 1 to 100 and must total no more than 100% (a total below 100%, e.g. 60%, is accepted; above 100% returns 400) [VALIDATED 2026-09-17 · V-48]. If none are given, one "Project Completion" milestone at 100% is created. Each milestone amount = round(budgetMax, or budgetMin if absent, × pct / 100). | same | Implemented |
| BR-JOB-03 | `jobDate` acts as a go-live date. A job with a future `jobDate` is hidden from feeds, search and proposals, and new-job notifications are skipped at publish time. New-job notifications are sent only by a direct `POST` publish; publishing a draft via `PATCH` sends none (+0 vs +15 notifications) [FOUND IN VALIDATION 2026-09-17 · V-46]. | `app/api/marketplace/jobs/route.ts`, `app/api/professional/proposals/route.ts:70-79`, `app/api/client/jobs/route.ts:234` | Implemented (notifications are never sent later; see §10) |
| BR-JOB-04 | Only DRAFT jobs can be deleted by the client. CLOSED jobs cannot be edited except to reopen them. | `app/api/client/jobs/[id]/route.ts` PATCH/DELETE | Implemented |
| BR-PROP-01 | A proposal requires a job that is OPEN, live (`jobDate` ≤ now) and not expired (`deadline` ≥ now), and not owned by the proposer. Bid is an integer from 1 to 10,000,000. Duration is 2–100 characters. Cover letter is 10–5000 characters. | `app/api/professional/proposals/route.ts` | Implemented |
| BR-PROP-02 | Each professional has at most one PENDING proposal per job. Re-submitting updates it. | same | Implemented |
| BR-PROP-03 | A client hire request requires the client to own an OPEN job. For non-HOURLY jobs with a budget range, the bid must be within [budgetMin, budgetMax]; otherwise it must not exceed ₹10,000,000. There can be one PENDING request per job and professional. | `app/api/client/project-requests/route.ts`, `src/lib/constants/hiring.ts` | Implemented |
| BR-PROP-04 | Either party can accept, reject or counter a PENDING request. A counter overwrites the request's bid, duration and message and keeps the history in `ProjectNegotiation`. Turns are not enforced: a client countered and then accepted its own hire request, creating a project without the professional responding [VALIDATED 2026-09-17 · V-44]. | `respondToProjectRequest` | Implemented (no turn enforcement) |
| BR-PROP-05 | Acceptance closes the job (OPEN → CLOSED), rejects all other PENDING requests for that job, and creates `ProjectTracking` (READY_TO_START) with milestones copied from the job. A job can therefore have exactly one hired professional. | `respondToProjectRequest` accept branch | Implemented |
| BR-PRJ-01 | Only the client starts work (READY_TO_START → IN_PROGRESS). The first UPCOMING milestone becomes IN_PROGRESS. | `start-work` | Implemented |
| BR-PRJ-02 | A milestone created by the client must not push the milestone total above max(bid, existing total). Its date must fall between the job's `jobDate` and `deadline`. Increasing a milestone above the agreed total returns 400, but a **funded** milestone can still be lowered (200) and deleting a funded milestone returns 500 (FK) [FOUND IN VALIDATION 2026-09-17 · V-42]. | `create-milestone`, `update-milestone` | Implemented |
| BR-PRJ-03 | Final work can be submitted only when every milestone is APPROVED | `submit-final-work` | Implemented |
| BR-PRJ-04 | Completion is two-step: the client requests it (→ AWAITING_PROFESSIONAL_CONFIRMATION), then the professional confirms (→ COMPLETED, progress 100, job CLOSED) | `complete-project`, `confirm-project-completion` | Implemented |
| BR-PAY-01 | WALLET milestones must be paid from the client wallet. The direct Razorpay per-milestone order and verify endpoints return 410. | `app/api/payments/razorpay/order/route.ts`, `verify/route.ts` | Implemented |
| BR-PAY-02 | A milestone can be paid only while AWAITING_CLIENT_REVIEW. Double payment is prevented by a conditional status claim and the `Payment.milestoneId` upsert. | `app/api/wallet/milestone/route.ts` | Implemented |
| BR-PAY-03 | Wallet payouts to professionals require admin approval. The payout amount is computed from the milestone's **current** amount, not the funded `Payment`; approval sets `Payment` COMPLETED [VALIDATED 2026-09-17 · V-42, V-45]. | `app/api/admin/finance/milestone-payout/route.ts` | Implemented |
| BR-PAY-04 | Withdrawals are limited to the available balance (balance − pendingBalance). Clients as well as professionals may withdraw. | `POST /api/wallet` (`canWithdraw` includes CLIENT) | Implemented |
| BR-PAY-05 | Only clients can fund a wallet. A single top-up is between ₹1 and ₹1,000,000. | `app/api/wallet/deposit/order/route.ts` | Implemented |
| BR-DSP-01 | A dispute can be raised by either party while the project is READY_TO_START, IN_PROGRESS, AWAITING_CLIENT_REVIEW, REVISION_REQUESTED, FINAL_WORK_SUBMITTED, COMPLETED or CLOSED. A project can have only one OPEN dispute at a time. | `submit-dispute` | Implemented |
| BR-DSP-02 | An admin dispute resolution only changes status (OPEN/RESOLVED) and sends messages. There is no refund or other financial remedy. | `PATCH /api/admin/disputes/[id]` | Implemented (the financial remedy is **Planned**, see old Decision 4) |
| BR-REV-01 | Only the client reviews the professional, with a rating from 1 to 5 and an optional comment. There is one review per project (upsert). The professional's average rating and review count are recalculated. The professional can respond once (overwritable). | `submit-review`, `respond-to-review` | Implemented |
| BR-MSG-01 | Clients and professionals can message each other only when they share a project that is not COMPLETED. Anyone can message an admin. Admins can message anyone except other admins. | `POST /api/v1/messages` | Implemented |
| BR-VER-01 | Verification is optional. Unverified professionals can still send proposals. | No `isVerified` check in the proposal route | Implemented |
| BR-VER-02 | An admin decision (APPROVED/REJECTED) sets `ProfessionalVerification.status` and `User.isVerified`. Per-document review status is stored in `VerificationDocumentReview`. | `PATCH /api/admin/verifications` | Implemented |
| BR-PRIV-01 | Public professional profiles strip email, phone, address, exact coordinates, last login and document URLs | `getPublicProfessionalProfile` in `src/lib/queries/marketplace.ts` | Implemented |
| BR-NOT-01 | Email notifications respect `User.emailNotificationsEnabled`. In-app notifications are always stored. | `sendEmails` in `src/lib/marketplace-notifications.ts` | Implemented |

---

## 8. Scope

### 8.1 In scope (implemented in this repository)

| Area | Status | Notes |
|---|---|---|
| Public marketing website: home, about, how-it-works, services, for-clients, for-professionals, pricing, FAQ, contact, privacy, terms, cookies, professional-home, blog, careers | Implemented | Hero/items copy for 8 marketing pages plus home is editable through the file CMS (`data/cms-*.json`). Most marketing pages (e.g. `/pricing`, `/how-it-works`) are prerendered static in the production build, so saved CMS edits appear only after a rebuild [FOUND IN VALIDATION 2026-09-17 · V-03, V-03b] |
| Registration and login: email/password, phone OTP, phone+password, Google OAuth, email verification, password reset by email or phone | Implemented | `app/api/auth/[action]/route.ts` |
| Client profile, company details, saved locations, avatar | Implemented | `app/api/profile/*` |
| Professional profile setup: category, skills, experience, hourly rate, service area, radius, work mode, bio | Implemented | `app/api/professional/profile/route.ts` |
| Professional verification: document upload, Persona inquiry, admin review | Implemented | Single `isVerified` badge |
| Job posting with draft/publish, milestones, map location, urgency, work mode, payment method | Implemented | Job attachments are **not** implemented (see 8.3) |
| Professional discovery with filters and map | Implemented | `GET /api/v1/professionals` |
| Job discovery for professionals: radius, favourites, map | Implemented | |
| Proposals, hire requests, counter-offers, accept/reject | Implemented | |
| Project tracking: milestones, work uploads, revisions, final work, two-step completion | Implemented | |
| Wallet top-up (Razorpay), milestone funding, admin payout approval, withdrawals | Implemented | |
| Invoices (PDF) and PDF reports for clients, professionals and admins | Implemented | `src/lib/reports/pdf/*` |
| Reviews with professional response | Implemented | |
| Disputes with admin messaging | Implemented | |
| In-app, email and realtime (Socket.IO) notifications | Implemented | |
| Messaging (client↔professional during a project; users↔admin) | Implemented | |
| Admin back office: overview, users, verifications, operations (jobs, disputes), finance, services catalogue, CMS, support (FAQ, contact requests), reports, messages, notifications | Implemented | |

### 8.2 Out of scope, or not present in code

| Item | Evidence |
|---|---|
| Native iOS and Android apps in this working tree | `flutter_app/` (139 tracked files at HEAD) is **deleted in the working tree** (uncommitted). There are mobile-oriented affordances: `/api/v1` rewrite, `token` in the login response, Bearer support in 3 routes. A Bearer `POST` without `Origin` is rejected with 403 by `proxy.ts` [VALIDATED 2026-09-17 · V-20]. [NEEDS VALIDATION — not testable locally] whether a mobile client is still maintained. |
| Multi-language support | No i18n |
| Refunds and escrow reversal | No refund code (search for "refund": no results) |
| Subscriptions or paid plans | None |
| Background-check execution, insurance, licence issuance | Documents are stored only |
| Durable job queue or scheduler | `src/lib/background-jobs.ts` runs work in-process, fire-and-forget. No cron. |

### 8.3 Specified in older docs but not implemented (Planned)

Sources: `project-docs/src/routes/docs/Scope_Of_Development_MASTER.md` and `Business_Requirements_Document.md` §8.

| Old ID / scope item | Requirement | Current state | Status |
|---|---|---|---|
| JOB "Upload photos / documents" (CRA/JOB section) | Job attachments when posting | `ClientJobAttachment` model exists and is selected in `getOpenJob`, but no upload endpoint writes it (0 writers found) | Planned / Partial (read-only schema) |
| CDS "Compare profiles" [P2] | Side-by-side profile comparison | No code | Planned |
| HIR "Shortlist professional" [P1] | Shortlist | Only in CMS marketing copy (`src/lib/marketing-cms.ts`) | Planned |
| HIR "Chat before hiring" [P2] | Pre-hire chat | Messaging is blocked without a running project (BR-MSG-01) | Planned |
| PAY "Request refund" [P2] | Refunds | None | Planned |
| VER status "Reviewing" and badges "ID Verified / Skill Verified / Background Checked / Fully Verified" | Multi-badge trust model | Only PENDING/APPROVED/REJECTED and a boolean `isVerified` | Partial |
| MAP "View travel time" | Travel time to job | Distance only (`src/lib/geo.ts` haversine), no travel time | Planned |
| PRI-04 "Contact details released after appointment" | Controlled release of contact details | Messaging opens on hire. [NEEDS VALIDATION — not testable locally] whether phone/email are ever shown to the counterparty. | Unknown |
| CPR-06/07 Billing details and payment method storage [FUTURE] | Stored billing and payment methods | None | Planned |
| ADM-07 Configure commission rate | Admin-configurable fee | Hard-coded 10% + 10% | Planned |
| ADM-05 Suspend or remove a job posting | Job moderation | Admin can set OPEN/CLOSED and delete a job (`app/api/admin/jobs/[id]/route.ts`) | Implemented |
| PNT "New job nearby" | Radius-targeted notification | New-job notifications go to **all** active professionals, not only those nearby (`notifyProfessionalsOfNewJob` → `notifyRole("PROFESSIONAL")`) | Partial |
| NFR-08 Feature parity across web, iOS and Android | Parity | Web only in the working tree | Unknown |
| OI-13 Professionals rate clients | Two-way reviews | Clients rate professionals only | Planned |
| Browser push notifications | Push | `BrowserSubscription` model is unused (0 references). Only in-app, email and socket are used. | Planned |

### 8.4 Implemented but never specified in older docs

| Capability | Evidence |
|---|---|
| Client wallet with Razorpay top-up, and a platform fee on **both** sides (the old docs assumed commission only on the professional side) | `src/lib/wallet-ledger.ts` |
| OFFLINE payment method per job (no platform fees) | `ClientJob.paymentMethod`, `approve-milestone` |
| Admin approval gate for milestone payouts | `app/api/admin/finance/milestone-payout/route.ts` |
| Client-initiated hire requests (`origin = CLIENT_HIRE`) and two-way counter-offers | `app/api/client/project-requests/route.ts`, `ProjectNegotiation` |
| Two-step completion (client requests, professional confirms) | `project-actions` |
| Persona KYC integration | `src/lib/persona.ts` |
| Google OAuth, phone+password login | `app/api/auth/[action]/route.ts` |
| File-based CMS for marketing pages | `src/lib/cms-file.ts`, `marketing-cms.ts`, `app/api/admin/cms/route.ts` |
| Admin-managed service catalogue with segments (RESIDENTIAL / COMMERCIAL / INDUSTRIAL) and a parent/child hierarchy | `app/api/admin/services/route.ts`, `ServiceCategory` |
| PDF reports and invoices | `src/lib/reports/pdf/*` |
| Realtime updates over Socket.IO | `server.mjs`, `src/lib/realtime.ts` |
| Withdrawals for **clients** (not only professionals) | `POST /api/wallet` |
| Professional-to-client "request client" nudges, and professional review responses | `request-client`, `respond-to-review` |
| Admin FAQ and contact-request management | `app/api/admin/support/route.ts`, `app/api/contact/route.ts` |

---

## 9. Assumptions, dependencies and constraints (verified)

| ID | Type | Statement | Evidence |
|---|---|---|---|
| D-01 | Dependency | Google Maps key for maps, geocoding and address picking | `src/components/GoogleMapsProvider.tsx`, `app/api/geocode/route.ts` |
| D-02 | Dependency | Razorpay keys. `RAZORPAY_ENABLED` defaults to enabled, and funding returns 503 if the keys are missing. | `src/lib/razorpay.ts` |
| D-03 | Dependency | At least one ADMIN user must exist for wallet settlement | `src/lib/wallet-ledger.ts` |
| D-04 | Dependency | SMTP for email verification. Without it, email/password users cannot verify and so cannot log in. | `src/lib/email.ts`, BR-ACC-04 |
| D-05 | Dependency | A persistent Node process for Socket.IO (`server.mjs`) | See [deployment.md](../08-operations/deployment.md). The Vercel hints conflict with this [NEEDS VALIDATION — not testable locally]. |
| C-01 | Constraint | CMS content is written to the local filesystem (`data/*.json`). It will not persist on read-only or ephemeral hosts. Pages prerendered as static (e.g. `/pricing`, `/how-it-works`) do not show saved edits until the next build [FOUND IN VALIDATION 2026-09-17 · V-03b]. | `src/lib/cms-file.ts:119` `writeFile` |
| A-01 | Assumption | English-only, INR-only launch | §5 |

---

## 10. Business-level discrepancies and risks found

Runtime evidence for rows tagged `V-xx`: [LOCAL_VALIDATION_LOG](../validation/LOCAL_VALIDATION_LOG.md).

| Severity | Finding | Evidence | Business impact |
|---|---|---|---|
| High | `proxy.ts` rejects every POST/PUT/PATCH/DELETE to `/api/*` that has no matching `Origin` header. Server-to-server webhooks (Razorpay, Persona) normally send no `Origin`, so they would receive 403 before reaching their handlers. The same applies to native mobile clients using Bearer tokens. | `proxy.ts:4-14,45-47`; `app/api/webhooks/*` | Webhook-based wallet crediting and Persona status updates may never run. Wallet top-ups then depend only on the browser `verify` call. Locally: Razorpay and Persona webhook POSTs without `Origin` → 403 "Request origin is not allowed.", Bearer POST without `Origin` → 403; even a genuine same-origin request to `127.0.0.1` was rejected — only the exact `APP_URL` origin passes [PARTIALLY VALIDATED 2026-09-17 · V-20]. Live provider delivery: [NEEDS VALIDATION — not testable locally]. |
| Critical | Concurrent `POST /api/wallet/deposit/verify` calls for one top-up can credit the wallet several times (one ₹5,000 top-up credited ₹20,000 and ₹25,000 with 20 concurrent calls) | `app/api/wallet/deposit/verify/route.ts`, `src/lib/wallet-ledger.ts` | Direct money loss; reproducible from the browser without webhooks [FOUND IN VALIDATION 2026-09-17 · V-41] |
| High | A funded milestone can be lowered after the client paid. The admin payout then uses the new amount (client charged ₹2,200, `Payment.proPayout` ₹1,800, professional paid ₹450) | `project-actions` `update-milestone`; `milestone-payout` route (`baseAmount: milestone.amount`) | Professional underpaid; platform keeps the difference; ledger disagrees with `Payment` [FOUND IN VALIDATION 2026-09-17 · V-42] |
| High | Password-reset links are built from `X-Forwarded-Host`/`Host` (a forged header produced a reset link to an attacker domain), and login rate limits are keyed on the spoofable `X-Forwarded-For` (rotating it is never limited) | `app/api/auth/[action]/route.ts`, `src/lib/rate-limit.ts` | Account takeover and brute-force risk unless a trusted proxy normalises headers [FOUND IN VALIDATION 2026-09-17 · V-25, V-26] |
| High | The pricing page advertises "Free for clients" and "Starter / Pro / Business" plans, but the code charges clients a 10% fee on WALLET milestones and has no plans | `data/cms-marketing.json` (`pricing`), `src/lib/wallet-ledger.ts:5` | Misleading public pricing; possible consumer-protection exposure |
| Medium | `Payment.commissionAmount` stores only the professional commission (base − payout), while `Invoice.commissionAmount` stores the combined platform take (`adminNetAmount`). The same label means different values. | `app/api/wallet/milestone/route.ts:73,105` | Inconsistent finance reporting and invoices |
| Medium | The platform wallet is whichever ADMIN `findFirst` returns | `src/lib/wallet-ledger.ts:116,150` | Platform funds can be split across admin accounts |
| Medium | A manually completed withdrawal decrements `Wallet.balance` without writing a `WalletTransaction` | `app/api/admin/finance/withdrawals/[id]/route.ts:37-70` | The ledger does not reconcile with balances |
| Medium | The Razorpay Route payout path requires a COMPLETED `Payment` with `razorpayPaymentId`. The current milestone flow creates `provider: "wallet"` payments without one, and the per-milestone Razorpay endpoints return 410, so the path is effectively unusable with new data. The transfer is also executed before the DB transaction, so a later DB failure marks it FAILED even though money moved. | `app/api/admin/finance/payouts/route.ts:39-47,58-104` | Automated payouts are not operable; risk of double payout |
| Medium | Milestone amounts are copied from the job, computed from `budgetMax` at posting, not from the agreed bid. `bid × pct` is used only when the job milestone amount is null. Observed: agreed bid ₹1,400 → milestone ₹2,000 (= budgetMax) [VALIDATED 2026-09-17 · V-44]. | `src/lib/project-request-actions.ts:129-131`; `app/api/client/jobs/route.ts:210-216` | Milestone totals can differ from the agreed price |
| Medium | New-job notifications go to every active professional (and new professionals are announced to every client) instead of nearby or relevant users | `src/lib/marketplace-notifications.ts` `notifyRole` | Notification spam and email cost that grows with the user base |
| Medium | Jobs with a future `jobDate` never trigger new-job notifications when they go live (no scheduler). Jobs published from a draft via `PATCH` never notify either [FOUND IN VALIDATION 2026-09-17 · V-46] | `app/api/client/jobs/route.ts:234`; `app/api/client/jobs/[id]/route.ts`; no cron | Scheduled and draft-first jobs get less reach |
| Low | The public job detail reports `proposalCount` as the favourites count | `src/lib/queries/marketplace.ts` `getOpenJob` (`proposalCount: job._count.favoriteJobs`) | Wrong social-proof number |
| Low | Admin-managed FAQs (`Faq` table) are not shown on the public FAQ page, which renders file-CMS content. `src/lib/queries/faq.ts` is not imported anywhere. | `app/api/admin/support/route.ts`; `src/routes/faq.tsx` | Admin edits have no public effect |
| Low | A client can submit a review and request completion at any project status. The server does not require completion first; only the UI gates it. Observed on a READY_TO_START project with no work: `complete-project` → 200 (AWAITING_PROFESSIONAL_CONFIRMATION), `submit-review` → 200 [VALIDATED 2026-09-17 · V-34b/c]. | `app/api/portal/project-actions/route.ts` `submit-review`, `complete-project` | Reviews before delivery are possible through the API |
| Low | Auto-rejected competing proposals are not notified when another request is accepted | `src/lib/project-request-actions.ts:107-110` | Professionals are not told they lost the job |
| Low | The verification-approved realtime notification links to `/professional/profile`, which is not a page route (pages: `/professional-profile`, `/verification`) | `app/api/admin/verifications/route.ts` | Broken link in the notification |

The consolidated list is kept in [known-issues-and-tech-debt.md](../07-development/known-issues-and-tech-debt.md).

---

## 11. Relationship to existing documentation

| Existing file | Assessment | Reason |
|---|---|---|
| `project-docs/src/routes/docs/Business_Requirements_Document.md` (v0.1 draft, 09 Aug 2026) | **Outdated / partially accurate** | It assumes Phase-1 off-platform payments, three platforms, professional-only commission, no CMS, and a single-sided proposal flow. The code implements wallet payments with two-sided 10% fees, a CMS, client hire requests and counter-offers. Its objectives, stakeholders and privacy rules are still valid. |
| `project-docs/src/routes/docs/Scope_Of_Development_MASTER.md` | **Outdated as a scope baseline** | Open Decisions 1–5 were effectively resolved in code: payments are in (Decision 1), accept/reject exists (2), counter-offers exist and chat is limited to running projects (3), disputes are admin tickets without financial remedy (4), client notifications exist (5). See §8.3 and §8.4 for the gaps. |
| `project-docs/src/routes/docs/Software_Requirements_Specification.md` | Superseded by [SRS](../02-requirements/SRS.md) | |
| `docs/_archive/2026-09-14-flat-docs/architecture.md`, `docs/_archive/2026-09-14-flat-docs/review-findings.md` (earlier AI session) | Partially accurate | Neither records the webhook-vs-Origin conflict or the fee model. Superseded by this `/docs` set. |
