# Functional Requirements (implementation-derived)

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

This catalogue is written from code. Every FR records the behaviour the repository implements, the actor, a status, and evidence. The traceability matrix (§2) follows each FR from requirement to screen, component, API, service and data model, in line with spec §21.

**Conventions**

- **ID:** `FR-<MOD>-NNN`. MOD codes: AUTH, ACC, CAT, JOB, PROP, PRJ, PAY, DSP, MSG, NOT, VER, SRCH, CMS, RPT, ADM, SYS.
- **Status:** `Implemented` (verified in code) · `Partial` (some behaviour missing or broken) · `Not implemented` (expected by existing docs, schema or UI but absent; listed so gaps stay visible) · `Unknown`.
- **API paths** use the canonical `/api/...` form. The web client usually calls `/api/v1/...`, which `next.config.ts:25` rewrites to the same handler.
- **Actors:** Visitor, Client, Professional, Admin, System (webhook, scheduler or background work).
- Screens are referenced by **route**. SCR ids live in [../06-ui/screen-inventory.md](../06-ui/screen-inventory.md).
- Related docs: [SRS.md](./SRS.md) · [non-functional-requirements.md](./non-functional-requirements.md) · [../05-api/api-specification.md](../05-api/api-specification.md) · [../04-database/data-dictionary.md](../04-database/data-dictionary.md).

**Counts:** 163 FRs. 130 Implemented, 29 Partial, 4 Not implemented (11 FRs moved from Implemented to Partial after runtime validation on 2026-09-17).

---

## 1. Requirements catalogue

### AUTH: Identity and access

| ID | Requirement (as implemented) | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-AUTH-001 | The system shall register a user with firstName, lastName, email, password and role (`CLIENT`/`PROFESSIONAL`), and require `terms: true`. The password must be ≥8 characters with an uppercase letter, a lowercase letter and a digit. Duplicate email or phone returns 409 with a `fields` map. The password is hashed with bcrypt (cost 12). The system creates a 24 h email-verification token (SHA-256 hash stored), queues the verification email and admin/client notifications in the background, and returns `201 {redirect:"/verify"}`. No session is issued [VALIDATED 2026-09-17 · V-22] | Visitor | Implemented | `app/api/auth/[action]/route.ts:30-39,366-445` |
| FR-AUTH-002 | The system shall report whether an email and/or phone is already registered (`{fields}`) | Visitor | Implemented | `route.ts:340-364` |
| FR-AUTH-003 | The system shall verify an email from a single-use token (≥32 characters, unexpired, unused), set `emailVerifiedAt`, create a session cookie, and redirect clients to `/client-profile?profileSetup=1` and professionals to `/professional-home` or `/professional/setup?profileSetup=1` depending on profile completeness | Visitor (link holder) | Implemented | `route.ts:803-844` |
| FR-AUTH-004 | The system shall resend a verification email for the signed-in, still-unverified user (background email) | Client, Professional | Implemented | `route.ts:719-736` |
| FR-AUTH-005 | The system shall let a signed-in user change their email. It checks uniqueness, invalidates outstanding verification tokens, clears `emailVerifiedAt` and sends a new link synchronously | Client, Professional | Implemented | `route.ts:667-717` |
| FR-AUTH-006 | The system shall authenticate by email and password (inactive users rejected with the generic 401). Unverified users get `403 EMAIL_NOT_VERIFIED`. On success it updates `lastLoginAt`, creates a welcome notification on first login, clears the rate-limit key, sets the `servio_session` cookie and returns `{redirect, token, user}` with a role- and profile-aware redirect | Client, Professional, Admin | Partial: unverified → 403 without a cookie [VALIDATED 2026-09-17 · V-22]. An account registered with upper-case letters in its email can never log in (401 as typed and lowercased, even after verification) because login lowercases the input but the stored email keeps its case [FOUND IN VALIDATION 2026-09-17 · V-21] | `route.ts:446-533` |
| FR-AUTH-007 | The system shall support phone login for CLIENT/PROFESSIONAL: request an OTP for an active account (404 if none exists), then verify the code and issue a session. Unverified email returns 403 (no session) [VALIDATED 2026-09-17 · V-22] | Client, Professional | Partial (behaviour depends on the OTP provider): OTP verification always fails (400 "Invalid verification code.") when the DB session time zone is not UTC — raw `"expiresAt" > NOW()`; proven failing on Asia/Calcutta, passing on UTC [FOUND IN VALIDATION 2026-09-17 · V-27] | `route.ts:534-601`, `src/lib/phone-otp-provider.ts` |
| FR-AUTH-008 | The system shall support phone + password login | Client, Professional | Partial: API only, no UI calls it. It sets a valid session cookie even when it returns 403 for an unverified email, and APIs accept that session (`POST /api/client/jobs` → 201) [VALIDATED 2026-09-17 · V-23] | `route.ts:602-653` |
| FR-AUTH-009 | The system shall support Google OAuth 2.0 sign-in and sign-up. It uses a `state` cookie (10 min) and an optional `role`/`next`, requires Google `email_verified`, links by `googleId` or matching email, creates the user (marked email-verified) when missing, notifies admins/clients of new accounts, sets a session and redirects (`next` restricted to same-site paths) | Visitor | Implemented (requires `GOOGLE_CLIENT_ID/SECRET`): start → 307 to Google [VALIDATED 2026-09-17 · V-33]. The `next` guard accepts `/\evil.example`, which resolves to an external URL [PARTIALLY VALIDATED 2026-09-17 · V-24]; `redirect_uri` follows `X-Forwarded-Host` [V-25] | `route.ts:96-227`, `src/routes/login.tsx:270`, `src/routes/signup.tsx:172` |
| FR-AUTH-010 | The system shall sign a user out by revoking the DB session row and clearing the cookie | All signed-in | Implemented (an already-open Socket.IO connection stays connected after logout) [FOUND IN VALIDATION 2026-09-17 · V-28] | `route.ts:654-666`, `src/lib/auth.ts:47-55` |
| FR-AUTH-011 | The system shall start an email password reset. It always returns `{success:true}`, and when the account exists it creates a 1 h `PASSWORD_RESET` token and emails the link in the background | Visitor | Implemented (the link origin comes from `X-Forwarded-Host`/`Host`: a forged header produced a reset link to an attacker domain) [FOUND IN VALIDATION 2026-09-17 · V-25] | `route.ts:737-765` |
| FR-AUTH-012 | The system shall start a phone password reset: send an OTP to an active CLIENT/PRO phone (3 per 10 min), verify it (5 per 10 min), then return a 30-minute reset token in the response body | Visitor | Implemented | `route.ts:766-802` |
| FR-AUTH-013 | The system shall reset the password from a valid unused token, applying the password policy, and revoke **all** of the user's active sessions in the same transaction | Visitor | Implemented | `route.ts:845-878` |
| FR-AUTH-014 | The system shall keep revocable sessions: an HS256 JWT `{userId, role, sessionId}` valid for 7 days in an HttpOnly cookie, plus a `sessions` row. Every verification checks that the row is not revoked or expired and that the user is active, and re-reads `role` and `emailVerifiedAt` from the DB | System | Implemented | `src/lib/auth.ts:12-45,66-72` |
| FR-AUTH-015 | The system shall expose the current user (`GET /api/auth/me`), reading the cookie or `Authorization: Bearer`, and return `{user:null}` when the caller is unauthenticated or inactive | All | Implemented | `app/api/auth/me/route.ts` |
| FR-AUTH-016 | The system shall keep users with unverified email in the verification flow | System | Partial: page redirect to `/verify` in `proxy.ts:87-91` (GET /dashboard → 307 /verify). APIs do not enforce verification, except `POST /api/profile` (`app/api/profile/route.ts:73-77`). `requireVerifiedUser` is unused [VALIDATED 2026-09-17 · V-22, V-23] | `proxy.ts`, `src/lib/auth.ts:61-65` |
| FR-AUTH-017 | The system shall let a signed-in CLIENT/PROFESSIONAL verify a phone number by OTP. It rejects numbers owned by other users (409) and sets `phone` and `phoneVerifiedAt` | Client, Professional | Partial: the correct code is rejected when the DB session time zone is not UTC [FOUND IN VALIDATION 2026-09-17 · V-27]. In development without `DEV_PHONE_OTP` a fixed code is used and logged [V-27] | `route.ts:244-339`, `src/components/PhoneVerification.tsx` |
| FR-AUTH-018 | The system shall require a signed phone-verification proof cookie (10 min) when a phone is supplied at registration | Visitor | Partial: supported by the API (`verify-phone` without a session, then `register`). `src/routes/signup.tsx` never sends `phone` | `route.ts:332-338,378-390`, `src/lib/dev-phone-otp.ts` |
| FR-AUTH-019 | The system shall authenticate administrators by `username` and password (5 attempts per 15 min per IP and username). When no ADMIN exists it creates a bootstrap admin from `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_PASSWORD` (≥12) and `ADMIN_EMAIL` | Admin | Implemented (without `ADMIN_EMAIL` the bootstrap silently does nothing and login returns 401) [VALIDATED 2026-09-17 · V-31] | `app/api/admin/login/route.ts` |
| FR-AUTH-020 | The system shall guard pages. `/admin/*` (except `/admin/login`) requires role ADMIN. Listed portal prefixes require a session. Role layouts redirect wrong roles (client group → `/professional-profile` or `/admin`; professional group → `/dashboard` or `/admin`) | System | Partial: the proxy prefix list is session-only and incomplete (for example `/verification` and `/professional-home` rely on page and layout checks). `app/(portal)/layout.tsx` calls `redirect()` inside `try/catch`, so `/verify` redirects there fall back to `/login` | `proxy.ts:16-37,63-75`, `app/(portal)/layout.tsx`, `app/(portal)/(client)/layout.tsx`, `app/(portal)/professional/layout.tsx` |

### ACC: Accounts and profiles

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-ACC-001 | The system shall let an email-verified client create or update a profile (first and last name, company, address, photo URL, phone with a uniqueness check). It mirrors the data onto `User` and keeps a primary `ClientSavedLocation` ("Primary Address") in one transaction | Client | Implemented (the relative URL returned by avatar upload is rejected as photo URL: 400 "Enter a valid photo URL.") [FOUND IN VALIDATION 2026-09-17 · V-40] | `app/api/profile/route.ts:69-158` |
| FR-ACC-002 | The system shall return the client's account and profile, including saved locations | Client | Partial: the 1:1-typed relation returns a single arbitrary (possibly non-primary) location object instead of the list [FOUND IN VALIDATION 2026-09-17 · V-05] | `app/api/profile/route.ts:47-67` |
| FR-ACC-003 | The system shall list saved locations (primary first) and create new ones, up to **3** per profile. The first location becomes primary. A profile is required (409 otherwise) | Client | Implemented | `app/api/profile/locations/route.ts` |
| FR-ACC-004 | The system shall update a saved location owned by the client. Setting it primary demotes the others and syncs `ClientProfile.address` | Client | Implemented | `app/api/profile/locations/[id]/route.ts:21-44` |
| FR-ACC-005 | The system shall delete an owned saved location and promote the oldest remaining location to primary when needed | Client | Implemented | `app/api/profile/locations/[id]/route.ts:46-68` |
| FR-ACC-006 | The system shall upload a profile image (JPEG/PNG/WebP by MIME type, ≤5 MB) to storage under `avatars/<userId>/`, set `User.avatarUrl` (and the client `profilePhotoUrl`) and serve it | Client, Professional | Partial: `GET /api/profile/avatar` serves only the caller's **own** avatar keys (`route.ts:67-69`), so counterparties and admins cannot load other users' uploaded avatars (other user 404, admin 404, anonymous 401) [VALIDATED 2026-09-17 · V-40]. No magic-byte check | `app/api/profile/avatar/route.ts` |
| FR-ACC-007 | The system shall show a client "My info" summary (account, profile, up to 3 locations, open/draft/closed job counts) and a client verification-status view (email and phone verified timestamps) | Client | Implemented | `app/my-info/page.tsx`, `src/lib/services/client-account-service.ts`, `app/api/client/verification/route.ts`. `GET /api/client/account` duplicates the summary and has no UI caller |
| FR-ACC-008 | The system shall let a professional complete a service profile: a valid category (by id or name), experience 0–80, hourly rate, service radius 1–500 km, state (required), district/city/address, **required** latitude and longitude, work mode `on_site/remote/both`, bio ≤2000, ≤20 skills | Professional | Implemented | `app/api/professional/profile/route.ts:6-126`, `src/components/ProfessionalProfileSetup.tsx` |
| FR-ACC-009 | The system shall render the signed-in professional's own detailed profile page | Professional | Implemented | `app/(portal)/professional-profile/page.tsx:160-169`, `src/lib/queries/marketplace.ts:401` |
| FR-ACC-010 | The system shall store or clear a professional's Razorpay Route linked account id (format `acc_…`) | Professional | Implemented | `app/api/professional/razorpay-account/route.ts` |
| FR-ACC-011 | The system shall honour a per-user email notification opt-out | Client, Professional | Partial: `emailNotificationsEnabled` is respected when sending (`src/lib/marketplace-notifications.ts:29`), but no API or UI changes it | `src/lib/marketplace-notifications.ts` |

### CAT: Service catalogue

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-CAT-001 | The system shall render a public services catalogue from the DB category hierarchy (segment → parent → subcategory) | Visitor | Implemented | `src/routes/services.tsx`, `src/lib/queries/categories-hierarchy.ts:65` |
| FR-CAT-002 | The system shall list categories with professional counts for pickers and filters | All | Implemented | `GET /api/marketplace/categories` → `listCategories` (`src/lib/queries/marketplace.ts:189`) |
| FR-CAT-003 | The system shall list all categories for admins, with job counts by category name, and show a category's direct children and their jobs | Admin | Implemented | `app/api/admin/services/route.ts:29-72` |
| FR-CAT-004 | The system shall create a category or subcategory (name 2–80, description ≤300, icon, segment `RESIDENTIAL/COMMERCIAL/INDUSTRIAL`). The slug is unique (409 on conflict). A child inherits the parent's segment | Admin | Implemented | `route.ts:74-102` |
| FR-CAT-005 | The system shall rename a category and edit its description | Admin | Implemented | `route.ts:104-120` |
| FR-CAT-006 | The system shall delete a category | Admin | Partial: hard delete. Errors are swallowed and the response is always `{ok:true}`. Jobs reference categories by **name string**, so renames and deletes silently orphan them | `route.ts:122-130` |

### JOB: Jobs

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-JOB-001 | The system shall create a job in `mode: draft` (lenient) or `publish`. Publish validation requires: title, a category that exists by name, description, deadline, and location with coordinates unless REMOTE; a budget range (FIXED) or hourly rate (HOURLY); min ≤ max; deadline ≥ jobDate; milestone percentages ≤100% with titles (sum > 100 → 400; sum < 100 accepted) [VALIDATED 2026-09-17 · V-48]. Status becomes `OPEN` or `DRAFT` | Client | Implemented | `app/api/client/jobs/route.ts:26-47,90-127,183-249` |
| FR-JOB-002 | The system shall attach a milestone plan to each job. With no milestones supplied it creates "Project Completion" at 100%. Amounts are `round(budgetMax∥budgetMin × %/100)` | Client, System | Implemented | `route.ts:200-217`, `app/api/client/jobs/[id]/route.ts:288-321` |
| FR-JOB-003 | The system shall notify **all** active professionals and all admins (in-app, realtime, email) when a job is published and is not scheduled for the future | System | Partial (no geo or category targeting): only `POST` publish notifies (+15 rows); publishing a draft via `PATCH /api/client/jobs/[id]` sends none [FOUND IN VALIDATION 2026-09-17 · V-46] | `route.ts:234-240`, `src/lib/marketplace-notifications.ts:213-260` |
| FR-JOB-004 | The system shall list the client's jobs with derived status (`RUNNING` when a non-completed project exists), `projectId` and proposal count | Client | Implemented | `app/api/client/jobs/route.ts:129-181` |
| FR-JOB-005 | The system shall return an owned job with attachments, milestones, category parent and segment, project id, proposals (with the previous negotiated terms and `lastActorRole`) and hire requests with professional summaries | Client | Implemented | `app/api/client/jobs/[id]/route.ts:127-246` |
| FR-JOB-006 | The system shall edit an owned, non-closed job (full replace through `mode`) and replace its milestone plan | Client | Implemented | `route.ts:247-340` |
| FR-JOB-007 | The system shall close or reopen an owned job with a status-only PATCH that leaves other fields untouched | Client | Implemented | `route.ts:257-273`, `src/routes/job.$jobId.tsx:1346,1372` |
| FR-JOB-008 | The system shall delete an owned job only while it is `DRAFT` (409 otherwise) | Client | Implemented | `route.ts:341-362` |
| FR-JOB-009 | The system shall treat an `OPEN` job with a future `jobDate` as scheduled: it is hidden from professional feeds, public lists, search and proposals until the date | System | Partial: visibility filters exist. No scheduler sends the "new job" notification when a scheduled job goes live | `app/api/client/jobs/route.ts:234`, `app/api/portal/[resource]/route.ts:451-455`, `app/api/professional/proposals/route.ts:70-79` |
| FR-JOB-010 | The system shall show a client dashboard: 4 latest jobs, project summary (total/open/running/drafts), 4 latest proposals and hire requests with professional names, notifications, and this month's completed spend | Client | Implemented | `app/api/dashboard/route.ts`, `src/routes/client/dashboard.tsx` |
| FR-JOB-011 | The system shall list all jobs for admins with derived status (RUNNING/COMPLETED), the latest 50 disputes and stats (total/open/scheduled) | Admin | Implemented (unpaginated) | `app/api/admin/data/[resource]/route.ts:99-129` |
| FR-JOB-012 | The system shall show an admin job detail: client, attachments, favourites count, proposals with professionals, project with milestones and financials | Admin | Implemented | `app/api/admin/jobs/[id]/route.ts:60-180` |
| FR-JOB-013 | The system shall let an admin set a job's status to `OPEN` or `CLOSED` | Admin | Implemented | `route.ts:16-37` |
| FR-JOB-014 | The system shall let an admin hard-delete a job (500 when related records block it) | Admin | Implemented | `route.ts:39-58` |

### PROP: Proposals, hiring and job feed

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-PROP-001 | The system shall accept a proposal on an `OPEN`, started, non-expired job that the professional does not own: bid 1–10,000,000, duration 2–100 characters, cover letter 10–5000. An existing pending proposal is **updated in place**. The client is notified (in-app, email, realtime `proposal:new`) and admins are notified in the background | Professional | Implemented | `app/api/professional/proposals/route.ts:55-172` |
| FR-PROP-002 | The system shall return the professional's latest proposal for a job with `lastActorRole` and the latest negotiation | Professional | Implemented | `route.ts:17-53` |
| FR-PROP-003 | The system shall let a client send a hire request (`origin CLIENT_HIRE`) to a professional for the client's own `OPEN` job. The bid must be within the job budget range for fixed-budget jobs, otherwise ≤10,000,000. Duplicate pending requests return 409. The professional is notified | Client | Implemented | `app/api/client/project-requests/route.ts` |
| FR-PROP-004 | The system shall let either party accept, reject or counter a pending request that belongs to them. A counter requires price, timeline and message, and stores the previous terms in `ProjectNegotiation`. The other party is notified | Client, Professional | Partial: turn-taking (`lastActorRole`) is informational only. A party can accept its own counter-offer [VALIDATED 2026-09-17 · V-44]. The accept sequence is not a single DB transaction | `src/lib/project-request-actions.ts:15-169`, `app/api/client/project-requests/[id]/route.ts`, `app/api/professional/project-requests/[id]/route.ts` |
| FR-PROP-005 | On acceptance, the system shall close the job (conditional update, 409 if no longer OPEN), mark the request ACCEPTED, reject other pending requests, create `ProjectTracking` (`READY_TO_START`), copy the job milestone plan into `ProjectMilestone` (`UPCOMING`), write a timeline event, notify the other party and emit `proposal:new` and `project:updated` | System | Implemented (copied milestone amounts derive from `budgetMax`, not the accepted bid: bid 1,400 → milestone 2,000) [VALIDATED 2026-09-17 · V-44] | `src/lib/project-request-actions.ts:96-168` |
| FR-PROP-006 | The system shall give a professional a job feed: open, started, unexpired jobs not blocked by running projects or accepted requests, within the service radius (bounding box plus Haversine) or REMOTE/BOTH. It also returns saved jobs, proposals, offers, active projects (revision-requested first) and completed projects with earnings. Addresses are approximated and coordinates obfuscated | Professional | Implemented | `app/api/portal/[resource]/route.ts:377-797` |
| FR-PROP-007 | The system shall let a professional save or unsave an open job (favourites) | Professional | Implemented | `app/api/professional/favorite-jobs/[jobId]/route.ts` |
| FR-PROP-008 | The system shall let a professional withdraw a proposal | Professional | Not implemented (no endpoint; only reject by the client) | none |

### PRJ: Project delivery and reviews

All actions go through `POST /api/portal/project-actions` (discriminated `action`) unless stated. Role gating: client actions = create/update/delete milestone(s), start-work, request-revision, approve-milestone, complete-project. Shared = submit-review, submit-dispute. Everything else = professional (`app/api/portal/project-actions/route.ts:119-160`). The project must belong to the caller.

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-PRJ-001 | The system shall show a project to its client, its professional, or any admin: milestones with payment status, job details (including **exact** coordinates), parties, uploads, revisions, timeline, agreed amount, review and latest dispute | Client, Professional, Admin | Implemented | `app/api/portal/[resource]/route.ts:798-920` |
| FR-PRJ-002 | The system shall let the client start a `READY_TO_START` project (→ `IN_PROGRESS`, first `UPCOMING` milestone → `IN_PROGRESS`) | Client | Implemented | `project-actions/route.ts:247-280` |
| FR-PRJ-003 | The system shall let the client add one or many milestones. The total must not exceed max(agreed bid, existing total). Due dates must fall within the job date and deadline. A new milestone becomes `IN_PROGRESS` when none is active | Client | Implemented | `route.ts:293-414` |
| FR-PRJ-004 | The system shall let the client edit a non-approved milestone (title, amount, description) within the agreed bid | Client | Partial: increases above the agreed total → 400, but a **funded** milestone can be lowered (200) and the admin payout then uses the lowered amount [FOUND IN VALIDATION 2026-09-17 · V-42] | `route.ts:415-466` |
| FR-PRJ-005 | The system shall let the client delete a milestone unless it is `APPROVED` or `AWAITING_CLIENT_REVIEW` | Client | Implemented (a funded milestone returns 500, blocked only by the FK) [VALIDATED 2026-09-17 · V-42] | `route.ts:467-484` |
| FR-PRJ-006 | The system shall accept 1–10 project files (≤15 MB each; pdf/png/jpg/webp/doc/docx/txt; MIME and magic-byte checks) from the project's professional while the project is `READY_TO_START`/`IN_PROGRESS`/`REVISION_REQUESTED`, store them privately and create `StoredFile` rows (rolled back on failure) | Professional | Implemented | `app/api/portal/project-files/route.ts`, `src/lib/project-file-storage.ts:146-156` |
| FR-PRJ-007 | The system shall stream a project file to the project's client or professional (`Cache-Control: private, no-store`, `nosniff`) | Client, Professional | Implemented (admins are not allowed) | `app/api/portal/project-files/[fileId]/route.ts` |
| FR-PRJ-008 | The system shall record a work upload (title, note, uploaded files owned by the caller) while the project is `IN_PROGRESS`/`REVISION_REQUESTED`. The round number becomes 2 during revision | Professional | Implemented | `project-actions/route.ts:485-519` |
| FR-PRJ-009 | The system shall let the professional submit an `IN_PROGRESS`/`REVISION_REQUESTED` milestone with a note and attachments (→ milestone and project `AWAITING_CLIENT_REVIEW`) | Professional | Implemented | `route.ts:520-567` |
| FR-PRJ-010 | The system shall let the client request a revision on a milestone awaiting review (→ `REVISION_REQUESTED`, `ProjectRevisionRequest` row) | Client | Implemented | `route.ts:568-596` |
| FR-PRJ-011 | The system shall let the professional set progress 0–100% and a stage label | Professional | Partial: it forces the project to `IN_PROGRESS` from any status (COMPLETED → IN_PROGRESS observed) [FOUND IN VALIDATION 2026-09-17 · V-43] | `route.ts:281-292` |
| FR-PRJ-012 | The system shall let the professional submit final work once **all** milestones are `APPROVED` (→ `FINAL_WORK_SUBMITTED`) | Professional | Implemented | `route.ts:724-755` |
| FR-PRJ-013 | The system shall let the professional send a free-text request to the client (timeline and notification) | Professional | Implemented | `route.ts:756-764` |
| FR-PRJ-014 | The system shall let the client request completion (→ `AWAITING_PROFESSIONAL_CONFIRMATION`) | Client | Partial: no precondition that final work was submitted or milestones approved. Allowed from any status except COMPLETED/AWAITING (200 from READY_TO_START) [VALIDATED 2026-09-17 · V-34b] | `route.ts:765-795` |
| FR-PRJ-015 | The system shall let the professional confirm completion (→ `COMPLETED`, progress 100, `completedAt`, job `CLOSED`) | Professional | Implemented | `route.ts:796-831` |
| FR-PRJ-016 | For every project action, the system shall write a `ProjectTimelineEvent`, notify the counterparty (in-app and email with project details) and emit `project:updated` to both parties | System | Implemented | `route.ts:161-226`, `src/lib/marketplace-notifications.ts:275-304` |
| FR-PRJ-017 | The system shall list a professional's running projects with milestone-derived progress | Professional | Implemented | `src/routes/professional/running-projects.tsx` → `GET /api/portal/professional-jobs` |
| FR-PRJ-018 | The system shall let the client submit or update a 1–5 rating with an optional comment (≤2000) for a project, and recompute the professional's `averageRating` (1 decimal place) and `reviewCount` | Client | Implemented (no completion precondition: 200 on an unfinished project) [VALIDATED 2026-09-17 · V-34c] | `route.ts:832-873` |
| FR-PRJ-019 | The system shall let the professional respond to the client review | Professional | Implemented | `route.ts:874-888` |
| FR-PRJ-020 | The system shall list reviews a professional has received, with client name and project | Professional | Implemented | `app/api/portal/[resource]/route.ts:342-376` |

### PAY: Payments, wallet, payouts, invoices

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-PAY-001 | The system shall show the caller's wallet (created on demand): balance, last 50 transactions, earned total (`MILESTONE_EARNING`), commission total, available = balance − reserved, reserved (`pendingBalance`) and the last 10 withdrawals | Client, Professional | Implemented | `app/api/wallet/route.ts:17-54` |
| FR-PAY-002 | The system shall create a Razorpay order for a client wallet top-up (integer INR 1–1,000,000) and a `PENDING` `WALLET_TOP_UP` transaction keyed by the order id | Client | Implemented (503 if Razorpay is not configured) | `app/api/wallet/deposit/order/route.ts` |
| FR-PAY-003 | The system shall verify the Razorpay checkout signature and credit the wallet exactly once (the pending transaction must match the caller's wallet) | Client | Partial: sequential repeats return `alreadyProcessed`, but concurrent verify calls credit the same top-up several times (one ₹5,000 top-up credited ₹20,000 and ₹25,000 with 20 concurrent calls; losers get 500) [CORRECTED 2026-09-17 · V-41] | `app/api/wallet/deposit/verify/route.ts`, `src/lib/wallet-ledger.ts:83-104` |
| FR-PAY-004 | The system shall mark a pending top-up as `FAILED` with a reason when checkout is cancelled | Client | Implemented | `app/api/wallet/deposit/fail/route.ts` |
| FR-PAY-005 | The system shall process Razorpay webhooks idempotently: HMAC check; event persisted as `RECEIVED`; claimed as `PROCESSING` (stale after 5 min); `payment.captured`/`payment.failed` applied to the `Payment` or wallet top-up after amount and currency checks; `PROCESSED`, or `FAILED` with `lastError` | System | Partial: handler complete, but `proxy.ts` returns 403 for POSTs without an allowed `Origin`, which webhook deliveries normally lack (locally: no `Origin` → 403; `APP_URL` Origin → handler reached, 401 on bad signature) [PARTIALLY VALIDATED 2026-09-17 · V-20]. Live Razorpay delivery `[NEEDS VALIDATION — not testable locally]` | `app/api/webhooks/razorpay/route.ts`, `proxy.ts:4-14,44-46` |
| FR-PAY-006 | The system shall let the client pay a milestone awaiting review from the wallet in one transaction: claim → `PAYMENT_PROCESSING`; `Payment` upsert (idempotency key `wallet-milestone-<id>`); debit client `base + ceil(10%)`; credit the admin wallet; `Payment FUNDED`; `Invoice` upsert; milestone → `AWAITING_ADMIN_APPROVAL`; `ProjectTransaction PENDING_ADMIN_PAYOUT`. Insufficient balance returns 402 | Client | Implemented | `app/api/wallet/milestone/route.ts`, `src/lib/wallet-ledger.ts:8-20,106-138` |
| FR-PAY-007 | For jobs with `paymentMethod = OFFLINE`, the system shall let the client approve a milestone awaiting review. This records a `COMPLETED` offline `Payment` with no fees, marks the milestone `APPROVED`, writes an `OFFLINE_MILESTONE_PAYMENT` transaction and activates the next milestone. WALLET jobs get 402 `paymentRequired` | Client | Implemented | `app/api/portal/project-actions/route.ts:597-723`, `app/project/[projectId]/tracking/page.tsx:392-399` |
| FR-PAY-008 | The system shall let an admin approve a funded milestone payout: claim `PAYOUT_PROCESSING`; debit the admin wallet by the payout (`base − ceil(10%)`); credit the professional wallet (`MILESTONE_EARNING`); `Payment COMPLETED`; milestone `APPROVED`; transaction `COMPLETED`; next `UPCOMING` milestone → `IN_PROGRESS`; notify the parties | Admin | Partial: Payment COMPLETED confirmed [VALIDATED 2026-09-17 · V-45]; the payout base is the milestone's **current** amount, not the funded `Payment` (client charged 2,200, `Payment.proPayout` 1,800, professional paid 450 after the milestone was lowered) [FOUND IN VALIDATION 2026-09-17 · V-42] | `app/api/admin/finance/milestone-payout/route.ts`, `src/lib/wallet-ledger.ts:140-172` |
| FR-PAY-009 | The system shall let a professional **or client** request a withdrawal (amount, destination BANK/CARD/UPI with a label). It atomically reserves `pendingBalance` when available funds suffice and creates a `PENDING` `ProjectWithdrawal` | Client, Professional | Implemented | `app/api/wallet/route.ts:55-101` |
| FR-PAY-010 | The system shall let an admin settle a pending withdrawal as `COMPLETED` (debit balance and reservation) or `FAILED` (release reservation, reason) | Admin | Partial: bookkeeping only. No money is moved to a bank. Client withdrawals are stored in `professionalId` | `app/api/admin/finance/withdrawals/[id]/route.ts` |
| FR-PAY-011 | The system shall pay a withdrawal through a Razorpay Route transfer from a captured payment to the professional's linked account | Admin | Partial: API only (`POST /api/admin/finance/payouts`). No UI caller. Requires `RAZORPAY_ROUTE_ENABLED=true` (otherwise 503 "Razorpay Route payouts are not enabled.") [VALIDATED 2026-09-17 · V-47] | `app/api/admin/finance/payouts/route.ts` |
| FR-PAY-012 | The system shall list the caller's last 50 project transactions (professional or client side) with the linked completed `invoicePaymentId` | Client, Professional | Implemented | `app/api/portal/[resource]/route.ts:299-332` |
| FR-PAY-013 | The system shall return payment details (amount breakdown, provider refs, status) to the payment's client, professional or an admin | Client, Professional, Admin | Implemented | `app/api/portal/payment-details/[paymentId]/route.ts` |
| FR-PAY-014 | The system shall generate an invoice PDF for a **completed** payment (upserting `Invoice` `INV-<year>-<000id>`) for its parties or an admin | Client, Professional, Admin | Implemented (200 `application/pdf` after payout) [VALIDATED 2026-09-17 · V-45] | `app/api/portal/invoices/[paymentId]/route.tsx`, `src/lib/reports/pdf/InvoiceDocument.tsx` |
| FR-PAY-015 | The system shall give admins a finance overview: last 100 project transactions and withdrawals; last 200 payments enriched with job, milestone progress and fee breakdown; last 100 wallet top-ups; the aggregated platform wallet (all ADMIN wallets) with received, paid-out and retained totals; user lookup maps | Admin | Implemented | `app/api/admin/data/[resource]/route.ts:130-389` |
| FR-PAY-016 | The system shall reject the legacy direct Razorpay milestone order and verify endpoints with 410 so they cannot bypass the wallet flow | System | Implemented (deprecated stubs) | `app/api/payments/razorpay/order/route.ts`, `verify/route.ts` |
| FR-PAY-017 | The system shall expose the public Razorpay checkout configuration (`enabled`, `keyId`, `INR`) | All | Implemented (no UI caller found) | `app/api/payments/razorpay/config/route.ts` |

### DSP: Disputes

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-DSP-001 | The system shall let the client or professional raise a dispute (issue type, priority LOW/MEDIUM/HIGH, message 10–4000) on a project in an allowed status, one `OPEN` dispute per project. It records a timeline event and notifies admins and the parties in the background | Client, Professional | Implemented | `app/api/portal/project-actions/route.ts:889-958`, `src/lib/marketplace-notifications.ts:306-335` |
| FR-DSP-002 | The system shall show admins a dispute with its messages, client, professional, job, project, milestones, milestone summary and financials (milestone total, paid, remaining, unpaid approved) | Admin | Implemented | `app/api/admin/disputes/[id]/route.ts:55-138` |
| FR-DSP-003 | The system shall let admins set a dispute to `OPEN` or `RESOLVED` and notify both parties | Admin | Implemented | `route.ts:17-53` |
| FR-DSP-004 | The system shall let admins send a dispute message (2–4000 characters) to either the client or the professional, with a notification | Admin | Implemented | `app/api/admin/disputes/[id]/messages/route.ts` |
| FR-DSP-005 | The system shall let parties reply in the dispute thread | Client, Professional | Not implemented (no party-side dispute message API) | none |

### MSG: Messaging

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-MSG-001 | The system shall list messaging contacts. Non-admins see counterparts from their projects, existing conversation partners and admins who messaged them. Admins see all users. Each contact has its conversation, last message, unread count, project list with milestone progress and active project | All signed-in | Implemented | `app/api/v1/messages/route.ts:27-207` |
| FR-MSG-002 | The system shall load a conversation (last 100 messages) for its two participants or any admin | All signed-in | Implemented | `route.ts:31-46` |
| FR-MSG-003 | The system shall send a text message. Between non-admins it requires a non-completed project linking the pair (403 otherwise). Admins can message any non-admin. Non-admins can message admins. The system creates the conversation if missing, stores the message, notifies the recipient and emits `message:new` to both users | All signed-in | Implemented (no length limit) | `route.ts:275-377` |
| FR-MSG-004 | The system shall mark one conversation or all of the caller's messages as read and emit `message:read` to the senders | All signed-in | Implemented | `route.ts:209-273` |
| FR-MSG-005 | Legacy messages list (`MessageConversation`) at `GET /api/portal/messages` | Client, Professional | Not implemented (dead code): its only consumer `src/routes/messages.tsx` is not imported by any page | `app/api/portal/[resource]/route.ts:333-341` |

### NOT: Notifications

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-NOT-001 | The system shall list the caller's non-cleared notifications (excluding `PROPOSAL_SENT`, `PROPOSAL_UPDATE_SENT` and `HIRE_REQUEST_SENT`), enriched with derived `projectId`, `jobId`, project title, client and professional names | All signed-in | Implemented (unpaginated) | `app/api/portal/[resource]/route.ts:40-298` |
| FR-NOT-002 | The system shall mark notifications read or unread by id, ids (≤100) or all | All signed-in | Implemented | `route.ts:928-975` |
| FR-NOT-003 | The system shall clear (soft-delete through `clearedAt`) notifications by id, ids or all | All signed-in | Implemented | `route.ts:976-1010` |
| FR-NOT-004 | The system shall push realtime events (`notification:new`, `message:new`, `project:updated`, `proposal:new`) to user rooms. Portal screens refresh or toast on receipt | System | Implemented | `src/lib/realtime.ts`, `src/components/RealtimeNotifications.tsx:130-133`, dashboards |
| FR-NOT-005 | The system shall email notifications (branded HTML and text, detail table, absolute link from `APP_URL`) to active recipients with `emailNotificationsEnabled`. Email failures are logged, not thrown | System | Implemented (requires SMTP) | `src/lib/marketplace-notifications.ts:23-46`, `src/lib/email.ts:134-186` |
| FR-NOT-006 | The system shall broadcast by role: new account → admins; new professional → all clients; new job → all professionals and admins; new proposal → admins; milestone funded or payout → admins | System | Implemented | `src/lib/marketplace-notifications.ts:95-273,371-423` |
| FR-NOT-007 | The system shall show admin sidebar badges (unread new-account notifications, pending verifications and open disputes since last seen, unread notifications and messages) and mark a section as seen (updates notifications and sets the `servio_admin_seen_*` cookies) | Admin | Implemented | `app/api/admin/sidebar-counts/route.ts`, `src/components/AdminSidebar.tsx` |
| FR-NOT-008 | The system shall give admins a notification centre with read, unread, clear and project drill-down | Admin | Implemented | `app/admin/notifications/page.tsx`, `src/components/AdminNotificationCenter.tsx` |
| FR-NOT-009 | The system shall deliver browser or device push notifications | Client, Professional | Not implemented (`BrowserSubscription` model unused) | `prisma/schema.prisma:990` |

### VER: Professional verification and KYC

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-VER-001 | The system shall accept a verification document upload (JPG/PNG/WEBP/PDF, ≤10 MB, MIME and magic-byte validated), store it under `verification/<userId>/<uuid>`, write an audit entry and return an API URL | Professional | Implemented | `app/api/professional/verification/upload/route.ts` |
| FR-VER-002 | The system shall save the professional's verification record (government ID, licence, certifications JSON, insurance, selfie URLs), set it to `PENDING`, and alert admins in realtime when any document is present | Professional | Implemented | `app/api/professional/verification/route.ts:37-66` |
| FR-VER-003 | The system shall show the professional their verification record and per-document review statuses | Professional | Implemented | `route.ts:26-35` |
| FR-VER-004 | The system shall stream a verification document only to the owning professional (key prefix `verification/<own id>/`) or an admin, with `private, no-store` caching and an audit entry | Professional, Admin | Partial: with the local storage provider an encoded `..%2F` / `%2e%2e%2f` segment lets another professional read the document (200); literal `../` → 403. S3 keys are unaffected [FOUND IN VALIDATION 2026-09-17 · V-35] | `app/api/professional/verification/documents/[...storageKey]/route.ts` |
| FR-VER-005 | The system shall start a Persona hosted inquiry for the professional and store a `PersonaVerification` row with the provider status. When Persona is not configured it returns `{enabled:false}` | Professional | Implemented (config dependent) | `app/api/verification/persona/start/route.ts`, `src/lib/persona.ts:27-57` |
| FR-VER-006 | The system shall return the professional's latest Persona inquiry status | Professional | Implemented | `app/api/verification/persona/status/route.ts` |
| FR-VER-007 | The system shall process Persona webhooks: HMAC-SHA256 over `t.body` within ±300 s, event dedupe (`PersonaWebhookEvent` unique), stale-event guard, update `providerStatus` and `submittedAt` | System | Partial: blocked by the proxy Origin check when no `Origin` is sent (403) [PARTIALLY VALIDATED 2026-09-17 · V-20]; live Persona delivery `[NEEDS VALIDATION — not testable locally]`. The provider result does not change `User.isVerified` | `app/api/webhooks/persona/route.ts`, `src/lib/persona.ts:71-145` |
| FR-VER-008 | The system shall give admins a verification queue: professional verifications in `PENDING`/`REJECTED` with document reviews, and Persona inquiries with `adminStatus = PENDING` | Admin | Implemented | `app/api/admin/verifications/route.ts:17-70` |
| FR-VER-009 | The system shall let an admin approve or reject a professional's overall verification. This sets `ProfessionalVerification.status` and `User.isVerified` in one transaction and emits a realtime notification (not persisted) | Admin | Implemented (notification href `/professional/profile` does not exist) | `route.ts:113-134` |
| FR-VER-010 | The system shall let an admin approve or reject an individual document (`VerificationDocumentReview` upsert) | Admin | Implemented | `route.ts:98-112` |
| FR-VER-011 | The system shall let an admin record an approve or reject decision on a Persona inquiry (`adminStatus`, `reviewedBy`, `reviewedAt`) | Admin | Implemented | `route.ts:87-97` |

### SRCH: Search, discovery and geo

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-SRCH-001 | The system shall search professionals with filters: query ≤200, segment, parent/category/subcategory ids, category name, city/state/district, minRating 0–5, verified, availability, distance ≤500 km (requires originLat/Lng), sort `recommended/rating/distance/most-reviewed/price`, page, limit ≤50. Results carry obfuscated display points | Visitor, Client | Implemented | `app/api/v1/professionals/route.ts`, `src/lib/queries/professional-discovery.ts:387` |
| FR-SRCH-002 | The system shall list up to 50 featured active professionals (verified first, then by rating) for the home page | Visitor | Implemented | `GET /api/marketplace/professionals` → `listProfessionals` (`marketplace.ts:264`), `src/routes/index.tsx:99` |
| FR-SRCH-003 | The system shall show a public professional profile with email, phone, address, exact coordinates, last login and verification document URLs **removed** | Visitor, Client | Implemented | `GET /api/marketplace/professional-detail` → `getPublicProfessionalProfile` (`marketplace.ts:472-491`) |
| FR-SRCH-004 | The system shall list up to 100 open, started, unexpired jobs publicly (client first name and verified flag only) | Visitor | Implemented. The `[resource]=jobs` branch (`listOpenJobs`) is shadowed by the static `app/api/marketplace/jobs/route.ts` | `app/api/marketplace/jobs/route.ts` |
| FR-SRCH-005 | The system shall return a public open-job detail (404 once a project is running), with approximate address and display point | Visitor, Professional | Implemented | `GET /api/marketplace/job?id` → `getOpenJob` (`marketplace.ts:493`) |
| FR-SRCH-006 | The system shall search open jobs by title, description or category (case-insensitive, top 8) from the portal header | All | Implemented (no auth required) | `app/api/search/route.ts`, `src/components/AppHeader.tsx:99` |
| FR-SRCH-007 | The system shall proxy forward and reverse geocoding to Google (20 requests per minute per IP, 8 s timeout) and return address, lat, lon, state, city and district. On failure it returns 503 with a manual-entry hint | All | Implemented | `app/api/geocode/route.ts` |
| FR-SRCH-008 | The system shall provide map pickers and maps for job location, professional base location, discovery and job feeds | Client, Professional | Implemented | `src/components/AddressMapPicker.tsx`, `ProfessionalDiscoveryMap.tsx`, `ProfessionalJobsMap.tsx`, `GoogleMapsProvider.tsx` |

### CMS: Content, FAQ, contact

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-CMS-001 | The system shall render the Home, About and 8 marketing pages (`how-it-works`, `professional-home`, `services`, `for-clients`, `for-professionals`, `pricing`, `faq`, `contact`) from JSON content with coded defaults | Visitor | Implemented | `src/lib/cms-file.ts`, `home-cms-file.ts`, `marketing-cms.ts`, `src/components/MarketingPageShell.tsx` |
| FR-CMS-002 | The system shall let admins read and update CMS content with Zod validation (and HTML sanitisation for the About content) | Admin | Partial: content is written to `data/cms-*.json` on the local filesystem, which is not durable or shared on serverless or multi-instance hosts `[NEEDS VALIDATION — not testable locally]`. Locally proven: saves succeed but statically prerendered pages (`/pricing`, `/how-it-works`) keep old content until a rebuild [FOUND IN VALIDATION 2026-09-17 · V-03b] | `app/api/admin/cms/route.ts`, `src/lib/sanitizeCmsHtml.ts`, `src/components/CmsEditor.tsx` |
| FR-CMS-003 | The system shall serve static Privacy Policy, Terms and Cookies pages | Visitor | Implemented | `app/(marketing)/privacy-policy|terms|cookies/page.tsx`, `src/components/LegalPage.tsx` |
| FR-CMS-004 | The system shall serve Blog and Careers placeholder pages | Visitor | Implemented (static) | `app/blog/page.tsx`, `app/careers/page.tsx` |
| FR-CMS-005 | The system shall accept contact form submissions (name 2–120, email, subject 2–180, message 10–4000) into `ContactRequest` | Visitor | Implemented (no rate limit or CAPTCHA) | `app/api/contact/route.ts`, `src/components/MarketingVisualPage.tsx:712` |
| FR-CMS-006 | The system shall let admins create, update and delete FAQ entries (question, answer, order, category) | Admin | Partial: the public `/faq` page renders CMS JSON, **not** the `Faq` table (`getPublishedFaqGroups` is unused) | `app/api/admin/support/route.ts`, `src/lib/queries/faq.ts` |
| FR-CMS-007 | The system shall list the latest 200 contact requests and 200 FAQs for admins (read-only) | Admin | Implemented | `app/api/admin/data/[resource]/route.ts:390-396`, `app/admin/support/page.tsx` |

### RPT: Reports and exports

All exports are `POST` with `{scope: "all"|"selected", ids?, pageSize?, orientation?}` parsed by `src/lib/reports/pdf/request.ts` and rendered by `ReportDocument`. The UI trigger is `src/components/reports/ExportMenu.tsx`.

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-RPT-001 | The system shall export the client's jobs to PDF | Client | Implemented (unbounded when scope is all) | `app/api/client/jobs/export/route.ts` |
| FR-RPT-002 | The system shall export the client's payments (project transactions, ≤500) to PDF | Client | Implemented | `app/api/client/payments/export/route.ts` |
| FR-RPT-003 | The system shall export the professional's running projects to PDF | Professional | Implemented | `app/api/professional/jobs/export/route.ts` |
| FR-RPT-004 | The system shall export the professional's earnings and payouts (≤500 each) to PDF | Professional | Implemented | `app/api/professional/earnings/export/route.ts` |
| FR-RPT-005 | The system shall export admin users (CLIENT/PRO), jobs, or finance (transactions and withdrawals) to PDF (≤500 per source, or the selection) | Admin | Implemented | `app/api/admin/reports/[resource]/route.ts` |
| FR-RPT-006 | The system shall show report screens with selectable tables feeding the exports | Client, Professional, Admin | Implemented | `src/routes/client/reports.tsx`, `src/routes/professional/reports.tsx`, `app/admin/reports/page.tsx`, `src/components/reports/SelectableReportTable.tsx`, `src/hooks/use-row-selection.ts` |

### ADM: Administration

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-ADM-001 | The system shall show an admin overview: client and professional counts, pending verifications, jobs, open disputes, completed payment total, 5 newest users, jobs and disputes | Admin | Implemented | `app/api/admin/data/[resource]/route.ts:21-81`, `src/routes/admin/admin.tsx` |
| FR-ADM-002 | The system shall list all users (including admins) with role, active, verified and email-verified flags | Admin | Implemented (unpaginated) | `route.ts:82-98`, `app/admin/users/page.tsx` |
| FR-ADM-003 | The system shall show a user detail with profile fields, client profiles and locations, and stats (jobs posted, proposals, projects, completed payments and amount, services) | Admin | Partial: the API returns `clientProfiles` as an object while the page reads `clientProfiles?.[0]`, so client-profile data is never displayed (no crash) [FOUND IN VALIDATION 2026-09-17 · V-05b] | `app/api/admin/users/[id]/route.ts:59-155` |
| FR-ADM-004 | The system shall activate or deactivate an account. Deactivation revokes all the user's sessions in the same transaction | Admin | Implemented (no self or last-admin protection) | `route.ts:6-34` |
| FR-ADM-005 | The system shall hard-delete a user (500 when related records block it) | Admin | Implemented: any user with activity → 500, nothing deleted; a fresh user → 200 with an orphaned `ApiToken` row [VALIDATED 2026-09-17 · V-07] | `route.ts:36-57` |
| FR-ADM-006 | The system shall report database connectivity and latency (`SELECT 1`). It requires ADMIN only when `NODE_ENV=production` (prod 401 unauthenticated; dev 200 unauthenticated) [VALIDATED 2026-09-17 · V-30] | Admin | Implemented | `app/api/admin/database-status/route.ts`, `src/hooks/use-database-status.ts` |
| FR-ADM-007 | The system shall refresh admin screens in realtime (`admin:*-update`, `admin:notification`, `message:new`, `project:updated`) | Admin | Implemented (each admin event shows 2 toasts) [FOUND IN VALIDATION 2026-09-17 · V-53] | `src/components/AdminRealtime.tsx:118-125` |
| FR-ADM-008 | The system shall provide an admin shell with sidebar navigation, a DB status indicator and sign-out | Admin | Implemented | `src/components/AdminPortal.tsx`, `AdminSidebar.tsx`, `AdminHeader.tsx:28` |

### SYS: Platform services

| ID | Requirement | Actor | Status | Evidence |
|---|---|---|---|---|
| FR-SYS-001 | The system shall run a combined HTTP and Socket.IO server. Socket handshakes are authenticated from the session cookie and the DB session check. Sockets join `user:<id>`, and admins also join `admins` and `admin:room`. The server is exposed to route handlers through `globalThis.__servioIo` | System | Implemented. Caveats: with `DATABASE_URL` only in `.env` the handshake revocation check is skipped; a shell-inherited `HOSTNAME` binds only the LAN IP [FOUND IN VALIDATION 2026-09-17 · V-10, V-11] | `server.mjs` |
| FR-SYS-002 | The system shall serve every `/api/*` handler also at `/api/v1/*` | System | Implemented (physical `/api/v1/messages` and `/api/v1/professionals` have no unprefixed twin → 404; `/api/v1/v1/*` → 404) [VALIDATED 2026-09-17 · V-13] | `next.config.ts:21-27` |
| FR-SYS-003 | The system shall reject state-changing `/api/*` requests whose `Origin` is missing or does not match the request origin or `APP_URL` | System | Partial: effective CSRF defence for browsers, but it also blocks legitimate server-to-server webhooks and non-browser (mobile) clients (403) [VALIDATED 2026-09-17 · V-20]. Under `server.mjs` only the exact `APP_URL` origin passed; a genuine same-origin request to `127.0.0.1` got 403 [FOUND IN VALIDATION 2026-09-17 · V-20] | `proxy.ts:4-14,44-46` |
| FR-SYS-004 | The system shall attach an `x-request-id` (incoming or random UUID) to requests and responses | System | Implemented (used in only a few logs; not applied to `/api/realtime`) [VALIDATED 2026-09-17 · V-12] | `proxy.ts:93-99` |
| FR-SYS-005 | The system shall write an audit log for sensitive actions | System | Partial: only `verification.document.uploaded` and `.viewed`. Admin decisions, payouts, user deactivation and deletion are not audited | `src/lib/audit-log.ts`, callers |
| FR-SYS-006 | The system shall run non-critical side effects (emails, broadcasts) after the response in an in-process background executor, logging failures | System | Implemented (not durable) | `src/lib/background-jobs.ts` |
| FR-SYS-007 | The system shall provide a global error boundary, a 404 page and route-level loading skeletons | All | Implemented | `app/error.tsx`, `app/not-found.tsx`, `app/**/loading.tsx` |
| FR-SYS-008 | The system shall log server errors as structured JSON and capture them in Sentry (tags and context, no PII) | System | Implemented (used by a subset of handlers; others use `console.error`). Browser capture is blocked by CSP `connect-src` [FOUND IN VALIDATION 2026-09-17 · V-51] | `src/lib/server-logger.ts`, `instrumentation.ts`, `sentry.*.config.ts` |

---

## 2. Traceability matrix

Chain: **FR → Screen route → main component → API (METHOD /api/path) → service / lib function → Prisma model(s)**. Links were traced by following page `import`/`export`, `fetch()` call sites (method and URL) and handler imports. "—" means none exists. `[NEEDS VALIDATION]` marks a link that could not be confirmed statically.

Abbreviations: `R/` = `src/routes/`, `C/` = `src/components/`, `L/` = `src/lib/`. Canonical API paths are shown; the UI calls `/api/v1/...` equivalents unless the path is written with `(no v1)`.

### AUTH

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-AUTH-001 | `/signup` | `R/signup.tsx` | POST /api/auth/register | `bcrypt.hash`, `createEmailVerificationToken`, `enqueueBackgroundJob`, `sendAuthEmail`, `notifyAdminsOfNewAccount`, `notifyClientsOfNewProfessional` | User, ApiToken, UserNotification |
| FR-AUTH-002 | `/signup` | `R/signup.tsx:51` | POST /api/auth/check-availability | — | User |
| FR-AUTH-003 | `/verify-email` | `R/verify-email.tsx` (via `app/verify-email/page.tsx`) | POST /api/auth/verify-email | `createSession` (`L/auth.ts`) | ApiToken, User, Session |
| FR-AUTH-004 | `/verify` | `R/verify.tsx:58` | POST /api/auth/resend-verification | `verifySession`, `sendAuthEmail` | ApiToken, User |
| FR-AUTH-005 | `/verify` | `R/verify.tsx:72` | POST /api/auth/update-email | `verifySession`, `sendAuthEmail` | ApiToken, User |
| FR-AUTH-006 | `/login` | `R/login.tsx:116` | POST /api/auth/login | `rateLimit`/`clearRateLimit` (`L/rate-limit.ts`), `createSession` | User, ClientProfile, UserNotification, Session |
| FR-AUTH-007 | `/login` | `R/login.tsx:150,187` | POST /api/auth/send-phone-login-otp · POST /api/auth/login-phone | `requestPhoneOtp`, `verifyPhoneOtp` (`L/phone-otp-provider.ts`), `createSession` | User, OtpCode, Session |
| FR-AUTH-008 | — (no UI) | — | POST /api/auth/login-phone-password | `bcrypt.compare`, `createSession` | User, Session |
| FR-AUTH-009 | `/login`, `/signup` | `R/login.tsx:270`, `R/signup.tsx:172` (browser redirect) | GET /api/auth/google | Google OAuth token and userinfo fetch, `notifyAdminsOfNewAccount`, `createSession` | User, Session, UserNotification |
| FR-AUTH-010 | portal header, `/my-info`, admin header | `C/ClientAccountMenu.tsx:61`, `C/ClientMyInfoPage.tsx:99`, `C/AdminHeader.tsx:28` | POST /api/auth/logout | `revokeSession` | Session |
| FR-AUTH-011 | `/forgot-password` | `R/forgot-password.tsx:21` | POST /api/auth/forgot-password | `sendAuthEmail`, `enqueueBackgroundJob` | User, ApiToken |
| FR-AUTH-012 | `/forgot-password` | `R/forgot-password.tsx:79,123` | POST /api/auth/forgot-password-phone · POST /api/auth/verify-forgot-password-phone | `requestPhoneOtp`, `verifyPhoneOtp` | User, OtpCode, ApiToken |
| FR-AUTH-013 | `/reset-password`, `/forgot-password` | `R/reset-password.tsx:23`, `R/forgot-password.tsx:151` | POST /api/auth/reset-password | `bcrypt.hash` | ApiToken, User, Session |
| FR-AUTH-014 | all protected | `proxy.ts`, layouts | (all authenticated handlers) | `createSession`, `verifySession`, `revokeSession` (`L/auth.ts`) | Session, User |
| FR-AUTH-015 | shells, `/verify`, job detail, messages | `C/AppShell.tsx:37`, `C/PortalShell.tsx:56`, `C/SiteHeader.tsx:32`, `C/Logo.tsx:16`, `C/MessagesWorkspace.tsx:147`, `R/verify.tsx:25`, `R/job.$jobId.tsx:287`, `C/RealtimeNotifications.tsx:63` (no v1) | GET /api/auth/me | `verifySession` | User, Session |
| FR-AUTH-016 | any page → `/verify` | `proxy.ts:87-91`, `app/(portal)/layout.tsx` | POST /api/profile (only API gate) | `verifySession` | User |
| FR-AUTH-017 | `/client-profile`, `/professional/setup` | `C/PhoneVerification.tsx:41,57` (inside `C/ClientProfilePage.tsx`, `C/ProfessionalProfileSetup.tsx`) | POST /api/auth/send-phone-otp · POST /api/auth/verify-phone | `requestPhoneOtp`, `verifyPhoneOtp`, `isValidInternationalPhoneNumber` | User, OtpCode |
| FR-AUTH-018 | `/signup` [NEEDS VALIDATION: not wired] | — | POST /api/auth/verify-phone → POST /api/auth/register | `createPhoneVerificationProof`, `hasValidPhoneVerificationProof` (`L/dev-phone-otp.ts`) | OtpCode, User |
| FR-AUTH-019 | `/admin/login` | `app/admin/login/page.tsx:37` | POST /api/admin/login | `createBootstrapAdmin`, `rateLimit`, `createSession` | User, Session |
| FR-AUTH-020 | `/admin/*`, portal routes | `proxy.ts`, `app/(portal)/(client)/layout.tsx`, `app/(portal)/professional/layout.tsx`, `app/admin/page.tsx`, `app/admin/cms/page.tsx` | — | `verifySession` | Session, User |

### ACC

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-ACC-001 | `/client-profile` | `C/ClientProfilePage.tsx:112,153` (also `C/ProfileSetup.tsx:46`, not mounted by any page) | POST /api/profile | `verifySession` | User, ClientProfile, ClientSavedLocation |
| FR-ACC-002 | `/client-profile`, `/post-job`, `/discover` | `C/ClientProfilePage.tsx:86`, `R/client/post-job.tsx:119`, `R/client/discover.tsx:105` (no v1) | GET /api/profile | — | User, ClientProfile, ClientSavedLocation |
| FR-ACC-003 | `/client-profile`, `/post-job` | `C/ClientProfilePage.tsx:172`, `R/client/post-job.tsx:142` | GET, POST /api/profile/locations | `getClientSession` (`L/client-profile-auth.ts`) | ClientProfile, ClientSavedLocation |
| FR-ACC-004 | `/client-profile`, `/my-info` | `C/ClientProfilePage.tsx:172`, `C/ClientMyInfoPage.tsx:72` | PATCH /api/profile/locations/{id} | `getClientSession` | ClientSavedLocation, ClientProfile |
| FR-ACC-005 | `/client-profile` | `C/ClientProfilePage.tsx:196` | DELETE /api/profile/locations/{id} | `getClientSession` | ClientSavedLocation |
| FR-ACC-006 | `/client-profile`, `/professional/setup` | `C/ClientProfilePage.tsx:133`, `C/ProfessionalProfileSetup.tsx:131` (no v1) | POST, GET /api/profile/avatar | `storeProjectFile`, `readProjectFile` (`L/project-file-storage.ts`) | User, ClientProfile |
| FR-ACC-007 | `/my-info`, `/verification` (client) | `C/ClientMyInfoPage.tsx` (server props from `app/my-info/page.tsx`), `R/client/verification.tsx:13` | (server-side) · GET /api/client/verification · GET /api/client/account (no caller) | `getClientAccountSummary` (`L/services/client-account-service.ts`) | User, ClientProfile, ClientSavedLocation, ClientJob |
| FR-ACC-008 | `/professional/setup` | `C/ProfessionalProfileSetup.tsx:160,249` | GET, POST /api/professional/profile (+ GET /api/marketplace/categories, GET /api/geocode) | — | User, ServiceCategory |
| FR-ACC-009 | `/professional-profile` | `app/(portal)/professional-profile/page.tsx` (server) | — (server read) | `getDetailedProfessional` (`L/queries/marketplace.ts:401`) | User, ProfessionalVerification, Service |
| FR-ACC-010 | `/earnings` (professional) | `R/professional/earnings.tsx:95,132` (no v1) | GET, PUT /api/professional/razorpay-account | — | User |
| FR-ACC-011 | — (no UI) | — | — | `sendEmails` filter (`L/marketplace-notifications.ts:29`) | User.emailNotificationsEnabled |

### CAT

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-CAT-001 | `/services` | `R/services.tsx` → `C/ServicesCatalog.tsx` | — (server read) | `getCompleteCategoryHierarchy` (`L/queries/categories-hierarchy.ts`) | ServiceCategory, User |
| FR-CAT-002 | `/post-job`, `/discover`, `/professional/my-jobs`, `/professional/setup`, marketing | `R/client/post-job.tsx:115`, `R/client/discover.tsx:139`, `R/professional/my-jobs.tsx:334`, `C/ProfessionalProfileSetup.tsx:153`, `C/MarketingVisualPage.tsx:213` | GET /api/marketplace/categories | `listCategories` | ServiceCategory, User |
| FR-CAT-003 | `/admin/services` | `app/admin/services/page.tsx:129,367` | GET /api/admin/services[?categoryId] | — | ServiceCategory, ClientJob |
| FR-CAT-004 | `/admin/services` | `app/admin/services/page.tsx:269` | POST /api/admin/services | `slugify` | ServiceCategory |
| FR-CAT-005 | `/admin/services` | `app/admin/services/page.tsx:313` | PATCH /api/admin/services?id= | — | ServiceCategory |
| FR-CAT-006 | `/admin/services` | `app/admin/services/page.tsx:340` | DELETE /api/admin/services?id= | — | ServiceCategory |

### JOB

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-JOB-001 | `/post-job` | `R/client/post-job.tsx:358` | POST /api/client/jobs | `publishErrors`, `normalized` | ClientJob, ClientJobMilestone, ServiceCategory |
| FR-JOB-002 | `/post-job` | `R/client/post-job.tsx` | POST /api/client/jobs · PATCH /api/client/jobs/{id} | (in handler) | ClientJobMilestone |
| FR-JOB-003 | `/post-job` (trigger) | — | POST /api/client/jobs | `notifyProfessionalsOfNewJob`, `notifyAdminsOfNewJob` → `notifyRole`, `emitRealtimeNotification`, `sendNotificationEmail` | UserNotification, User |
| FR-JOB-004 | `/my-jobs`, `/reports`, `/pro/[proId]` | `R/client/my-jobs.tsx:92`, `R/client/reports.tsx:54`, `R/professional/pro.$proId.tsx:86` | GET /api/client/jobs | `getClient` | ClientJob, ClientJobMilestone, ProjectTracking, ProjectRequest |
| FR-JOB-005 | `/job/[jobId]` | `R/job.$jobId.tsx:302` | GET /api/client/jobs/{id} | `attachLastActorRole` (`L/project-request-actions.ts`) | ClientJob, ClientJobAttachment, ClientJobMilestone, ServiceCategory, ProjectTracking, ProjectRequest, ProjectNegotiation, User |
| FR-JOB-006 | `/post-job?edit={id}` | `R/client/post-job.tsx:169,358` | GET, PATCH /api/client/jobs/{id} | `errors`, `dataOf` | ClientJob, ClientJobMilestone |
| FR-JOB-007 | `/job/[jobId]` | `R/job.$jobId.tsx:1346,1372` | PATCH /api/client/jobs/{id} `{status}` | — | ClientJob |
| FR-JOB-008 | `/my-jobs` | `R/client/my-jobs.tsx:193` | DELETE /api/client/jobs/{id} | — | ClientJob |
| FR-JOB-009 | (feeds) | `R/professional/my-jobs.tsx`, `C/MarketingVisualPage.tsx` | GET /api/portal/professional-jobs · GET /api/marketplace/jobs · GET /api/search · POST /api/professional/proposals | date filters in handlers | ClientJob |
| FR-JOB-010 | `/dashboard` | `R/client/dashboard.tsx:74` (+ socket refresh) | GET /api/dashboard | — | User, ClientJob, FavoriteJob, ProjectRequest, UserNotification, ProjectTransaction, ProjectTracking |
| FR-JOB-011 | `/admin/operations`, `/admin/reports` | `app/admin/operations/page.tsx:216`, `app/admin/reports/page.tsx:112` | GET /api/admin/data/jobs | — | ClientJob, ProjectDispute, ProjectTracking, User |
| FR-JOB-012 | `/admin/operations` | `app/admin/operations/page.tsx:277` | GET /api/admin/jobs/{id} | — | ClientJob, ClientJobAttachment, FavoriteJob, ProjectRequest, ProjectTracking, ProjectMilestone, ProjectTransaction, User |
| FR-JOB-013 | `/admin/operations` | `app/admin/operations/page.tsx:330` | PATCH /api/admin/jobs/{id} | — | ClientJob |
| FR-JOB-014 | `/admin/operations` | `app/admin/operations/page.tsx:354` | DELETE /api/admin/jobs/{id} | — | ClientJob |

### PROP

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-PROP-001 | `/professional/job/[jobId]`, `/professional/jobs/[jobId]`, `/professional/my-jobs/[jobId]` | `R/job.$jobId.tsx:509` | POST /api/professional/proposals | `notifyUsers`, `emitRealtimeProposalNew`, `notifyAdminsOfNewProposal` (background) | ProjectRequest, ClientJob, User, UserNotification |
| FR-PROP-002 | same | `R/job.$jobId.tsx:329` | GET /api/professional/proposals?jobId= | `attachLastActorRole` | ProjectRequest, ProjectNegotiation |
| FR-PROP-003 | `/pro/[proId]`, `/job/[jobId]` | `R/professional/pro.$proId.tsx:145`, `R/job.$jobId.tsx:453` | POST /api/client/project-requests | `notifyUsers`, `emitRealtimeProposalNew`, `MAX_HIRE_REQUEST_BUDGET` (`L/constants/hiring.ts`) | ProjectRequest, ClientJob, User |
| FR-PROP-004 | `/job/[jobId]` (both roles), `/professional/my-jobs` | `R/job.$jobId.tsx:542,594` (`negotiationEndpoint`), `R/professional/my-jobs.tsx:169,219` | PATCH /api/client/project-requests/{id} · PATCH /api/professional/project-requests/{id} | `respondToProjectRequest` | ProjectRequest, ProjectNegotiation, ClientJob |
| FR-PROP-005 | same (accept) | same | same | `respondToProjectRequest` (accept branch), `notifyUsers`, `emitRealtimeProjectUpdate` | ClientJob, ProjectRequest, ProjectTracking, ProjectMilestone, ProjectTimelineEvent |
| FR-PROP-006 | `/professional/my-jobs`, `/professional-home`, `/professional`, `/professional/dashboard`, `/earnings`, `/professional/reports` | `R/professional/my-jobs.tsx:294`, `R/professional-home.tsx:154`, `R/professional/dashboard.tsx:63` | GET /api/portal/professional-jobs | `getDistanceBoundingBox`, `getDistanceKm`, `createDisplayPoint`, `approximateAddress` (`L/geo.ts`), `inferLocationFromAddress` (`L/india-locations.ts`), `attachLastActorRole` | User, ClientJob, FavoriteJob, ProjectRequest, ProjectTracking, ProjectMilestone, Payment, ProjectTransaction |
| FR-PROP-007 | `/professional/my-jobs` | `R/professional/my-jobs.tsx:362` | POST, DELETE /api/professional/favorite-jobs/{jobId} | — | FavoriteJob, ClientJob |
| FR-PROP-008 | — | — | — | — | — |

### PRJ

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-PRJ-001 | `/project/[projectId]/tracking` (`/project/[id]` redirects), `/job/[jobId]`, notification drill-downs | `app/project/[projectId]/tracking/page.tsx:243`, `R/job.$jobId.tsx:292`, `C/NotificationInbox.tsx:489`, `C/AdminNotificationCenter.tsx:475` | GET /api/portal/project?id= or ?jobId= | — | ProjectTracking, ProjectMilestone, Payment, ClientJob, User, ProjectWorkUpload, ProjectRevisionRequest, ProjectTimelineEvent, ProjectRequest, ProjectReview, ProjectDispute |
| FR-PRJ-002 | `/project/[id]/tracking` | `tracking/page.tsx:947` `action("start-work")` | POST /api/portal/project-actions | `event()` helper, `notifyUsers`, `emitRealtimeProjectUpdate` | ProjectTracking, ProjectMilestone, ProjectTimelineEvent |
| FR-PRJ-003 | same | `tracking/page.tsx:629,635` | POST /api/portal/project-actions (`create-milestone`, `create-milestones`) | same | ProjectMilestone, ProjectRequest, ClientJob |
| FR-PRJ-004 | same | `tracking/page.tsx:730` | POST /api/portal/project-actions (`update-milestone`) | same | ProjectMilestone, ProjectRequest |
| FR-PRJ-005 | same | `tracking/page.tsx:752` | POST /api/portal/project-actions (`delete-milestone`) | same | ProjectMilestone |
| FR-PRJ-006 | same | `tracking/page.tsx:366` | POST /api/portal/project-files (multipart) | `validateProjectFile`, `createProjectStorageKey`, `storeProjectFile`, `removeProjectFile` | StoredFile, ProjectTracking |
| FR-PRJ-007 | same (attachment links) | links to `/api/v1/portal/project-files/{id}` | GET /api/portal/project-files/{fileId} | `readProjectFile` | StoredFile, ProjectTracking |
| FR-PRJ-008 | same | `tracking/page.tsx:1834` (`upload-work`) | POST /api/portal/project-actions | `attachmentsFor`, `event()` | ProjectWorkUpload, StoredFile, ProjectTimelineEvent |
| FR-PRJ-009 | same | `tracking/page.tsx:827` `actionWithFiles("submit-milestone")` | POST /api/portal/project-files → POST /api/portal/project-actions | same | ProjectWorkUpload, ProjectMilestone, ProjectTracking |
| FR-PRJ-010 | same | `tracking/page.tsx:1740` | POST /api/portal/project-actions (`request-revision`) | `event()` | ProjectRevisionRequest, ProjectMilestone, ProjectTracking |
| FR-PRJ-011 | same | `tracking/page.tsx:2616` | POST /api/portal/project-actions (`update-progress`) | `event()` | ProjectTracking, ProjectTimelineEvent |
| FR-PRJ-012 | same | `tracking/page.tsx:1128` `actionWithFiles("submit-final-work")` | POST /api/portal/project-actions | `attachmentsFor`, `event()` | ProjectMilestone, ProjectWorkUpload, ProjectTracking |
| FR-PRJ-013 | same | `tracking/page.tsx:2014` | POST /api/portal/project-actions (`request-client`) | `event()`, `notifyUsers` | ProjectTimelineEvent, UserNotification |
| FR-PRJ-014 | same | `tracking/page.tsx:2079` | POST /api/portal/project-actions (`complete-project`) | `event()`, `notifyUsers` | ProjectTracking |
| FR-PRJ-015 | same | `tracking/page.tsx:990` | POST /api/portal/project-actions (`confirm-project-completion`) | `event()`, `notifyUsers` | ProjectTracking, ClientJob |
| FR-PRJ-016 | same (+ realtime listeners) | `tracking/page.tsx:258` socket, `C/RealtimeNotifications.tsx` | POST /api/portal/project-actions | `event()` → `notifyUsers` (`L/marketplace-notifications.ts:275`), `emitRealtimeProjectUpdate` (`L/realtime.ts:45`) | ProjectTimelineEvent, UserNotification |
| FR-PRJ-017 | `/professional/running-projects` | `R/professional/running-projects.tsx:96` | GET /api/portal/professional-jobs | see FR-PROP-006 | ProjectTracking, ProjectMilestone |
| FR-PRJ-018 | `/project/[id]/tracking` | `tracking/page.tsx:1249` | POST /api/portal/project-actions (`submit-review`) | `event()` | ProjectReview, User |
| FR-PRJ-019 | same | `tracking/page.tsx:1290` | POST /api/portal/project-actions (`respond-to-review`) | `event()` | ProjectReview |
| FR-PRJ-020 | `/professional/reviews` | `R/professional/reviews.tsx:30` | GET /api/portal/reviews | — | ProjectReview, User, ProjectTracking, ClientJob |

### PAY

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-PAY-001 | `/earnings` (both roles), `/project/[id]/tracking` | `R/client/earnings.tsx:88`, `R/professional/earnings.tsx:92`, `tracking/page.tsx:312` | GET /api/wallet | `ensureWallet` (`L/wallet-ledger.ts`) | Wallet, WalletTransaction, Payment, ProjectWithdrawal |
| FR-PAY-002 | `/earnings` (client) | `R/client/earnings.tsx:140` (Razorpay Checkout in browser) | POST /api/wallet/deposit/order | `createRazorpayOrder`, `isRazorpayConfigured` (`L/razorpay.ts`), `ensureWallet` | Wallet, WalletTransaction |
| FR-PAY-003 | `/earnings` (client) | `R/client/earnings.tsx:166` | POST /api/wallet/deposit/verify | `verifyRazorpayPaymentSignature`, `creditWalletFromVerifiedProvider` | WalletTransaction, Wallet |
| FR-PAY-004 | `/earnings` (client) | `R/client/earnings.tsx:182` | POST /api/wallet/deposit/fail | — | WalletTransaction |
| FR-PAY-005 | — (Razorpay → server) | — | POST /api/webhooks/razorpay | `verifyRazorpayWebhookSignature`, `isRazorpayWebhookConfigured` | RazorpayWebhookEvent, Payment, WalletTransaction, Wallet |
| FR-PAY-006 | `/project/[id]/tracking` | `tracking/page.tsx:392` (no v1: `/api/wallet/milestone`) | POST /api/wallet/milestone | `calculateMilestoneMoney`, `fundMilestoneFromWallet`, `notifyMilestoneFunded`, `emitRealtimeProjectUpdate` | ProjectTracking, ProjectMilestone, Payment, Wallet, WalletTransaction, Invoice, ProjectTransaction, User |
| FR-PAY-007 | `/project/[id]/tracking` | `tracking/page.tsx:392-399` (offline branch) | POST /api/portal/project-actions (`approve-milestone`) | `event()` | Payment, ProjectMilestone, ProjectTransaction, ProjectTracking, ClientJob |
| FR-PAY-008 | `/admin/finance` | `app/admin/finance/page.tsx:468` (no v1) | POST /api/admin/finance/milestone-payout | `releaseMilestoneToProfessional`, `notifyMilestonePayoutApproved`, `emitRealtimeProjectUpdate` | Payment, ProjectMilestone, Wallet, WalletTransaction, ProjectTransaction, ProjectTracking |
| FR-PAY-009 | `/earnings` (both roles) | `R/professional/earnings.tsx:114`, `R/client/earnings.tsx:118` | POST /api/wallet | `ensureWallet`, raw SQL reservation | Wallet, ProjectWithdrawal |
| FR-PAY-010 | `/admin/finance` | `app/admin/finance/page.tsx:492` (no v1) | PATCH /api/admin/finance/withdrawals/{id} | — | ProjectWithdrawal, Wallet |
| FR-PAY-011 | — (no UI) | — | POST /api/admin/finance/payouts | `createRazorpayPaymentTransfer`, `isRazorpayRouteConfigured` | ProjectWithdrawal, Payment, User, Wallet |
| FR-PAY-012 | `/earnings`, `/reports`, `/professional/reports` | `R/client/earnings.tsx:112`, `R/professional/earnings.tsx:83`, `R/client/reports.tsx:128`, `R/professional/reports.tsx:130` | GET /api/portal/earnings | — | ProjectTransaction, Payment |
| FR-PAY-013 | `/earnings` | `R/client/earnings.tsx:245`, `R/professional/earnings.tsx:149` | GET /api/portal/payment-details/{paymentId} | — | Payment, ProjectMilestone |
| FR-PAY-014 | `/earnings` (download link) | `R/client/earnings.tsx:728`, `R/professional/earnings.tsx:517` (href) | GET /api/portal/invoices/{paymentId} | `renderReportPdf`, `pdfResponse`, `InvoiceDocument` (`L/reports/pdf`) | Payment, Invoice, User |
| FR-PAY-015 | `/admin/finance`, `/admin/reports` | `app/admin/finance/page.tsx:211`, `app/admin/reports/page.tsx:176` | GET /api/admin/data/finance | `ensureWallet` | ProjectTransaction, ProjectWithdrawal, Payment, WalletTransaction, Wallet, User, LegacyUserProfile |
| FR-PAY-016 | — | — | POST /api/payments/razorpay/order · POST /api/payments/razorpay/verify | — | — |
| FR-PAY-017 | — [NEEDS VALIDATION: no caller found] | — | GET /api/payments/razorpay/config | `razorpayConfig` | — |

### DSP

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-DSP-001 | `/project/[id]/tracking` | `tracking/page.tsx:1392` | POST /api/portal/project-actions (`submit-dispute`) | `event()`, `enqueueBackgroundJob` → `notifyDisputeRaised` | ProjectDispute, ProjectTimelineEvent, UserNotification |
| FR-DSP-002 | `/admin/operations` | `app/admin/operations/page.tsx:291` | GET /api/admin/disputes/{id} | — | ProjectDispute, ProjectDisputeMessage, ProjectTracking, User, ClientJob, ProjectMilestone, ProjectTransaction |
| FR-DSP-003 | `/admin/operations` | `app/admin/operations/page.tsx:303` | PATCH /api/admin/disputes/{id} | `notifyDisputeResolved` | ProjectDispute |
| FR-DSP-004 | `/admin/operations` | `app/admin/operations/page.tsx:1138` | POST /api/admin/disputes/{id}/messages | `notifyDisputeMessage` | ProjectDisputeMessage, ProjectDispute |
| FR-DSP-005 | — | — | — | — | ProjectDisputeMessage (unused by parties) |

### MSG

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-MSG-001 | `/messages`, `/professional/messages`, `/admin/messages`, nav badges | `C/MessagesWorkspace.tsx:130`, `C/AppNavigation.tsx:25` | GET /api/v1/messages (physical route) | — | ProjectTracking, ClientJob, ProjectMilestone, Payment, SocketConversation, SocketMessage, User |
| FR-MSG-002 | same | `C/MessagesWorkspace.tsx` | GET /api/v1/messages?conversationId= | — | SocketConversation, SocketMessage |
| FR-MSG-003 | same | `C/MessagesWorkspace.tsx:263` (socket `message:new` at :170) | POST /api/v1/messages | `notifyUsers`, `emitRealtimeMessage` | SocketConversation, SocketMessage, ProjectTracking, UserNotification |
| FR-MSG-004 | same | `C/MessagesWorkspace.tsx:158,237,243` | PATCH /api/v1/messages | `emitRealtimeMessageRead` | SocketMessage |
| FR-MSG-005 | none (orphan `R/messages.tsx`) | `R/messages.tsx:13` | GET /api/portal/messages | — | MessageConversation, Message |

### NOT

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-NOT-001 | `/notifications`, portal header and nav, professional dashboard | `R/notifications.tsx` → `C/NotificationInbox.tsx:228`, `C/AppHeader.tsx:121`, `C/AppNavigation.tsx:60`, `R/professional/dashboard.tsx:70`, `C/RealtimeNotifications.tsx:72` (no v1) | GET /api/portal/notifications | — | UserNotification, ProjectDispute, ProjectMilestone, ClientJob, ProjectTracking, User |
| FR-NOT-002 | same + admin | `C/NotificationInbox.tsx:435,450`, `C/AppNavigation.tsx:52`, `C/RealtimeNotifications.tsx:39`, `C/AdminRealtime.tsx:36` | PATCH /api/portal/notifications | — | UserNotification |
| FR-NOT-003 | `/notifications`, `/admin/notifications` | `C/NotificationInbox.tsx:465`, `C/AdminNotificationCenter.tsx:451` | DELETE /api/portal/notifications | — | UserNotification |
| FR-NOT-004 | all portal pages | `C/providers.tsx` → `C/RealtimeNotifications.tsx`, dashboards, `R/client/my-jobs.tsx:112`, `R/professional/running-projects.tsx:120` | WS /api/realtime | `emitRealtimeNotification`, `emitRealtimeMessage`, `emitRealtimeProjectUpdate`, `emitRealtimeProposalNew` (`L/realtime.ts`), `server.mjs` | Session, User |
| FR-NOT-005 | — (email) | — | (triggered by mutating APIs) | `sendEmails`, `sendNotificationEmail` (`L/email.ts`) | User |
| FR-NOT-006 | — | — | POST /api/auth/register, GET /api/auth/google, POST /api/client/jobs, POST /api/professional/proposals, POST /api/wallet/milestone, POST /api/admin/finance/milestone-payout, POST /api/portal/project-actions | `notifyRole` and the exported `notify*` functions | UserNotification, User |
| FR-NOT-007 | `/admin/*` sidebar | `C/AdminSidebar.tsx:68,121` (no v1) | GET, PATCH /api/admin/sidebar-counts | — | UserNotification, ProfessionalVerification, ProjectDispute, SocketMessage |
| FR-NOT-008 | `/admin/notifications` | `C/AdminNotificationCenter.tsx:224,421,436,451,475` | GET, PATCH, DELETE /api/portal/notifications · GET /api/portal/project | — | UserNotification, ProjectTracking |
| FR-NOT-009 | — | — | — | — | BrowserSubscription (unused) |

### VER

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-VER-001 | `/verification` (professional) | `R/professional/verification.tsx:124` | POST /api/professional/verification/upload | `validateProjectFile`, `createVerificationStorageKey`, `storeProjectFile`, `recordAudit` | AuditLog |
| FR-VER-002 | same | `R/professional/verification.tsx:140` | PUT /api/professional/verification | `emitAdminNotification`, `emitAdminVerificationsUpdate` | ProfessionalVerification |
| FR-VER-003 | same | `R/professional/verification.tsx:92` | GET /api/professional/verification | — | ProfessionalVerification, VerificationDocumentReview |
| FR-VER-004 | `/verification`, `/admin/verifications` (document links) | document URLs `/api/v1/professional/verification/documents/...` | GET /api/professional/verification/documents/{...storageKey} | `readProjectFile`, `recordAudit` | AuditLog |
| FR-VER-005 | `/verification` (professional) | `R/professional/verification.tsx:158` (no v1) | POST /api/verification/persona/start | `createPersonaInquiry`, `isPersonaConfigured` (`L/persona.ts`) | PersonaVerification, User |
| FR-VER-006 | same | `R/professional/verification.tsx:110` (no v1) | GET /api/verification/persona/status | `isPersonaConfigured` | PersonaVerification |
| FR-VER-007 | — (Persona → server) | — | POST /api/webhooks/persona | `handlePersonaWebhook` | PersonaWebhookEvent, PersonaVerification |
| FR-VER-008 | `/admin/verifications` | `app/admin/verifications/page.tsx:68` | GET /api/admin/verifications | — | ProfessionalVerification, PersonaVerification, VerificationDocumentReview, User |
| FR-VER-009 | same | `app/admin/verifications/page.tsx:102` (`decide`) | PATCH /api/admin/verifications `{userId,status}` | `emitRealtimeNotification`, `emitAdminVerificationsUpdate` | ProfessionalVerification, User |
| FR-VER-010 | same | `app/admin/verifications/page.tsx:130` (`decideDocument`) | PATCH /api/admin/verifications `{userId,status,documentKey}` | — | VerificationDocumentReview |
| FR-VER-011 | same | `app/admin/verifications/page.tsx:113` (`decidePersona`) | PATCH /api/admin/verifications `{userId,status,providerInquiryId}` | — | PersonaVerification |

### SRCH

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-SRCH-001 | `/discover`, `/job/[jobId]` (suggested pros) | `R/client/discover.tsx:210`, `R/job.$jobId.tsx:399`, `C/ProfessionalDiscoveryMap.tsx` | GET /api/v1/professionals (physical route) | `searchProfessionals` (`L/queries/professional-discovery.ts`), `createDisplayPoint` | User, ServiceCategory |
| FR-SRCH-002 | `/` | `R/index.tsx:99` → `C/ProCard.tsx` | GET /api/marketplace/professionals | `listProfessionals` | User |
| FR-SRCH-003 | `/pro/[proId]` | `R/professional/pro.$proId.tsx:72` | GET /api/marketplace/professional-detail?id= | `getPublicProfessionalProfile` → `getDetailedProfessional` | User, ProfessionalVerification, Service |
| FR-SRCH-004 | marketing pages | `C/MarketingVisualPage.tsx:221` (no v1) | GET /api/marketplace/jobs (static route) | — | ClientJob, User |
| FR-SRCH-005 | `/discover`, `/job/[jobId]` | `R/client/discover.tsx:158`, `R/job.$jobId.tsx:321` | GET /api/marketplace/job?id= | `getOpenJob`, `approximateAddress`, `createDisplayPoint` | ClientJob, ProjectTracking, User |
| FR-SRCH-006 | portal header | `C/AppHeader.tsx:99` (no v1) | GET /api/search?q= | — | ClientJob |
| FR-SRCH-007 | `/post-job`, `/discover`, `/professional/setup`, map pickers | `C/AddressMapPicker.tsx:62,92`, `R/client/discover.tsx:117`, `R/client/post-job.tsx:449`, `C/ProfessionalProfileSetup.tsx:93` (no v1) | GET /api/geocode?q= or ?lat=&lon= | `rateLimit`, Google Geocoding fetch | — |
| FR-SRCH-008 | `/post-job`, `/professional/setup`, `/discover`, `/professional/my-jobs` | `C/GoogleMapsProvider.tsx`, `C/AddressMapPicker.tsx`, `C/GoogleAddressMap.tsx` (in AddressMapPicker), `C/ProfessionalLocationMap.tsx` (`/pro/[proId]`), `C/ProfessionalJobsMap.tsx` + `C/JobsPreviewMap.tsx` (`/professional/my-jobs`), `C/ProfessionalsPreviewMap.tsx` (`/discover`) | GET /api/geocode | `L/geo.ts` | — |

### CMS

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-CMS-001 | `/`, `/about`, `/how-it-works`, `/services`, `/for-clients`, `/for-professionals`, `/pricing`, `/faq`, `/contact`, `/professional-home` | `R/index.tsx`, `R/about.tsx`, `C/MarketingPageShell.tsx` → `C/MarketingVisualPage.tsx` | — (server read) | `readHomeContent`, `readCmsContent`, `readMarketingContent` | — (files `data/cms-home.json`, `data/cms-content.json`, `data/cms-marketing.json`) |
| FR-CMS-002 | `/admin/cms` | `app/admin/cms/page.tsx` → `C/CmsEditor.tsx:135,214,942,1017,1433,1484` (no v1) | GET, PUT /api/admin/cms[?page=] | `writeCmsContent` (+ `sanitizeCmsHtml`), `writeHomeContent`, `writeMarketingContent` | — (files) |
| FR-CMS-003 | `/privacy-policy`, `/terms`, `/cookies` | `C/LegalPage.tsx` | — | — | — |
| FR-CMS-004 | `/blog`, `/careers` | `app/blog/page.tsx`, `app/careers/page.tsx` | — | — | — |
| FR-CMS-005 | `/contact` (and other marketing pages rendering the form) | `C/MarketingVisualPage.tsx:712` | POST /api/contact | — | ContactRequest |
| FR-CMS-006 | `/admin/support` | `app/admin/support/page.tsx:55,103` | POST, PUT, DELETE /api/admin/support[?id=] | — | Faq |
| FR-CMS-007 | `/admin/support` | `app/admin/support/page.tsx:37` | GET /api/admin/data/support | — | Faq, ContactRequest |

### RPT

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-RPT-001 | `/reports` | `R/client/reports.tsx:74` → `C/reports/ExportMenu.tsx:39` (no v1) | POST /api/client/jobs/export | `parseReportRequest`, `ReportDocument`, `renderReportPdf`, `pdfResponse` | ClientJob, User |
| FR-RPT-002 | `/reports` | `R/client/reports.tsx:148` → `ExportMenu` | POST /api/client/payments/export | same + `logServerError` | ProjectTransaction, User |
| FR-RPT-003 | `/professional/reports` | `R/professional/reports.tsx:70` → `ExportMenu` | POST /api/professional/jobs/export | same | ProjectTracking, ClientJob, User |
| FR-RPT-004 | `/professional/reports` | `R/professional/reports.tsx:150` → `ExportMenu` | POST /api/professional/earnings/export | same | ProjectTransaction, ProjectWithdrawal, User |
| FR-RPT-005 | `/admin/reports` | `app/admin/reports/page.tsx:61,128,238` → `ExportMenu` | POST /api/admin/reports/{users,jobs,finance} | same | User, ClientJob, ProjectTransaction, ProjectWithdrawal |
| FR-RPT-006 | `/reports`, `/professional/reports`, `/admin/reports` | `C/reports/SelectableReportTable.tsx`, `src/hooks/use-row-selection.ts` | GET /api/client/jobs, GET /api/portal/earnings, GET /api/portal/professional-jobs, GET /api/admin/data/{users,jobs,finance} | — | (as sources) |

### ADM

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-ADM-001 | `/admin` | `app/admin/page.tsx` (server guard) → `R/admin/admin.tsx:51` | GET /api/admin/data/overview | — | User, ProfessionalVerification, ClientJob, ProjectDispute, ProjectTransaction |
| FR-ADM-002 | `/admin/users`, `/admin/reports` | `app/admin/users/page.tsx:221`, `app/admin/reports/page.tsx:45` | GET /api/admin/data/users | — | User |
| FR-ADM-003 | `/admin/users` | `app/admin/users/page.tsx:241` | GET /api/admin/users/{id} | — | User, ClientProfile, ClientSavedLocation, Service, ClientJob, ProjectRequest, ProjectTracking, ProjectTransaction |
| FR-ADM-004 | `/admin/users` | `app/admin/users/page.tsx:272` | PATCH /api/admin/users/{id} | — | User, Session |
| FR-ADM-005 | `/admin/users` | `app/admin/users/page.tsx:289` | DELETE /api/admin/users/{id} | — | User (cascades per schema) |
| FR-ADM-006 | admin header and sidebar | `C/AdminHeader.tsx:24`, `C/AdminSidebar.tsx:63` → `src/hooks/use-database-status.ts:10` | GET /api/admin/database-status | `db.$queryRaw` | — |
| FR-ADM-007 | `/admin/*` | `C/AdminPortal.tsx` → `C/AdminRealtime.tsx` | WS /api/realtime (room `admins`) | `emitAdmin*` (`L/realtime.ts:60-102`) | — |
| FR-ADM-008 | `/admin/*` | `app/admin/layout.tsx` → `C/AdminPortal.tsx`, `C/AdminSidebar.tsx`, `C/AdminHeader.tsx` | POST /api/auth/logout | `revokeSession` | Session |

### SYS

| FR | Screen route | Component | API | Service / lib | Model(s) |
|---|---|---|---|---|---|
| FR-SYS-001 | all realtime consumers | `socket.io-client` in `C/RealtimeNotifications.tsx`, `C/AdminRealtime.tsx`, `C/MessagesWorkspace.tsx`, dashboards, tracking page | WS /api/realtime | `server.mjs`, `L/realtime.ts` | Session (`sessions`), User |
| FR-SYS-002 | all | all `fetch('/api/v1/...')` | `/api/v1/:path*` → `/api/:path*` | `next.config.ts` rewrites | — |
| FR-SYS-003 | all mutations | — | all POST/PUT/PATCH/DELETE `/api/*` | `isTrustedStateChangingRequest` (`proxy.ts`) | — |
| FR-SYS-004 | all | — | all | `proxy.ts:93-99` | AuditLog.requestId (when audited) |
| FR-SYS-005 | `/verification` | `R/professional/verification.tsx` | POST /api/professional/verification/upload · GET /api/professional/verification/documents/{...} | `recordAudit` | AuditLog |
| FR-SYS-006 | — | — | POST /api/auth/register, forgot-password, resend-verification, POST /api/professional/proposals, POST /api/portal/project-actions (dispute) | `enqueueBackgroundJob` | — |
| FR-SYS-007 | all | `app/error.tsx`, `app/not-found.tsx`, `app/**/loading.tsx`, `C/LoadingSkeleton.tsx` | — | — | — |
| FR-SYS-008 | — | — | handlers using `logServerError` (auth verify-email, exports, project files, verification, project requests, audit) | `logServerError` (`L/server-logger.ts`), `@sentry/nextjs` | — |

---

## 3. Coverage notes and gaps

### 3.1 API handlers with no UI caller

| API | Observation |
|---|---|
| POST /api/auth/login-phone-password | FR-AUTH-008. API-only |
| GET /api/client/account | Duplicates `getClientAccountSummary`. Unused |
| POST /api/admin/finance/payouts | FR-PAY-011. Route transfers have no UI |
| GET /api/payments/razorpay/config | No caller found `[NEEDS VALIDATION]` |
| POST /api/payments/razorpay/order, /verify | Deprecated 410 stubs |
| GET /api/portal/messages | Consumed only by orphan `src/routes/messages.tsx` |
| GET /api/marketplace/professional?id= | No caller found (the UI uses `professional-detail`) |
| GET /api/marketplace/jobs via `[resource]` | Shadowed by the static `app/api/marketplace/jobs/route.ts` |
| POST /api/webhooks/* | External callers. See FR-PAY-005 and FR-VER-007 about the Origin gate |

### 3.2 Orphan UI modules (not imported by any page)

`src/routes/messages.tsx`, `src/components/ProfileSetup.tsx`, `src/components/AdminDataPage.tsx`, `src/components/DatabaseStatus.tsx`, `src/components/WebsitePagePreview.tsx`, `src/components/JobCard.tsx` (verified with repository-wide import grep).

### 3.3 Behaviour expected by the older SRS but absent

Proposal withdrawal (FR-PROP-008), party-side dispute replies (FR-DSP-005), device and browser push (FR-NOT-009), job auto-expiry, document expiry and badge derivation, admin MFA and role separation, account self-deletion and data export, review windows, a notification preference UI (FR-ACC-011), and a CAPTCHA on the contact form. See [SRS.md §8.2](./SRS.md#82-discrepancies-old-srs-vs-implementation).

### 3.4 Broken notification links `[NEEDS VALIDATION]`

- `href: "/professional/earnings"` (`src/lib/marketplace-notifications.ts`, payout approved) and `href: "/professional/profile"` (`app/api/admin/verifications/route.ts:130`) have no matching `page.tsx`.
- `NEW_JOB` links to `/job/{id}`, which sits inside the client-only route group. Professionals are redirected unless the notification UI rewrites the link.
