# TECHNICAL ARCHITECTURE DOCUMENT

**Project:** Service Marketplace Platform
**Version:** 2.0 — web-first · **Date:** 09 August 2026
**Resolves:** OTD-01 … OTD-14 from the SRS
**Related:** ADR-001 (build mobile-ready)

---

## 1. DECISION SUMMARY

| ID     | Decision                       | Resolution                                                          |
| ------ | ------------------------------ | ------------------------------------------------------------------- |
| OTD-01 | Backend stack                  | Next.js 15 App Router route handlers as the single API; TypeScript  |
| OTD-02 | Mobile                         | **Deferred to phase 2** — Flutter + Riverpod, against this same API |
| OTD-03 | Database                       | PostgreSQL on Supabase with **PostGIS**; Prisma ORM                 |
| OTD-04 | Auth                           | Own JWT — 15-min access, 30-day rotating refresh, RS256             |
| OTD-05 | Search                         | PostgreSQL full-text + trigram; no external search engine at V1     |
| OTD-06 | Quote rate limit               | 20 per professional per day                                         |
| OTD-07 | Appointment window             | 48 hours, then auto-revert                                          |
| OTD-08 | Review window                  | 14 days after completion                                            |
| OTD-09 | Nearby-job notification cap    | 10/day, digest above 5                                              |
| OTD-10 | Audit log retention            | 7 years                                                             |
| OTD-11 | Min reviews for rating display | 3                                                                   |
| OTD-12 | Providers                      | Twilio (SMS), Mailtrap→SendGrid (email), **Web Push/VAPID**         |
| OTD-13 | Payments                       | **Razorpay Checkout + Route**, escrow                               |
| OTD-14 | Environments                   | local → preview (per PR) → staging → production                     |
| —      | **Maps**                       | **Google Maps** — Maps JS, Places, Geocoding, Distance Matrix       |
| —      | **Tax**                        | Per-province `TaxRate`, versioned by effective date                 |

---

## 2. ARCHITECTURE OVERVIEW

### 2.1 Shape

A modular monolith. One Next.js application serves the marketing site, both user portals, the admin panel, and the REST API. Business logic sits in a service layer with no dependency on Next.js, so extraction to a standalone service later is a routing change rather than a rewrite.

```
┌──────────────────────────────┐        ┌───────────────────────┐
│   Next.js Web (responsive)   │        │  Flutter iOS/Android  │
│  marketing · portals · admin │        │      (phase 2)        │
└──────────────┬───────────────┘        └───────────┬───────────┘
               │                                     │
               └──────────────┬──────────────────────┘
                              │ HTTPS, Bearer JWT
                   ┌──────────▼───────────┐
                   │  /api/v1/*           │  Route Handlers
                   │  Zod → auth → svc    │
                   │  → public/private DTO│
                   └──────────┬───────────┘
                              │
     ┌────────────────────────┴────────────────────────┐
     │        Service layer (framework-free)            │
     │  auth · profile · job · geo · quote · hiring ·   │
     │  verification · work · payment · review ·        │
     │  dispute · message · notification · admin        │
     └────────────────────────┬────────────────────────┘
                              │  Prisma  +  GeoRepository ($queryRaw)
                   ┌──────────▼───────────┐
                   │  PostgreSQL/PostGIS  │  Supabase
                   └──────────────────────┘

  Adapters (all behind ports in packages/core):
  Storage → Supabase Storage      Maps → Google Maps
  Payments → Stripe Connect       SMS → Twilio
  Email → SMTP                    Push → Web Push (VAPID)
  Queue → Vercel Cron + BackgroundJob table
```

### 2.2 Why route handlers rather than a separate backend

Two developers, greenfield, and a shared type system outweigh the benefits of a separate service. The extraction path is preserved by three rules, enforced in review:

1. Route handlers contain no business logic — parse, authorize, delegate, serialize.
2. The service layer imports nothing from `next/*`.
3. Every external dependency sits behind an interface in `packages/core/ports`.

**Vercel constraint:** serverless functions time out at 60s on Pro. Notification fan-out, reconciliation and badge recomputation are queued, never inlined.

### 2.3 Web-first, mobile-ready

Flutter is deferred, not cancelled. Per **ADR-001**, every client- and professional-facing capability exists as a REST endpoint before the feature is done. Server Components may read through the service layer directly; Server Actions are permitted **only** in the admin panel, which Flutter will never render.

Cost during the web build is roughly 8–10%. It removes the entire API workstream from phase 2.

---

## 3. AUTHENTICATION

### 3.1 Model

Own JWT. Not NextAuth (session cookies don't serve Flutter) and not Supabase Auth (would bind the auth layer to Supabase precisely where portability is wanted).

| Token   | Lifetime          | Web storage                           | Flutter (phase 2)        |
| ------- | ----------------- | ------------------------------------- | ------------------------ |
| Access  | 15 min            | Memory                                | Memory                   |
| Refresh | 30 days, rotating | httpOnly, Secure, SameSite=Lax cookie | `flutter_secure_storage` |

**Claims:** `sub`, `userType`, `accountStatus`, `profileComplete`, `iat`, `exp`, `jti`. Nothing else — badges, ratings and permissions come from the database, never from the token.

### 3.2 Refresh rotation and reuse detection

Each refresh issues a new token and consumes the old one, tracked by `familyId`. **Presenting an already-consumed refresh token revokes the entire family** and forces re-login. This is how stolen-token replay is caught, and it is the subtlest code in M1.

### 3.3 Registration and OTP

1. Register by email or phone → `USER` created `PENDING`, no tokens issued
2. 6-digit OTP, 10-minute expiry, max 5 attempts, 30-minute lockout
3. Resend: max 3/hour, minimum 60s apart
4. On verification → `ACTIVE`, token pair issued, empty profile row created
5. Profile completion gates job posting and quoting

Passwords: argon2id. Reset tokens single-use, 30 minutes, identical response whether or not the account exists, and all sessions revoked on reset.

### 3.4 Admin

Separate `/admin` segment in the same app. Roles: `VERIFICATION_REVIEWER`, `DISPUTE_HANDLER`, `FINANCE`, `SUPER_ADMIN`. **Role separation is a privacy requirement** — without it every admin can read every government ID on the platform. MFA mandatory.

---

## 4. GEOSPATIAL

### 4.1 Storage

`geography(Point, 4326)` with GiST indexes on `jobs.location_point`, `professional_profiles.base_point` and `display_point`.

Prisma has no PostGIS type. Columns are declared `Unsupported()`, created and indexed in a hand-written migration, and accessed via `$queryRaw`. **Prisma Client cannot read or write them.** A `GeoRepository` owns all point I/O. This is a known constraint, not a workaround to be tidied later — and it is risk R2 in the delivery plan.

### 4.2 Matching

```sql
ST_DWithin(p.base_point, j.location_point, p.service_radius_km * 1000)
AND j.category_id = ANY(professional's categories)
AND work modes compatible          -- REMOTE bypasses distance entirely
AND j.status IN ('PUBLISHED','QUOTED')
AND p.account_status = 'ACTIVE' AND p.profile_complete
```

Single indexed query. Never fetch-then-filter.

**Note on the IT launch category:** IT work is largely remote, so `REMOTE` jobs bypass radius matching and rank on skills, rating and portfolio. Geo is built to full strength from V1 as directed, but expect the remote path to carry most early traffic until trades launch. Both are first-class in ranking.

### 4.3 Privacy — obfuscated markers

```
offset_bearing  = hash(professional_id + GEO_OBFUSCATION_SALT) mod 360
offset_distance = 1000 + (hash(professional_id + SALT + 'd') mod 1000)   -- metres
display_point   = ST_Project(base_point, offset_distance, radians(offset_bearing))
```

Computed once on profile save, stored, and served to **every** non-appointed viewer. Deterministic so it cannot be triangulated across sessions.

Distance shown to users is computed from the **true** point (accurate); the marker renders at the **display** point (private). This is deliberate.

**The salt is permanent.** Rotating it moves every public pin, and the delta between old and new positions leaks the true location.

### 4.4 Google Maps

| Capability               | Service             | Cost control                                                                |
| ------------------------ | ------------------- | --------------------------------------------------------------------------- |
| Map rendering            | Maps JavaScript API | —                                                                           |
| Address autocomplete     | Places Autocomplete | **Session tokens mandatory** — without them each keystroke bills separately |
| Geocode / reverse        | Geocoding API       | 30-day cache keyed on normalised address                                    |
| Distance (straight line) | PostGIS             | No API call, no cost                                                        |
| Travel time              | Distance Matrix     | **Detail views only**, never list views                                     |

Browser key restricted by HTTP referrer; server key restricted by IP. Set a billing alert at the budget ceiling on day one — Maps is metered and this product is map-heavy.

All of the above sits behind a `MapsPort` interface. The provider is a configuration detail, not an architectural commitment.

---

## 5. PAYMENTS

### 5.1 Stripe Connect Express with escrow

Professionals onboard as Express connected accounts; Stripe handles their KYC and banking. The platform holds funds and releases per milestone.

```
1. Milestone agreed          → PaymentIntent created
2. Client authorizes         → funds authorized
3. Professional submits work → no money movement
4. Client confirms milestone → capture → transfer to connected account
                               (net of commission)
5. Stripe payout             → professional's bank, on Stripe's schedule
```

**Critical constraint:** a card authorization expires after 7 days. Milestones longer than that cannot use authorize-then-capture. For those, **capture immediately into the platform balance and transfer on release** (separate charges and transfers) — which means the platform holds client funds and carries money-transmission implications in Canada.

### 5.2 Commission and tax

Commission 10%, admin-configurable, **frozen onto the job at appointment**.

Money is integer cents, CAD. Worked example on a $1,000.00 milestone in Ontario:

| Line                           | Cents  |
| ------------------------------ | ------ |
| Milestone amount (client pays) | 100000 |
| Platform commission @10%       | 10000  |
| HST on commission @13%         | 1300   |
| Platform revenue               | 11300  |
| Transfer to professional       | 88700  |

**Canada is not one rate.** `TaxRate` is seeded per province and versioned by effective date: ON 13% HST; NB/NL/NS/PE 15% HST; BC/MB/SK 5% GST + PST; AB/NT/NU/YT 5% GST; QC 5% GST + 9.975% QST. `Payment` freezes `taxProvince` and `taxType` at charge time so a professional relocating never alters a historical invoice.

The platform charges tax **on its commission only**; professionals handle their own. Invoices must show all four lines separately or they are not compliant.

### 5.3 Webhooks

Every handler is idempotent on `event.id`, recorded in `StripeEvent` before processing. Signature verification mandatory. Handled: `payment_intent.succeeded`, `payment_intent.payment_failed`, `transfer.created`, `payout.paid`, `payout.failed`, `account.updated` (KYC), `charge.dispute.created`.

### 5.4 Refunds and disputes

A platform dispute freezes any pending release on that job. Resolution is an admin action producing release, partial refund, or full refund. Stripe chargebacks surface to admin but follow Stripe's process.

---

## 6. STORAGE

Supabase Storage, S3-compatible. **Vercel's filesystem is ephemeral — nothing is written locally.**

| Bucket             | Visibility         | Contents                                  |
| ------------------ | ------------------ | ----------------------------------------- |
| `public-media`     | Public read        | Profile photos, portfolio images          |
| `job-media`        | Private            | Job attachments — parties + admin         |
| `work-proof`       | Private            | Delivery evidence — parties + admin       |
| `verification`     | Private, encrypted | Government IDs, licences — **admin only** |
| `chat-attachments` | Private            | Thread participants + admin               |

Upload: client requests a signed upload URL → uploads directly to Supabase → notifies the API → `Media` row created → async virus scan → `CLEAN` before the file is retrievable.

Download URLs expire in 15 minutes. Verification document access is audit-logged on every read.

---

## 7. NOTIFICATIONS AND ASYNC WORK

A database-backed queue (`BackgroundJob`) drained by Vercel Cron every minute. Not elegant, but it avoids a queue service, survives function time limits, and gives retry plus dead-lettering for free.

Queued: nearby-job fan-out, email, push, badge recomputation, geocode batches, payout reconciliation, document-expiry sweeps, review-window closure.

**Channels at V1:** in-app inbox (always), **Web Push via VAPID**, email. Per-user, per-event-type preferences across 26 event types. FCM/APNs join in phase 2 — `PushSubscription` already models both shapes.

Nearby-job notifications cap at 10/day and digest above 5. Uncapped proximity alerts are the leading cause of professional-side churn.

---

## 8. MESSAGING

Text plus attachments. **One thread per (job, professional) pair** — a client negotiates with several professionals before appointing one, so a single thread per job is wrong. Threads open on first quote.

Polling at V1 (5s while a thread is open); WebSocket upgrade is a later optimisation and the API is shaped to allow it.

**Admins can read full thread contents** for dispute resolution. No end-to-end encryption; the privacy policy must disclose this explicitly. Messages are encrypted at rest at the database level only.

---

## 9. ENVIRONMENTS AND CI/CD

| Environment | Host               | Database                           |
| ----------- | ------------------ | ---------------------------------- |
| Local       | Docker Compose     | `postgis/postgis:16-3.4`           |
| Preview     | Vercel, per PR     | Supabase branch                    |
| Staging     | Vercel             | Supabase staging, Stripe test mode |
| Production  | Vercel → AWS later | Supabase production                |

- **PR:** typecheck → lint → unit tests → migration check → build → preview deploy
- **Merge to `main`:** above → integration tests → staging → smoke tests
- **Tag:** production deploy, migrations behind manual approval

No iOS/Android runners at V1. macOS minutes bill at 10× and the Apple account is a phase-2 dependency.

---

## 10. SECURITY BASELINE

- TLS 1.2+, HSTS, secure headers in middleware
- argon2id passwords; JWT RS256 with rotatable keys
- Rate limits: login 10/account/15min, OTP 3/hour, quotes 20/day, API 100/min/user
- Zod validation at every boundary; Prisma parameterises all queries
- Verification documents encrypted at rest, role-gated, access logged
- Immutable admin audit log, 7-year retention, `REVOKE UPDATE, DELETE`
- OWASP ASVS L2 target
- No PII in application logs — correlation IDs only

---

## 11. DATA PROTECTION — CANADA

PIPEDA applies federally; Quebec's Law 25 adds stricter consent and breach rules. Requirements: explicit consent at signup, data export and erasure on request, breach notification, documented retention. Verification documents retained 7 years to match financial record obligations, then purged.

**Confirm with counsel before launch:** whether holding client funds in escrow triggers money-services-business registration with FINTRAC. Stripe Connect's structure is designed to mitigate this, but the answer depends on the exact flow and is not one to guess.

---

## 12. OPEN ITEMS

| #   | Item                                                | Blocks       | Owner   |
| --- | --------------------------------------------------- | ------------ | ------- |
| 1   | Full IT category list beyond the 6 confirmed leaves | M0-04 seed   | You     |
| 2   | Provinces to support for tax                        | M6 invoicing | You     |
| 3   | FINTRAC / escrow legal position                     | M6 go-live   | Counsel |
| 4   | Stripe account with Connect enabled in test mode    | M6           | You     |
| 5   | Privacy Policy + T&C copy                           | Launch       | Lawyer  |
| 6   | Google Cloud billing account and alert              | M3           | You     |
| 7   | Apple Developer account                             | Phase 2      | You     |

Resolved since v1: launch market and timeline, map provider (Google), design tokens (from prototype), mobile sequencing (phase 2).
