# Next Steps — Execution Plan (prompts for Codex)

**Derived from:** `Coding-Standards-Compliance-Review.md` in this same folder
**Purpose:** A step-by-step build plan, ordered safest/cheapest → riskiest. Each step includes a
self-contained prompt you can hand directly to Codex (or any other coding agent) — it doesn't
assume Codex has seen this conversation, so each prompt carries its own context and file
references.

**Direction assumed:** grow the current flat Next.js app toward the architecture `CLAUDE.md`
describes (it names itself the operational source of truth), rather than rewriting from scratch
or rewriting the docs to match the current app. If that assumption turns out to be wrong, stop
before Phase D and say so — everything from Phase D onward depends on it.

This file does not modify any other document in `src/routes/docs`. It's a new, standalone plan.

---

## Phase A — Safe cleanup (no architecture decisions, do these first)

### A1. Delete the dead float-money `Hire*` schema

```
In prisma/schema.prisma, delete the HireJob, HireContract, HireAttachment, HireMilestone, and
DirectHireNegotiation models. Confirm first with grep that nothing in src/ or app/ references
db.hireJob, db.hireContract, db.hireMilestone, or db.directHireNegotiation — they should be
dead. Run `npx prisma migrate dev --name drop_hire_models` to generate the migration. Do not
touch any other models. These models stored money as Float, which the project's CLAUDE.md
explicitly forbids ("Never store money as a float or Decimal in application code"), and they
duplicate the correct Int-cents ProjectTransaction/ProjectMilestone models.
```

### A2. Remove leftover pre-Next.js dead code

```
Delete src/lib/error-capture.ts. It references `h3` and `server.ts`, which are Nitro/TanStack
Start internals from before this app was ported to Next.js (see
src/routes/docs/nextjs-port-guide.md, section "WHAT GOES" — this exact file is listed as
something Next's error.tsx/not-found.tsx should replace). Grep the codebase first to confirm
nothing imports consumeLastCapturedError from it; if something does, remove that call site too.
```

### A3. Add basic security headers

```
Add a `headers()` function to next.config.ts (or create middleware.ts if preferred) that sets:
Strict-Transport-Security, X-Content-Type-Options: nosniff, X-Frame-Options: DENY,
Referrer-Policy: strict-origin-when-cross-origin, and a baseline Content-Security-Policy
appropriate for a Next.js app that loads Google-hosted fonts via next/font (self-hosted, so no
external font origin needed) and no other third-party script origins yet. Verify the app still
builds and loads in the browser with no CSP console errors.
```

### A4. Fix undocumented non-null assertions

```
In src/lib/auth.ts and src/lib/db.ts, the code uses process.env.AUTH_SECRET! and
process.env.DATABASE_URL! without a startup check. Replace both with an explicit check at module
load that throws a clear error if the variable is missing, instead of a silent `!` assertion. In
app/api/auth/[action]/route.ts around the reset-password handler, parsed.data.password! is used
after a Zod schema that already requires the field for that action — restructure the Zod schema
so the type is provably non-undefined for that branch without needing `!`, or add a one-line
comment explaining why it's safe if restructuring isn't practical.
```

### A5. Sweep arbitrary Tailwind values

```
Search src/ and app/ for Tailwind arbitrary pixel values (patterns like mt-[13px], rounded-[11px],
text-[17px]) and replace each with the nearest standard Tailwind utility or an existing token
from src/styles.css / the design system described in src/routes/docs/design-system.md. List every
file changed and the before/after class for each in your summary.
```

---

## Phase B — Testing foundation

### B1. Stand up a test runner and cover auth

```
Add Vitest to this Next.js project (no test framework currently exists — verify with
`find . -iname "*.test.ts"` returning nothing). Configure it to run against a test database or
mocked Prisma client. Write tests for app/api/auth/[action]/route.ts covering: register success,
register with duplicate email (409), login success, login with wrong password (401), an
unauthenticated request to a protected route, and a wrong-role request to a role-gated route
(e.g. a CLIENT session hitting the professional-only earnings resource in
app/api/portal/[resource]/route.ts). Add `"test": "vitest run"` to package.json.
```

---

## Phase C — Reliability & observability

### C1. Stop blocking requests on outbound email

```
In app/api/auth/[action]/route.ts, the register, resend-verification, and forgot-password
handlers currently `await sendVerificationCodeEmail(...)` / `await sendAuthEmail(...)` directly
before responding, which blocks the HTTP response on an SMTP round trip. Refactor so the email
send happens after the response is sent — use a fire-and-forget call (`void sendX(...).catch(err
=> console.error("email.send.failed", err))`) rather than awaiting it in the request path. Do not
change the email content or the sending logic itself, only when it's awaited.
```

### C2. Add Sentry

```
Add @sentry/nextjs to this project and run its setup wizard equivalent manually: sentry.client.config.ts,
sentry.server.config.ts, sentry.edge.config.ts, and wire SENTRY_DSN from an environment variable
(add it to .env.example as empty). Wrap the catch blocks in app/api/*/route.ts files that currently
only do console.error(...) so they also call Sentry.captureException(error) with the route name
and any relevant IDs (userId, resource) as extra context — but never log email, password, or
token values. Confirm the app still builds with SENTRY_DSN unset (Sentry should no-op locally).
```

---

## Phase D — API contract (ADR-001)

### D1. Move routes under `/api/v1` with a standard error envelope

```
Reference: src/routes/docs/ADR-001-mobile-ready-web-build.md and CLAUDE.md's "Code conventions"
section, which specify the error shape { error: { code, message, details? } }.

Move every route under app/api/** to app/api/v1/**, preserving behavior exactly. Replace the
current `{ error: "string" }` responses with the standard envelope — pick a stable string code per
error (e.g. "UNAUTHORIZED", "VALIDATION_ERROR", "NOT_FOUND", "JOB_NOT_FOUND") rather than reusing
the human message as the code. Update every client-side fetch call in src/routes/**/*.tsx that
currently calls /api/... to call /api/v1/... instead, and update any code that reads
`json.error` as a string to read `json.error.message`. Do not change the resource-dispatch
pattern in marketplace/[resource] or portal/[resource] yet — that's a separate step. Run
`pnpm build` and manually verify login and the client dashboard still work.
```

### D2. Write `openapi.yaml` for the routes that already exist

```
Reference: CLAUDE.md repository layout, which places the contract at docs/api/openapi.yaml
(create packages/contracts/openapi.yaml if you'd rather match that path, or docs/api/openapi.yaml
if flattening — pick one and be consistent).

Write an OpenAPI 3.1 spec documenting every endpoint currently under app/api/v1/** as of this
session (auth actions, dashboard, profile, marketplace resources, portal resources, admin
database-status). Include request/response schemas matching the actual Zod schemas and Prisma
select shapes in the code — don't invent fields that don't exist. This is documenting the current
API, not redesigning it.
```

---

## Phase E — Auth hardening

### E1. Add refresh-token rotation

```
Reference: CLAUDE.md section 3.2 (refresh rotation and reuse detection) in
src/routes/docs/technical-architecture.md, and src/lib/auth.ts for the current implementation
(single 7-day session JWT, no refresh token).

Add a second token: a short-lived access token (15 min) and a rotating refresh token (30 days),
stored hashed in a new RefreshToken Prisma model with a familyId. On refresh, mark the presented
token consumed and issue a new pair in the same family; if an already-consumed token is
presented, revoke the whole family and require re-login. Keep the refresh token in the existing
httpOnly cookie for web. Update app/api/auth/[action]/route.ts login/logout accordingly and add a
new /api/v1/auth/refresh route. Write tests for: normal rotation, replay of a consumed token
revokes the family, and a subsequent legitimate refresh after replay also fails.
```

---

## Phase F — Geo (large, do only once D and E land)

### F1. Introduce PostGIS + GeoRepository

```
Reference: CLAUDE.md sections "NEVER" items 6/7 and technical-architecture.md section 4.

Currently User.professionalLatitude/professionalLongitude are plain Float columns in
prisma/schema.prisma, directly readable by any Prisma query — there is no PostGIS, no geography
column, no GeoRepository. This is a significant migration: enable the postgis extension on the
database, add geography(Point,4326) columns via a hand-written SQL migration (Prisma can't
express this type), and build src/lib/geo-repository.ts as the only file permitted to touch those
columns, exposing setProfessionalBase(), findProfessionalsNearJob(), and distanceMeters(). Do not
attempt to also build the display-point obfuscation or job radius matching UI in this same
session — scope this ticket to the repository and migration only, and stop to report back once
that's done rather than expanding into the matching feature.
```

---

## Phase G — Verification badges

### G1. Derive `isVerified` from documents instead of a raw flag

```
Reference: CLAUDE.md "NEVER store badges as editable flags" and the ProfessionalVerification
Prisma model.

User.isVerified is currently a plain, independently-settable Boolean. Change it so verification
status is computed from ProfessionalVerification records (approved and unexpired) rather than
stored as a directly-writable column — either as a Prisma-computed value at read time or recomputed
into a cached column whenever a ProfessionalVerification record changes status. Update every
place that currently sets isVerified directly to go through this derivation instead. Report back
before touching admin approval UI if a Server Action there needs to change.
```

---

## Phase H — Payments — do not prompt this yet

`project-delivery-plan.md` lists **FINTRAC/escrow legal status** as a Critical-impact risk
("holding client funds may require money-services-business registration... get counsel's
opinion"). Separately, `Business_Requirements_Document.md` says Phase 1 has _no_ on-platform
payments at all (off-platform, direct client-to-professional), while `CLAUDE.md` says escrow is
mandatory before launch. Those two documents disagree, and it's a legal/business decision, not an
engineering one.

**Do not generate a Stripe Connect prompt until this is resolved.** Once it is, this phase should
cover: Stripe Connect Express onboarding, `PaymentIntent`/escrow capture-and-transfer, commission

- per-province tax freezing at appointment time, and idempotent webhook handling keyed on
  `event.id` — all specified in `technical-architecture.md` section 5.

---

## Suggested execution order

Run Phases A → B → C → D → E in order — each is independent enough to land as its own PR, and
none requires a business decision. Pause before F (geo) and G (badges) to confirm scope with
whoever owns the product, since both touch data that's already live. Do not start H until the
FINTRAC question above is answered.
