# Coding Standards Compliance Review

**Reviewed against:** all 13 text documents in `src/routes/docs` — `Coding Standards & Engineering
Rules.md` (v1.0), `CLAUDE.md` (v2.0), `ADR-001-mobile-ready-web-build.md`,
`technical-architecture.md` (v2.0), `project-delivery-plan.md` (v2.0),
`Business_Requirements_Document.md` (v0.1 draft), `Software_Requirements_Specification.md` (v0.1
draft), `Scope_Of_Development_MASTER.md`, `design-system.md`, `nextjs-port-guide.md`,
`environment-setup.md`, `M0-tickets.md`, `M1-tickets.md`
**Scope:** `app/`, `src/lib`, `src/routes`, `src/components`, `prisma/schema.prisma`
**Date:** 2026-08-10 (revised — third pass, full document set)

---

## Read this first

`src/routes/docs/CLAUDE.md` states **"Current status: Greenfield. All planning documents
complete; no application code yet. Start at M0-01."** That is not true of this repository — there
is substantial, working application code (auth, marketplace browse, client dashboard, job
posting, messaging scaffolding, etc.). The planning docs describe a **monorepo** architecture
(`/packages/db`, `/packages/core`, `/packages/contracts`, `/apps/web`) with PostGIS geo-matching,
Stripe Connect escrow, Twilio SMS, and RS256 access+refresh JWT auth. **None of that exists in
the actual code.** What exists instead is a flat single Next.js app with a simpler feature set.

This means most of the gaps below aren't small rule infractions — they're evidence that the app
was built independently of (or before) these planning docs, most likely as a rapid prototype
(there's a `.lovable/` directory at the repo root). Treat the items under "Architecture-level"
as a decision point, not a punch list: either the docs need to be revised to describe the app
that actually exists, or a real amount of rebuild work is required to make the code match the
docs. Trying to patch individual files toward compliance without resolving that first will just
produce more drift.

### The docs disagree with each other too, not only with the code

`Business_Requirements_Document.md` and `Software_Requirements_Specification.md` are both marked
**v0.1 — Draft, pending sign-off**, full of `[TO BE CONFIRMED]` placeholders, and structured
around a **feature-scope** Phase 1/Phase 2 split: BRD assumption A-04 states _"Phase 1 payment
happens off-platform, directly between client and professional"_ — i.e. no Stripe, no escrow, no
wallet in Phase 1 at all, deferred to a Phase 2 that also includes messaging and the full
notification set. `Scope_Of_Development_MASTER.md`'s "Decision 1" leaves this genuinely open
("bring client payments into Phase 1, or move the whole wallet to Phase 2").

`CLAUDE.md`, `ADR-001`, `technical-architecture.md`, and `project-delivery-plan.md` are all
dated the same day but read as a later, resolved generation: they use "Phase 1 / Phase 2" to mean
**web now, Flutter later** — and in that framing, Stripe Connect escrow and PostGIS geo-matching
are both mandatory _inside_ Phase 1 (web), scheduled at M6 and M3 respectively, weeks before
launch. `technical-architecture.md`'s own open-items list even notes _"Resolved since v1: launch
market and timeline, map provider (Google), design tokens, mobile sequencing"_ — implying a v1 of
this planning existed and was superseded, consistent with BRD/SRS being that superseded v1 left
in the folder without a note pointing readers to the newer decision.

Net effect: **nothing in the actual `Coding Standards & Engineering Rules.md` is affected by
this**, but it matters for reading the rest of `src/routes/docs` — a developer who opens BRD/SRS
first will reasonably conclude payments are out of scope for now, while `CLAUDE.md` (which the
harness treats as the operational source of truth) says the opposite. Worth either deleting the
superseded BRD/SRS or adding a banner pointing to `CLAUDE.md` as authoritative, per that file's
own rule: _"`CLAUDE.md` is the single operational source of truth and is updated the same day a
decision changes."_ That update evidently didn't happen for BRD/SRS.

The geo-matching requirement, by contrast, is consistent across every document, old and new alike
(BRD's `MAP-01…10`/`PRI-01…04`, SRS's `SRS-PRI-03` obfuscated markers, `CLAUDE.md`'s
`GeoRepository`) — there's no version of the plan where PostGIS radius matching and location
obfuscation are optional or deferred. That finding stands unweakened.

---

## 🔴 Architecture-level — code and docs describe different systems

| CLAUDE.md mandate                                                                                                                            | Actual code                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo: `/packages/{db,core,contracts}`, `/apps/web`                                                                                       | Flat repo — `app/`, `src/lib`, `src/routes` at root. No `/packages`, no `/apps`.                                                                                                                                                                                                                  |
| Payments: Stripe Connect, escrow, commission, invoices, `StripeEvent` idempotency                                                            | **No Stripe integration anywhere** — not in `package.json`, not in any source file.                                                                                                                                                                                                               |
| SMS/OTP: Twilio                                                                                                                              | **No Twilio integration anywhere.** Verification currently uses emailed 6-digit codes only.                                                                                                                                                                                                       |
| Geo-matching: PostGIS via `GeoRepository`, radius queries only through `$queryRaw`, `base_point`/`display_point` unreadable by Prisma Client | **No PostGIS, no `GeoRepository`, no geospatial query anywhere.** `User.professionalLatitude` / `professionalLongitude` are plain `Float?` columns on the `User` model (`prisma/schema.prisma:~140`), fully readable by any ordinary `db.user.findMany()` — the opposite of the mandated lockout. |
| "Never store badges as editable flags... admin approves a _document_; the badge follows"                                                     | `User.isVerified` is a plain, independently-settable `Boolean` on `User` (`prisma/schema.prisma:132`), not derived from `ProfessionalVerification` state.                                                                                                                                         |
| Auth: JWT access + refresh, **RS256**                                                                                                        | Single 7-day session JWT, **HS256**, no refresh token (`src/lib/auth.ts`). Functionally fine for web-only today, but not what's documented, and not ready for a mobile client per ADR-001.                                                                                                        |
| `/api/v1` REST surface + `openapi.yaml`, contract-first                                                                                      | No version prefix on any route, no `openapi.yaml` in the repo. (Detailed in the section below.)                                                                                                                                                                                                   |

**Net:** the payments and geo-matching systems — arguably the two things that make this a
"location-aware marketplace with escrow" rather than a generic job board — don't exist in code
yet. If M6 (Money) and M3 (Jobs & Geo) haven't actually started, `CLAUDE.md`'s "Greenfield"
status line is closer to correct than the rest of the repo suggests, and the existing `app/`
code should be understood as an earlier prototype layer, not the M0–M2 output the milestone plan
describes.

---

## 🔴 High severity — contradicts the project's own ADR-001

1. **No `/api/v1` prefix, no `openapi.yaml`.** Routes are flat: `app/api/{auth,dashboard,profile,marketplace,portal,admin}/route.ts`. ADR-001 requires every client/professional capability to exist as a documented `/api/v1` endpoint, contract-first, before a feature counts as done.
2. **Resource-in-URL-param dispatch instead of REST resources.** `app/api/marketplace/[resource]/route.ts` and `app/api/portal/[resource]/route.ts` switch on a string param (`if (resource === "jobs")…`) in one handler instead of exposing `GET /api/v1/jobs`, etc. Error shape is `{ error: "string" }` everywhere, not the `{ error: { code, message, details } }` envelope both the standards doc and `CLAUDE.md` specify.
3. **Auth doesn't match the documented model** (see architecture table above) — no refresh rotation, no Bearer path for a future mobile client.

---

## 🟠 Medium severity

4. **Money stored as `Float`** in unused `Hire*`/`DirectHireNegotiation` Prisma models — a named "NEVER" in `CLAUDE.md` ("Never store money as a float or Decimal") and an automatic-failure rule (§19/§61.15). Dead code (no `db.hireJob`/etc. calls anywhere), but sits alongside the correct `Int`-cents `Project*` models — two money representations in one schema. Delete the `Hire*` models.
   - `ClientJob.budgetMin`/`budgetMax` are `Int` (not float) but store whole dollars, not cents, rendered directly as `$${job.budgetMin}` — lighter deviation from "integer cents" but worth normalizing before real money logic is built on top of it.
5. **No test suite at all.** No `*.test.ts`, no `*.spec.ts`, no Vitest/Jest/Playwright config anywhere in the repo. §41/§42 (every protected endpoint needs an authorized-success + unauthorized-failure test, privacy assertions are mandatory) and `CLAUDE.md`'s own testing section are both unmet in full.
6. **Email is sent synchronously inline in request handlers, blocking the HTTP response.** `app/api/auth/[action]/route.ts` (register, resend-verification, forgot-password) does `await sendVerificationCodeEmail(...)` / `await sendAuthEmail(...)` directly in the handler via `nodemailer.sendMail`, before responding. Violates §27/CLAUDE.md rule 11 ("never block a user-facing request on an external call beyond 5s... notification fan-out is queued through `BackgroundJob`"). There's no `BackgroundJob` model or queue in the schema at all.
7. **No audit logging.** No `AuditLog` (or equivalent) model in `prisma/schema.prisma`. §56 and CLAUDE.md rule 9 both require audit trails for exactly the sensitive actions this app has (verification approval, login, profile changes) — none are recorded anywhere.
8. **File upload UI exists with no backend.** `src/routes/professional/verification.tsx` renders a drag-and-drop upload control, but there's no `fetch`/`FormData` submission wired to it, and no Supabase Storage (or any storage) integration anywhere in the codebase (`grep -i supabase` over `src`/`app` returns nothing). CLAUDE.md rule 10 ("never write to the local filesystem... all uploads go to Supabase Storage") has nothing to violate yet because uploads aren't implemented.
9. **No security headers / CSP.** No `middleware.ts`, and `next.config.ts` only sets `images.remotePatterns` — no headers config at all. §38 requires secure headers and CSP "where practical."
10. **No Sentry / error-monitoring integration** (§23/§57) — errors are `console.error`'d only, not durable on Vercel.
11. **Leftover pre-Next.js code.** `src/lib/error-capture.ts` references `h3`/`server.ts` (Nitro/TanStack-Start internals) — dead code from before the port described in `nextjs-port-guide.md`.
12. **In-memory rate limiter** (`src/lib/rate-limit.ts`, plain `Map`) won't hold a limit across serverless instances on Vercel.
13. **Undocumented non-null assertions:** `process.env.AUTH_SECRET!` (`src/lib/auth.ts:5`), `process.env.DATABASE_URL!` (`src/lib/db.ts`), `parsed.data.password!` (`app/api/auth/[action]/route.ts:344`).
14. **13 arbitrary-pixel Tailwind values** (`mt-[13px]`-style) instead of design-system tokens.

---

## 🟢 What's solid (confirmed, no action needed)

- **Zero `any`, zero `@ts-ignore`/`@ts-expect-error`** anywhere in `src`/`app`. `strict: true` and `noUncheckedIndexedAccess: true` are on.
- **No direct Prisma/DB or Stripe/Twilio/Maps calls from any `"use client"` component** — the service-layer boundary is respected throughout, for the features that do exist.
- Single shared Prisma client via a `globalForPrisma` singleton (`src/lib/db.ts`) — correct, avoids connection exhaustion.
- Auth flow uses bcrypt, per-key rate limiting, single-use hashed verification/reset tokens, `db.$transaction` for multi-step writes, and generic responses on `forgot-password` to avoid user enumeration.
- Server-side authorization is checked in every route reviewed (role verified against the session, never trusted from client input).
- No `onClick` on non-semantic `<div>`/`<span>` found. List queries consistently use `take` (pagination).
- The marketplace/professional listing query does **not** select `professionalLatitude`/`professionalLongitude` — no live exact-coordinate leak today, even though the schema doesn't prevent one architecturally.

---

## Suggested next steps (priority order)

1. **Resolve the docs-vs-code mismatch first.** Confirm with the team whether `app/` is the M0–M2 foundation the milestone plan describes (in which case `CLAUDE.md`'s "Greenfield" line is stale and should be corrected, and the monorepo/PostGIS/Stripe/Twilio work is genuinely still ahead) or a separate prototype that should be reconciled/retired. Everything else here depends on that answer.
2. If the current app is the path forward: scope the missing M6 (Stripe Connect/escrow) and M3 (PostGIS geo-matching) work explicitly rather than discovering it feature-by-feature, and move `professionalLatitude`/`professionalLongitude` behind a `GeoRepository`-style boundary before any feature starts selecting them.
3. Lock down `isVerified` to be derived from `ProfessionalVerification` state rather than a directly editable column.
4. Add a test runner (Vitest is already implied by the stack) and cover at minimum auth + authorization paths before adding more features.
5. Move `sendVerificationCodeEmail`/`sendAuthEmail` off the request path (queue or fire-and-forget with logging) so registration/login isn't blocked on SMTP.
6. Add an `AuditLog` model and start recording login/verification/profile-change events.
7. Delete unused `Hire*`/`DirectHireNegotiation` Prisma models and `src/lib/error-capture.ts`.
8. Add basic security headers/CSP via `next.config.ts` or `middleware.ts`, and Sentry for error monitoring.
