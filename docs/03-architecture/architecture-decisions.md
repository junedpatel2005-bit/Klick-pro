# Architecture Decisions (reverse-engineered)

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

These ADRs record decisions **observable in the repository**. Rationale is quoted only when a code comment, commit or existing document states it; otherwise it is marked "Reason: Not documented in repository." Status values: **Accepted (implemented)**, **Partially implemented**, **Superseded**, **Proposed (not implemented)**.

Related: [solution-architecture.md](./solution-architecture.md) · [integrations.md](./integrations.md) · [authentication-and-authorization.md](./authentication-and-authorization.md).

## Index

| ADR     | Title                                                                                  | Status                 |
| ------- | -------------------------------------------------------------------------------------- | ---------------------- |
| ADR-001 | Next.js App Router port of a Lovable TanStack Start app, keeping `src/routes/` screens | Accepted (implemented) |
| ADR-002 | Custom Node server (`server.mjs`) hosting Next.js and Socket.IO                        | Accepted (implemented) |
| ADR-003 | `proxy.ts` as the global request gate (origin check, page gating, request id)          | Accepted (implemented) |
| ADR-004 | Prisma 7 with `@prisma/adapter-pg` over a shared `pg.Pool`; generated client committed | Accepted (implemented) |
| ADR-005 | Custom DB-backed revocable JWT sessions                                                | Accepted (implemented) |
| ADR-006 | One session cookie and session store for clients, professionals and admins             | Accepted (implemented) |
| ADR-007 | File-based JSON CMS in `data/`                                                         | Accepted (implemented) |
| ADR-008 | Integer whole-rupee money fields                                                       | Accepted (implemented) |
| ADR-009 | Internal wallet ledger with admin-wallet escrow for milestone settlement               | Accepted (implemented) |
| ADR-010 | Run `prisma migrate deploy` inside `npm run build`                                     | Accepted (implemented) |
| ADR-011 | `/api/v1` namespace via rewrite (reconciliation with project-docs ADR-001)             | Partially implemented  |
| ADR-012 | shadcn/ui + Radix + Tailwind v4 UI kit                                                 | Accepted (implemented) |
| ADR-013 | Provider abstraction for private file storage (local / S3-compatible)                  | Accepted (implemented) |
| ADR-014 | Persona hosted KYC as an informational signal beside manual admin review               | Partially implemented  |
| ADR-015 | Razorpay for payments, wallet top-up and Route payouts                                 | Partially implemented  |
| ADR-016 | Feature-flag / credential-presence gating of every external integration                | Accepted (implemented) |
| ADR-017 | In-process background jobs, rate limiting and realtime (single-process assumptions)    | Accepted (implemented) |
| ADR-018 | Phone OTP via pluggable provider (development code or Twilio Verify)                   | Accepted (implemented) |

---

## ADR-001 — Next.js App Router port of a Lovable TanStack Start app, keeping `src/routes/`

**Title:** Port the Lovable-generated TanStack Start/Router UI to Next.js App Router by wrapping existing screens.

**Context:** The UI originated as a Lovable export on the TanStack Start template targeting Cloudflare Workers. A port guide planned a move to Next.js App Router.

**Decision:** Next.js App Router owns routing (`app/`), while screen components remain in `src/routes/` with TanStack-style names and are rendered by thin `app/**/page.tsx` wrappers.

**Evidence:**

- `.lovable/project.json` → `"template": "tanstack_start_ts_2026-05-06"`.
- `project-docs/src/routes/docs/nextjs-port-guide.md` ("From: Lovable export, TanStack Start + TanStack Router").
- Initial commit `9bdbdc9` (2026-08-09) contains one-line `app/**/page.tsx` wrappers, `wrangler.jsonc` (`"name": "tanstack-start-app"`), `bun.lock`; `wrangler.jsonc` deleted in `bd751c8`, `bun.lock` in `185afc9`.
- `src/routes/job.$jobId.tsx`, `src/routes/professional/pro.$proId.tsx`; 36 of 60 pages import `@/routes/*`.
- Dead leftover `src/lib/error-page.ts` (no importers).

**Reason:** The port guide states the move is "a large part of why you're moving off the SPA build" (SEO/SSR for marketing pages). Why `src/routes/` was retained instead of moved (the guide says to delete it): Not documented in repository.

**Consequences:** Two locations per screen; most rendering happens in client components, limiting Server Component benefits; `docs/_archive/2026-09-14-flat-docs/architecture.md` misattributes the origin to React Router. Some newer screens live directly in `app/`, so conventions are mixed.

**Status:** Accepted (implemented).

---

## ADR-002 — Custom Node server hosting Next.js and Socket.IO

**Title:** Run the app through `server.mjs` instead of `next start`.

**Context:** Realtime notifications, chat and admin dashboards need server push.

**Decision:** A plain Node `http` server wraps the Next request handler and attaches a Socket.IO server at path `/api/realtime`, authenticated by the `servio_session` cookie plus a raw-SQL session revocation check. Server code emits via `globalThis.__servioIo`.

**Evidence:** `server.mjs:1-81`; `package.json` scripts `dev: node server.mjs`, `start: cross-env NODE_ENV=production node server.mjs`; `src/lib/realtime.ts`; migrations `202608240001_realtime_messaging`, `202608240002_message_read_state`.

**Reason:** Not documented in repository (inferred need: Socket.IO requires a long-lived HTTP server sharing the app port).

**Consequences:**

- Requires a persistent Node.js host; incompatible with serverless deployment of the realtime path (conflicts with `project-docs/DEPLOY.md` Vercel instructions — [NEEDS VALIDATION — not testable locally] which host is used).
- Next docs: custom servers cannot be combined with `output: "standalone"` (`node_modules/next/dist/docs/01-app/02-guides/custom-server.md:14`).
- No Socket.IO adapter → single-instance only. Emitters silently no-op if `server.mjs` is not the entry point.
- `server.mjs` reads `DATABASE_URL` before `app.prepare()` loads `.env`: with the DB URL only in `.env`, the socket revocation check is skipped (fail-open) and `REALTIME_ALLOWED_ORIGIN`/`APP_URL` from `.env` do not configure CORS; an inherited shell `HOSTNAME` (e.g. Git Bash) binds the server to the LAN IP only [FOUND IN VALIDATION 2026-09-17 · [V-10](../validation/LOCAL_VALIDATION_LOG.md), [V-11](../validation/LOCAL_VALIDATION_LOG.md)].
- `server.mjs` is not compiled/typechecked by Next or `tsc` (not in `tsconfig.json` `include`).

**Status:** Accepted (implemented).

---

## ADR-003 — `proxy.ts` as the global request gate

**Title:** Centralize CSRF-style origin validation, coarse page protection and request correlation in the Next 16 proxy.

**Context:** Next.js 16 renamed `middleware.ts` to `proxy.ts`, running on the Node.js runtime by default.

**Decision:** `proxy.ts` (matcher: all but `_next/static`, `_next/image`, `favicon.ico`) (1) rejects mutating `/api/*` requests whose `Origin` is missing or not same-origin/`APP_URL`; (2) requires role `ADMIN` for `/admin*` except `/admin/login`; (3) redirects unauthenticated users away from a prefix list of portal pages; (4) sends unverified non-admins to `/verify`; (5) sets `x-request-id`.

**Evidence:** `proxy.ts:4-104`; `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md:221-223,774`.

**Reason:** Code comment: "Adds a correlation id that API handlers can include in structured server logs" (`proxy.ts:38-41`). Other rationale: Not documented in repository.

**Consequences:**

- Every matched request with a cookie performs a DB session lookup.
- The strict Origin rule blocks server-to-server webhooks (`/api/webhooks/*`) and non-browser/mobile clients from all mutating calls — see finding F-01 in [solution-architecture.md](./solution-architecture.md#10-architecture-findings) [PARTIALLY VALIDATED 2026-09-17 · [V-20](../validation/LOCAL_VALIDATION_LOG.md)]: locally both webhooks and Bearer POSTs without `Origin` → 403, and even a genuine same-origin `http://127.0.0.1:3100` request was rejected under `server.mjs` (only the exact `APP_URL` origin passes); live provider delivery [NEEDS VALIDATION — not testable locally].
- Page protection is prefix-based and not role-aware; role enforcement is delegated to layouts and handlers.

**Status:** Accepted (implemented).

---

## ADR-004 — Prisma 7 with `@prisma/adapter-pg` over a shared pool

**Title:** Use Prisma 7's `prisma-client` generator with the PostgreSQL driver adapter.

**Context:** Prisma 7 requires driver adapters. The original context assumed a pooled (PgBouncer) endpoint — that assumption is superseded by ADR-019.

**Decision:** `PrismaClient({ adapter: new PrismaPg(pgPool) })` with one shared `pg.Pool` (`max 5`, `idleTimeoutMillis 30000`, `connectionTimeoutMillis 10000`); generator output `src/generated/prisma` (committed); `prisma.config.ts` gives the CLI `DIRECT_URL || DATABASE_URL`; `partialIndexes` preview feature.

**Evidence:** `src/lib/db.ts:28-51`; `prisma/schema.prisma:1-9`; `prisma.config.ts`; `git ls-files src/generated` = 77 files.

**Reason:** A shared pool is required because `PrismaPg` builds a new pool per adapter when handed a config object. (The original wording cited a "Supabase PgBouncer endpoint"; that claim had no supporting configuration and is superseded by ADR-019.) `prisma.config.ts`: migrate needs "a session-capable connection (DIRECT_URL)".

**Consequences:** Generated client must be regenerated on schema change (output moved to `generated/` and gitignored, 2026-09-19). The dev-only staleness guard is now a model-list fingerprint rather than a hand-bumped `prismaSchemaVersion` string. `server.mjs` uses a second independent pool (`max 1`) whose hand-written SQL depends on physical table/column names (`sessions.revoked_at`, `"User"."isActive"`); that SQL now lives in `src/lib/socket-session-sql.mjs` so a test can pin it.

**Status:** Accepted (implemented).

---

## ADR-005 — Custom DB-backed revocable JWT sessions

**Title:** Stateless JWT cookie combined with a server-side `Session` row.

**Context:** Earlier implementation used a pure JWT `{userId, role}` (`project-docs/docs/current-architecture.md`). The planned design was access/refresh RS256 tokens (`technical-architecture.md` §3).

**Decision:** `createSession()` signs HS256 `{userId, role, sessionId}` for 7 days and inserts a `Session` row; `verifySession()` verifies the JWT, loads the session and user, rejects revoked/expired sessions and inactive users, and returns the **database** role and `emailVerifiedAt`. Logout sets `revokedAt`.

**Evidence:** `src/lib/auth.ts:12-58`; migration `202608310003_revocable_sessions`; `server.mjs:44-58`.

**Reason:** Not documented in repository beyond the migration name ("revocable sessions"); `project-docs/CURRENT_PROJECT_STATUS.md` lists revocable sessions as implemented.

**Consequences:** Immediate logout/deactivation; one DB read per verification (proxy + layout + handler can each verify the same request). No refresh-token rotation, no sliding expiry. Planned RS256 access/refresh design is not implemented. Details: [authentication-and-authorization.md](./authentication-and-authorization.md).

**Status:** Accepted (implemented).

---

## ADR-006 — One session cookie for all roles

**Title:** Clients, professionals and administrators share `servio_session` and the same session mechanism.

**Context:** Admin has a separate login screen (`/admin/login`) and API (`/api/admin/login`) using username + password.

**Decision:** Admin login calls the same `createSession()` and sets the same cookie with the same options; separation is purely by `User.role`.

**Evidence:** `app/api/admin/login/route.ts:64-80`; `src/lib/auth.ts:10`; `proxy.ts:62-68`; `server.mjs:72-75`.

**Reason:** Not documented in repository. The planned design (separate admin roles `VERIFICATION_REVIEWER`, `DISPUTE_HANDLER`, `FINANCE`, `SUPER_ADMIN` and mandatory MFA in `technical-architecture.md` §3.4) was not implemented.

**Consequences:** A single browser cannot hold an admin and a user session simultaneously; admin sessions have the same 7-day lifetime and no MFA; all admins have full privileges.

**Status:** Accepted (implemented).

---

## ADR-007 — File-based JSON CMS

**Title:** Store editable marketing/about/home content as JSON files on the application filesystem.

**Context:** The schema contains DB CMS models (`CmsPage`, `CmsPageVersion`, `CmsMedia`, `WebsitePage`, `LegalPage`, `PageConfiguration`, `WebsitePageOverride`, `PageTextOverride`) inherited from an earlier design.

**Decision:** `src/lib/cms-file.ts`, `home-cms-file.ts`, `marketing-cms.ts` read/write `data/cms-content.json`, `data/cms-home.json`, `data/cms-marketing.json`; admin edits via `GET/PUT /api/admin/cms` (`runtime = "nodejs"`).

**Evidence:** files above; `app/api/admin/cms/route.ts:1-16`; DB CMS models referenced by ≤1 file.

**Reason:** Not documented in repository.

**Consequences:** Requires a writable persistent disk; content is not shared across instances; `readHomeContent()` caches in memory, so edits made by another instance are invisible until restart; runtime edits create uncommitted changes in a git-deployed checkout; no versioning or audit. DB CMS models are dead schema.

**Status:** Accepted (implemented).

---

## ADR-008 — Integer whole-rupee money fields

**Title:** Represent money as integer rupees in the database, converting to paise only at the Razorpay boundary.

**Context:** Legacy/hire tables used decimal/float amounts.

**Decision:** Migration converts remaining monetary columns to `INTEGER` using `ROUND()`; application code multiplies by 100 when talking to Razorpay and compares webhook `amount` to `local amount * 100`.

**Evidence:** `prisma/migrations/202608200005_integer_money_fields/migration.sql`; `src/lib/razorpay.ts` (`Math.round(input.amountRupees * 100)`); `app/api/webhooks/razorpay/route.ts` (`entity.amount !== payment.amount * 100`); `app/api/wallet/deposit/order/route.ts` (`z.number().int()`).

**Reason:** Not documented in repository.

**Consequences:** No paise precision (fees use `Math.ceil`); amounts must be whole rupees; currency hard-coded to INR.

**Status:** Accepted (implemented).

---

## ADR-009 — Internal wallet ledger with admin-wallet escrow

**Title:** Settle milestones from an internal client wallet, holding funds in the first admin user's wallet until payout approval.

**Context:** Direct Razorpay milestone payments were replaced.

**Decision:** Clients top up a `Wallet` through Razorpay (`WalletTransaction` `WALLET_TOP_UP`, `PENDING` → `COMPLETED`). Milestone approval (`POST /api/wallet/milestone`) calls `fundMilestoneFromWallet()`: debit client `baseAmount + 10%` (idempotency key `payment-<id>-client-debit`) and credit the **first `User` with role `ADMIN`**. Admin approval (`/api/admin/finance/milestone-payout`) calls `releaseMilestoneToProfessional()`: debit admin wallet, credit professional `baseAmount − 10%`. Legacy direct endpoints return HTTP 410.

**Evidence:** `src/lib/wallet-ledger.ts:4-190`; `app/api/wallet/milestone/route.ts`; `app/api/admin/finance/milestone-payout/route.ts`; `app/api/payments/razorpay/order/route.ts` and `verify/route.ts` (410 with comment "Kept as a compatibility response so old clients cannot bypass wallet settlement"); migration `202608210001_wallet_earning_flow`.

**Reason:** Comment in `app/api/payments/razorpay/order/route.ts`: "Milestones are settled from the client wallet after Razorpay top-up." Why an admin user wallet acts as escrow: Not documented in repository.

**Consequences:** Platform funds are tied to whichever admin row `findFirst` returns (non-deterministic without ordering); the Razorpay webhook credits wallets with its own code instead of the ledger helper; double credit of top-ups under concurrency — reproduced with concurrent `/api/wallet/deposit/verify` calls alone (one 5,000 top-up credited 20,000 / 25,000) [VALIDATED 2026-09-17 · [V-41](../validation/LOCAL_VALIDATION_LOG.md)], finding F-03; the verify-vs-webhook variant was not tested. Legal/escrow compliance: [UNKNOWN].

**Status:** Accepted (implemented).

---

## ADR-010 — Migrations inside the build

**Title:** `npm run build` = `prisma migrate deploy && next build`.

**Decision / Evidence:** `package.json` `build` script; CI `quality.yml` runs `npm run build` against a disposable Postgres service.

**Reason:** Not documented in repository.

**Consequences:** Building against a real database mutates its schema; edited already-applied migrations (the `0_init` baseline was rewritten 2026-09-12) do **not** fail builds — Prisma 7.9.1 `migrate deploy` reports "No pending migrations" with exit 0 and no warning, so `migrate resolve` is not required, but the edited content never runs on databases that already applied the old version [CORRECTED 2026-09-17 · [V-02](../validation/LOCAL_VALIDATION_LOG.md)]; preview builds pointed at production would migrate production. See [deployment.md](../08-operations/deployment.md).

**Status:** Accepted (implemented).

---

## ADR-011 — `/api/v1` namespace (reconciliation with project-docs ADR-001)

**Title:** Expose a "mobile-ready" `/api/v1` namespace by URL rewrite rather than separate versioned handlers.

**Context:** `project-docs/src/routes/docs/ADR-001-mobile-ready-web-build.md` (Accepted, 2026-08-09) required: framework-free service layer (`packages/core`), every client/professional capability under `/api/v1` and in `openapi.yaml` with tests, Server Actions only for admin, JWT access + refresh tokens with `Authorization: Bearer`, no cookie sessions.

**Decision:** `next.config.ts` rewrites `/api/v1/:path*` → `/api/:path*` (after-files rewrite). Two physical routes exist under `app/api/v1/` (`messages`, `professionals`); because `rewrites()` returning an array is applied after filesystem routes (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/rewrites.md:96`), those physical routes win and have no `/api/*` twin. Web UI calls `/api/v1/*` in 157 literal references and legacy `/api/*` in 54.

**Evidence:** `next.config.ts:22-28` (comment: "Canonical, mobile-ready API namespace. Existing route handlers remain the single implementation while web clients are migrated from legacy /api/* URLs."); `app/api/v1/messages/route.ts`; `app/api/v1/professionals/route.ts`; Google OAuth callback `/api/v1/auth/google` (`app/api/auth/[action]/route.ts:104`); root `openapi.yaml` (69 lines).

**Reconciliation with project-docs ADR-001:**

| ADR-001 rule                                                             | Implemented?                                                                                                           | Evidence                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Service layer is the only place for business logic                       | No — logic lives in handlers; `src/lib/services` has 1 file                                                            | `app/api/**`                     |
| Every client/professional capability under `/api/v1`, in OpenAPI, tested | Partially — alias exists; OpenAPI incomplete; no tests                                                                 | `next.config.ts`, `openapi.yaml` |
| Server Actions only for admin                                            | Satisfied trivially — no Server Actions anywhere                                                                       | `grep "use server"` = 0          |
| JWT access/refresh + Bearer, no cookie sessions                          | No — cookie session with DB row; Bearer accepted only by `/api/auth/me` and `/api/client/jobs`                         | `src/lib/auth.ts`                |
| Flutter in phase 2                                                       | Prototype `flutter_app/` tracked at HEAD (calls `/api/auth/login`, extracts `Set-Cookie`), deleted in the working tree | `git ls-files flutter_app`       |

Additional blocker: `proxy.ts` rejects mutating API calls without an `Origin` header, which native mobile HTTP clients do not send.

**Consequences:** Versioning is cosmetic (no v2 path possible without handler duplication); two URL spaces in the web client; mobile readiness claimed by ADR-001 is not achieved.

**Status:** Partially implemented (project-docs ADR-001 is largely **not implemented**; its token model is superseded by ADR-005).

---

## ADR-012 — shadcn/ui + Radix + Tailwind v4

**Decision / Evidence:** `components.json`; 46 primitives in `src/components/ui/`; `@radix-ui/*`, `class-variance-authority`, `tailwind-merge`, `tailwindcss ^4.2.1` with `@tailwindcss/postcss` (`postcss.config.mjs`); `cn()` in `src/lib/utils.ts` (graph "god node").

**Reason:** Inherited from the Lovable template (port guide §1 "src/components/ui/* — 49 shadcn components: Copy verbatim").

**Consequences:** Copy-owned primitives; some unused (e.g. `ui/form.tsx` depending on `react-hook-form`). Design tokens in `src/styles.css`. See [design-system.md](../06-ui/design-system.md).

**Status:** Accepted (implemented).

---

## ADR-013 — Private file storage provider abstraction

**Decision:** `FileStorageProvider {put,get,remove}` with a local-disk provider (development only, throws in production — every upload 500 when `NODE_ENV=production` and `FILE_STORAGE_PROVIDER≠s3` [VALIDATED 2026-09-17 · PROD-STORAGE]) and an S3-compatible provider selected by `FILE_STORAGE_PROVIDER=s3`; files served only through authenticated API routes; magic-byte validation.

**Evidence:** `src/lib/project-file-storage.ts`; `.env.example` comment "Use `local` only for development. Production requires the S3-compatible values below."; `project-docs/docs/current-architecture.md` "Project-work file storage deployment note".

**Reason:** Documented: persistent object storage is required "before a serverless production deployment" (`current-architecture.md`).

**Consequences:** Portable across AWS S3, R2, MinIO etc.; every download is proxied through Node (no presigned URLs), increasing server bandwidth/latency.

**Status:** Accepted (implemented).

---

## ADR-014 — Persona hosted KYC beside manual review

**Decision:** Professionals can start a Persona inquiry (`POST /api/verification/persona/start`) and follow a hosted one-time link; Persona webhooks update `PersonaVerification.providerStatus`. Approval of professional verification remains a manual admin action on uploaded documents (`/admin/verifications`), which displays the Persona status.

**Evidence:** `src/lib/persona.ts`; `app/api/verification/persona/*`; `app/api/webhooks/persona/route.ts`; `app/admin/verifications/page.tsx:293`; migration `202608200001_persona_verification`.

**Reason:** Not documented in repository.

**Consequences:** Persona outcome never changes verification status automatically; webhook dedupe-before-process can lose updates (finding F-05); disabled unless `PERSONA_ENABLED=true`.

**Status:** Partially implemented.

---

## ADR-015 — Razorpay payments

**Decision:** Direct REST calls (no SDK) with Basic auth for Orders and Route transfers; Checkout script in the browser; HMAC-SHA256 signature verification for client callbacks and webhooks; webhook events persisted in `RazorpayWebhookEvent` with a `RECEIVED → PROCESSING → PROCESSED/FAILED` state machine; Route payouts gated by `RAZORPAY_ROUTE_ENABLED`.

**Evidence:** `src/lib/razorpay.ts`; `app/api/webhooks/razorpay/route.ts`; `app/api/admin/finance/payouts/route.ts`; migrations `202608200002_razorpay_payments`, `202608310002_razorpay_webhook_processing_state`; CSP allows `checkout.razorpay.com`, `api.razorpay.com`.

**Reason:** `technical-architecture.md` OTD-13: "Razorpay Checkout + Route, escrow" (India market). Its adapter list still names Stripe — contradictory within that document.

**Consequences:** INR only; `.env.example` comment "Keep false until Razorpay Route Linked Accounts and payout permissions are approved" → with `RAZORPAY_ROUTE_ENABLED=false` payouts return 503 "Razorpay Route payouts are not enabled." [VALIDATED 2026-09-17 · [V-47](../validation/LOCAL_VALIDATION_LOG.md)]; whether Route is approved/enabled in production [NEEDS VALIDATION — not testable locally]; webhook delivery may be blocked by `proxy.ts` (F-01).

**Status:** Partially implemented.

---

## ADR-016 — Integrations gated by flags or credential presence

**Decision:** Each provider degrades gracefully when unconfigured: Razorpay → 503; Persona → 503/401; SMTP notification email → warn once and skip (auth emails attempt anyway); Twilio → development OTP mode; Google Maps → UI fallback; geocode → 503; Sentry → disabled; S3 → local (dev) or throw (prod); Google OAuth → redirect with `oauthError=google-not-configured`.

**Evidence:** see [integrations.md](./integrations.md). README: "Leave them disabled or blank for basic local development."

**Consequences:** Easy local setup; misconfiguration in production can go unnoticed (e.g. OTP in development mode with a fixed `DEV_PHONE_OTP`).

**Status:** Accepted (implemented).

---

## ADR-017 — In-process background jobs, rate limiting and realtime

**Decision:** Background work (`enqueueBackgroundJob`), rate limits (`Map`), home CMS cache and Socket.IO rooms all live in process memory.

**Evidence:** `src/lib/background-jobs.ts` (comment: "keeps queue-provider code out of route handlers, so a durable queue can replace this in-process executor without changing callers"); `src/lib/rate-limit.ts`; `server.mjs`.

**Reason:** Partially documented (swap-ability comment above). Planned "Vercel Cron + BackgroundJob table" (`technical-architecture.md`) was not implemented.

**Consequences:** Single-instance deployment assumption; lost jobs on restart; rate limits bypassable across instances.

**Status:** Accepted (implemented).

---

## ADR-018 — Pluggable phone OTP provider

**Decision:** `PHONE_OTP_PROVIDER` selects `development` (hashed code stored in `OtpCode`, 10-minute expiry, 5 attempts, code = `DEV_PHONE_OTP` or a fixed development code outside production, random otherwise) or `twilio` (Twilio Verify handles generation, delivery, expiry, limits). A signed short-lived `servio_phone_verification` cookie proves phone verification during signup.

**Evidence:** `src/lib/phone-otp-provider.ts`; `src/lib/dev-phone-otp.ts`; migration `202608180001_add_otp_codes`; `.env.example` comments.

**Reason:** `.env.example`: 'Keep "development" until Twilio Verify is configured'; code comment explains Verify templates work on trial accounts.

**Consequences:** If production runs in development mode with `DEV_PHONE_OTP` set, every phone OTP is a known static code; without it, random codes are stored but never delivered. Outside production without `DEV_PHONE_OTP` the fixed development code is used and **printed to the server log**; `verifyPhoneOtp` compares `"expiresAt" > NOW()` in raw SQL, so verification always fails when the DB session TimeZone is not UTC (proven IST fail / UTC pass) [FOUND IN VALIDATION 2026-09-17 · [V-27](../validation/LOCAL_VALIDATION_LOG.md)]. `SMS_API_*` variables are reserved and unused.

**Status:** Accepted (implemented).

---

## ADR-019 — PostgreSQL hosting: native local for development, AWS target undecided

**Title:** Run PostgreSQL natively for local development; defer the production hosting choice.

**Context:** Several documents stated the database was "likely Supabase". Investigation on 2026-09-19 found no basis for it: no `@supabase/*` dependency, no `sslmode`, no `pgbouncer=true`, no pooler port convention, no Supabase project artifact. Two code comments (`src/lib/db.ts`, `server.mjs`) asserted it and every other mention derived from those two. The team has confirmed the direction: PostgreSQL, run locally for development, hosted on AWS later.

**Decision:** PostgreSQL is the engine everywhere. Developers install it natively and follow the README setup (`servio_dev`, `servio_shadow`, `servio_test`); no docker-compose is provided for the development database. CI keeps its `postgres:16-alpine` service container. The AWS production target is deliberately **not** chosen yet and no infrastructure code is committed; `docs/08-operations/aws-target.md` records the constraints the codebase already imposes on that choice.

**Evidence:** `src/lib/db.ts`; `prisma.config.ts`; `.github/workflows/quality.yml`; `README.md`; the absence of any Supabase artifact across the repository.

**Consequences:** `DATABASE_URL` / `DIRECT_URL` stay split, because Prisma CLI migrations need a session-capable connection. `SHADOW_DATABASE_URL` is now supported for `migrate dev` where the role lacks `CREATEDB`. Pool sizing becomes a local decision rather than an inherited pooler constraint: `max: 5` per app process plus `max: 1` in `server.mjs`, sized against the server `max_connections`. Any AWS work must account for the app needing a long-lived process for Socket.IO, which rules out Lambda.

**Status:** Accepted (documentation and local configuration implemented; AWS target open).
