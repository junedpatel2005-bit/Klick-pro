# AWS target — constraints and open choices

**Status: no target chosen. No infrastructure code is committed.** This document records what the
codebase already decides for us, so that whoever picks the target is not rediscovering it. See
[ADR-019](../03-architecture/architecture-decisions.md) for the decision context.

Development runs PostgreSQL natively (see the README). This page is only about production.

## 1. The app needs a long-lived process — Lambda is ruled out

`server.mjs` is a persistent Node HTTP server with Socket.IO attached, and realtime depends on the
in-process `globalThis.__servioIo` handle (`src/lib/realtime.ts`). A request-scoped runtime never
sets it, so notifications and messaging would silently stop working while the rest of the app
appeared healthy.

Viable shapes: **ECS Fargate**, **App Runner**, or **EC2**. Each needs a load balancer that supports
websocket upgrades.

## 2. Socket.IO across more than one instance

There is no Socket.IO adapter configured (KI-076). With two or more instances, an event emitted on
instance A never reaches a client connected to instance B — realtime becomes silently partial rather
than broken, which is worse to diagnose.

Before any autoscaling: either a Redis adapter (ElastiCache) or a deliberate single instance with
sticky sessions. This decision gates the compute choice, so make it first.

## 3. Container image work still pending

`next.config.ts` does not set `output: "standalone"`. A container image without it has to ship
`node_modules`, which is large and slow to build. This is a code change and has not been made —
decide the target first, since it is wasted work if the answer is EC2 with a checkout.

## 4. Connection math

Two pools open per app process:

| Pool | Size | Purpose |
|---|---|---|
| `src/lib/db.ts` | `max: 5` | every request through Prisma |
| `server.mjs` | `max: 1` | one session lookup per Socket.IO handshake |

So each process consumes up to **6** connections. Size `max_connections` against
`6 × processes × instances`, and remember RDS caps connections by instance class. RDS Proxy is worth
considering if the process count is dynamic, but it is not needed for a fixed small fleet — the
shared-pool design already avoids the per-request connection churn that a proxy normally fixes.

## 5. Migrations run at build time

`npm run build` is `prisma migrate deploy && next build`. That is a deliberate choice for the
current workflow, but note the consequence for AWS: **a build container that cannot reach the
database cannot build the app.** CodeBuild and ECS image builds usually sit outside the VPC that
holds a private RDS instance. Either the build environment gets network access to the database, or
migrations move to an explicit release step before this can deploy.

## 6. Storage is already AWS-shaped

`@aws-sdk/client-s3` is a real dependency and `src/lib/project-file-storage.ts` is the only storage
seam. `FILE_STORAGE_PROVIDER=local` is the development default; production sets the S3 variables
listed in `.env.example`. Nothing else in the app touches the filesystem except the CMS JSON files
under `data/`, which **do** need a persistent volume or a move into the database — on an ephemeral
container filesystem, CMS edits are lost on redeploy.

## 7. Secrets

`.env.example` lists every variable. `AUTH_SECRET`, `DATABASE_URL`, SMTP, Razorpay, Twilio, Persona
and the S3 keys are all secrets and belong in SSM Parameter Store or Secrets Manager, injected as
environment variables at task start.

## 8. Before going live

- `APP_URL` must equal the public origin exactly — the CSRF origin check in `proxy.ts` compares against it.
- `REALTIME_ALLOWED_ORIGIN` must be set, or Socket.IO CORS is left open.
- Confirm the database session time zone is UTC: phone OTP verification compares timestamps in raw SQL and fails otherwise (KI-079).
- `HOSTNAME` is set by many container runtimes and will change the bind address (KI-076).
