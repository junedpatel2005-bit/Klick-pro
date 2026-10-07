# PROJECT DELIVERY PLAN

**Project:** Service Marketplace Platform — Web first, Flutter phase 2
**Version:** 2.0 · **Date:** 09 August 2026
**Prepared from:** Master Scope → BRD → SRS → Technical Architecture v2 → ADR-001

---

## 1. EXECUTIVE SUMMARY & GOALS

### Charter

Build and launch a two-sided, location-aware service marketplace for the Canadian market. Clients post jobs; verified professionals quote, are appointed, deliver against milestones, and are paid through platform-held escrow net of a 10% commission.

**Delivered as a responsive Next.js web application**, built against its own REST API so that Flutter apps in phase 2 consume an existing contract rather than driving new backend work.

### Baseline objectives

| #   | Objective                                  | Measure of done                                                             |
| --- | ------------------------------------------ | --------------------------------------------------------------------------- |
| G1  | Responsive web app serving both user types | Excellent at 375px, not merely unbroken                                     |
| G2  | Verified-professional trust model live     | Upload → admin review → derived badges, with expiry handling                |
| G3  | Geo matching as a core capability          | PostGIS radius matching p95 < 2s at 10k professionals                       |
| G4  | End-to-end money flow                      | Escrow → milestone release → payout, commission and tax correct to the cent |
| G5  | Location privacy provably enforced         | Every public endpoint has a passing test asserting forbidden fields absent  |
| G6  | API complete enough for phase 2            | Every client/professional capability documented in `openapi.yaml`           |
| G7  | Launch-ready                               | UAT signed off, legal pages live, monitoring in place                       |

### Capacity assumption — **confirm before this plan is trusted**

**2 full-time developers at ~35 productive hours/week each = 70 hrs/week combined**, both now on the web stack. If either is part-time, the calendar scales accordingly.

---

## 2. WORK BREAKDOWN STRUCTURE

Three workstreams. WS1 gates WS2; WS3 is continuous.

### WS1 — Platform Foundation & API

| Task                                   | DoD                                                                                                                             | Hrs     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1.1 Monorepo, tooling, CI/CD           | Turborepo, lint/typecheck/test/build green on PR, preview deploys                                                               | 40      |
| 1.2 Prisma schema, migrations, PostGIS | 40 models migrated, GiST + partial-unique indexes, `GeoRepository` with obfuscation, seed with 60 geo-distributed professionals | 40      |
| 1.3 API conventions & contract tooling | Error envelope, Zod boundary, public/private DTO separation, `openapi.yaml`, `contracts:generate`                               | 30      |
| 1.4 Auth service                       | Register, OTP via Twilio, argon2id, JWT with family rotation and replay detection, reset, Google OAuth, guards                  | 80      |
| 1.5 Media service                      | Signed uploads to 5 Supabase buckets, virus-scan gate, 15-min signed downloads, per-bucket authorization                        | 30      |
| 1.6 Profile APIs                       | Both profiles, completeness gating, geocode on save, display-point computed                                                     | 60      |
| 1.7 Category taxonomy                  | Two-level model, admin CRUD, IT categories seeded                                                                               | 20      |
| 1.8 Job APIs + geo matching            | Job CRUD, state machine, `ST_DWithin` single indexed query, remote bypass                                                       | 70      |
| 1.9 Discovery & search APIs            | Full-text + trigram, combinable filters, cursor pagination, configurable ranking                                                | 50      |
| 1.10 Quote & hiring APIs               | Submit/revise/withdraw, atomic acceptance with sibling closure, concurrency-safe                                                | 60      |
| 1.11 Work & milestone APIs             | Agreement, progress, work proof, submit/confirm/revise, timeline                                                                | 50      |
| 1.12 Chat APIs                         | Thread per (job, professional), messages, attachments, admin read                                                               | 40      |
| 1.13 Notification service              | `BackgroundJob` queue + cron, fan-out, Web Push/email/in-app, preferences, caps                                                 | 70      |
| 1.14 Review & dispute APIs             | Double-blind publication, responses, aggregation, dispute lifecycle                                                             | 40      |
| 1.15 Admin APIs                        | Verification queue, review, users, disputes, config, audit log, role gating                                                     | 60      |
| 1.16 Payments                          | Stripe Connect onboarding, escrow, milestone release, commission + provincial tax, invoices, payouts, idempotent webhooks       | 140     |
|                                        | **WS1 subtotal**                                                                                                                | **880** |

### WS2 — Web Application

| Task                          | DoD                                                                                                                                                                 | Hrs     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 2.1 Port prototype to Next.js | App Router, Tailwind v4 tokens intact, 49 shadcn components, shell components, fonts self-hosted                                                                    | 60      |
| 2.2 Marketing pages           | 11 pages server-rendered with Metadata API, dynamic categories, contact form, **legal pages**                                                                       | 50      |
| 2.3 Auth screens              | Signup/login/OTP/reset, API client with single-flight refresh, guards                                                                                               | 40      |
| 2.4 Client portal             | Profile, saved locations, post job, discovery, quote comparison, shortlist, hiring, tracking, milestone confirm, checkout, invoices, reviews, disputes              | 180     |
| 2.5 Professional portal       | Profile wizard, portfolio, categories/skills, service-area editor, verification upload, job feed, quoting, work management, work proof, earnings, Stripe onboarding | 180     |
| 2.6 Google Maps integration   | Pin placement, session-tokenised autocomplete, clustered **obfuscated** markers, radius overlay, on-demand travel time                                              | 60      |
| 2.7 Chat UI                   | Thread, attachments, unread, polling                                                                                                                                | 40      |
| 2.8 Admin panel               | 7 role-gated screens, MFA enforced. **Server Actions permitted here only**                                                                                          | 120     |
| 2.9 Notifications UI          | Inbox, preferences, Web Push opt-in                                                                                                                                 | 25      |
| 2.10 Responsive hardening     | Job feed, quote submission, work-proof upload excellent at 375px; optional PWA shell                                                                                | 40      |
|                               | **WS2 subtotal**                                                                                                                                                    | **795** |

### WS3 — Quality, Security & Launch (continuous)

| Task                   | DoD                                                                                             | Hrs     |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| 3.1 Privacy test suite | Role-by-role assertions that forbidden fields are absent, on every user-data endpoint           | 30      |
| 3.2 Integration & E2E  | All 15 BRD acceptance scenarios automated                                                       | 60      |
| 3.3 Security hardening | Rate limits, headers, ASVS L2 review, admin MFA, audit log verification                         | 40      |
| 3.4 Performance & load | Geo matching at 10k professionals, map render, feed pagination                                  | 25      |
| 3.5 Compliance         | PIPEDA consent, export/erasure, retention jobs, privacy policy accuracy incl. admin chat access | 20      |
| 3.6 UAT & fixes        | Both user types, real devices including phones                                                  | 80      |
| 3.7 Launch             | Production deploy, monitoring, alerting, runbook, rollback tested                               | 30      |
|                        | **WS3 subtotal**                                                                                | **285** |

**Raw total: 1,960 hours.**

---

## 3. TIMELINE & DEPENDENCIES

### Adjusted estimate

Raw hours assume conventional development. With Claude Code working from a fixed schema, a maintained contract and well-scoped tickets, boilerplate compresses; payments, integration and debugging do not.

| Scenario                   | Effective hours | Calendar at 70 hrs/wk    |
| -------------------------- | --------------- | ------------------------ |
| Conservative               | 1,960           | ~28 weeks (6.5 months)   |
| **Expected (AI-assisted)** | **~1,480**      | **~21 weeks (5 months)** |
| Optimistic                 | 1,300           | ~19 weeks (4.5 months)   |

**Plan to 5 months; hold 6.5 as the outer bound.** Re-baseline after M2, when real velocity is known.

### Roadmap

| Milestone                 | Weeks | Content                                                | Exit criteria                                                                     |
| ------------------------- | ----- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **M0 Foundation**         | 1–2   | 1.1, 1.2, 2.1                                          | CI green, schema migrated with PostGIS, design tokens rendering in Next.js        |
| **M1 Auth**               | 3–6   | 1.3, 1.4, 1.5, 2.3                                     | Register → OTP → login → silent refresh → reset, all through `/api/v1`            |
| **M2 Profiles & Trust**   | 7–11  | 1.6, 1.7, 2.5 (partial), 2.8 (partial), 1.15 (partial) | Professional completes profile, uploads documents, admin approves, badges appear  |
| **M3 Jobs & Geo**         | 12–15 | 1.8, 1.9, 2.4 (partial), 2.6                           | Client posts a geo-pinned job; matching professionals see it; privacy tests pass  |
| **M4 Quote & Hire**       | 16–19 | 1.10, 1.12, 2.4, 2.7                                   | Quote → compare → appoint → chat, end to end                                      |
| **M5 Delivery**           | 20–22 | 1.11, 2.4 (tracking)                                   | Milestones agreed, work proof uploaded, completion confirmed                      |
| **M6 Money**              | 23–26 | 1.16, 2.5 (earnings)                                   | Escrow funded, release pays professional, invoice arithmetic verified to the cent |
| **M7 Trust & Comms**      | 27–29 | 1.13, 1.14, 2.8, 2.9                                   | Double-blind reviews, disputes, full notification set, admin complete             |
| **M8 Hardening & Launch** | 30–33 | WS3, 2.10                                              | UAT signed off, production live                                                   |

### Critical path

```
1.1 Monorepo ──► 1.2 Schema+PostGIS ──► 1.4 Auth ──► 1.6 Profiles ──► 1.8 Jobs+Geo
                                                                            │
                                                      1.10 Quote/Hire ◄─────┘
                                                            │
                                              1.11 Milestones ──► 1.16 Payments ──► Launch
```

**Everything downstream of 1.2 is blocked by the schema and `GeoRepository`.** Highest-leverage task in the plan.

### Parallelisation

Both developers are now on the same stack, which removes the M0–M1 idle problem from v1 of this plan.

- **M0:** one takes the database track (M0-01/02/05/06), the other the frontend track (M0-03/04/07)
- **M1:** auth is largely serial. Dev B takes media (M1-09), the API client and shared components, then starts M2 profile schema early
- **M2 onward:** split by module — one on API handlers, the other on the portal screens consuming them, one milestone's worth of endpoints ahead
- **Admin panel (2.8)** splits across M2 and M7 — verification review is needed early, the rest can wait

---

## 4. RISK MITIGATION MATRIX

| #   | Risk                                                                                                                                                           | Likelihood | Impact       | Mitigation                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **FINTRAC / escrow legal blocker.** Holding client funds may require money-services-business registration. Discovered at M6, it stalls the milestone entirely. | Medium     | **Critical** | Get counsel's opinion during M1 — 20 weeks of buffer. Fallback: destination charges with immediate transfer, no platform-held balance. Payment service sits behind an interface so the model can switch without touching business logic. |
| R2  | **Prisma cannot read or write PostGIS columns.** Every point operation is raw SQL. Discovered mid-M3, it forces rework across job and profile code.            | **High**   | High         | `GeoRepository` is built in M0-06, before any feature depends on it, with tests written first. Nothing outside it touches a geography column.                                                                                            |
| R3  | **Server Actions erode the API.** Next.js makes it easy to build a working web app with almost no HTTP API — then phase 2 has no endpoints.                    | **High**   | High         | ADR-001, enforced in review. Admin may use Server Actions; nothing else may. CI could assert that no `"use server"` file exists outside `app/admin`.                                                                                     |
| R4  | **Single-developer bus factor per area.**                                                                                                                      | Medium     | High         | Cross-review weekly. Keep `CLAUDE.md` and ADRs current so context lives in the repo. Both developers should have run every part of the build at least once.                                                                              |
| R5  | **Google Maps cost overrun.** Map-heavy product on metered APIs; autocomplete without session tokens multiplies billing.                                       | Medium     | Medium       | Session tokens mandatory, 30-day geocode cache, travel time on detail views only. Billing alert set in M0.                                                                                                                               |
| R6  | **Responsive treated as an afterthought.** With no app, on-site professionals are on phone browsers from day one.                                              | Medium     | Medium       | 375px is an acceptance criterion on every portal ticket, not a hardening task. Task 2.10 is polish, not first contact.                                                                                                                   |
| R7  | **Notification scope creep.** "Whatever possible, all activities" is unbounded.                                                                                | High       | Low          | The 26 enum values in the schema are the complete set. Beyond that is a change request.                                                                                                                                                  |
| R8  | **AI-generated code review debt.** Velocity gains lost to unreviewed inconsistency.                                                                            | Medium     | Medium       | One ticket, one branch, one PR, human review on every merge. The NEVER list in `CLAUDE.md` is the review checklist.                                                                                                                      |
| R9  | **Stale planning docs.** Decisions changed four times during planning; stale docs inject wrong decisions into generated code.                                  | Medium     | Medium       | `CLAUDE.md` is the single operational source of truth and is updated the same day a decision changes.                                                                                                                                    |

---

## 5. RESOURCE & ESTIMATION ALLOCATION

### By workstream

| Workstream           | Hours     | %   | Expertise required                                                               |
| -------------------- | --------- | --- | -------------------------------------------------------------------------------- |
| WS1 Foundation & API | 880       | 45% | Next.js route handlers, Prisma, PostgreSQL/PostGIS, Stripe Connect, JWT security |
| WS2 Web Application  | 795       | 41% | React 19, App Router, Tailwind v4, shadcn/ui, Google Maps JS                     |
| WS3 Quality & Launch | 285       | 14% | Testing, security review, deployment                                             |
| **Total**            | **1,960** |     |                                                                                  |

### By milestone (expected case, ~1,480 effective hours)

| Milestone             | Weeks | Effective hrs | Cumulative |
| --------------------- | ----- | ------------- | ---------- |
| M0 Foundation         | 2     | 105           | 105        |
| M1 Auth               | 4     | 200           | 305        |
| M2 Profiles & Trust   | 5     | 250           | 555        |
| M3 Jobs & Geo         | 4     | 210           | 765        |
| M4 Quote & Hire       | 4     | 190           | 955        |
| M5 Delivery           | 3     | 130           | 1,085      |
| M6 Money              | 4     | 200           | 1,285      |
| M7 Trust & Comms      | 3     | 120           | 1,405      |
| M8 Hardening & Launch | 4     | 75            | 1,480      |

### Running costs

| Service               | Monthly      | Note                                     |
| --------------------- | ------------ | ---------------------------------------- |
| Vercel Pro            | $40          | 2 seats; Hobby prohibits commercial use  |
| Supabase Pro          | $25          | Backups, no project pausing              |
| Google Maps           | $50–200      | $200/mo free credit absorbs early volume |
| Twilio                | $15–50       | Trial only reaches verified numbers      |
| SendGrid              | $0–20        | Free to 100/day                          |
| Sentry                | $0–26        |                                          |
| GitHub Actions        | $0–20        | No macOS runners at V1                   |
| **Development phase** | **$130–380** |                                          |
| Stripe                | 2.9% + $0.30 | Per transaction, from M6                 |

---

## 6. PHASE 2 — FLUTTER

Begins after web launch. **No API work included** — that is the return on ADR-001.

| Item                                                  | Hours   |
| ----------------------------------------------------- | ------- |
| Scaffold, theme, Riverpod, Dio, generated Dart models | 80      |
| Auth & onboarding                                     | 50      |
| Client flows                                          | 150     |
| Professional flows                                    | 170     |
| Google Maps SDK                                       | 50      |
| Chat                                                  | 40      |
| Push (FCM/APNs)                                       | 30      |
| Payments (Stripe SDK)                                 | 60      |
| Store readiness                                       | 30      |
| **Total**                                             | **660** |

One developer full-time ≈ 4.5 months; two ≈ 2.5 months. Register the Apple Developer account well before starting — organisation approval can take weeks.

---

## 7. IMMEDIATE NEXT ACTIONS

| #   | Action                               | Owner  | By           |
| --- | ------------------------------------ | ------ | ------------ |
| 1   | Confirm developer capacity (§1)      | You    | Before M0    |
| 2   | Engage counsel on FINTRAC/escrow     | You    | Week 1       |
| 3   | Supply full IT category list         | You    | Before M0-04 |
| 4   | Google Cloud billing account + alert | You    | M0           |
| 5   | Upgrade Twilio beyond trial          | You    | Before M1-03 |
| 6   | Stripe account, Connect test mode    | You    | Before M6    |
| 7   | Confirm provinces for tax rates      | You    | Before M6    |
| 8   | Commission legal/T&C copy            | Lawyer | Before M8    |
| 9   | Start M0-01                          | Dev A  | Now          |
