# M1 — AUTHENTICATION & IDENTITY

**Milestone:** M1 Foundation · **Target:** weeks 3–6 · **Depends on:** all of M0

**Exit criteria:** a user registers by email or phone, verifies by OTP, logs in, refreshes silently, resets a forgotten password, and uploads a profile photo — through `/api/v1` on web, with route guards enforced server-side. This is the first complete vertical slice and it sets the pattern for every module after it.

Each ticket is scoped to one Claude Code session. Work them in order — later tickets assume earlier ones landed. One ticket, one branch, one PR.

**Session protocol:** read `/CLAUDE.md`, then this ticket. Stay inside the files listed under _Scope_. If the work requires touching anything outside that list, stop and say so rather than expanding silently.

**Standing constraint (ADR-001):** every capability here must exist as a REST endpoint under `/api/v1`. Server Components may read through the service layer directly, but the REST equivalent must exist and be tested. No Server Actions outside the admin panel.

---

## M1-01 — Token service and JWT primitives

**Depends on:** M0-08
**Estimate:** 8h
**Reference:** TAD §3.1–3.2, SRS-AUT-06

### Goal

Signing, verification and rotation of access and refresh tokens, isolated from any HTTP concern.

### Scope

`packages/core/src/auth/**` · `packages/db` (RefreshToken queries) · tests

### Steps

1. RS256 signing using `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` (base64 PEM from env).
2. Access token claims: `sub`, `userType`, `accountStatus`, `profileComplete`, `iat`, `exp`, `jti`. **Nothing else** — badges, ratings and permissions are read from the database, never trusted from a token.
3. `issueTokenPair(userId)` — access (15m) + refresh (30d), refresh stored **hashed** with a `familyId`.
4. `rotateRefreshToken(presentedToken)`:
   - valid and unconsumed → mark consumed, issue new pair in the same family
   - **already consumed → revoke the entire family and throw** (replay detection)
   - expired or revoked → throw
5. `verifyAccessToken(token)` returning typed claims.
6. `revokeFamily(familyId)`, `revokeAllForUser(userId)`.

### Definition of Done

- Unit tests cover: happy rotation, replay of a consumed token revokes the family, expired refresh rejected, tampered signature rejected
- No raw refresh token is ever persisted — assert the stored value differs from the issued value
- Zero imports from `next/*`

### Out of scope

HTTP routes, cookies, OTP.

---

## M1-02 — Password hashing and credential service

**Depends on:** M1-01
**Estimate:** 4h
**Reference:** SRS-NFR-09, Appendix A

### Goal

Password storage and validation that meets the security baseline.

### Scope

`packages/core/src/auth/password.ts` · `packages/core/src/auth/validators.ts` · tests

### Steps

1. argon2id hashing, memory cost from `ARGON2_MEMORY_COST`.
2. `hashPassword`, `verifyPassword` — the latter constant-time.
3. Zod password schema per Appendix A: ≥8 chars, at least one letter and one number, rejected against a common-password list.
4. Email (RFC 5322, ≤254) and E.164 phone validators.

### Definition of Done

- Hash output is not reversible and differs across calls for the same input
- Common passwords (`password1`, `12345678a`) rejected
- Phone validator rejects numbers without a country code

### Out of scope

Registration flow.

---

## M1-03 — OTP service with Twilio and email

**Depends on:** M1-02
**Estimate:** 10h
**Reference:** SRS-AUT-03, SRS-AUT-04

### Goal

Issue, deliver and verify one-time codes with the rate limits the SRS requires.

### Scope

`packages/core/src/auth/otp.ts` · `packages/core/src/ports/{sms,email}.ts` · `apps/web/src/server/adapters/{twilio,smtp}.ts` · tests

### Steps

1. `SmsPort` and `EmailPort` interfaces in `packages/core/src/ports`; Twilio and nodemailer adapters in the app layer. **Core must not import the SDKs** (TAD §2.2, rule 3).
2. `issueOtp(userId, channel)` — 6 digits, hashed at rest, 10-minute expiry, consumes any prior unconsumed code.
3. `verifyOtp(userId, code)` — max 5 attempts, then a 30-minute lockout on that user.
4. Resend limits: max 3 per hour, minimum 60s between requests.
5. Destination masked in every log line (`+1416•••1234`).
6. Dev mode: when `NODE_ENV=development`, log the code rather than sending, so local work doesn't burn Twilio credit.

### Definition of Done

- Tests cover: correct code succeeds, wrong code increments attempts, 6th attempt locks, expired code rejected, resend throttles at 3/hour and 60s
- Adapters are swappable — a fake port is used in tests, not a mocked SDK
- No unmasked phone number or raw code appears in logs

### Out of scope

Registration routes.

---

## M1-04 — Registration and verification endpoints

**Depends on:** M1-03
**Estimate:** 10h
**Reference:** SRS-AUT-01, 02, 03, 09

### Goal

`POST /api/v1/auth/register`, `/verify-otp`, `/resend-otp` — the first real endpoints on the M0-08 pattern.

### Scope

`apps/web/src/app/api/v1/auth/**` · `apps/web/src/server/services/auth-service.ts` · `packages/contracts/openapi.yaml` · tests

### Steps

1. **Update `openapi.yaml` first**, then implement against generated types.
2. `POST /auth/register` — email _or_ phone, password, `userType`, `acceptTerms`. Creates `USER` with `accountStatus = PENDING`, issues OTP, returns `201 { userId, otpRequired: true }` and **no tokens**.
3. `POST /auth/verify-otp` — on success sets the matching verified flag, promotes to `ACTIVE`, issues the token pair.
4. `POST /auth/resend-otp`.
5. Creates the empty `ClientProfile` or `ProfessionalProfile` row on verification, with `profileComplete = false`.
6. Seeds default `NotificationPreference` rows for all 26 event types.
7. Errors: 409 already registered · 422 validation · 429 rate limited · 410 expired code · 423 locked.

### Definition of Done

- Integration test walks register → verify → authenticated request
- Registering an existing email returns 409 without revealing whether it was verified
- A `PENDING` account cannot call an authenticated endpoint
- `openapi.yaml` documents all three paths and `contracts:generate` is clean

### Out of scope

Login, refresh, reset.

---

## M1-05 — Login, refresh and logout endpoints

**Depends on:** M1-04
**Estimate:** 8h
**Reference:** SRS-AUT-06, SRS-AUT-08

### Goal

`POST /auth/login`, `/refresh`, `/logout` with rate limiting and correct web cookie handling.

### Scope

`apps/web/src/app/api/v1/auth/{login,refresh,logout}/route.ts` · `apps/web/src/server/http/cookies.ts` · `openapi.yaml` · tests

### Steps

1. `POST /auth/login` — email or phone + password. Returns access token in the body **and** sets refresh as httpOnly, Secure, SameSite=Lax cookie for web. Mobile clients (phase 2) read the refresh token from the body.
2. `PENDING` → 403 with `otpRequired`; `SUSPENDED` → 403 with a support reference.
3. `POST /auth/refresh` — accepts cookie or body; performs rotation via M1-01; on replay detection returns 401 and clears cookies.
4. `POST /auth/logout` — revokes the presented family, clears cookies.
5. Rate limits: 10 per account and 20 per IP per 15 minutes.
6. Update `lastLoginAt`.

### Definition of Done

- Replaying a consumed refresh token returns 401 **and** invalidates the whole family — verified by a subsequent legitimate refresh also failing
- Rate limit returns 429 with `Retry-After`
- Login response contains no `passwordHash`, and no password ever appears in logs

### Out of scope

Google OAuth, password reset.

---

## M1-06 — Password reset

**Depends on:** M1-05
**Estimate:** 5h
**Reference:** SRS-AUT-07

### Goal

`POST /auth/forgot-password` and `/reset-password`, resistant to account enumeration.

### Scope

`apps/web/src/app/api/v1/auth/{forgot-password,reset-password}/route.ts` · `auth-service.ts` · `openapi.yaml` · tests

### Steps

1. `forgot-password` — single-use token, hashed at rest, 30-minute expiry, sent to a **verified** channel only.
2. **Identical response and timing whether or not the account exists.** Always 200 with the same body.
3. `reset-password` — validates token, sets new hash, consumes token, and **revokes every refresh token family for that user**.
4. Notify the user by email that their password changed.

### Definition of Done

- Response for an unknown email is byte-identical to a known one
- A used token cannot be reused
- All sessions terminate on reset — an old access token is rejected after expiry and no refresh succeeds

### Out of scope

Account recovery for lost email access.

---

## M1-07 — Google OAuth

**Depends on:** M1-05
**Estimate:** 6h
**Reference:** SRS-AUT-05

### Goal

Sign in with Google, linking rather than duplicating existing accounts.

### Scope

`apps/web/src/app/api/v1/auth/google/**` · `auth-service.ts` · `openapi.yaml` · tests

### Steps

1. OAuth 2.0 authorization-code flow with PKCE; verify the ID token signature and audience server-side.
2. Match on `googleSub` first, then verified email.
3. **Email match on an existing LOCAL account → require password confirmation before linking.** Never auto-merge on email alone.
4. New user → create `ACTIVE` with `emailVerified = true`, `authProvider = GOOGLE`, no password hash.
5. `userType` is chosen before the OAuth redirect and carried through `state`.

### Definition of Done

- New Google user lands authenticated with a profile row created
- Existing LOCAL account with the same email is not silently taken over
- `state` mismatch or replay returns 400

### Out of scope

Apple sign-in.

---

## M1-08 — Auth middleware and route guards

**Depends on:** M1-05
**Estimate:** 6h
**Reference:** SRS-SEC-01, port guide §6

### Goal

Role-based guards on `/client`, `/pro` and `/admin` — with the server-side re-check that actually enforces them.

### Scope

`apps/web/src/middleware.ts` · `apps/web/src/server/http/require-auth.ts` · tests

### Steps

1. Middleware decodes the access token, checks `userType`, redirects unauthenticated users to `/login?next=…`.
2. `requireAuth(handler, { userType, adminRole })` wrapper for route handlers — **this is the real enforcement**; middleware is UX only.
3. `requireOwnership(resource)` helper for owner-scoped resources.
4. Incomplete profiles redirect to onboarding for gated routes.
5. Admin routes additionally require `mfaEnabledAt` set.

### Definition of Done

- A client's token calling a `/pro` endpoint gets 403 from the handler, not merely a redirect
- Removing middleware entirely leaves every API endpoint still protected — prove this with a test
- Deep links preserve `next` through login

### Out of scope

MFA enrolment (M7).

---

## M1-09 — Media upload service

**Depends on:** M1-08
**Estimate:** 10h
**Reference:** SRS §6 Media, TAD §6

### Goal

Signed direct-to-Supabase uploads with a virus-scan gate, used by every later module.

### Scope

`apps/web/src/app/api/v1/media/**` · `apps/web/src/server/services/media-service.ts` · `packages/core/src/ports/storage.ts` · tests

### Steps

1. `StoragePort` interface; Supabase adapter in the app layer.
2. Five buckets per TAD §6 — `public-media`, `job-media`, `work-proof`, `verification`, `chat-attachments`.
3. `POST /media/upload-url` — validates mime and size against the target bucket, returns a signed upload URL and a pending `Media` row.
4. `POST /media/:id/complete` — client confirms upload; enqueues a virus scan `BackgroundJob`.
5. `GET /media/:id/url` — returns a 15-minute signed download URL, **authorized per bucket rules**. `verification` is admin-only, always.
6. Files remain unretrievable until `virusScanStatus = CLEAN`.

### Definition of Done

- A client cannot fetch a URL for another user's private media (403)
- A `verification` bucket object is unreachable by any non-admin, including its owner's client counterparty
- An oversized or wrong-mime request is rejected before a URL is issued
- Nothing is ever written to the local filesystem

### Out of scope

Image resizing, the actual AV engine (stub the scan to `CLEAN` in dev with a TODO).

---

## M1-10 — Auth screens

**Depends on:** M1-04 … M1-08
**Estimate:** 14h
**Reference:** port guide §7 step 6, design system

### Goal

Signup, login, OTP, forgot and reset password — ported from the prototype and wired to real endpoints.

### Scope

`apps/web/src/app/(auth)/**` · `apps/web/src/components/auth/**` · `apps/web/src/lib/api-client.ts`

### Steps

1. API client with automatic refresh on 401 and a single-flight queue so concurrent 401s trigger one refresh, not five.
2. Port `login`, `signup`, `verify`, `forgot-password` from `src/routes/`; add `reset-password`.
3. `userType` selection on signup — client or professional.
4. OTP screen using the already-installed `input-otp`, with resend countdown reflecting the 60s server limit.
5. react-hook-form + Zod, sharing the schemas from M1-02 so client and server validation cannot diverge.
6. Google button on both login and signup.
7. `sonner` toasts for errors; **never surface raw server messages**.
8. Post-auth routing by `userType` and `profileComplete`.

### Definition of Done

- Full journey works in the browser: signup → OTP → dashboard placeholder
- Refresh happens silently; the user is not logged out at the 15-minute boundary
- Responsive at 375px — this is a primary target, not an afterthought
- Dark mode correct on every screen

### Out of scope

Profile setup wizards (M2).

---

## M1 SUMMARY

| Ticket                         | Est.    | Track |
| ------------------------------ | ------- | ----- |
| M1-01 Token service            | 8h      | Core  |
| M1-02 Password & validators    | 4h      | Core  |
| M1-03 OTP service              | 10h     | Core  |
| M1-04 Registration endpoints   | 10h     | API   |
| M1-05 Login / refresh / logout | 8h      | API   |
| M1-06 Password reset           | 5h      | API   |
| M1-07 Google OAuth             | 6h      | API   |
| M1-08 Middleware & guards      | 6h      | API   |
| M1-09 Media service            | 10h     | API   |
| M1-10 Auth screens             | 14h     | Web   |
| **Total**                      | **81h** |       |

### Sequencing

```
M1-01 ─► M1-02 ─► M1-03 ─► M1-04 ─► M1-05 ─┬─► M1-06
                                            ├─► M1-07
                                            └─► M1-08 ─► M1-09
                                                          │
                            M1-04…M1-08 ────────────────► M1-10
```

Mostly serial — auth doesn't parallelise well. The second developer should take M1-09 and start M1-10's API client and shared components once M1-05 lands, then pick up M2 profile schema work early.

### Milestone risks

- **Twilio trial only delivers to verified numbers.** Upgrade before M1-03 testing or the OTP path can't be exercised properly.
- **Refresh rotation is the subtlest code in the milestone.** Replay detection has to revoke the family, not just the token. Write those tests first.
- **Do not let auth logic drift into React components.** If a screen needs a decision, the endpoint makes it — ADR-001 depends on this.
