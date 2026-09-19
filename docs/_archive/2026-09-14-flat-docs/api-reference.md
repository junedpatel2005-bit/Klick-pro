> **OBSOLETE (archived 2026-09-17).** Earlier AI-generated review doc (2026-09-14). Content was verified against code, corrected and absorbed into the structured knowledge base — see [docs/README.md](../../README.md). Known errors include: React Router origin (actually Lovable TanStack Start), references to test files that no longer exist, and outdated counts. Do not rely on this file.

# API Reference

Every endpoint is a Next.js App Router **route handler** — a `route.ts` file under `app/api/`
exporting named functions for each HTTP method. There are **65 route files** covering roughly 120
method handlers.

## How a request is handled

```
1. proxy.ts          CSRF origin check on mutating /api/* requests
2. route.ts handler  Read the session cookie again, verify it
3.                   Parse and validate the body or query with zod
4.                   Query Prisma
5.                   Side effects — notifications, realtime emits, audit
6.                   return NextResponse.json(...)
```

Note step 2. The proxy verifies the session but **does not pass it on** — `NextResponse.next()`
forwards only headers, and the only header it adds is `x-request-id`. Every handler therefore
re-reads the cookie and calls `verifySession()` itself, costing a second database round-trip per
request.

## Authentication

### The session token

Defined in [`src/lib/auth.ts`](../src/lib/auth.ts).

| Property | Value |
| --- | --- |
| Cookie name | `servio_session` |
| Format | JWT, HS256, signed with `AUTH_SECRET` via `jose` |
| Claims | `userId`, `role`, `sessionId` |
| Lifetime | 7 days |
| Cookie flags | `httpOnly`, `sameSite=lax`, `secure` in production, `path=/` |

The JWT is **not** self-sufficient. `sessionId` points at a row in the `Session` table, and
`verifySession()` checks it on every call:

```ts
const session = await db.session.findUnique({ where: { id: payload.sessionId }, ... });
if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new Error("Inactive session.");
if (user.id !== userId || !user.isActive) throw new Error("Inactive session user.");
```

This makes sessions genuinely revocable — logout, password reset and admin deactivation all set
`revokedAt`, and a stolen cookie stops working immediately rather than at JWT expiry.

### Helpers

| Function | Guarantees |
| --- | --- |
| `verifySession(token)` | Valid signature, live session row, active user |
| `requireAuthenticatedUser(token)` | Alias of the above |
| `requireVerifiedUser(token)` | The above **plus** `emailVerifiedAt` is set |
| `revokeSession(token)` | Marks the session row revoked |
| `createSession({ userId, role })` | Issues a JWT and inserts the session row |

### Bearer tokens

A few handlers accept `Authorization: Bearer <jwt>` as an alternative to the cookie — the same JWT,
for the mobile client. Example from [`app/api/client/jobs/route.ts`](../app/api/client/jobs/route.ts):

```ts
const authHeader = request.headers.get("authorization");
const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
const token = bearerToken || request.cookies.get(sessionCookie)?.value;
```

This is applied per-route, not globally. Most handlers are cookie-only.

> The `ApiToken` model exists in the schema but is not used for authentication anywhere.

### Authorisation

Role checks are written inline in each handler. There is no shared guard, and the local helper has
been rewritten several times under different names:

| Helper name | Occurrences |
| --- | --- |
| `getClient` | 5 |
| `requireAdmin` | 4 |
| `getSession` | 4 |
| `getProfessional` | 2 |
| `sessionFromRequest` | 1 |

52 files call `verifySession` directly. Behaviour differs subtly between copies — some re-check
`isActive` against the database even though `verifySession` already did, some don't.

Page-level admin access is additionally gated in `proxy.ts`, which redirects any non-`ADMIN` session
away from `/admin/*`. API-level admin access is **not** gated there and relies entirely on each
handler's own check.

## CSRF protection

`proxy.ts` rejects any `POST`/`PUT`/`PATCH`/`DELETE` to `/api/*` whose `Origin` header is missing or
matches neither the request origin nor `APP_URL`:

```json
{ "error": "Request origin is not allowed." }
```
→ `403`

A missing `Origin` is treated as untrusted. Native mobile clients must send one.

## Validation

`zod` schemas are declared at the top of each route file and applied with `safeParse`. There is no
shared schema library — `src/lib/types/` holds TypeScript types, not zod schemas, so shapes are
redefined per route.

```ts
const jobInput = z.object({
  title: z.string().trim().max(160).optional().or(z.literal("")),
  budgetMin: z.coerce.number().int().min(0).max(10000000).nullable().optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  paymentMethod: z.enum(["WALLET", "OFFLINE"]).optional(),
  mode: z.enum(["draft", "publish"]),
});
```

`z.coerce` is used consistently for query and form values, which arrive as strings.

## Response shapes — inconsistent

This is the single biggest inconsistency in the API surface.

[`src/lib/api-response.ts`](../src/lib/api-response.ts) defines a proper envelope and an error-code
enum, and has unit tests in `src/lib/api-response.test.ts`:

```ts
apiSuccess(data, status?)  // → { data: ... }
apiError(code, message, status, details?)  // → { error: { code, message, details? } }

ApiErrorCode = { authentication, authorization, conflict, internal,
                 notFound, rateLimited, validation }
```

**No route uses it.** `apiSuccess` and `apiError` have zero call sites. All 65 handlers call
`NextResponse.json` directly, producing at least five different shapes:

| Shape | Where |
| --- | --- |
| `{ error: { code, message, details } }` | `/api/v1/*` — hand-rolled to match the envelope |
| `{ error: "Plain sentence." }` | Most handlers |
| `{ ok: true }` | `/api/contact` |
| `{ received: true }` | `/api/webhooks/persona` |
| Bare object or array | Many `GET` handlers — e.g. `{ jobs: [...] }` |

**If you are adding an endpoint, use `apiSuccess`/`apiError`.** They already exist and are tested;
adopting them is how the surface converges rather than diverges further.

### Status codes in use

| Code | Meaning here |
| --- | --- |
| `200` | Success |
| `400` | Validation failure |
| `401` | No session, or session invalid |
| `403` | Wrong role, or CSRF origin rejected |
| `404` | Not found, also used to hide records the caller may not see |
| `409` | Conflict — duplicate email, already-accepted offer |
| `410` | Deliberately retired endpoint (see below) |
| `429` | Rate limited |
| `500` | Unhandled |

## Pagination

[`src/lib/pagination.ts`](../src/lib/pagination.ts) exports a cursor-based `paginationSchema` and
`parsePagination()` with `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 100`.

**It has zero call sites.** Endpoints that paginate do it their own way — `/api/v1/professionals`
uses offset pagination with its own `page` and `limit` fields. Most list endpoints return everything
unbounded.

## Rate limiting

[`src/lib/rate-limit.ts`](../src/lib/rate-limit.ts) is an in-memory sliding window keyed by an
arbitrary string, with periodic cleanup. Used in **3 places**, all on authentication paths (admin
login, OTP issuance).

Because the store is a process-local `Map`, limits are per-instance. Running more than one Node
process multiplies the effective limit.

## Logging, audit and background work

| Helper | Call sites | Notes |
| --- | --- | --- |
| `logServerError` ([`server-logger.ts`](../src/lib/server-logger.ts)) | 9 | Structured error log with request context |
| `recordAudit` ([`audit-log.ts`](../src/lib/audit-log.ts)) | 2 | Both in verification-document routes only |
| `enqueueBackgroundJob` ([`background-jobs.ts`](../src/lib/background-jobs.ts)) | 3 | In-process, fire-and-forget — **not durable**; a restart loses queued work |

Most handlers still `console.error` directly. Sentry is wired through `@sentry/nextjs` with
`instrumentation.ts`, `sentry.server.config.ts` and `sentry.edge.config.ts`.

## Endpoint catalogue

Line counts are included because several handlers are large enough to be a design concern.

### Authentication

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/auth/[action]` | GET, POST | **882** |
| `/api/auth/me` | GET | 47 |

`/api/auth/[action]` is a single handler dispatching on the path segment across 17 actions:

`google` · `send-phone-otp` · `verify-phone` · `check-availability` · `register` · `login` ·
`send-phone-login-otp` · `login-phone` · `login-phone-password` · `logout` · `update-email` ·
`resend-verification` · `forgot-password` · `forgot-password-phone` ·
`verify-forgot-password-phone` · `verify-email` · `reset-password`

Registration and email login deliberately **do not** issue a normal session until
`emailVerifiedAt` is set; they return a verification-required response instead.

### Client

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/client/jobs` | GET, POST | 240 |
| `/api/client/jobs/[id]` | GET, PATCH, DELETE | 353 |
| `/api/client/jobs/export` | POST | 98 |
| `/api/client/payments/export` | POST | 93 |
| `/api/client/project-requests` | POST | 122 |
| `/api/client/project-requests/[id]` | PATCH | 59 |
| `/api/client/account` | GET | 83 |
| `/api/client/verification` | GET | 19 |

### Professional

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/professional/profile` | GET, POST | 126 |
| `/api/professional/proposals` | GET, POST | 172 |
| `/api/professional/project-requests/[id]` | PATCH | 60 |
| `/api/professional/favorite-jobs/[jobId]` | POST, DELETE | 61 |
| `/api/professional/verification` | GET, PUT | 66 |
| `/api/professional/verification/upload` | POST | 71 |
| `/api/professional/verification/documents/[...storageKey]` | GET | 65 |
| `/api/professional/razorpay-account` | GET, PUT | 51 |
| `/api/professional/jobs/export` | POST | 154 |
| `/api/professional/earnings/export` | POST | 126 |

### Shared portal — the project workspace

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/portal/[resource]` | GET, PATCH, DELETE | **1,010** |
| `/api/portal/project-actions` | POST | **786** |
| `/api/portal/project-files` | POST | 99 |
| `/api/portal/project-files/[fileId]` | GET | 56 |
| `/api/portal/payment-details/[paymentId]` | GET | 52 |

**`/api/portal/project-actions` is the domain core.** One `POST` handler switching on an `action`
field in the body, implementing the project state machine:

| Action | Effect |
| --- | --- |
| `start-work` | `READY_TO_START` → `IN_PROGRESS` |
| `update-progress` | Sets progress percentage and current stage |
| `create-milestone` | Adds a milestone (max 5) |
| `upload-work` | Attaches files to the active milestone |
| `submit-milestone` | → `AWAITING_CLIENT_REVIEW` |
| `request-revision` | → `REVISION_REQUESTED` |
| `approve-milestone` | Creates the payment, activates the next milestone |
| `submit-final-work` | Requires every milestone `APPROVED` |
| `request-client` / `complete-project` / `confirm-project-completion` | Completion handshake |
| `submit-review` / `respond-to-review` | Ratings |
| `submit-dispute` | Opens a dispute |

`approve-milestone` branches on `job.paymentMethod` — an `OFFLINE` job records the approval without
moving wallet money.

### Money

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/wallet` | GET, POST | 101 |
| `/api/wallet/deposit/order` | POST | 55 |
| `/api/wallet/deposit/verify` | POST | 54 |
| `/api/wallet/deposit/fail` | POST | 37 |
| `/api/wallet/milestone` | POST | 181 |
| `/api/payments/razorpay/config` | GET | 11 |
| `/api/payments/razorpay/order` | POST | **410 Gone** |
| `/api/payments/razorpay/verify` | POST | **410 Gone** |

The last two are deliberate tombstones. They return `410` so older clients cannot bypass wallet
settlement:

```
"Milestones are paid from the client wallet. Fund the wallet first."
```

Fee arithmetic lives in [`src/lib/wallet-ledger.ts`](../src/lib/wallet-ledger.ts):

```ts
export const CLIENT_FEE_RATE = 0.1;
export const PROFESSIONAL_FEE_RATE = 0.1;
// ₹1,000 milestone → client charged ₹1,100, professional paid ₹900, platform keeps ₹200
```

Every ledger write carries a unique `idempotencyKey`, and `providerReference` is uniquely indexed
where non-null, so a retried Razorpay callback cannot double-credit.

### Admin

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/admin/login` | POST | 83 |
| `/api/admin/users/[id]` | GET, PATCH, DELETE | 155 |
| `/api/admin/jobs/[id]` | GET, PATCH, DELETE | 180 |
| `/api/admin/verifications` | GET, PATCH | 135 |
| `/api/admin/disputes/[id]` | GET, PATCH | 138 |
| `/api/admin/disputes/[id]/messages` | POST | 55 |
| `/api/admin/finance/payouts` | POST | 106 |
| `/api/admin/finance/milestone-payout` | POST | 150 |
| `/api/admin/finance/withdrawals/[id]` | PATCH | 81 |
| `/api/admin/services` | GET, POST, PATCH, DELETE | 130 |
| `/api/admin/cms` | GET, PUT | 147 |
| `/api/admin/support` | POST, PUT, DELETE | 57 |
| `/api/admin/data/[resource]` | GET | 267 |
| `/api/admin/reports/[resource]` | POST | 234 |
| `/api/admin/sidebar-counts` | GET, PATCH | 102 |
| `/api/admin/database-status` | GET | 40 |

### Public and marketplace

| Endpoint | Methods | Auth | Lines |
| --- | --- | --- | --- |
| `/api/marketplace/[resource]` | GET | public | 58 |
| `/api/marketplace/jobs` | GET | public | 43 |
| `/api/search` | GET | public | 27 |
| `/api/geocode` | GET | public | 101 |
| `/api/contact` | POST | public | 17 |
| `/api/v1/professionals` | GET | public | 62 |
| `/api/v1/messages` | GET, PATCH, POST | session | 377 |

`/api/v1/professionals` is the richest query surface — filters for segment, category tier,
city/state/district, minimum rating, verified, availability and distance, with
`sort ∈ {recommended, rating, distance, most-reviewed, price}` and offset pagination. Distance
filtering requires `originLat` and `originLng` together or returns `400`.

### Profile and shared

| Endpoint | Methods | Lines |
| --- | --- | --- |
| `/api/profile` | GET, POST | 158 |
| `/api/profile/avatar` | GET, POST | 82 |
| `/api/profile/locations` | GET, POST | 53 |
| `/api/profile/locations/[id]` | PATCH, DELETE | 68 |
| `/api/dashboard` | GET | 103 |

### Webhooks

| Endpoint | Verification |
| --- | --- |
| `/api/webhooks/razorpay` | HMAC signature; events recorded in `RazorpayWebhookEvent` with a processing state so replays are idempotent |
| `/api/webhooks/persona` | `Persona-Signature` header; events recorded in `PersonaWebhookEvent`, unique on `providerEventId` |

Both read the **raw body text** before parsing — signature verification depends on the exact bytes.
Do not add body parsing ahead of them.

Razorpay has no webhook age/replay-window policy; Persona records a `lastProviderEventAt`. Tracked as
API-001.

### Verification

| Endpoint | Methods |
| --- | --- |
| `/api/verification/persona/start` | POST |
| `/api/verification/persona/status` | GET |

## Dispatch routes

Four endpoints switch on a dynamic segment rather than having separate files:

| Route | Behaviour |
| --- | --- |
| `/api/portal/[resource]` | 1,010 lines, `if (resource === ...)` chains across GET/PATCH/DELETE |
| `/api/admin/data/[resource]` | Generic admin table reads |
| `/api/admin/reports/[resource]` | Report generation |
| `/api/marketplace/[resource]` | Public listings |

This keeps the URL space tidy but produces very large files, defeats per-route code splitting, and
makes it hard to see at a glance which resources exist or what each returns. New resources are
better added as their own route files.

## Realtime events

Emitted server-side through [`src/lib/realtime.ts`](../src/lib/realtime.ts), which reaches Socket.IO
via `globalThis.__servioIo`. If the global is missing, every emit **silently returns** — worth
knowing when events appear to vanish.

Rooms: `user:<userId>` for each connected user; `admins` and `admin:room` for staff.

| Event | Room | Payload |
| --- | --- | --- |
| `notification:new` | `user:<id>` | `{ id, type, title, description, href, createdAt }` |
| `message:new` | `user:<id>` | Message record |
| `message:read` | `user:<id>` | Read-receipt marker |
| `project:updated` | `user:<id>` | `{ projectId }` — a signal to re-fetch |
| `proposal:new` | `user:<id>` | `{ jobId }` |
| `admin:notification` | `admins` | Also re-emitted as `notification:new` |
| `admin:overview-update` | `admins` | `{}` |
| `admin:verifications-update` | `admins` | `{}` |
| `admin:operations-update` | `admins` | `{}` |

Handshake auth in [`server.mjs`](../server.mjs) verifies the JWT signature **and** checks the
`sessions` table for revocation, expiry and `isActive` — the same guarantees as `verifySession`,
via raw SQL on a small `pg` pool. The check is guarded by `if (dbPool && ...)`, so it silently
degrades to signature-only if `DATABASE_URL` is unset.

## The OpenAPI spec is a stub

[`openapi.yaml`](../openapi.yaml) is 69 lines covering 6 paths:
`/auth/me`, `/client/jobs`, `/professional/proposals`, `/client/proposals/{id}`, `/portal/project`,
`/portal/project-actions`.

It describes fewer than 10% of the surface, still carries the old product name (`title: Servio API`),
and at least one path (`/client/proposals/{id}`) does not match a route file. Treat this document as
the reference and `openapi.yaml` as out of date.
