# ADR-001 — Build the web app mobile-ready

**Status:** Accepted
**Date:** 09 August 2026
**Supersedes:** the "web only" reading of the v2 schema notes

---

## Context

Delivery is now sequential: **web first, Flutter after the web app is complete.** Flutter is deferred, not cancelled.

This is a different constraint from "web only." A genuinely web-only build invites shortcuts that are correct for web and fatal for a later mobile client — chiefly, letting React Server Components and server actions become the only way data enters and leaves the system. Every such shortcut is an endpoint that doesn't exist when Flutter starts, and the phase-2 team discovers it one screen at a time.

The failure mode is specific and common: the web app ships, works well, and has almost no HTTP API, because Next.js made it easy not to have one. Flutter then needs 60+ endpoints written from scratch against business logic entangled in React components. What should have been a 2-month port becomes a 5-month rebuild.

## Decision

Build the web app against its own REST API, exactly as though a second client already existed.

### The rules

**1. The service layer is the only place business logic lives.**
`packages/core` and `apps/web/src/server/services` contain the domain. They import nothing from `next/*`. Route handlers and server components are both thin callers.

**2. Every capability a mobile client will need must exist as a REST endpoint under `/api/v1`.**
Not "can be added later." It exists, it's in `openapi.yaml`, and it's tested — before the feature is considered done.

**3. Server Components may call the service layer directly.**
This is a performance win and it's allowed. The rule is only that a REST equivalent must also exist. Both call the same service; neither contains logic. No duplication of behaviour, only of entry point.

**4. Server Actions are permitted for the admin panel only.**
Admin is web-only forever — Flutter will never render a verification queue. Admin may use server actions freely and needs no REST surface. This is a real saving; take it.

**5. Client and Professional features get no such exemption.**
Anything a client or professional does — profile, jobs, quotes, hiring, milestones, work proof, chat, payments, reviews, notifications — goes through `/api/v1`. If a web form calls a server action instead of the API, that's a defect.

**6. Auth stays JWT.**
No drift to cookie sessions because "it's just web for now." Access + refresh tokens, `Authorization: Bearer`, refresh rotation with family revocation. The httpOnly cookie mirror for web is a convenience layered on top of tokens, never a replacement.

**7. `openapi.yaml` is maintained during the web build, not reconstructed after it.**
Contract-first within each milestone. When Flutter starts, `pnpm contracts:generate` emits Dart models on day one.

### What this rules out

- tRPC, or any RPC layer coupled to TypeScript clients
- Server actions as the primary mutation path for user-facing features
- Business logic in React components or route handlers
- Session-cookie authentication
- Response shapes designed around a specific React component's needs

## Consequences

**Cost during web build:** roughly 8–10% additional effort — writing and testing route handlers that a pure-web build could have skipped, and keeping the OpenAPI file current. Call it 120–150 hours across the project.

**Saving at phase 2:** the entire API workstream. Flutter consumes an existing, documented, tested contract instead of driving new backend work. Realistically 250–350 hours avoided, plus the schedule risk of discovering missing endpoints mid-build.

**Net:** clearly positive, and the benefit lands even if Flutter slips further — a documented REST API is also what any future integration, partner, or admin tooling will use.

**Secondary benefit:** responsive web still has to be excellent. On-site professionals will use phone browsers until the app ships, and that traffic doesn't wait for phase 2. Treat 375px as a first-class target for the job feed, quote submission, and work-proof upload.

## Phase 2 estimate (unchanged in scope, reduced in risk)

| Item                                                     | Hours   |
| -------------------------------------------------------- | ------- |
| Flutter scaffold, theme, Riverpod, Dio, generated models | 80      |
| Auth & onboarding                                        | 50      |
| Client flows                                             | 150     |
| Professional flows                                       | 170     |
| Maps (Google Maps SDK)                                   | 50      |
| Chat                                                     | 40      |
| Push (FCM/APNs)                                          | 30      |
| Payments (Stripe SDK)                                    | 60      |
| Store readiness                                          | 30      |
| **Total**                                                | **660** |

At one developer full-time, ~4.5 months. At two, ~2.5 months. **No API work included** — that is the point of this ADR.

## Add to `CLAUDE.md`

> **Flutter is coming in phase 2.** Every client- and professional-facing capability must exist as a documented REST endpoint under `/api/v1` before the feature is done. Server Components may read through the service layer directly, but a REST equivalent must exist. Server Actions are permitted **only** in the admin panel. Never put business logic in a component or a route handler. Never replace JWT with cookie sessions.
