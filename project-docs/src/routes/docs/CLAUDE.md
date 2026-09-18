# CLAUDE.md — Service Marketplace Platform

Root project memory. Read this before every task. Package-level `CLAUDE.md` files add rules; they never relax rules stated here.

**Version:** 2.0 — web-first · **Updated:** 09 August 2026

---

## What this is

A two-sided, location-aware service marketplace. **Clients** post jobs; **Professionals** quote on them and deliver. Geography is core: jobs match professionals by service radius, not just category. Money moves through the platform in escrow and is released against milestones, net of a 10% commission.

Launch market **India**, currency **INR**, English only. Launch category **IT**, two-level taxonomy, trades to follow.

**Delivery is sequential: web first, Flutter in phase 2.** See ADR-001 — this shapes how the API is built, not just when.

---

## Stack — do not substitute

| Layer        | Choice                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Web + API    | Next.js 15 App Router, React 19, TypeScript                             |
| Styling      | Tailwind **v4** (CSS-first `@theme`, **no `tailwind.config.js`**)       |
| Components   | shadcn/ui over Radix, ported from the prototype                         |
| Database     | PostgreSQL on Supabase, **PostGIS enabled**                             |
| ORM          | Prisma                                                                  |
| Auth         | Own JWT — access + refresh, RS256. **Not NextAuth. Not Supabase Auth.** |
| Storage      | Supabase Storage, private buckets, signed URLs                          |
| Payments     | Razorpay Checkout + Route, escrow                                       |
| Maps         | **Google Maps** — Maps JS, Places, Geocoding, Distance Matrix           |
| SMS/OTP      | Twilio                                                                  |
| Email        | SMTP — Mailtrap in dev, SendGrid in production                          |
| Push         | **Web Push (VAPID)**. FCM/APNs arrive with Flutter in phase 2           |
| Client cache | TanStack Query                                                          |
| Hosting      | Vercel now, AWS later — keep portable                                   |

**Phase 2 (not now):** Flutter + Riverpod for iOS and Android.

---

## Repository layout

```
/CLAUDE.md                  ← this file
/docs/
  architecture/             ← technical architecture, ADRs
  api/openapi.yaml          ← API contract, single source of truth
  design-system.md
/packages/
  db/                       ← Prisma schema, migrations, seed, GeoRepository
  contracts/                ← openapi.yaml + generated TS types (Dart in phase 2)
  core/                     ← domain logic, pure, no framework imports
/apps/
  web/                      ← Next.js: marketing, portals, admin, API
/tickets/                   ← agent-sized work items
```

---

## Commands

```bash
# Database
pnpm db:generate            # regenerate Prisma client
pnpm db:migrate             # apply migrations (dev)
pnpm db:seed                # geo-distributed Canadian fixtures
pnpm db:reset               # truncate + reseed
pnpm db:studio

# Web
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web test
pnpm lint
pnpm typecheck              # whole repo

# Contracts — run after ANY change to openapi.yaml
pnpm contracts:generate

# Local database
docker compose up -d        # postgis/postgis:16-3.4
```

---

## NEVER — violations require a rewrite, not a patch

These encode legal, financial and trust requirements. Each has burned a real marketplace.

1. **Never return a professional's exact coordinates, street address, phone or email to a non-appointed party.** Enforcement lives in the serializer, not the UI. Public and private DTOs are separate types; the public one is structurally incapable of carrying these fields.

2. **Never place a map marker at a professional's true base location.** Non-appointed viewers see `displayPoint` — a deterministic 1–2km offset derived from a salted hash of the professional ID. A true-coordinate marker leaks the home address regardless of what the label says.

3. **Never change `GEO_OBFUSCATION_SALT` once professionals exist.** Every public pin would move, and the delta leaks the true location.

4. **Never store money as a float or `Decimal` in application code.** Integers in **cents**, always, with an explicit currency code. Quotes, budgets, commission, tax, payouts.

5. **Never store badges as editable flags.** Badges are derived from `VerificationDocument` state. An admin approves a _document_; the badge follows.

6. **Never write geospatial queries in application code.** Radius matching runs in PostGIS through `GeoRepository` via `$queryRaw`. Never `findMany()` then filter by distance in JS.

7. **Never let anything outside `GeoRepository` touch `base_point`, `display_point` or `location_point`.** Prisma Client cannot read these columns at all — that is expected, not a bug to fix.

8. **Never trust client-side authorization.** Every request re-checks ownership and role server-side. Middleware is UX; the handler is enforcement.

9. **Never expose verification documents to a client.** Admin-only, signed URLs expiring ≤15 minutes, every access audit-logged. Not even to the client who hired that professional.

10. **Never write to the local filesystem.** Vercel's filesystem is ephemeral. All uploads go to Supabase Storage.

11. **Never block a user-facing request on an external call beyond 5s.** Notification fan-out, geocode batches and reconciliation are queued through `BackgroundJob`.

12. **Never make a Razorpay webhook non-idempotent.** Check `RazorpayWebhookEvent` by event ID before acting.

13. **Never create `tailwind.config.js`.** Tailwind v4 has no config file. If one appears it is a hallucination from v3-era training data.

---

## ADR-001 — build mobile-ready

**Flutter arrives in phase 2.** Every client- and professional-facing capability must exist as a documented REST endpoint under `/api/v1` **before the feature is done** — not "can be added later."

- Server Components **may** read through the service layer directly, but a REST equivalent must exist and be tested.
- Server Actions are permitted **only** in the admin panel. Admin is web-only forever; Flutter will never render a verification queue.
- Client and professional features get no exemption. A web form calling a server action instead of the API is a defect.
- Business logic lives in `packages/core` or `apps/web/src/server/services` — never in a component or a route handler.
- Auth stays JWT. No drift to cookie sessions because "it's just web for now."
- `openapi.yaml` is maintained during the build, contract-first per milestone — never reconstructed afterwards.

This rules out tRPC, session-cookie auth, and response shapes designed around one React component's needs.

---

## Domain rules that are easy to get wrong

- **A job has exactly one appointed professional.** Accepting a quote is atomic: quote → `ACCEPTED`, siblings → `NOT_SELECTED`, job → `ASSIGNED`. Concurrent acceptance yields exactly one winner; the second gets 409.
- **Escrow, not direct payment.** Client funds are captured to the platform and held. Release happens per milestone on client confirmation.
- **Commission is 10%, admin-configurable, deducted from the professional's earnings** — not added to the client's price. Frozen onto the job at appointment so later rate changes never rewrite history.
- **The platform charges GST/HST on its commission only.** Professionals handle their own tax. Rates are **per province** via `TaxRate`; `Payment` freezes `taxProvince` and `taxType` at charge time. Invoices separate: job amount, commission, tax on commission, net to professional.
- **Currency is display-only relabelling.** Store CAD everywhere. The admin currency setting changes the symbol shown. Do not build FX.
- **Verification is optional.** Unverified professionals still quote and work; verification affects badges and ranking only.
- **Verification documents expire.** Licences, insurance and background checks carry `expiresAt`; badges are revoked on expiry with 30 days' warning.
- **Reviews are bidirectional and double-blind.** Both stay `PENDING_COUNTERPART` until both are submitted or the 14-day window closes.
- **Contact details release automatically on appointment**, and are revoked if the job reverts to `PUBLISHED`.
- **One chat thread per (job, professional)** — a client negotiates with several professionals before appointing one.
- **Admins can read chat threads** for dispute resolution. No end-to-end encryption; the privacy policy must say so.
- **Visitors browse without logging in**, seeing masked client details. Full job detail requires auth.

---

## Code conventions

**TypeScript**

- `strict: true`, `noUncheckedIndexedAccess: true`. No `any`. No non-null assertions without a justifying comment.
- Validate every API input with Zod at the route boundary; infer types from the schema rather than writing them twice.
- Route handlers stay thin: parse → authorize → service → serialize.
- Errors use the standard envelope: `{ error: { code, message, details? } }`.
- Share Zod schemas between form and endpoint so client and server validation cannot diverge.

**Naming**

- Database `snake_case`, mapped to `camelCase` via `@map`.
- API `camelCase` JSON, plural resources, `/api/v1/...`.
- Files `kebab-case`; React components `PascalCase`.

**Routing** — route groups in parentheses create no URL segment. `/client/...` and `/pro/...` are **real segments**; `(marketing)`, `(auth)` and `(public-browse)` are groups.

**Database**

- Every schema change is a migration. Never edit an applied migration.
- PostGIS indexes, partial-unique indexes and the audit-log REVOKE live in a hand-written migration, not the Prisma schema.
- Soft-delete users; hard-delete nothing a dispute might reference.

---

## Testing

- Business logic in `packages/core`: unit tested, ≥70% coverage.
- Every API route: one authorized-success and one unauthorized-failure test minimum.
- **Privacy assertions are mandatory.** For every endpoint returning user data, assert forbidden fields are _absent_ per role. Most likely to regress silently; only ones with legal consequences.
- State machines: test the illegal transitions, not just the happy path.
- Money: test commission and tax arithmetic in integer cents, including rounding.
- Auth: test refresh replay revokes the whole family.

---

## Working method

- One ticket per session. Read `/tickets/<id>.md` first; it names its file scope and acceptance criteria.
- Stay inside those files. If the work needs something outside, stop and say so rather than expanding scope silently.
- If a ticket is ambiguous, ask. Don't pick an interpretation and proceed.
- Reference SRS IDs in commit messages where applicable.
- Two developers on the same web stack — coordinate on `packages/contracts` and `packages/db`, which are the shared seams.

---

## Milestones

**M0** Foundation — monorepo, schema + PostGIS, Next.js port, CI _(95–115h)_
**M1** Auth — JWT, OTP, login, reset, OAuth, guards, media _(81h)_
**M2** Profiles & Trust — both profiles, categories, verification, admin review
**M3** Jobs & Geo — posting, PostGIS matching, discovery, Google Maps
**M4** Quote & Hire — quotes, revisions, appointment, chat
**M5** Delivery — milestones, work proof, completion
**M6** Money — Stripe Connect, escrow, release, invoices, payouts
**M7** Trust & Comms — reviews, disputes, notifications, admin completion
**M8** Hardening & Launch — privacy suite, UAT, production

**Phase 2** Flutter iOS + Android against the existing API.

---

## Current status

Greenfield. All planning documents complete; no application code yet. Start at `M0-01`.
