# Build and Deployment

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

Related: [environment.md](./environment.md) · [troubleshooting.md](./troubleshooting.md) · [../07-development/development-workflow.md](../07-development/development-workflow.md) · [../03-architecture/diagrams/deployment-architecture.md](../03-architecture/diagrams/deployment-architecture.md)

---

## 1. Summary

| Aspect | Finding | Status |
|---|---|---|
| Runtime model | Long-lived Node.js process `server.mjs` = Next.js request handler + Socket.IO server on the same HTTP port | Implemented |
| Build | `npm run build` = `prisma migrate deploy && next build` | Implemented |
| Production start | `npm start` = `cross-env NODE_ENV=production node server.mjs` | Implemented |
| Hosting target | **Unknown / conflicting evidence.** Vercel artifacts exist (`.vercelignore`, `.vercel` in `.gitignore`, `project-docs/DEPLOY.md`, remote branch `origin/vercel`, `@vercel/functions` dependency) but the architecture needs a persistent server. | `[NEEDS VALIDATION — not testable locally]` |
| Docker | Dockerfile / docker-compose: **Not detected** (a `docker-compose.test.yml` for tests existed until commit `185afc9`, then deleted) | Not detected |
| IaC (Terraform, K8s, CloudFormation, Procfile, fly/render/railway/nixpacks configs) | **Not detected** | Not detected |
| CI | GitHub Actions `Quality` workflow: lint, typecheck, build (no tests) | Implemented |
| CD / deploy pipeline | **Not detected** (no deploy job, no release workflow). Deployment is manual or performed by an external platform integration outside the repository. | Not detected |
| DB migration in deploy | Implicit: runs inside `npm run build` | Implemented (risky, see §3) |
| Rollback mechanism | **Not detected** (no scripts, no down migrations, no release tagging) | Not detected |
| Error monitoring | Sentry SDK initialised when DSN set; no release/source-map configuration | Partially implemented |

---

## 2. Local development

| Step | Command | Notes / evidence |
|---|---|---|
| Install | `npm ci` | Lockfile `package-lock.json`; README recommends `npm ci`. |
| Env | copy `.env.example` → `.env` | See [environment.md](./environment.md) §4. |
| Prisma client | `npx prisma generate` (README step 5) | Output `src/generated/prisma` (`prisma/schema.prisma:1-5`). The generated client is **committed** (77 tracked files), so a fresh clone type-checks even without generating; regenerate after any schema change. |
| Migrations | `npx prisma migrate deploy` | Uses `DIRECT_URL` → `DATABASE_URL` (`prisma.config.ts:6-9`). |
| Seed (optional) | `npm run db:seed` | `tsx prisma/seed.ts`; also `prisma.config.ts:12` registers `npx tsx ./prisma/seed.ts` for `prisma db seed`. |
| Run | `npm run dev` → `node server.mjs` | `NODE_ENV` unset ⇒ `dev = true` ⇒ Next dev mode with HMR; listens on `HOSTNAME:PORT` (default `0.0.0.0:3000`). Note: `next dev` CLI is **not** used, so CLI flags such as `--turbopack`/`--port` do not apply. |

A local PostgreSQL 16 container command is documented in `README.md` ("Local PostgreSQL with Docker"); it is a manual `docker run`, not a compose file.

---

## 3. Build process

```text
npm run build
  └─ prisma migrate deploy        # connects to DIRECT_URL||DATABASE_URL and APPLIES pending migrations
  └─ next build                   # compiles app/ + proxy.ts, type-checks, prerenders static routes
```

| Property | Detail | Evidence |
|---|---|---|
| Next.js version | `^16.1.6` declared; `16.3.0` installed. `next build` prints "▲ Next.js 16.3.0 (Turbopack)" — Turbopack is the default production bundler (no flag); compile ≈71 s locally, exit 0 [VALIDATED 2026-09-17 · [V-03](../validation/LOCAL_VALIDATION_LOG.md)] | `package.json`, `node_modules/next/package.json` |
| Prerendered routes | Build route table: 29 static (○), 98 dynamic (ƒ, incl. API). Static: `/about`, `/contact`, `/pricing`, `/services` (despite `force-dynamic` in `src/routes/services.tsx`, not re-exported by the page), `/for-clients`, `/for-professionals`, `/how-it-works`, `/cookies`, `/privacy-policy`, `/terms`, `/blog`, `/careers` and all `/admin/*` pages except `/admin` and `/admin/cms`. Dynamic: `/`, `/faq`. Consequence: admin CMS edits to static marketing pages appear only after a rebuild/redeploy [VALIDATED 2026-09-17 · [V-03](../validation/LOCAL_VALIDATION_LOG.md), [V-03b](../validation/LOCAL_VALIDATION_LOG.md)] | `next build` output |
| Output mode | Default (`.next/`); **no** `output: "standalone"` or `"export"` | `next.config.ts` |
| Build-time env | `NEXT_PUBLIC_*` values are inlined; `NODE_ENV` controls CSP `unsafe-eval` in `next.config.ts:3,6` (evaluated at config load) | `next.config.ts` |
| Tailwind | v4 via `@tailwindcss/postcss` | `postcss.config.mjs` |
| Sentry build plugin | Not used (`withSentryConfig` absent) → no source-map upload, no release creation | `next.config.ts` |
| Build history | `build` was `next build` only on branch `origin/vercel` (last commit 2026-08-16); `prisma migrate deploy &&` was prepended in commit `3e2e1b1` (2026-09-11) | `git log -S` on `package.json` |

### Consequences of running migrations inside `build`

1. **Every build mutates the target database.** Any environment that builds (CI, preview, production) must have a reachable database and credentials with DDL rights.
2. **CI applies all migrations** to its throw-away Postgres 16 service on every PR/push — this is the only automated migration-replay check that remains (the dedicated `migration-replay` job was removed in `185afc9`).
3. **Preview/branch builds against a shared database would apply unmerged migrations** to that database `[NEEDS VALIDATION: whether previews share a DB — not testable locally]`.
4. **Build and schema change are coupled but not atomic**: if `next build` fails after `migrate deploy` succeeded, the DB is already migrated while the old application version keeps running.
5. **Baseline drift is silent (does not block builds)**: `prisma/migrations/0_init/migration.sql` was rewritten (last modified in commit `185afc9`; project memory notes a 2026-09-12 rewrite) and `202608120003_shared_project_tracking/migration.sql` was edited in `6572a99`. With Prisma CLI 7.9.1, databases whose `_prisma_migrations` holds the old checksums get `No pending migrations to apply.` from `migrate deploy` and `Database schema is up to date!` from `migrate status` (exit 0, no warning), so the build proceeds and `prisma migrate resolve` is not required. The real risk: SQL added to those migrations after they were applied **never runs** on such databases [CORRECTED 2026-09-17 · [V-02](../validation/LOCAL_VALIDATION_LOG.md)]. The pre-`6572a99` migration set also fails on an empty DB (42P01 `relation "ProjectTracking" does not exist`) [VALIDATED 2026-09-17 · [V-02](../validation/LOCAL_VALIDATION_LOG.md)]. Even the current set yields an incomplete schema on an empty DB (28 models without a table, 16 missing FKs, 30 missing indexes) [[V-01](../validation/LOCAL_VALIDATION_LOG.md)]. See [troubleshooting.md](./troubleshooting.md#t-01).

---

## 4. Production runtime

| Item | Behaviour | Evidence |
|---|---|---|
| Start | `npm start` → `NODE_ENV=production node server.mjs` → `next({ dev:false })` serves the prebuilt `.next` | `package.json`, `server.mjs:13-17` |
| Port / bind | `PORT` (default 3000), `HOSTNAME` (default 0.0.0.0). Set `HOSTNAME` explicitly: shells/containers that pre-set it to the machine name make the server bind only to that interface [VALIDATED 2026-09-17 · [V-11](../validation/LOCAL_VALIDATION_LOG.md)] | `server.mjs:14-15` |
| Realtime | Socket.IO attached to the same `http.Server`, path `/api/realtime`, CORS = `REALTIME_ALLOWED_ORIGIN ?? APP_URL`; handshake verifies `servio_session` JWT and (if `DATABASE_URL`) checks `sessions` row + `User.isActive` via a raw `pg` pool (max 2) | `server.mjs:9-11,32-76` |
| Server → socket bridge | `globalThis.__servioIo` set in `server.mjs:77`; route handlers emit through `src/lib/realtime.ts`, which **silently no-ops** if the global is absent | `src/lib/realtime.ts:24-26` |
| In-process state | Rate-limit `Map` (`src/lib/rate-limit.ts`), background jobs as fire-and-forget promises (`src/lib/background-jobs.ts:11-19`), Prisma pool singleton | — |
| Filesystem writes | CMS JSON files in `data/` are **written at runtime** by admin CMS saves (`src/lib/cms-file.ts:119`, `src/lib/home-cms-file.ts:53`, `src/lib/marketing-cms.ts:263`); local file storage (`.project-work-files/`) is blocked in production (`src/lib/project-file-storage.ts:45-49`): with `NODE_ENV=production` and `FILE_STORAGE_PROVIDER` ≠ `s3`, every upload returns 500 "Local file storage is disabled in production. Configure S3-compatible storage." [FOUND IN VALIDATION 2026-09-17 · PROD-STORAGE] | — |
| Health endpoint | `GET /api/admin/database-status` (`SELECT 1`, latency); admin-only when `NODE_ENV=production` | `app/api/admin/database-status/route.ts` |
| Logs | `console.*` to stdout/stderr; structured JSON only through `logServerError` (`src/lib/server-logger.ts`) | — |
| Scaling | Single process. No Socket.IO adapter (Redis etc.), no shared rate-limit store → **horizontal scaling would break realtime fan-out across instances and per-instance rate limits** | absence of adapter in `server.mjs` |

### Runtime requirements implied by the code

A host must provide: a persistent Node.js ≥ 20.9 process (Next 16 requirement per README; CI uses Node 22), WebSocket/long-polling support, a writable and **persistent** working directory for `data/cms-*.json` (or CMS edits are lost on redeploy/restart), outbound HTTPS to Razorpay/Persona/Twilio/Google/SMTP/S3, and PostgreSQL connectivity.

---

## 5. Hosting evidence and the Vercel conflict `[NEEDS VALIDATION — not testable locally]`

| Evidence for Vercel | Location |
|---|---|
| `project-docs/DEPLOY.md` titled "Deploying to Vercel" (`npx vercel --prod`, "production commands are `npm run build` and `npm start`") | `project-docs/DEPLOY.md` |
| `.vercelignore` (excludes `.env*`, `node_modules`, `.next`, prisma sqlite files) | repo root |
| `.vercel` in `.gitignore` | `.gitignore` last line block |
| Remote branch `origin/vercel` (merged into `main`) | `git branch -a` |
| `@vercel/functions` in dependencies — **no import found** in `app/`, `src/`, `server.mjs`, `proxy.ts` (unused dependency) | `package.json` |
| Comment "Use a global singleton across serverless warm invocations" | `src/lib/rate-limit.ts:9` |
| `.commandcode/settings.json` records a check for `.vercel/project.json` in an earlier workspace (`D:\new`) | `.commandcode/settings.json` |

| Evidence against a pure Vercel deployment | Why it matters |
|---|---|
| `dev`/`start` scripts run a **custom server** (`server.mjs`) | Vercel's Next.js runtime ignores custom servers; `npm start` is not used by Vercel. |
| Socket.IO requires a long-lived HTTP server with upgrade handling | Vercel Functions are request-scoped; `globalThis.__servioIo` would never be set, so realtime notifications/messages silently stop (`src/lib/realtime.ts`). |
| Runtime writes to `data/*.json` | Serverless filesystems are read-only/ephemeral; CMS saves would fail or be lost. |
| In-memory rate limiting | Not shared across function instances. |

**Conclusion:** the repository supports two incompatible readings. (a) The app was/is deployed on Vercel, in which case realtime and CMS persistence are degraded in production; or (b) production runs `npm start` on a persistent VM/container host, in which case `DEPLOY.md` is outdated. No repository artifact resolves this. Hosting provider, domain, TLS termination and reverse proxy are **[UNKNOWN]**.

Database hosting: **PostgreSQL. Native local install for development; the AWS target is not yet chosen** (see [aws-target.md](./aws-target.md)). The earlier "likely Supabase" reading came from two code comments and nothing else — there is no `@supabase/*` package, no `sslmode`, no pooler configuration anywhere in the repository. Both comments were corrected on 2026-09-19. The `DATABASE_URL`/`DIRECT_URL` split remains useful: Prisma CLI migrations need a session-capable connection.

---

## 6. CI/CD

### 6.1 Continuous integration — `.github/workflows/quality.yml`

| Field | Value |
|---|---|
| Triggers | `pull_request` (all branches), `push` to `main` |
| Runner | `ubuntu-latest`, Node 22, npm cache |
| Services | `postgres:16-alpine` (db/user `servio_quality`), health-checked |
| Env | `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (CI-only placeholder), `APP_URL`, `REALTIME_ALLOWED_ORIGIN` |
| Steps | `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` (includes `prisma migrate deploy` against the service DB) |
| Not run | Unit tests, integration tests, migration-replay diagnostics (all removed in `185afc9`, 2026-09-15), `prisma validate`, format check, security/dependency audit |

### 6.2 Continuous deployment

**CI/CD deploy pipeline: Not detected.** No workflow deploys, tags releases, uploads Sentry releases, or runs migrations against a real environment. If Vercel's Git integration is connected it would build on push outside of this repository's visibility `[UNKNOWN]`.

---

## 7. Database migration process (as implemented)

| Step | Mechanism |
|---|---|
| Authoring | Hand-named folders `YYYYMMDDNNNN_description` (e.g. `202608310001_database_integrity_guards`), 28 migrations incl. `0_init`; `migration_lock.toml` present |
| Application | `prisma migrate deploy` inside `npm run build` |
| Preflight guards | Some migrations embed SQL preflights that `RAISE EXCEPTION` on dirty data (e.g. `202608310001_database_integrity_guards/migration.sql:23,29,38`) |
| Read-only diagnostics | `scripts/check-database-baseline.sql`, `scripts/full-database-audit.sql`, `scripts/project-db-check.ts` (manual) |
| Down / rollback migrations | None (Prisma migrate has no automatic down) |

Recommended deploy order documented in `project-docs/DATABASE_FIX_REPORT.md` and `project-docs/PRODUCTION_HARDENING_REPORT.md` (backup → verify `_prisma_migrations` → replay on disposable DB → apply → smoke test) is **documentation only**; no automation implements it.

---

## 8. Rollback

**Rollback mechanism: Not detected.**

| Layer | What exists | Gap |
|---|---|---|
| Application | Nothing in repo (no release artifacts, tags, or scripts). If hosted on Vercel, instant rollback is a platform feature `[UNKNOWN]`. | Reverting app code does not revert DB changes applied at build time. |
| Database | Forward-only migrations; project docs advise "restore the verified pre-deployment backup" | No backup/restore scripts or tested procedure (`PRODUCTION_HARDENING_REPORT.md`: "A tested backup and restore procedure is still missing"). |
| Data | `online.dump` (≈57 MB PostgreSQL dump) is committed at repo root | Not a rollback mechanism; it is a **sensitive data exposure** (see [security.md](./security.md)). |

---

## 9. Sentry / release configuration

| File | Behaviour |
|---|---|
| `instrumentation.ts` | Imports `sentry.server.config` (nodejs) or `sentry.edge.config` (edge); exports `onRequestError = captureRequestError` |
| `sentry.server.config.ts`, `sentry.edge.config.ts` | `dsn = SENTRY_DSN`, `enabled` only if set, `tracesSampleRate 0.1`, `sendDefaultPii false` |
| `instrumentation-client.ts` | Browser init with `NEXT_PUBLIC_SENTRY_DSN`; exports `onRouterTransitionStart` |
| `src/lib/server-logger.ts` | `logServerError` → JSON `console.error` + `Sentry.captureException` with `event` tag |
| Missing | No `release`, `environment`, source-map upload, `SENTRY_AUTH_TOKEN`; errors will be un-symbolicated and not grouped by release |

---

## 10. Production readiness signals in existing docs

`project-docs/PRODUCTION_HARDENING_REPORT.md` and `project-docs/FIX_COMPLETION_REPORT.md` both end with **"NOT PRODUCTION READY"** (migration baseline, missing integration tests, restore rehearsal). Some items they list as open have since been implemented in code (e.g. revocable sessions: `src/lib/auth.ts:23-40`, migration `202608310003_revocable_sessions`), while their test claims are now obsolete because the tests were deleted.

## Relationship to existing docs

| Existing doc | Status |
|---|---|
| `project-docs/DEPLOY.md` | **Partially accurate / outdated**: correct build/start commands, but does not address the custom server, Socket.IO, migrations-in-build or filesystem CMS. |
| `project-docs/PRODUCTION_HARDENING_REPORT.md`, `FIX_COMPLETION_REPORT.md`, `DATABASE_FIX_REPORT.md` | Historical status reports. Deployment-order and rollback guidance remains valid advice; test/validation results are obsolete. |
| `README.md` | Accurate for local setup; its "Flutter app" section points to `flutter_app/`, which is tracked in `HEAD` (139 files) but deleted in the current working tree (uncommitted). |
