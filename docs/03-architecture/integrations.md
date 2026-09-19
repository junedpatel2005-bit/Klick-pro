# External Integrations

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

Scope: every external service found in source and configuration (§13). Environment variable **names only**; no values. Integration status legend: **Implemented**, **Partially implemented**, **Configured but unused**, **Unknown** (runtime configuration of deployed environments cannot be verified from the repository).

Related: [solution-architecture.md](./solution-architecture.md) · [architecture-decisions.md](./architecture-decisions.md) · [environment.md](../08-operations/environment.md) · [security.md](../08-operations/security.md) · [system-context diagram](./diagrams/system-context.md).

## Summary

| # | Service | Purpose | Enabled when | Status |
|---|---|---|---|---|
| INT-01 | Razorpay (Orders, Checkout, Webhooks) | Client wallet top-up in INR | `RAZORPAY_ENABLED !== "false"` and key id + secret set | Implemented |
| INT-02 | Razorpay Route (Transfers) | Payout of withdrawals to professionals' linked accounts | INT-01 configured and `RAZORPAY_ROUTE_ENABLED === "true"` | Implemented; disabled flag → 503 [VALIDATED 2026-09-17 · [V-47](../validation/LOCAL_VALIDATION_LOG.md)]; production setting [NEEDS VALIDATION — not testable locally] |
| INT-03 | Persona | Hosted identity/KYC inquiry for professionals | `PERSONA_ENABLED === "true"` and API key + template id | Partially implemented |
| INT-04 | Twilio Verify | SMS one-time passwords for signup/login/password reset by phone | `PHONE_OTP_PROVIDER === "twilio"` and 3 Twilio vars | Implemented |
| INT-05 | Generic SMS API | Reserved for a future SMS provider | — | Configured but unused |
| INT-06 | SMTP (nodemailer) | Verification, password reset and notification emails | SMTP vars set (notification path checks; auth path does not) | Implemented |
| INT-07 | Google OAuth 2.0 / OpenID Connect | "Sign in with Google" | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | Implemented |
| INT-08 | Google Maps JavaScript API + Places (browser) | Interactive maps, address picking, discovery maps | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` set and `NEXT_PUBLIC_GOOGLE_MAPS_JS_ENABLED !== "false"` | Implemented |
| INT-09 | Google Geocoding API (server) | Forward/reverse geocoding proxy `/api/geocode` | `GOOGLE_MAPS_SERVER_KEY` or fallback browser key | Implemented |
| INT-10 | S3-compatible object storage (AWS SDK v3) | Private project files, verification documents, avatars | `FILE_STORAGE_PROVIDER === "s3"` | Implemented |
| INT-11 | Sentry | Error monitoring and 10% tracing | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Implemented (browser SDK active but ingest requests CSP-blocked [VALIDATED 2026-09-17 · [V-51](../validation/LOCAL_VALIDATION_LOG.md)]) |
| INT-12 | PostgreSQL (hosted; comments mention Supabase PgBouncer) | Primary datastore | `DATABASE_URL` (+ `DIRECT_URL` for CLI) | Implemented |
| INT-13 | Socket.IO (self-hosted) | Realtime push | `server.mjs` entry point | Implemented (internal, listed for completeness) |
| INT-14 | `i.pravatar.cc` | Placeholder avatar images (seed/demo data) | Always allowed by CSP and `next.config.ts` `images.remotePatterns` | Implemented (demo) |
| — | CKEditor 5, `@vercel/functions`, `@tanstack/react-query` | npm dependencies with no imports in application code | — | Configured but unused |

---

## INT-01 Razorpay — Orders, Checkout and Webhooks

| Field | Detail |
|---|---|
| Service | Razorpay payment gateway (India) |
| Purpose | Fund the client's internal wallet. Milestone payments are then settled internally from the wallet ([ADR-009](./architecture-decisions.md#adr-009--internal-wallet-ledger-with-admin-wallet-escrow)). |
| Integration location | `src/lib/razorpay.ts` (REST client, signature helpers); `app/api/payments/razorpay/config/route.ts` (public key id); `app/api/wallet/deposit/order/route.ts`; `app/api/wallet/deposit/verify/route.ts`; `app/api/wallet/deposit/fail/route.ts`; `app/api/webhooks/razorpay/route.ts`; browser Checkout loader `src/routes/client/earnings.tsx:193-207`; `scripts/check-razorpay-sandbox.ts` (`npm run check:razorpay`). Legacy `app/api/payments/razorpay/order` and `verify` return **410 Gone**. |
| Authentication mechanism | Outbound: HTTP Basic `key_id:key_secret` (`authHeader()`). Client callback: HMAC-SHA256 of `order_id|payment_id` with key secret, `timingSafeEqual`. Webhook: HMAC-SHA256 of raw body with webhook secret compared to `X-Razorpay-Signature`. |
| Environment variables | `RAZORPAY_ENABLED`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| API usage | `POST https://api.razorpay.com/v1/orders` (amount = rupees × 100, currency `INR`, receipt `servio_wallet_<userId>_<ts>`, notes `purpose=wallet_top_up`). Browser `checkout.razorpay.com/v1/checkout.js`. Webhook events handled: `payment.captured`, `payment.failed` (matched by `order_id` to `Payment.razorpayOrderId` or `WalletTransaction.providerReference`). |
| Failure handling | Unconfigured → `/api/wallet/deposit/*` return **503**, config endpoint returns `enabled:false`. Order API error → throws (description from Razorpay) → unhandled 500 [NEEDS VALIDATION of UI message — not testable locally]. Verify: bad signature 400; already `COMPLETED` → idempotent `{ok, alreadyProcessed}`. Webhook: invalid/missing signature or unconfigured → **401**; bad JSON → 400; receipt persisted first with `createMany … skipDuplicates` (`RazorpayWebhookEvent`), `PROCESSED` → no-op 200, `PROCESSING` < 5 min → 200 `processing:true`, stale `PROCESSING` reset; processing inside `db.$transaction` with a conditional claim; amount/currency/payment-id mismatch throws → event `FAILED` with `lastError`, response **500** so Razorpay retries. No outbound retry logic. |
| Known issues | (1) `proxy.ts:44-46` rejects POSTs without an `Origin` header, so webhook POSTs without `Origin` get 403 "Request origin is not allowed." before the handler runs (with the `APP_URL` Origin they reach it and get 401 invalid signature) [PARTIALLY VALIDATED 2026-09-17 · [V-20](../validation/LOCAL_VALIDATION_LOG.md); live delivery not testable locally]. (2) Wallet credit in the webhook (`route.ts:134-138`) and in `creditWalletFromVerifiedProvider` (`src/lib/wallet-ledger.ts:88-97`) read `PENDING` then increment unconditionally → double credit under concurrency: 20 concurrent verify calls credited one 5,000 top-up 20,000 (and 25,000 in another round) [VALIDATED 2026-09-17 · [V-41](../validation/LOCAL_VALIDATION_LOG.md)]. (3) Webhook uses `console.error`, not `logServerError`. |
| Status | Implemented |

## INT-02 Razorpay Route — Transfers

| Field | Detail |
|---|---|
| Purpose | Transfer approved withdrawal amounts from a captured Razorpay payment to a professional's Route linked account |
| Integration location | `src/lib/razorpay.ts` `createRazorpayPaymentTransfer()`; `app/api/admin/finance/payouts/route.ts`; `app/api/professional/razorpay-account/route.ts` (professional stores `razorpayAccountId`, no remote validation) |
| Authentication mechanism | HTTP Basic (same keys) |
| Environment variables | `RAZORPAY_ROUTE_ENABLED` (+ INT-01 vars) |
| API usage | `POST https://api.razorpay.com/v1/payments/{paymentId}/transfers` with `account`, `amount` (paise), `currency INR`, `notes.withdrawal_id` |
| Failure handling | Not enabled → **503** "Razorpay Route payouts are not enabled."; withdrawal not `PENDING` → 409; payment not captured / no linked account → 400; transfer error throws with Razorpay description. No idempotency key sent to Razorpay [NEEDS VALIDATION — not testable locally, Route not enabled — whether a double-click can transfer twice — the handler re-checks `PENDING` before calling]. |
| Status | Implemented; `.env.example` says keep `false` until Route is approved → likely disabled in practice; with the flag false, `POST /api/admin/finance/payouts` → 503 [VALIDATED 2026-09-17 · [V-47](../validation/LOCAL_VALIDATION_LOG.md)]; production flag [NEEDS VALIDATION — not testable locally]. Milestone payouts via `/api/admin/finance/milestone-payout` are internal wallet movements, not Route transfers. |

## INT-03 Persona — KYC

| Field | Detail |
|---|---|
| Purpose | Optional hosted identity verification for professionals; status shown to admins |
| Integration location | `src/lib/persona.ts`; `app/api/verification/persona/start/route.ts`; `app/api/verification/persona/status/route.ts`; `app/api/webhooks/persona/route.ts`; UI `src/routes/professional/verification.tsx`, `app/admin/verifications/page.tsx` |
| Authentication mechanism | Outbound `Authorization: Bearer <PERSONA_API_KEY>`; `Idempotency-Key: servio-persona-<userId>-<uuid>` (random per call, so it does not dedupe user retries). Webhook `Persona-Signature` header `t=<ts>,v1=<hmac>`: HMAC-SHA256 of `"<t>.<rawBody>"`, 300-second timestamp tolerance, multiple `v1` supported. |
| Environment variables | `PERSONA_ENABLED`, `PERSONA_API_KEY`, `PERSONA_TEMPLATE_ID`, `PERSONA_WEBHOOK_SECRET` |
| API usage | `POST https://api.withpersona.com/api/v1/inquiries` (template id, `reference-id` = user id, first/last name) → stores `PersonaVerification` with `providerInquiryId`, `providerStatus`, returns `meta.one-time-link`; `GET /inquiries/{id}` helper (`getPersonaInquiry`). |
| Failure handling | Not a professional → 401; unconfigured → 503; Persona error → logged, **502**. Webhook: disabled/unsigned/invalid → 401; malformed → 400; duplicate event (`PersonaWebhookEvent.providerEventId` unique, Prisma `P2002`) → 200; unknown inquiry → 200 ignored; out-of-order events (`created-at` ≤ `lastProviderEventAt`) → 200 stale; handler exception → 500. **Gap:** the dedupe row is inserted before the status update and outside a transaction, so a failure after insert makes later retries look like duplicates and the update is lost. Persona status never changes `ProfessionalVerification` approval automatically. |
| Status | Partially implemented |

## INT-04 Twilio Verify — SMS OTP

| Field | Detail |
|---|---|
| Purpose | Phone verification during signup, phone login, forgot-password by phone |
| Integration location | `src/lib/phone-otp-provider.ts` (`requestPhoneOtp`, `verifyPhoneOtp`); callers in `app/api/auth/[action]/route.ts` (`send-phone-otp`, `verify-phone`, `send-phone-login-otp`, `login-phone`, `forgot-password-phone`, `verify-forgot-password-phone`); proof cookie `src/lib/dev-phone-otp.ts` |
| Authentication mechanism | Twilio SDK (`twilio` ^6) with Account SID + Auth Token |
| Environment variables | `PHONE_OTP_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`; development mode: `DEV_PHONE_OTP` |
| API usage | `verify.v2.services(sid).verifications.create({to, channel:"sms"})`; `verificationChecks.create({to, code})` expecting `status === "approved"` |
| Failure handling | Provider not `twilio` → development mode: code = `DEV_PHONE_OTP`, else a fixed development code when not production, else random (never delivered); SHA-256 hash stored in `OtpCode`, 10-minute expiry, max 5 attempts via atomic `UPDATE`, prior codes invalidated; code logged to console outside production (confirmed: the code is printed to the server log). **Defect:** verification uses raw SQL `"expiresAt" > NOW()`, so it always fails ("Invalid verification code.") when the DB session TimeZone is not UTC — proven IST fail / UTC pass; the developer's local DB is Asia/Calcutta [FOUND IN VALIDATION 2026-09-17 · [V-27](../validation/LOCAL_VALIDATION_LOG.md)]; production DB timezone not testable locally. `twilio` selected but unconfigured → 503. Send error → logged, 503. Check 404 (expired) → 400 "invalid or expired"; other errors → 503. Twilio handles its own rate limits; app-level `rateLimit` also applied in the auth route. |
| Status | Implemented. Which mode production uses: [UNKNOWN]. |

## INT-05 Generic SMS API

| Field | Detail |
|---|---|
| Environment variables | `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_ID`, `SMS_API_URL` |
| Integration location | None — no references outside `.env.example` ("Reserved for a future SMS provider") |
| Status | Configured but unused (Planned per `.env.example` comment) |

## INT-06 SMTP Email (nodemailer)

| Field | Detail |
|---|---|
| Purpose | Transactional auth emails (email verification, password reset) and notification emails (new account, disputes, milestones, messages, etc.) |
| Integration location | `src/lib/email.ts` (`sendAuthEmail`, `sendNotificationEmail`, `isEmailConfigured`); callers `app/api/auth/[action]/route.ts` (via `enqueueBackgroundJob`), `src/lib/marketplace-notifications.ts` (`sendEmails`, awaited with `Promise.allSettled`) |
| Authentication mechanism | SMTP AUTH user/password; TLS implicit when port is 465, otherwise STARTTLS negotiation by nodemailer default |
| Environment variables | `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (display name forced to "Klick-Pro"); `APP_URL` for absolute links in notifications |
| API usage | `nodemailer.createTransport(...)` per send (no pooling); `sendMail` with HTML (escaped) + text bodies |
| Failure handling | Notifications: unconfigured → one `console.warn`, skip; per-recipient failures logged with `logServerError("marketplace.notification.email.failed")`; respects `User.emailNotificationsEnabled`. Auth emails: no configuration guard; run in background job → failures logged `background.job.failed`; user still gets success response; no retry. |
| Known issues | Auth links are built by `publicAppOrigin(request)` from `x-forwarded-host`/`Host` headers before `APP_URL` (`app/api/auth/[action]/route.ts:44-71`) → password-reset/verification link host can be influenced by the requester unless a trusted proxy normalizes headers (host-header poisoning): `forgot-password` with `X-Forwarded-Host: evil.example` e-mailed a reset link on `https://evil.example/…`; links use `Host`, not `APP_URL`; Google `redirect_uri` also follows `X-Forwarded-Host` [VALIDATED 2026-09-17 · [V-25](../validation/LOCAL_VALIDATION_LOG.md)]; edge header handling in production not testable locally. Auth email text always says "expires in 24 hours" while password-reset tokens expire in 1 hour (`route.ts:748`). |
| Status | Implemented |

## INT-07 Google OAuth 2.0 / OpenID Connect

| Field | Detail |
|---|---|
| Purpose | Sign up / sign in with Google as CLIENT or PROFESSIONAL |
| Integration location | `app/api/auth/[action]/route.ts:101-225` (`GET /api/auth/google`, callback at `/api/v1/auth/google` via rewrite); `src/components/GoogleMark.tsx` (button icon) |
| Authentication mechanism | Authorization-code flow with client secret; CSRF `state` stored in httpOnly cookie `servio_google_oauth` (10 min, JSON `{state, role, nextPath}`); no PKCE, no ID-token verification (uses userinfo endpoint over TLS) |
| Environment variables | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; redirect URI derived from request host (`publicAppOrigin`) — README documents `http://localhost:3000/api/v1/auth/google` |
| API usage | Redirect to `https://accounts.google.com/o/oauth2/v2/auth` (`scope openid email profile`, `prompt select_account`); `POST https://oauth2.googleapis.com/token`; `GET https://openidconnect.googleapis.com/v1/userinfo`. Requires `email_verified === true`. Links by `googleId` or **existing email** (sets `authProvider GOOGLE` and `emailVerifiedAt`). New users get the role from the pre-auth query string. |
| Failure handling | Unconfigured → redirect `/login?oauthError=google-not-configured`; any error (state mismatch, token/userinfo failure) → redirect `/login?oauthError=google-failed` and clear cookie. `nextPath` restricted to same-site paths (`/` but not `//`). |
| Status | Implemented (earlier notes calling it "env only" are incorrect). Auth deep-dive: [authentication-and-authorization.md](./authentication-and-authorization.md). |

## INT-08 Google Maps JavaScript API + Places (browser)

| Field | Detail |
|---|---|
| Purpose | Maps for job/professional discovery, location pickers, previews |
| Integration location | `src/components/GoogleMapsProvider.tsx` (`useJsApiLoader`, libraries `["places"]`, `gm_authFailure` hook); map components `GoogleAddressMap`, `AddressMapPicker`, `JobsPreviewMap`, `ProfessionalDiscoveryMap`, `ProfessionalJobsMap`, `ProfessionalLocationMap`, `ProfessionalsPreviewMap`; loaded globally from `src/components/providers.tsx` |
| Authentication mechanism | Browser API key (public; should be HTTP-referrer restricted — [UNKNOWN] in Google Cloud) |
| Environment variables | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_JS_ENABLED` |
| API usage | `@react-google-maps/api` loader; CSP allows `maps.googleapis.com`, `places.googleapis.com`, `*.gstatic.com` |
| Failure handling | Context exposes `isConfigured`, `isLoaded`, `hasError`; auth/billing failures captured via `gm_authFailure` and surfaced as an error state; components render fallbacks (manual address entry) [NEEDS VALIDATION per component — not testable locally] |
| Status | Implemented |

## INT-09 Google Geocoding API (server)

| Field | Detail |
|---|---|
| Purpose | Convert typed addresses/coordinates to formatted address + state/city/district for Indian locations |
| Integration location | `app/api/geocode/route.ts` (`GET /api/geocode?q=` or `?lat=&lon=`) |
| Authentication mechanism | API key in query string |
| Environment variables | `GOOGLE_MAPS_SERVER_KEY` (falls back to `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) |
| API usage | `GET https://maps.googleapis.com/maps/api/geocode/json?address=…|latlng=…&key=…` |
| Failure handling | In-memory rate limit 20 requests/min per `x-forwarded-for` IP → 429; no key → 503; 8-second `AbortController` timeout → 503 "timed out"; non-OK HTTP or status other than `OK`/`ZERO_RESULTS` → 503 with "enter the address manually" guidance; no retries; no auth required on the endpoint (public quota consumption). |
| Related | Location privacy helpers in `src/lib/geo.ts` (`approximateAddress`, `createDisplayPoint` using `GEO_OBFUSCATION_SALT` — **not listed in `.env.example`**; returns `null` when unset). |
| Status | Implemented |

## INT-10 S3-Compatible Object Storage

| Field | Detail |
|---|---|
| Purpose | Private storage for project work files, professional verification documents and avatars |
| Integration location | `src/lib/project-file-storage.ts`; callers `app/api/portal/project-files/route.ts`, `app/api/portal/project-files/[fileId]/route.ts`, `app/api/professional/verification/upload/route.ts`, `app/api/professional/verification/documents/[...storageKey]/route.ts`, `app/api/profile/avatar/route.ts` |
| Authentication mechanism | Static access key pair if both provided, otherwise AWS SDK default credential provider chain (instance role, env, etc.) |
| Environment variables | `FILE_STORAGE_PROVIDER`, `FILE_STORAGE_BUCKET`, `FILE_STORAGE_REGION`, `FILE_STORAGE_ENDPOINT`, `FILE_STORAGE_FORCE_PATH_STYLE`, `FILE_STORAGE_ACCESS_KEY_ID`, `FILE_STORAGE_SECRET_ACCESS_KEY` |
| API usage | `PutObjectCommand` (with `ContentType`), `GetObjectCommand` (`transformToByteArray`), `DeleteObjectCommand`; objects streamed back through authenticated routes (no presigned URLs, no public ACLs) |
| Failure handling | Provider not `s3` → local disk `.project-work-files/`; in production local provider **throws** ("Configure S3-compatible storage"). Missing bucket/region → throws on first use. `NoSuchKey`/`ENOENT` mapped to not-found by `isProjectFileNotFound`. Multi-file upload removes already-stored objects and their `StoredFile` rows on failure (`app/api/portal/project-files/route.ts:84-89`) and logs `project.file.upload.failed` with request id. No retries beyond AWS SDK defaults. |
| Status | Implemented. Actual bucket/provider in production: [UNKNOWN]. |

## INT-11 Sentry

| Field | Detail |
|---|---|
| Purpose | Error capture and performance tracing |
| Integration location | `instrumentation.ts` (loads `sentry.server.config.ts` / `sentry.edge.config.ts`; exports `onRequestError = captureRequestError`); `instrumentation-client.ts` (browser init, `onRouterTransitionStart`); `src/lib/server-logger.ts` (`captureException` with tag `event` and context `servio`) |
| Authentication mechanism | DSN |
| Environment variables | `SENTRY_DSN` (server/edge), `NEXT_PUBLIC_SENTRY_DSN` (browser). `.env.example` warns never to place a Sentry auth token there. |
| API usage | `Sentry.init({ tracesSampleRate: 0.1, sendDefaultPii: false, enabled: Boolean(dsn) })` |
| Failure handling | No DSN → disabled (no-op). `next.config.ts` not wrapped with `withSentryConfig` → no source-map upload/tunnel route. CSP `connect-src` (`next.config.ts:9`) lacks `*.sentry.io`/ingest host → browser SDK is active and its ingest requests are blocked by CSP `connect-src` [VALIDATED 2026-09-17 · [V-51](../validation/LOCAL_VALIDATION_LOG.md)]. |
| Status | Implemented (server); browser path likely ineffective |

## INT-12 PostgreSQL (hosted)

| Field | Detail |
|---|---|
| Purpose | System of record |
| Integration location | `src/lib/db.ts` (Prisma + `pg.Pool` max 5); `server.mjs` (separate `pg.Pool` max 2 for socket session checks); `prisma.config.ts` (CLI) |
| Authentication mechanism | Connection string credentials |
| Environment variables | `DATABASE_URL`, `DIRECT_URL` (CLI/migrations), `TEST_DATABASE_URL` (when `NODE_ENV=test`; not in `.env.example`) |
| Failure handling | Missing URL → `db.ts` throws at import; pool `connectionTimeoutMillis 10000`; socket auth skips DB revocation check if `DATABASE_URL` is unset **in the process environment** — `server.mjs` reads it before `.env` is loaded, so a URL only in `.env` also disables the check (fail-open) [CORRECTED 2026-09-17 · [V-10](../validation/LOCAL_VALIDATION_LOG.md)]; `/api/admin/database-status` is 401 unauthenticated in production and 200 unauthenticated in development [VALIDATED 2026-09-17 · [V-30](../validation/LOCAL_VALIDATION_LOG.md)]; `/api/admin/database-status` + `use-database-status` hook surface connectivity. Provider (Supabase suggested by `src/lib/db.ts:28-30` comment): [NEEDS VALIDATION — not testable locally]. Migrations-only databases lack 28 model tables, 16 FKs and 30 indexes vs `schema.prisma` [FOUND IN VALIDATION 2026-09-17 · [V-01](../validation/LOCAL_VALIDATION_LOG.md)]. |
| Status | Implemented — see [database-design.md](../04-database/database-design.md) |

## INT-13 Socket.IO (self-hosted realtime)

Internal component, documented in [solution-architecture.md §4](./solution-architecture.md#4-runtime-custom-server-and-realtime). Env: `REALTIME_ALLOWED_ORIGIN` (falls back to `APP_URL`; CORS disabled when neither set — including when they are set only in `.env`), `AUTH_SECRET` (read after `.env` load, works from `.env`), `DATABASE_URL` (must be a real process env var, otherwise revocation check is skipped) [VALIDATED 2026-09-17 · [V-10](../validation/LOCAL_VALIDATION_LOG.md)]. Failure handling: handshake rejected with "Unauthorized realtime connection"; server emitters no-op when the Socket.IO global is absent.

---

## Findings

| Severity | Title | Evidence | Impact |
|---|---|---|---|
| Critical [PARTIALLY VALIDATED 2026-09-17 · [V-20](../validation/LOCAL_VALIDATION_LOG.md); live delivery not testable locally] | Webhooks blocked by proxy origin check (403 without Origin) | `proxy.ts:4-14,44-46`; `app/api/webhooks/*` | Razorpay/Persona events rejected with 403 |
| Critical [VALIDATED 2026-09-17 · [V-41](../validation/LOCAL_VALIDATION_LOG.md)] | Wallet top-up double-credit race (concurrent verify alone credited 4–5×) | `src/lib/wallet-ledger.ts:88-97`; `app/api/webhooks/razorpay/route.ts:134-138` | Balance inflation |
| High [VALIDATED 2026-09-17 · [V-25](../validation/LOCAL_VALIDATION_LOG.md)] | Host-header-derived links in auth emails and OAuth redirect URI | `app/api/auth/[action]/route.ts:44-71,104` | Reset/verification link poisoning |
| Medium | Persona webhook dedupe before processing | `src/lib/persona.ts:113-141` | Lost status updates |
| Medium | Development OTP mode usable in production with static `DEV_PHONE_OTP` | `src/lib/phone-otp-provider.ts:25-32,80-88` | Phone verification bypass if misconfigured |
| Medium [FOUND IN VALIDATION 2026-09-17 · [V-27](../validation/LOCAL_VALIDATION_LOG.md)] | Development OTP verification always fails when DB session TimeZone ≠ UTC (raw `"expiresAt" > NOW()`) | `src/lib/phone-otp-provider.ts` `verifyPhoneOtp` | Phone verification/login broken on non-UTC databases |
| Medium | Geocode endpoint unauthenticated; server key falls back to public key | `app/api/geocode/route.ts:52-57` | Quota abuse; IP-restricted server key bypassed |
| Low | Env vars used but missing from `.env.example`: `ADMIN_EMAIL`, `GEO_OBFUSCATION_SALT`, `TEST_DATABASE_URL`, `HOSTNAME`, `PORT` | `grep process.env` | Silent misconfiguration |
| Low | Unused integrations/dependencies: `SMS_API_*`, CKEditor, `@vercel/functions`, React Query | `package.json`, `.env.example` | Maintenance noise |
| Low | Sentry browser path blocked by CSP; no source maps | `next.config.ts:9`, `instrumentation-client.ts` | Client errors not visible |

## Relationship to Existing Docs

| Existing document | Status |
|---|---|
| `project-docs/src/routes/docs/technical-architecture.md` (OTD-12/13, adapters list) | Outdated: names SendGrid/Mailtrap, Web Push/VAPID, Stripe Connect, Supabase Storage — none implemented; Razorpay, Persona, Twilio Verify, S3 are the actual providers |
| `project-docs/docs/current-architecture.md` env table | Obsolete: lists 11 variables; current `.env.example` has ~45 |
| `project-docs/docs/backend/16.7-file-storage-and-cdn.md`, `16.8-email-and-browser-notifications.md`, `16.9-payment-wallet-and-payout-logic.md` | Treat as design intent; verify against this file before use (browser push notifications are not implemented — `BrowserSubscription` model unused) |
| `README.md` "Optional integrations" | Accurate list; omits `ADMIN_EMAIL` requirement for admin bootstrap and still documents deleted `flutter_app/` |
