# Development Workflow

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

Related: [coding-standards.md](./coding-standards.md) · [testing-strategy.md](./testing-strategy.md) · [../08-operations/environment.md](../08-operations/environment.md) · [../08-operations/deployment.md](../08-operations/deployment.md) · [../08-operations/troubleshooting.md](../08-operations/troubleshooting.md)

---

## 1. Prerequisites

| Requirement | Version / detail | Evidence |
|---|---|---|
| Node.js | README: "20.9 or newer"; CI uses **Node 22**; `@types/node ^22`. Use Node 22 to match CI. No `engines` field or `.nvmrc`. | `README.md`, `.github/workflows/quality.yml` |
| npm | Lockfile `package-lock.json` (use `npm ci`). `bun.lock` was removed in `185afc9`. | repo root |
| PostgreSQL | 16 (CI service `postgres:16-alpine`; README Docker command). Hosted Postgres (likely Supabase pooler + direct URL) supported. | `quality.yml`, `src/lib/db.ts:28-30` |
| Docker | Optional, only to run Postgres locally | `README.md` |
| Accounts (optional) | SMTP, Google Cloud (Maps, OAuth), Twilio Verify, Razorpay Test Mode, Persona, S3-compatible storage, Sentry | `.env.example` |
| OS notes | README gives Windows (`copy`) and macOS/Linux (`cp`) commands; `cross-env` used for `NODE_ENV` in `start` | `package.json` |

## 2. First-time setup

```bash
npm ci                                  # exact dependency tree
cp .env.example .env                    # Windows: copy .env.example .env
# edit .env — minimum: DATABASE_URL, DIRECT_URL, AUTH_SECRET, APP_URL,
# REALTIME_ALLOWED_ORIGIN, FILE_STORAGE_PROVIDER=local (see environment.md §4)
# note: server.mjs reads DATABASE_URL, REALTIME_ALLOWED_ORIGIN/APP_URL before .env loads — values only in .env
# disable socket revocation checks and Socket.IO CORS (environment.md §1, validated V-10)
npx prisma generate                     # regenerates src/generated/prisma (also committed)
npx prisma migrate deploy               # applies prisma/migrations/* to your DB
npm run db:seed                         # optional demo data (mutating; fails with P2003 on DBs that have Payment_milestone_id_fkey)
npm run dev                             # node server.mjs → http://localhost:3000
# Git Bash / shells that pre-set HOSTNAME: HOSTNAME=127.0.0.1 npm run dev
```

Local Postgres (from README):

```bash
docker run --name servio-postgres -e POSTGRES_DB=servio -e POSTGRES_USER=servio \
  -e POSTGRES_PASSWORD=<local-password> -p 5432:5432 -d postgres:16-alpine
```

First admin: set `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_PASSWORD` (≥12 chars) **and `ADMIN_EMAIL`** (not in `.env.example`), then sign in at `/admin/login` (`app/api/admin/login/route.ts:17-43`). Development alternative: the seed creates a seed admin and client (`prisma/seed.ts:7-10,809-820`; credentials are constants in that file).

Email verification: non-admin users are redirected to `/verify` until `emailVerifiedAt` is set (`proxy.ts:78-91`). Without SMTP configured, verification emails fail (see [troubleshooting T-09](../08-operations/troubleshooting.md)). Phone OTP in development prints the code to the server console (`src/lib/phone-otp-provider.ts:84-86`).

## 3. Daily commands (`package.json`)

| Script | Command | Purpose | Side effects |
|---|---|---|---|
| `dev` | `node server.mjs` | Custom server: Next dev mode + Socket.IO (`/api/realtime`) | Port 3000 |
| `build` | `prisma migrate deploy && next build` | Production build | **Applies migrations to `DIRECT_URL`/`DATABASE_URL`** |
| `start` | `cross-env NODE_ENV=production node server.mjs` | Run production build | — |
| `lint` | `eslint .` | ESLint + Prettier check (TS/TSX) | — |
| `typecheck` | `tsc --noEmit` | Strict typecheck of `app/`, `src/`, `proxy.ts` | Writes `tsconfig.tsbuildinfo` (incremental) |
| `format` | `prettier --write .` | Format **entire repo** | Rewrites files — avoid mass-formatting unrelated code |
| `check:razorpay` | `tsx scripts/check-razorpay-sandbox.ts` | Validate Razorpay Test Mode env | Exit 1 on missing/live keys |
| `db:seed` | `tsx prisma/seed.ts` | Demo categories, users, jobs, wallet/payments | DB writes (upserts + creates) |
| `db:add-subcategory-jobs` | `tsx scripts/add-faker-subcategory-jobs.ts` | Faker jobs per subcategory | DB writes |
| `db:add-juned-jobs` | `tsx scripts/add-faker-jobs-for-juned.ts` | Faker jobs for one hard-coded developer account | DB writes **and deletes** that account's demo project rows |
| `db:add-faker-clients` | `tsx scripts/add-faker-clients.ts` | Faker client accounts with a shared default password | DB writes |
| `db:post-faker-jobs` | `tsx scripts/post-faker-jobs-for-all-clients.ts` | Faker jobs for all clients | DB writes |

Not available: `test`, `test:*` (removed in `185afc9`), `prisma:*` wrappers, `postinstall`. There is no `next dev`/`next start` script; always use `dev`/`start` so Socket.IO runs.

## 4. Scripts catalogue (`scripts/`) — descriptions only, not executed

| Script | Purpose | Reads/Writes | Risk |
|---|---|---|---|
| `add-faker-clients.ts` | Creates Indian demo client users with bcrypt-hashed shared default password; prints the password | Writes `User` etc. | Medium (demo accounts with known password) |
| `add-faker-jobs-for-juned.ts` | Demo jobs for a hard-coded email; removes prior demo `ProjectTracking`/`ProjectRequest` rows for those jobs | Writes + deletes | Medium |
| `add-faker-subcategory-jobs.ts` | One demo job per service subcategory | Writes | Low–medium |
| `post-faker-jobs-for-all-clients.ts` | Demo jobs for every client | Writes | Medium (touches all clients) |
| `backfill-admin-notifications.ts` | Backfills admin `UserNotification` rows from users/jobs/proposals; requires an active admin | Writes | Low |
| `backfill-user-notifications.ts` | Backfills user notifications from project requests/negotiations/projects | Writes | Low |
| `seed-category-hierarchy.ts` | Seeds 3-tier `ServiceCategory` tree (Residential/Commercial/Industrial) | Writes (upsert) | Low |
| `reset-marketplace-catalog.ts` | **Destructive**: in one transaction deletes all project workflow rows, jobs, hire/negotiation rows, services and categories, detaches payments from milestones, then rebuilds catalog and remaps legacy categories (`:451-489`) | Deletes + writes | **High** — never run against shared/prod DB |
| `check-hierarchy-summary.ts` | Prints the category tree | Read-only | None |
| `project-db-check.ts` | Live DB audit: tables, `_prisma_migrations`, row counts, orphan checks | Read-only (`Prisma.sql`) | None |
| `check-database-baseline.sql` | psql diagnostics: migration history, tables, orphan/CHECK preflights | Read-only | None |
| `full-database-audit.sql` | psql schema/constraint/FK/index inventory | Read-only | None |
| `check-razorpay-sandbox.ts` | Razorpay env validation | Env only | None |
| `india-demo-locations.ts` | Static `INDIA_DEMO_CITIES` list; **no importer found** | — | Dead code |
| `export-client-credentials.ts` | Queries all `CLIENT` users and writes `CLIENT_CREDENTIALS.md` and `clients-credentials.json` (including a password column) to the repo root. Both output files are currently **committed to git**. | Read DB, write files | **High (security)** — do not run; outputs must not be committed. See [security.md](../08-operations/security.md). |

All scripts load `.env` via `dotenv/config` and use `DATABASE_URL` directly with **no environment guard or confirmation prompt**. `dotenv` never overrides variables already set in the shell, so an inherited `DATABASE_URL` silently wins over `.env` — this sent `prisma db push`/`db:seed` to the wrong local database during the 2026-09-17 validation run [FOUND IN VALIDATION 2026-09-17 · [S-11](../validation/LOCAL_VALIDATION_LOG.md)]. Scripts are outside `tsconfig.include` (not type-checked in CI).

## 5. Database workflow

> ### Check your DATABASE_URL before every Prisma command
>
> **An exported shell variable overrides `.env`.** On 2026-09-17 an inherited `DATABASE_URL`
> beat a worktree `.env`, and `prisma db push` plus `db:seed` ran against a real local database
> instead of the disposable one (validation log S-11).
>
> `npm run build` is `prisma migrate deploy && next build`, so **building also migrates**
> whatever database the environment points at. That is deliberate for the current workflow, but
> it means a stray variable turns an ordinary build into a schema change on the wrong database.
>
> ```bash
> echo $DATABASE_URL        # bash / Git Bash
> $env:DATABASE_URL         # PowerShell
> ```
>
> Expect it to be empty (so `.env` wins) or to be exactly the database you intend. The test
> harness enforces the same rule automatically: it refuses to run when `TEST_DATABASE_URL`
> equals `DATABASE_URL`.

### 5.1 Schema change → migration

The repository has no `migrate dev` script and migration folders use a hand-sequenced 12-digit prefix (`YYYYMMDDNNNN_description`), not Prisma's default 14-digit timestamp. Observed workflow:

1. Edit `prisma/schema.prisma`.
2. `npx prisma format && npx prisma validate`.
3. Create a **new** folder `prisma/migrations/<YYYYMMDD><NNNN>_<snake_description>/migration.sql` (next sequence after `202609110001_add_client_job_milestones`). Options: `npx prisma migrate dev --create-only` against a **disposable** DB and rename, or `npx prisma migrate diff` to generate SQL `[NEEDS VALIDATION: team's actual method is not recorded]`.
4. For constraints on existing data, follow the preflight pattern in `202608310001_database_integrity_guards` (`DO $$ … RAISE EXCEPTION 'MIGRATION REQUIRES CLEAN PREFLIGHT' …`).
5. `npx prisma generate` and **commit `src/generated/prisma`** (current convention: 77 generated files tracked).
6. If you add models, bump `prismaSchemaVersion` in `src/lib/db.ts:40` so the dev-server Prisma singleton is recreated.
7. Apply locally with `npx prisma migrate deploy`; verify with `npx prisma migrate status`.
8. CI's `npm run build` replays all migrations on an empty Postgres 16.

### 5.2 Rules and caveats

| Rule | Why |
|---|---|
| Never edit an existing migration's SQL | Databases that already applied it never run the edited SQL, and nothing warns: Prisma 7.9.1 `migrate deploy`/`status` ignore the checksum mismatch (exit 0, "No pending migrations"), so `prisma migrate resolve` is **not** needed for deploy — the missing objects must be added by a new migration. This already happened to `0_init` (`185afc9`) and `202608120003_shared_project_tracking` (`6572a99`) — see [troubleshooting T-01](../08-operations/troubleshooting.md#t-01). [CORRECTED 2026-09-17 · [V-02](../validation/LOCAL_VALIDATION_LOG.md)] |
| Never run `build`, seeds or scripts with `DATABASE_URL` pointing at shared/production | `build` applies migrations; scripts mutate/delete without guards. |
| Use `DIRECT_URL` for migrations on pooled hosts | `prisma.config.ts:6-9` comment. |
| `migrate dev` may prompt to **reset** a DB whose history diverged | Only use on disposable databases. |

## 6. Git workflow (as evidenced)

| Aspect | Evidence | Observation |
|---|---|---|
| Default branch | `main` (`origin/HEAD → origin/main`) | — |
| Remote branches | `feature/login`, `juned1`, `juned3`, `vercel` | Person-named and purpose-named branches; no enforced prefix scheme |
| Pull requests | Merge commit `cd8f4fb` "Merge pull request #2 from junedpatel2005-bit/juned1" | Only one PR merge in history; most work committed directly to `main` |
| Commit messages | 156 of 163 subjects are `save` (plus `sa`, `sav`, `ave`) | No conventional commits; history is not self-describing |
| Authors | Predominantly one author (`junedpatel3009-cpu`); 1–2 commits from others | — |
| History start | 2026-08-09 (`9bdbdc9`) | — |
| PR template / CODEOWNERS / branch protection | Not detected in repo (branch protection is a GitHub setting `[UNKNOWN]`) | — |
| CI gate on PRs | `Quality` workflow: lint, typecheck, build | See [testing-strategy.md](./testing-strategy.md) §2 |
| Uncommitted state at documentation time | `flutter_app/` deleted in working tree; new `docs/`, `graphify-out/` untracked | README still documents `flutter_app/` |

**Recommended (not currently practised):** short-lived branches (`feature/…`, `fix/…`), PRs into `main` with CI green, descriptive commit messages, PR description listing DB migrations, env changes and manual verification performed.

## 7. Adding an API route (follow existing patterns)

1. Create `app/api/<domain>/<resource>/route.ts` exporting `GET`/`POST`/`PATCH`/`DELETE(request: NextRequest, { params }: { params: Promise<{…}> })`. Check Next 16 docs in `node_modules/next/dist/docs/01-app/` for route handler APIs (see `AGENTS.md`).
2. Authentication: read `request.cookies.get(sessionCookie)` and `verifySession(token)` from `@/lib/auth` (wrap in try/catch → 401). Prefer the shared `requireAuthenticatedUser` / `requireVerifiedUser` (`src/lib/auth.ts:57-65`) over adding another local helper.
3. Authorization: check `session.role` and scope DB queries by owner (`where: { id, clientId: session.userId }`).
4. Validation: zod schema + `safeParse(await request.json().catch(() => null))` → 400 with `{ error: "…" }`.
5. Sensitive endpoints: `rateLimit(key, limit, windowMs)` from `@/lib/rate-limit` → 429.
6. Business writes in `db.$transaction`; state changes via conditional `updateMany` + 409.
7. After commit: `enqueueBackgroundJob` for email; `emitRealtime*` from `@/lib/realtime` for socket events.
8. Errors: `logServerError("<domain>.<action>.failed", error, { requestId: request.headers.get("x-request-id"), … })` → 500 with a generic message.
9. Remember `proxy.ts` blocks cross-origin mutations: browser `fetch` from the same origin works; external callers (webhooks, mobile) need consideration.
10. Mobile/versioned access: `/api/v1/<path>` automatically rewrites to `/api/<path>` (`next.config.ts:21-27`) unless a physical `app/api/v1/<path>` exists.
11. Document the endpoint in [../05-api/api-specification.md](../05-api/api-specification.md) and `docs/05-api/openapi.yaml`.

## 8. Adding a page / screen (follow existing patterns)

1. Choose the route group: `app/(marketing)/…` (public), `app/(portal)/(client)/…` or `app/(portal)/professional/…` (authenticated; `app/(portal)/layout.tsx` verifies the session server-side and redirects to `/login`), or `app/admin/…`.
2. Existing convention: implement the screen in `src/routes/<area>/<name>.tsx` (client component, `export default function`) and make `app/.../page.tsx` a thin wrapper (`export { default } from "@/routes/…"` or import + render).
3. If the page must require login, also add its prefix to `protectedPrefixes` in `proxy.ts:17-32` (portal layout already covers `(portal)` pages); admin pages under `/admin/*` are role-guarded by `proxy.ts:64-68` automatically.
4. Use shadcn primitives from `@/components/ui/*`, `cn()` from `@/lib/utils`, Tailwind utility classes (no inline styles), `lucide-react` icons.
5. Data: client-side `fetch("/api/…")` + `useEffect` is the prevailing pattern; server components may query `db` directly (as `app/(portal)/layout.tsx` does).
6. Add navigation entries in `src/lib/portal-navigation.ts` / admin sidebar components as applicable `[see ui-specification.md]`.

## 9. Before opening a PR (manual checklist)

- [ ] `npm run lint` and `npm run typecheck` pass.
- [ ] Schema changed → new migration folder, `prisma generate` output committed, `prismaSchemaVersion` bumped if models added.
- [ ] `npm run build` executed only against a disposable DB.
- [ ] Manual verification per [testing-strategy.md](./testing-strategy.md) §5.
- [ ] No `.env`, credential exports, dumps or generated secrets staged (`git status`).
- [ ] New env vars added to `.env.example` and [environment.md](../08-operations/environment.md).

## Relationship to existing docs

| Existing doc | Status |
|---|---|
| `README.md` | Accurate for setup; stale for `flutter_app/` (deleted in working tree) and missing `ADMIN_EMAIL`. |
| `project-docs/src/routes/docs/environment-setup.md` | Obsolete (monorepo, RS256 keys, docker-compose, Supabase Storage). |
| `project-docs/src/routes/docs/nextjs-port-guide.md`, `M0-tickets.md`, `M1-tickets.md`, `project-delivery-plan.md` | Historical planning; not the current workflow. |
| `project-docs/src/routes/docs/Coding Standards & Engineering Rules.md` §47–49 (git/PR/CI) | Normative targets not practised (see §6). |
