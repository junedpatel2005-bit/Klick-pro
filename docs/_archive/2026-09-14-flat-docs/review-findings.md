> **OBSOLETE (archived 2026-09-17).** Earlier AI-generated review doc (2026-09-14). Content was verified against code, corrected and absorbed into the structured knowledge base — see [docs/README.md](../../README.md). Known errors include: React Router origin (actually Lovable TanStack Start), references to test files that no longer exist, and outdated counts. Do not rely on this file.

# Review Findings

From a structural review of the codebase on 2026-09-14. Ordered by impact. These are architectural
and consistency observations, not a security audit — for the outstanding security and reliability
items see `project-docs/CURRENT_PROJECT_STATUS.md`.

## High impact

### 1. Shared API helpers exist, are tested, and are used by nothing

| Helper                                                                                       | Call sites |
| -------------------------------------------------------------------------------------------- | ---------- |
| `apiSuccess` / `apiError` ([`src/lib/api-response.ts`](../src/lib/api-response.ts))          | **0**      |
| `parsePagination` / `paginationSchema` ([`src/lib/pagination.ts`](../src/lib/pagination.ts)) | **0**      |

`api-response.ts` even has a passing unit test. Meanwhile all 65 route files call
`NextResponse.json` directly and produce at least five different response shapes. Clients cannot
write one error handler.

**Fix:** adopt `apiSuccess`/`apiError` in every new handler, and convert existing ones opportunistically.
Start with `/api/v1/*`, which already hand-rolls the exact envelope the helper produces.

### 2. Authorisation logic is copy-pasted, with drift

`verifySession` is called directly in 52 files, wrapped in a local helper written five different
ways: `getClient` (×5), `requireAdmin` (×4), `getSession` (×4), `getProfessional` (×2),
`sessionFromRequest` (×1). Some copies re-query `isActive` that `verifySession` already checked;
others don't. Role checks are inline `if` statements.

This is where an authorisation bug will eventually appear, and it is why no complete two-user
negative test matrix exists.

**Fix:** one `requireRole(request, "CLIENT" | "PROFESSIONAL" | "ADMIN")` in `src/lib/`, returning
either a session or a ready-made 401/403 response. Replace the local copies.

### 3. Two handlers carry most of the domain logic

| File                                      | Lines |
| ----------------------------------------- | ----- |
| `app/api/portal/[resource]/route.ts`      | 1,010 |
| `app/api/portal/project-actions/route.ts` | 786   |
| `app/api/auth/[action]/route.ts`          | 882   |

`project-actions` implements the entire project state machine as a chain of `if (input.action === ...)`
blocks in one `POST`. Every state transition, every notification and every payment trigger is in
that file. It cannot be unit-tested in pieces, and a change to one action risks all fourteen.

**Fix:** extract the transitions into `src/lib/services/` functions, one per action, with the route
reduced to dispatch and response. The service layer then becomes testable without HTTP.

### 4. Screen components are too large to review

`src/routes/` is 13,003 lines across ~40 files. `job.$jobId.tsx` alone is 1,797 lines mixing data
fetching, local state, layout and business rules. Five files exceed 600 lines.

**Fix:** split by concern — data hooks, presentational sections, dialogs — rather than by screen.

## Medium impact

### 5. React Query and react-hook-form are installed but unused

`@tanstack/react-query` has **zero imports**. `react-hook-form` is imported by exactly one file,
`src/components/ui/form.tsx`, which is the shadcn wrapper — no actual form uses it.

The cost is visible: 156 hand-written `fetch` calls, 465 `useState`, 146 `useEffect`, no request
de-duplication, no caching across navigation, and no client-side validation anywhere.

**Fix:** either adopt them or remove them from `package.json`. The current state is the worst of
both — the dependency weight without the benefit.

### 6. Server pages pass no data

36 pages follow the pattern `app/**/page.tsx` → session check → render `src/routes/X`. The server
component has the session and a database connection, and passes neither. Every screen fetches after
mount, so the first paint is a skeleton even for data the server already had.

**Fix:** pass initial data as props from the server page for the first screenful. The screen can
still re-fetch on interaction.

### 7. `openapi.yaml` is a 69-line stub

6 paths out of ~120 method handlers, the old product name in `info.title`, and at least one path
(`/client/proposals/{id}`) with no matching route file.

**Fix:** either generate it from the zod schemas or delete it. A spec that describes 8% of the
surface is worse than none, because it is trusted.

### 8. Background jobs are not durable

`enqueueBackgroundJob` ([`src/lib/background-jobs.ts`](../src/lib/background-jobs.ts), 3 call sites)
runs in-process and fire-and-forget. A restart between a database commit and its follow-up work
loses the notification or email. Tracked upstream as TRAN-001.

**Fix:** a minimal outbox table written in the same transaction as the state change, drained by a
worker.

### 9. Rate limiting is per-process and barely applied

`rateLimit` is an in-memory `Map` used in 3 places, all on auth paths. Two Node processes means
double the effective limit. Nothing else — file upload, exports, search, the public `/api/v1/*`
surface — is limited at all.

### 10. Audit logging covers two routes

`recordAudit` has 2 call sites, both in verification-document handlers. Admin actions that matter —
deactivating a user, approving a payout, editing the wallet — are not audited, despite the
`AuditLog` model existing for exactly that.

## Low impact / worth knowing

### 11. `proxy.ts` queries the database on every request

`verifySession()` inside the proxy means a Prisma round-trip in front of every non-static request,
and the result is then discarded — handlers verify again. The Next.js 16 docs note that proxy is
intended to be deployable to a CDN and should not rely on shared modules; this implementation cannot
be.

**Fix:** the cheap win is passing the verified session to handlers via a request header set in
`NextResponse.next({ request: { headers } })`, removing the second lookup.

### 12. `src/routes/` naming is misleading

Filenames still use the React Router flat-route convention (`job.$jobId.tsx`). The `$param` names
nothing — params arrive as props. New contributors reasonably assume the file path drives routing.

**Fix:** rename to plain names (`job-details.tsx`) as files are touched.

### 13. Two messaging table sets coexist

`SocketConversation`/`SocketMessage` (3 files) and `MessageConversation`/`Message` (3 files) both
exist. Likewise `HireJob`/`HireContract`/`HireMilestone` (2 files) alongside the live
`ProjectTracking` flow (19 files).

**Fix:** decide which is canonical, migrate, and drop the other before the schema grows further.

### 14. `npm run build` applies migrations

`"build": "prisma migrate deploy && next build"`. A build pointed at production mutates the
production schema. That coupling should be a separate, deliberate deploy step.

### 15. Providers mount everywhere

`GoogleMapsProvider` and `RealtimeNotifications` are in the root layout, so the Maps SDK loads and a
Socket.IO connection is attempted on public marketing pages that need neither.

### 16. Six ESLint `react-hooks` warnings

Unresolved, tracked as CODE-001. Missing effect dependencies and cleanup — the class of bug that
produces state updates after unmount.

## Things that are done well

Worth recording so they are not "fixed" by accident:

- **Revocable sessions.** The JWT carries a `sessionId` checked against a live table on every
  request. Logout, password reset and deactivation all take effect immediately. Socket.IO handshakes
  apply the same check rather than trusting the signature alone.
- **Money handling.** Integer paise throughout — no floats. Every ledger write carries an
  `idempotencyKey`, and `providerReference` is uniquely indexed where non-null, so a retried webhook
  cannot double-credit. Fee arithmetic is in one file.
- **Location privacy.** `createDisplayPoint()` shifts a professional's coordinates 1,200–2,000 m on a
  deterministic per-user bearing, and addresses are truncated to their last two parts. The raw
  coordinates never leave the server.
- **Retired endpoints return 410, not 404.** `/api/payments/razorpay/order` and `/verify` explicitly
  refuse with an explanation so old clients cannot silently bypass wallet settlement.
- **Webhooks read the raw body** before parsing, so signature verification is correct, and both
  providers' events are recorded with uniqueness constraints for replay safety.
- **CSRF is enforced centrally** in the proxy for all mutating API requests, with a missing `Origin`
  treated as untrusted.
- **Database integrity is enforced in the schema**, not just the application — foreign keys, check
  constraints on money and ratings, and a partial unique index for "one primary location per client".
