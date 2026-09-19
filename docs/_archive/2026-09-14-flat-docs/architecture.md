> **OBSOLETE (archived 2026-09-17).** Earlier AI-generated review doc (2026-09-14). Content was verified against code, corrected and absorbed into the structured knowledge base — see [docs/README.md](../../README.md). Known errors include: React Router origin (actually Lovable TanStack Start), references to test files that no longer exist, and outdated counts. Do not rely on this file.

# Architecture

## The two-tree layout

The repository splits into two top-level source trees, and the split is the single most important
thing to understand before editing anything.

```
app/          Next.js App Router — routing only. Thin files.
src/          Everything else. The path alias @/* resolves here.
  components/   48 feature components + ui/ (46 shadcn primitives)
  routes/       ~40 large "screen" components — the actual pages
  lib/          Server and shared libraries
  hooks/        3 custom hooks
  generated/    Prisma client output (checked in, do not edit)
prisma/       schema.prisma (69 models, 5 enums) + 28 migrations
scripts/      Operational and seed scripts (tsx)
tests/        Integration tests (excluded from the default vitest run)
flutter_app/  Early mobile prototype, not at feature parity
project-docs/ Historical audit and status reports
```

`tsconfig.json` maps `@/*` to `src/*`. A file under `app/` importing `@/routes/login` is reaching
into `src/routes/login.tsx`.

### Why `src/routes/` exists

`src/routes/` is a holdover from an earlier React Router build of this app. The filenames still use
the flat-route convention from that era — `job.$jobId.tsx`, `professional/pro.$proId.tsx` — even
though routing is now entirely handled by `app/`.

These files were never migrated into the App Router. Instead, each `app/**/page.tsx` became a thin
server wrapper that renders the corresponding `src/routes/` component as a client component. **36 of
roughly 60 pages follow this pattern.** It works, but it means the App Router is doing very little
and almost all rendering happens on the client. See [react-guide.md](./react-guide.md) for what that
costs.

## Route groups

```
app/
  (marketing)/            Public pages — home, pricing, services, legal, FAQ
  (portal)/               Signed-in area, shared shell
    (client)/             Client-only screens
    professional/         Professional-only screens
  admin/                  Staff console, its own layout and login
  api/                    65 route handlers
  job/[jobId]/            Public job detail
  pro/[proId]/            Public professional profile
  project/[projectId]/    Shared project workspace
```

Parentheses are Next.js route groups — they organise files and let a segment own a `layout.tsx`
without adding a URL segment. `/dashboard` is served by
`app/(portal)/(client)/dashboard/page.tsx`.

### App Router conventions in use

| File | Where |
| --- | --- |
| `layout.tsx` | root, `(marketing)`, `(portal)`, `(portal)/(client)`, `(portal)/professional`, `admin` |
| `loading.tsx` | root, `(portal)/professional`, `job/[jobId]`, `pro/[proId]`, `project/[projectId]` |
| `error.tsx` | root only |
| `not-found.tsx` | root only |

Route segment config is used sparingly: `export const runtime = "nodejs"` on 9 handlers,
`dynamic = "force-dynamic"` on 2 pages, `revalidate = 0` on 1. Nothing uses `generateStaticParams`,
ISR, or the fetch cache — the app is dynamic throughout.

## Request lifecycle

```
Browser
  │
  ▼
server.mjs ─────────────────► Socket.IO upgrade at /api/realtime
  │  custom Node HTTP server      (separate auth path, see below)
  │
  ▼
proxy.ts  (Next.js 16 "proxy" — formerly middleware.ts)
  │  1. CSRF: reject mutating /api/* requests whose Origin isn't self or APP_URL → 403
  │  2. Read servio_session cookie, verifySession() once (hits the database)
  │  3. /admin/* without an ADMIN session → redirect /admin/login
  │  4. Protected page prefixes without a session → redirect /login
  │  5. Signed in but email unverified → redirect /verify
  │  6. Attach x-request-id to request and response
  │
  ├──► app/**/page.tsx    Server Component: read cookie, verify, redirect,
  │                       then render a "use client" screen from src/routes/
  │
  └──► app/api/**/route.ts  Handler: re-read cookie, verify again, validate with
                            zod, query Prisma, return NextResponse.json
```

### Next.js 16: `proxy.ts`, not `middleware.ts`

Next.js 16 renamed the `middleware` file convention to `proxy`. The exported function is `proxy`,
not `middleware`; `config.matcher` is unchanged. `middleware.ts` still works but is deprecated. A
codemod exists: `npx @next/codemod@canary middleware-to-proxy .`

**One caveat worth knowing.** The Next.js docs state that proxy "is meant to be invoked separately of
your render code and in optimized cases deployed to your CDN," and that you "should not attempt
relying on shared modules or globals." [`proxy.ts`](../proxy.ts) calls `verifySession()`, which
queries PostgreSQL through Prisma on every matched request. That is fine on this deployment — a
self-hosted Node server where proxy and handlers share a process — but it rules out edge deployment
of the proxy, and it puts a database round-trip in front of every page load, static assets excluded.

The matcher is `/((?!_next/static|_next/image|favicon.ico).*)`, so it runs on essentially everything.

### The custom server

[`server.mjs`](../server.mjs) wraps Next's request handler in a plain Node HTTP server so Socket.IO
can share the port. It is the entry point for both `npm run dev` and `npm start`.

```js
const io = new Server(httpServer, { path: "/api/realtime", cors: ... });
```

Consequences of running a custom server:

- No Vercel edge/serverless deployment without rework; this expects a long-lived Node process.
- `globalThis.__servioIo` is how server code reaches the Socket.IO instance — see
  [`src/lib/realtime.ts`](../src/lib/realtime.ts). If that global is absent, emit calls
  silently no-op.
- `HOSTNAME` defaults to `0.0.0.0` (IPv4 only). Set `HOSTNAME=::` to bind both stacks so
  `localhost` resolves without an IPv6 fallback hop.

## Security headers

[`next.config.ts`](../next.config.ts) sets, on every response:

- `Content-Security-Policy` (allowlist based)
- `Strict-Transport-Security`
- `X-Frame-Options: SAMEORIGIN`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

The CSP permits `unsafe-inline` and `unsafe-eval` in development. This is tracked as an open item in
`project-docs/CURRENT_PROJECT_STATUS.md` (SEC-001) and has not been migrated to nonces or hashes.

## Data layer

Prisma 7 with the `@prisma/adapter-pg` driver adapter — the client is constructed with an explicit
adapter rather than a connection string:

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

The generated client is written to `src/generated/prisma/` and **is committed to the repository**.
Regenerating it produces a large diff; that is expected.

`prisma.config.ts` supplies the datasource to the CLI and prefers `DIRECT_URL` over `DATABASE_URL`,
because migrations need a session-capable connection while the app can use a pooled one.

### Migrations

28 migrations. `0_init` is the baseline and was repaired on 2026-09-14 — it previously contained only
24 of the 69 tables, and several later migrations altered tables nothing had created. If you deploy
to a database that already recorded the old `0_init`, reconcile the checksum with
`npx prisma migrate resolve --applied 0_init` rather than re-running it.

## Build and run

| Command | Effect |
| --- | --- |
| `npm run dev` | `node server.mjs` — Next dev + Socket.IO |
| `npm run build` | `prisma migrate deploy && next build` — **migrations run during build** |
| `npm start` | Production Node server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Vitest unit tests only; `tests/integration/**` is excluded |
| `npm run test:integration` | Spins up a disposable PostgreSQL and runs the integration suite |
| `npm run db:seed` | `prisma/seed.ts` — categories, professionals, jobs |

Note that `build` applies migrations. A build against a production database will mutate its schema.

## Legacy areas

Three parts of the schema are superseded but still present. Model usage counts, measured by files
that call them:

| Area | Files | Status |
| --- | --- | --- |
| `ProjectTracking` and friends | 19 | **Live.** The current project workflow. |
| `HireJob` / `HireContract` / `HireMilestone` | 2 | Superseded by the above. |
| `SocketConversation` / `SocketMessage` | 3 | Realtime chat store. |
| `MessageConversation` / `Message` | 3 | A parallel messaging store. |
| `Legacy*` (5 models) | 2 | Imported historical data. |

Two messaging table sets coexist. Establishing which is canonical and removing the other is worth
doing before the schema grows further.
