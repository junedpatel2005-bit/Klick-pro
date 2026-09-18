# M0 — FOUNDATION TICKETS

**Milestone:** M0 Setup · **Target:** weeks 1–2 · **Exit criteria:** CI green, schema migrated with PostGIS, Next.js shell rendering the ported design tokens.

Each ticket is scoped to one Claude Code session. Work them in order — later tickets assume earlier ones landed. One ticket, one branch, one PR.

**Session protocol:** read `/CLAUDE.md`, then this ticket. Stay inside the files listed under _Scope_. If the work requires touching anything outside that list, stop and say so rather than expanding silently.

---

## M0-01 — Monorepo scaffold

**Depends on:** nothing
**Estimate:** 4h

### Goal

A pnpm workspace with shared tooling that builds green and empty.

### Scope

`package.json` · `pnpm-workspace.yaml` · `tsconfig.base.json` · `eslint.config.js` · `.prettierrc` · `.gitignore` · `.editorconfig` · `turbo.json`

### Steps

1. `pnpm init`, workspace with `apps/*` and `packages/*`.
2. Root `tsconfig.base.json`: `strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/*`.
3. ESLint flat config + Prettier, carried from the prototype's config where sensible.
4. Turborepo pipeline: `build`, `dev`, `lint`, `typecheck`, `test`.
5. Root scripts: `typecheck`, `lint`, `format`, `build`.

### Definition of Done

- `pnpm install` succeeds from a clean clone
- `pnpm typecheck` and `pnpm lint` exit 0
- `.gitignore` covers `node_modules`, `.next`, `.env*`, `.turbo`, `dist`

### Out of scope

Any application code. No Next.js yet.

---

## M0-02 — Next.js application scaffold

**Depends on:** M0-01
**Estimate:** 3h

### Goal

An empty Next.js 15 App Router app at `apps/web` that builds.

### Scope

`apps/web/**` (config only) · `apps/web/src/app/layout.tsx` · `apps/web/src/app/page.tsx`

### Steps

1. `create-next-app` into `apps/web` — TypeScript, App Router, **decline Tailwind** (v4 comes in M0-03), src directory, `@/*` alias.
2. Extend root tsconfig.
3. `next.config.ts`: `images.remotePatterns` placeholder for the Supabase storage domain, `reactStrictMode: true`.
4. Delete boilerplate CSS and the default page content.

### Definition of Done

- `pnpm --filter web dev` serves a page
- `pnpm --filter web build` exits 0
- No Tailwind, no leftover `create-next-app` styling

### Out of scope

Tokens, fonts, components, routes.

---

## M0-03 — Tailwind v4 and design tokens

**Depends on:** M0-02
**Estimate:** 5h
**Reference:** `docs/nextjs-port-guide.md` §3, §5 · `docs/design-system.md`

### Goal

The prototype's exact visual identity rendering under Next.js.

### Scope

`apps/web/postcss.config.mjs` · `apps/web/src/styles/globals.css` · `apps/web/src/app/layout.tsx` · `apps/web/components.json`

### Steps

1. `pnpm add tailwindcss @tailwindcss/postcss tw-animate-css` in `apps/web`.
2. `postcss.config.mjs` → `{ plugins: { "@tailwindcss/postcss": {} } }`.
3. Copy `styles.css` from the prototype **verbatim** into `globals.css`. Change only the source directive to `@import "tailwindcss"; @source "../";`.
4. Wire `next/font/google` — Inter (variable `--font-inter`), Poppins weights 600/700 only (variable `--font-poppins`). Apply both variables on `<html>`.
5. Update `--font-sans` / `--font-display` in the theme block to reference those variables.
6. `components.json` with Next aliases.
7. Temporary demo page showing primary blue, CTA orange, success green, both fonts, and the three shadow levels.

### Definition of Done

- Demo page matches the prototype's palette and typography
- **No `tailwind.config.js` exists** — v4 is CSS-first. If one is generated, delete it.
- The `@theme inline`, `:root`, `.dark`, and gradient utility blocks are byte-identical to the source
- Dark mode renders correctly when `.dark` is applied to `<html>`

### Out of scope

Components, theme toggle UI.

---

## M0-04 — shadcn/ui primitives port

**Depends on:** M0-03
**Estimate:** 6h

### Goal

All 49 shadcn components compiling under App Router.

### Scope

`apps/web/src/components/ui/**` · `apps/web/src/lib/utils.ts` · `apps/web/package.json`

### Steps

1. Copy `src/lib/utils.ts` (`cn` helper) verbatim.
2. Copy all 49 files from the prototype's `components/ui/` verbatim.
3. Add `"use client"` to the top of every one during the copy.
4. Install the Radix and supporting dependencies listed in the port guide §1.
5. Build. Remove `"use client"` only where the build proves it unnecessary (`button.tsx`, `badge.tsx`, and similar).
6. Kitchen-sink page rendering every component for visual verification.

### Definition of Done

- `pnpm --filter web build` exits 0
- Kitchen-sink page renders all 49 without console errors
- Zero components modified beyond the directive and import paths

### Out of scope

Domain components (`ProCard`, `JobCard`). New components.

---

## M0-05 — Database package, schema and PostGIS

**Depends on:** M0-01
**Estimate:** 8h
**Reference:** `packages/db/schema.prisma` (v2)
**This is the highest-risk ticket in M0. Do not rush it.**

### Goal

Full schema migrated, PostGIS working, and the geo boundary established before any feature depends on it.

### Scope

`packages/db/**` · `docker-compose.yml`

### Steps

1. `packages/db` with Prisma installed; copy `schema.prisma` v2 in.
2. `docker-compose.yml` running `postgis/postgis:16-3.4` for local development.
3. `prisma migrate dev --name init`.
4. **Hand-written migration** for everything Prisma can't express — copy the SQL block from the foot of the schema file: extensions, three GiST indexes, the partial unique index on active quotes, two trigram indexes, and the audit-log `REVOKE`.
5. Implement `packages/db/src/geo-repository.ts` — the **only** place that reads or writes `geography` columns:
   - `setJobLocation(jobId, lat, lng)`
   - `setProfessionalBase(proId, lat, lng)` — computes and stores the obfuscated display point per TAD §4.3
   - `findProfessionalsNearJob(jobId, filters)` — single `ST_DWithin` query
   - `findJobsNearProfessional(proId, filters)` — single `ST_DWithin` query
   - `distanceMeters(fromLat, fromLng, toLat, toLng)`
6. Unit tests for `GeoRepository`, including the obfuscation determinism check.

### Definition of Done

- `pnpm db:migrate` applies cleanly against a fresh database
- All GiST, partial-unique, and trigram indexes verified present via `\di`
- `EXPLAIN ANALYZE` on the radius query shows an **index scan**, not a sequential scan
- The same professional ID always yields the same display point; two different IDs yield different offsets
- No file outside `geo-repository.ts` references a `geography` column

### Out of scope

API routes. Seed data (M0-06).

---

## M0-06 — Seed data

**Depends on:** M0-05
**Estimate:** 5h

### Goal

Realistic Canadian fixture data that makes geo matching testable.

### Scope

`packages/db/src/seed.ts` · `packages/db/src/fixtures/**`

### Steps

1. **Categories** — 2 parents, 6 leaves: Development → Frontend, Backend, Mobile · Data → Analytics, ML, Engineering.
2. **Tax rates** — all provinces, effective 2026-01-01: ON 13% HST · NB/NL/NS/PE 15% HST · BC/MB/SK 5% GST + PST · AB/NT/NU/YT 5% GST · QC 5% GST + 9.975% QST.
3. **Platform config** — single row, defaults from the schema.
4. **Skills** — ~40 IT skills.
5. **Users** — 1 super admin, 1 verification reviewer, 5 clients, 40 professionals.
6. **Geography** — distribute professionals across Toronto (43.6532, −79.3832), Vancouver (49.2827, −123.1207), Calgary (51.0447, −114.0719), Montreal (45.5019, −73.5674) with random offsets up to 30km and service radii of 10–50km.
7. **Jobs** — 20 across all statuses; mix of ONSITE and REMOTE. Some deliberately outside every professional's radius, to prove the filter excludes them.
8. Idempotent: safe to re-run.

### Definition of Done

- `pnpm db:seed` runs twice with no duplicates or errors
- Every professional has a base point _and_ a display point
- A radius query from downtown Toronto returns Toronto professionals and excludes Vancouver ones
- At least one seeded job matches zero professionals — the negative case is testable

### Out of scope

Verification documents, payments, reviews.

---

## M0-07 — Layout shell and route skeleton

**Depends on:** M0-04
**Estimate:** 6h
**Reference:** `docs/nextjs-port-guide.md` §6

### Goal

Navigation shell in place and the full route tree stubbed, so later tickets add pages rather than restructure.

### Scope

`apps/web/src/components/layout/**` · `apps/web/src/app/**/layout.tsx` · route directory stubs

### Steps

1. Port `Logo`, `SiteHeader`, `SiteFooter`, `AppShell`, `AuthLayout`; swap `@tanstack/react-router` `Link` for `next/link`.
2. Create route groups and **real path segments** per the port guide:
   - `(marketing)/` with header + footer layout
   - `(auth)/` with `AuthLayout`
   - `(public-browse)/`
   - `client/` · `pro/` · `admin/` — **real segments, not groups**, to avoid the `/dashboard` collision
3. Placeholder `page.tsx` in each, naming its ticket.
4. Root `error.tsx`, `not-found.tsx`, `loading.tsx`.
5. `next-themes` provider with a header toggle.

### Definition of Done

- Every route in the port guide §6 resolves without 404
- **No route collision at build time**
- Dark toggle persists and switches correctly
- Marketing pages are Server Components — no `"use client"` in their `page.tsx`

### Out of scope

Real page content. Auth guards (M1).

---

## M0-08 — API conventions scaffold

**Depends on:** M0-02, M0-05
**Estimate:** 5h
**Reference:** ADR-001

### Goal

The API skeleton every later handler is written against, so conventions are set once rather than negotiated per route.

### Scope

`apps/web/src/server/**` · `apps/web/src/app/api/v1/health/route.ts` · `packages/contracts/**`

### Steps

1. Error envelope type + `ApiError` class with the status codes from SRS §11.
2. `withHandler()` wrapper: Zod parse → auth check → service call → serialize → typed error response.
3. Serialization layer with **explicit public/private DTO separation** — a public DTO must be structurally incapable of carrying `baseLatitude`, `baseAddressLine`, `phone`, or `email`.
4. `packages/contracts` with `openapi.yaml` — info block, security scheme, shared error and pagination schemas, and the health endpoint only.
5. `pnpm contracts:generate` emitting TypeScript types. Dart generation is stubbed with a TODO for phase 2.
6. `GET /api/v1/health` returning version and database connectivity.

### Definition of Done

- `/api/v1/health` returns 200 with a database check
- A deliberately malformed request returns the standard envelope with 422
- Generated types compile
- The public DTO test proves forbidden fields cannot be present

### Out of scope

Auth implementation (M1-01). Any domain endpoint.

---

## M0-09 — CI/CD pipeline

**Depends on:** M0-01, M0-02
**Estimate:** 5h

### Goal

Every PR verified automatically; every merge deployed to a preview environment.

### Scope

`.github/workflows/ci.yml` · `.github/workflows/deploy.yml` · `.github/pull_request_template.md`

### Steps

1. **CI on PR:** install → `typecheck` → `lint` → `prisma validate` → `prisma migrate diff` (fails on drift) → unit tests → build.
2. Postgres+PostGIS service container for tests requiring a database.
3. **Deploy on merge to `main`:** Vercel preview.
4. Branch protection: CI must pass, one approving review.
5. PR template with the `CLAUDE.md` NEVER-list as a review checklist.
6. Cache pnpm store and Next build.

### Definition of Done

- A PR runs the full pipeline in under 5 minutes
- A deliberate type error fails CI
- Schema drift between migrations and `schema.prisma` fails CI
- Merge produces a working preview URL

### Out of scope

Production deploy, staging environment, iOS runners.

---

## M0 SUMMARY

| Ticket                  | Hours  | Depends on |
| ----------------------- | ------ | ---------- |
| M0-01 Monorepo          | 4      | —          |
| M0-02 Next.js scaffold  | 3      | 01         |
| M0-03 Tailwind + tokens | 5      | 02         |
| M0-04 shadcn primitives | 6      | 03         |
| M0-05 Schema + PostGIS  | 8      | 01         |
| M0-06 Seed data         | 5      | 05         |
| M0-07 Layout + routes   | 6      | 04         |
| M0-08 API conventions   | 5      | 02, 05     |
| M0-09 CI/CD             | 5      | 01, 02     |
| **Total**               | **47** |            |

**Parallel tracks:** Dev A takes 01 → 02 → 03 → 04 → 07. Dev B takes 05 → 06 → 08 in parallel from the start, then 09.

**Exit review before M1:** demo the seeded radius query returning correct professionals, and the token-styled shell rendering in both light and dark.
