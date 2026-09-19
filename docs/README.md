# Klick-Pro (servio) — Project Documentation

Last verified against code: 2026-09-16 (commit `cd8f4fb`, branch `main`); runtime-validated 2026-09-17 — see [validation/LOCAL_VALIDATION_LOG.md](validation/LOCAL_VALIDATION_LOG.md)

This folder is the **source-of-truth knowledge base** for the Klick-Pro codebase (npm package `servio`). It was produced by reverse-engineering the repository: every non-trivial statement cites a file (`path:line`), and anything that could not be proven from code is marked `[UNKNOWN]` or `[NEEDS VALIDATION]`. It is written to be usable by a new developer **or an AI coding agent** with no prior conversation history.

---

## 1. What this is (30-second summary)

| Question | Answer | Read more |
|---|---|---|
| What is the product? | An India-focused services marketplace. Clients post jobs; professionals send proposals / receive hire requests; work is tracked through milestones; money flows through an internal wallet with Razorpay top-ups and admin-approved payouts; admins operate users, verification (Persona KYC), disputes, finance, CMS and reports. | [01-product/PRD.md](01-product/PRD.md) |
| Who uses it? | Public visitors, `CLIENT`, `PROFESSIONAL`, `ADMIN` (the only three roles in `UserRole`). | [01-product/PRD.md](01-product/PRD.md) |
| Tech stack | Next.js 16 App Router + React 19 + TypeScript, custom Node server (`server.mjs`) with Socket.IO, Prisma 7 + PostgreSQL, Tailwind 4 + shadcn/Radix, zod, jose JWT. | [03-architecture/solution-architecture.md](03-architecture/solution-architecture.md) |
| How does auth work? | Custom. One `servio_session` httpOnly cookie holding a JWT `{userId, role, sessionId}` that is re-validated against the `sessions` table on every request. **Users and admins share the same cookie and session mechanism**; admin separation is by role only (`proxy.ts` + per-handler checks). Login methods: email/password, phone OTP, Google OAuth, admin username/password. | [03-architecture/authentication-and-authorization.md](03-architecture/authentication-and-authorization.md) |
| Where is the code? | `app/` = Next routes & API route handlers; `src/routes/` = screen components; `src/components/` = UI; `src/lib/` = services/business logic; `prisma/` = schema & migrations; `server.mjs` = HTTP + Socket.IO server; `proxy.ts` = Next 16 middleware. | [03-architecture/solution-architecture.md](03-architecture/solution-architecture.md) |
| What APIs exist? | 66 route files → 149 logical endpoints + 10 Socket.IO events. | [05-api/api-specification.md](05-api/api-specification.md), [05-api/openapi.yaml](05-api/openapi.yaml) |
| What database exists? | PostgreSQL, 69 Prisma models, 5 enums, 28 migrations. | [04-database/database-design.md](04-database/database-design.md) |
| What screens exist? | 60 pages: Public 15, Auth 6, Client 9, Professional 13, Shared 5, Admin 12. | [06-ui/screen-inventory.md](06-ui/screen-inventory.md) |
| How do I test changes? | **There is no automated test suite** (removed in commit `185afc9`). CI runs lint, typecheck and build only. A reproducible manual runtime approach (private PostgreSQL, guarded environment, scripted API/socket/browser checks) is documented in [validation/LOCAL_VALIDATION_LOG.md](validation/LOCAL_VALIDATION_LOG.md). **Warning:** this Claude Code session exports `DATABASE_URL` → local `klick-pro`, which overrides any `.env`. | [07-development/testing-strategy.md](07-development/testing-strategy.md) |
| What should I avoid changing / be careful with? | Auth helpers and `proxy.ts`, wallet/payout code, Prisma migrations (never edit applied ones; `npm run build` runs `migrate deploy`), `server.mjs`, CMS file storage. See the change-hazards table. | [07-development/known-issues-and-tech-debt.md §5](07-development/known-issues-and-tech-debt.md) |
| How is it deployed? | No deploy pipeline or container config in the repo; hosting target is `[UNKNOWN]` (Vercel hints conflict with the long-running Socket.IO server). | [08-operations/deployment.md](08-operations/deployment.md) |

> **Before changing anything, read [07-development/known-issues-and-tech-debt.md](07-development/known-issues-and-tech-debt.md).** It lists verified critical issues (e.g. the `proxy.ts` Origin check blocks provider webhooks; 28 Prisma models have no table when the DB is built from migrations; concurrent wallet top-up verification double-credits) that affect how changes behave. Many findings were **reproduced at runtime** on a local server with a private PostgreSQL — see [validation/LOCAL_VALIDATION_LOG.md](validation/LOCAL_VALIDATION_LOG.md).

---

## 2. Document map

```text
docs/
├── README.md                         ← you are here (index, reading order, rules)
├── DOCS_BUILD_STATUS.md              ← how/when this knowledge base was generated
├── validation/
│   └── LOCAL_VALIDATION_LOG.md       ← runtime validation of [NEEDS VALIDATION] items (2026-09-17)
│
├── 01-product/          PRODUCT
│   ├── BRD.md                        business context, fee model, business rules, scope vs old specs
│   ├── PRD.md                        personas, modules & status, journeys, notifications
│   └── user-stories.md               US-<MOD>-NNN stories with acceptance criteria & status
│
├── 02-requirements/     REQUIREMENTS
│   ├── SRS.md                        implementation-derived SRS, interfaces, discrepancies vs old SRS
│   ├── functional-requirements.md    FR-<MOD>-NNN + traceability matrix (FR → screen → component → API → service → model)
│   └── non-functional-requirements.md NFR-<CAT>-NNN with enforcement evidence and gaps
│
├── 03-architecture/     ARCHITECTURE
│   ├── solution-architecture.md      summary, inventory, boundaries, layering, module map
│   ├── authentication-and-authorization.md  login/session/admin analysis, role & API protection matrix
│   ├── architecture-decisions.md     ADR-001… reconstructed from evidence
│   ├── integrations.md               Razorpay, Persona, Twilio, S3, SMTP, Google, Sentry, Socket.IO…
│   └── diagrams/                     Mermaid sources (see §4)
│
├── 04-database/         DATABASE
│   ├── database-design.md            engine, conventions, domains, migrations, integrity, gaps
│   ├── schema.md                     models, keys, relations, indexes, enums by domain
│   └── data-dictionary.md            every field of every model
│
├── 05-api/              API
│   ├── api-specification.md          all endpoints (auth, validation, errors, DB ops, side effects) + realtime
│   └── openapi.yaml                  OpenAPI 3.1 (x-source on every operation)
│
├── 06-ui/               UI
│   ├── ui-specification.md           frontend + component architecture
│   ├── design-system.md              tokens, primitives, typography, accessibility
│   └── screen-inventory.md           every route/screen: audience, auth, components, API calls, states
│
├── 07-development/      DEVELOPMENT
│   ├── coding-standards.md           actual conventions + rule compliance
│   ├── testing-strategy.md           what exists (nothing automated), critical untested areas
│   ├── development-workflow.md       local setup, DB, scripts, migrations, adding routes
│   └── known-issues-and-tech-debt.md consolidated, severity-ranked issue register
│
└── 08-operations/       OPERATIONS
    ├── deployment.md                 build, run, hosting evidence, migrations, rollback
    ├── environment.md                every env var: purpose, required, used by
    ├── security.md                   security controls checklist + risk register
    └── troubleshooting.md            evidence-based problems & fixes
```

---

## 3. Reading order

| You are… | Read in this order |
|---|---|
| **New developer** | This README → [solution-architecture](03-architecture/solution-architecture.md) → [development-workflow](07-development/development-workflow.md) → [environment](08-operations/environment.md) → [known-issues](07-development/known-issues-and-tech-debt.md) → area docs as needed |
| **AI coding agent about to change code** | This README → [known-issues](07-development/known-issues-and-tech-debt.md) → [authentication-and-authorization](03-architecture/authentication-and-authorization.md) → [functional-requirements traceability matrix](02-requirements/functional-requirements.md) for the feature → [api-specification](05-api/api-specification.md) / [schema](04-database/schema.md) / [screen-inventory](06-ui/screen-inventory.md) for the touched layer → [coding-standards](07-development/coding-standards.md) |
| **Product / business** | [BRD](01-product/BRD.md) → [PRD](01-product/PRD.md) → [user-stories](01-product/user-stories.md) |
| **Security review** | [security](08-operations/security.md) → [authentication-and-authorization](03-architecture/authentication-and-authorization.md) → [known-issues](07-development/known-issues-and-tech-debt.md) |
| **Ops / deploy** | [deployment](08-operations/deployment.md) → [environment](08-operations/environment.md) → [troubleshooting](08-operations/troubleshooting.md) → [database-design §migrations](04-database/database-design.md) |

---

## 4. Architecture diagrams

All diagrams live in [`03-architecture/diagrams/`](03-architecture/diagrams/) as **Mermaid inside Markdown** so they are version-controlled, diffable and render on GitHub/GitLab/VS Code. Each file contains the diagram, a short explanation, and its assumptions/limitations.

| Diagram | Shows |
|---|---|
| [system-context.md](03-architecture/diagrams/system-context.md) | Actors and external systems around the app |
| [container-architecture.md](03-architecture/diagrams/container-architecture.md) | Browser, custom server, Next.js, Socket.IO, PostgreSQL, file storage, providers |
| [application-flow.md](03-architecture/diagrams/application-flow.md) | Request lifecycle and marketplace money flow |
| [authentication-flow.md](03-architecture/diagrams/authentication-flow.md) | Login, session issue/verify, logout, reset, verification |
| [user-vs-admin-flow.md](03-architecture/diagrams/user-vs-admin-flow.md) | Where user and admin paths share or diverge |
| [api-flow.md](03-architecture/diagrams/api-flow.md) | Authenticated API request, Razorpay top-up → milestone funding, realtime emit |
| [database-erd.md](03-architecture/diagrams/database-erd.md) | ER diagrams (overview + per domain) |
| [deployment-architecture.md](03-architecture/diagrams/deployment-architecture.md) | What is known (and unknown) about runtime topology |

**Maintaining diagrams:** edit the Mermaid block in the same PR as the code change it reflects; keep only relationships verifiable in code; update the "assumptions/limitations" list. A code-derived knowledge graph (`graphify-out/graph.json`, `GRAPH_REPORT.md`, regenerate with `/graphify`) can help find call relationships but is not the source of truth.

---

## 5. Source-of-truth rules

1. **Implementation > this documentation > older documentation > assumption.** If code and docs disagree, the code is right and the doc is a bug.
2. Status labels used throughout: **Implemented** (verified in code) · **Partially implemented** · **Planned / inferred** (only with evidence such as TODOs, old specs, flags) · **Unknown**.
3. `[UNKNOWN]` = cannot be established from the repository. `[NEEDS VALIDATION]` = plausible from static reading but needs runtime/environment confirmation (`— not testable locally` = depends on production/hosting/business decisions). `[VALIDATED 2026-09-17 · V-xx]`, `[CORRECTED 2026-09-17 · V-xx]`, `[PARTIALLY VALIDATED 2026-09-17 · V-xx]` = outcome of the local runtime validation run; details per V-id in `validation/LOCAL_VALIDATION_LOG.md`.
4. IDs are stable and shared across documents: `FR-<MOD>-NNN`, `NFR-<CAT>-NNN`, `US-<MOD>-NNN`, `SCR-<AREA>-NNN`, `ADR-NNN`, `INT-NN`. Module codes: AUTH, ACC, CAT, JOB, PROP, PRJ, PAY, DSP, MSG, NOT, VER, SRCH, CMS, RPT, ADM, SYS.
5. **Secrets are never written here.** Environment variables are documented by name and purpose only.

### Older documentation (status)

| Location | Status |
|---|---|
| `project-docs/**` (BRD, SRS, scope, technical-architecture, design-system, CODING_STANDARDS, STATUS_POLICY, DEPLOY, audits, `docs/backend/16.x`, `docs/openapi.yaml`, ADR-001) | **Historical / partly obsolete.** Useful for intent and planned scope; each new document notes which older files it supersedes and where they are wrong. Not edited. |
| Root `openapi.yaml` | Superseded by [05-api/openapi.yaml](05-api/openapi.yaml). |
| Root `README.md` | Partly stale (mentions deleted `flutter_app/`, Node 20.9 vs CI Node 22). See [development-workflow](07-development/development-workflow.md). |
| `docs/_archive/2026-09-14-flat-docs/` | Earlier AI-generated review docs (architecture, react-guide, api-reference, review-findings). **Obsolete** — content verified, corrected and absorbed into this structure. Kept for history only. |

---

## 6. How to update this documentation

| When you change… | Update |
|---|---|
| An API route (`app/api/**`) | [api-specification.md](05-api/api-specification.md) endpoint block + [openapi.yaml](05-api/openapi.yaml) (`x-source` line refs) + auth matrix in [authentication-and-authorization.md](03-architecture/authentication-and-authorization.md) if auth changes |
| `prisma/schema.prisma` or a migration | [schema.md](04-database/schema.md), [data-dictionary.md](04-database/data-dictionary.md), [database-erd.md](03-architecture/diagrams/database-erd.md), migration table in [database-design.md](04-database/database-design.md) |
| A page / screen (`app/**/page.tsx`, `src/routes/**`) | [screen-inventory.md](06-ui/screen-inventory.md); [ui-specification.md](06-ui/ui-specification.md) if layouts/providers change |
| `proxy.ts`, `src/lib/auth.ts`, any auth helper | [authentication-and-authorization.md](03-architecture/authentication-and-authorization.md), [security.md](08-operations/security.md), auth diagrams |
| An env var | [environment.md](08-operations/environment.md) and `.env.example` |
| An integration | [integrations.md](03-architecture/integrations.md) |
| A feature's behaviour | the FR row + traceability line in [functional-requirements.md](02-requirements/functional-requirements.md) and the related user story |
| A significant technical decision | add an ADR to [architecture-decisions.md](03-architecture/architecture-decisions.md) |
| Fix a known issue | mark it resolved (with commit) in [known-issues-and-tech-debt.md](07-development/known-issues-and-tech-debt.md) |

Always refresh the `Last verified against code:` line of every file you touch.
