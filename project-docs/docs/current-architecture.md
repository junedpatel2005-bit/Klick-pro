# Servio current architecture

**Status:** Current implementation inventory  
**Reviewed:** 10 August 2026  
**Scope:** The repository as implemented. This is not a description of the planned monorepo architecture.

## Runtime and project layout

Servio is a single npm-managed Next.js application. It uses the App Router, React 19, TypeScript, Tailwind CSS v4, Prisma, PostgreSQL, and Radix/shadcn-style UI components.

```text
app/                    Next.js page and API route entry points
src/components/         Shared application and UI components
src/hooks/              Client hooks
src/lib/                Database, auth, email, queries, types, utilities
src/routes/             Page implementations re-exported by most app pages
src/generated/prisma/   Generated Prisma client; do not edit manually
src/styles.css          Tailwind v4 tokens and global styles
prisma/                 Active schema, migrations, and seed script
docs/                   Current documentation and implementation records
```

There is no `apps/`, `packages/`, `pnpm-workspace.yaml`, `turbo.json`, Docker Compose configuration, or OpenAPI contract in the current repository.

## Application routes

| Area                     | Current routes                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Public and marketing     | `/`, `/services`, `/how-it-works`, `/for-clients`, `/for-professionals`, `/pricing`, `/faq`       |
| Authentication           | `/signup`, `/login`, `/verify`, `/forgot-password`, `/reset-password`                             |
| Client-facing            | `/client-profile`, `/dashboard`, `/discover`, `/post-job`, `/job/[jobId]`, `/project/[projectId]` |
| Professional-facing      | `/professional-profile`, `/pro/[proId]`, `/earnings`, `/verification`                             |
| Shared or administrative | `/messages`, `/notifications`, `/admin`                                                           |

Most page wrappers in `app/` re-export components from `src/routes/`. `client-profile` and `professional-profile` directly use `ProfileSetup`.

The required public About, Contact, Privacy Policy, and Terms pages do not exist yet.

## Current API surface

The application currently has 23 API route handlers, including shared project-tracking actions and authenticated project-file upload/access routes. Most are not versioned under `/api/v1`. The initial API contract is tracked in `openapi.yaml`; it must be expanded whenever an endpoint changes.

| Endpoint family               | Current capabilities                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/api/auth/[action]`          | Registration, login, logout, current-user lookup, email verification/resend, password reset, and Google OAuth callback flow |
| `/api/profile`                | Client and professional profile setup/update                                                                                |
| `/api/dashboard`              | Authenticated client dashboard data                                                                                         |
| `/api/marketplace/[resource]` | Categories, professionals, jobs, and individual job/professional lookup                                                     |
| `/api/portal/[resource]`      | Notifications, professional earnings, messages, and project lookup                                                          |
| `/api/admin/database-status`  | Database health check; production access is admin-restricted                                                                |

The API uses dynamic resource/action dispatchers rather than stable resource-specific REST paths. Errors are generally returned as `{ error: "message" }`, not a structured error contract.

## Authentication

- `src/lib/auth.ts` creates a signed HS256 JWT containing `userId` and `role`.
- The token is stored in a `servio_session` HTTP-only, SameSite=Lax cookie with a seven-day lifetime.
- Protected handlers read and verify that cookie server-side.
- Passwords are hashed with bcrypt.
- Email verification and password-reset values are stored as hashes in the `ApiToken` table.
- Google sign-in uses an OAuth authorization-code exchange and stores temporary state in an HTTP-only cookie.

The current implementation does not have access/refresh token pairs, refresh-token rotation, Bearer-token support, PKCE, an API token contract, or a reusable auth service layer.

## Database and Prisma

`prisma/schema.prisma` is the active schema. It defines 58 models, including users, client profiles/jobs, Projects, verification records, notifications, messages, payments/wallet records, CMS content, legacy migration records, and generated-content support.

Prisma is accessed through a shared client in `src/lib/db.ts`. The current data model includes plain latitude/longitude fields and does not contain PostGIS geography columns, a `GeoRepository`, an audit-log model, or a background-job queue model.

`src/generated/prisma/` is generated output and must be recreated from the schema rather than edited directly.

## Environment variables

Only variable names are recorded here. Never add secret values to documentation.

| Variable               | Used by                                     |
| ---------------------- | ------------------------------------------- |
| `DATABASE_URL`         | Prisma database connection and seed script  |
| `AUTH_SECRET`          | JWT signing and verification                |
| `APP_URL`              | Google OAuth callback and reset-email links |
| `GOOGLE_CLIENT_ID`     | Google OAuth                                |
| `GOOGLE_CLIENT_SECRET` | Google OAuth                                |
| `SMTP_HOST`            | Transactional email transport               |
| `SMTP_PORT`            | Transactional email transport               |
| `SMTP_USER`            | Transactional email transport               |
| `SMTP_PASS`            | Transactional email transport               |
| `SMTP_FROM`            | Transactional email sender                  |
| `NODE_ENV`             | Runtime security and development behavior   |

`.env.example` also includes Google Maps browser settings. They are not currently consumed by the application source.

## Validation and quality status

| Control                          | Current status                          |
| -------------------------------- | --------------------------------------- |
| Linting                          | `npm run lint` passes                   |
| Production build                 | `npm run build` passes                  |
| Automated tests                  | No test files or configured test runner |
| CI                               | No GitHub Actions workflow directory    |
| OpenAPI                          | Not present                             |
| Security headers/CSP             | No repository-level policy configured   |
| Error monitoring                 | No Sentry or equivalent integration     |
| PostGIS/Docker local environment | Not configured                          |

## Missing foundations before feature expansion

1. Product-owner approval of the Phase 1 baseline in `docs/product-baseline.md`.
2. Test runner, test database strategy, CI workflow, and deployment quality gates.
3. Stable versioned API, standard error envelope, OpenAPI specification, and API tests.
4. Framework-independent services and explicit public/private DTOs.
5. A reviewed authentication migration plan for mobile-ready access/refresh tokens.
6. Secure storage, verification-document review, audit logs, background jobs, and observability.
7. A product-approved geospatial/privacy design before PostGIS or map features are implemented.
8. Legal approval before Stripe, escrow, wallet, tax, or payout work begins.

## Project-work file storage deployment note

Project Tracking files are private and are served only through the authenticated
`/api/portal/project-files/:fileId` route after confirming the requester is the
project's Client or Professional. The current development implementation stores
the bytes on the application server. Before a serverless production deployment,
configure persistent object storage or a persistent volume while retaining this
authenticated file-access route and the stable stored-file key.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:seed
npm run format
```
