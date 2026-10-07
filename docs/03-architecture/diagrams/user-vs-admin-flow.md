# User vs Admin Authentication and Authorization Flow

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

Related: [../authentication-and-authorization.md](../authentication-and-authorization.md) §17 (separation analysis), [authentication-flow.md](authentication-flow.md), [../../08-operations/security.md](../../08-operations/security.md) RISK-SEC-006.

---

## 1. Entry points converge on one session mechanism

```mermaid
flowchart LR
    subgraph UserUI["User UI"]
        UL["/login<br/>src/routes/login.tsx"]
        US["/signup"]
    end
    subgraph AdminUI["Admin UI"]
        AL["/admin/login<br/>app/admin/login/page.tsx"]
    end

    UL -->|"email+password"| L1["POST /api/auth/login<br/>no role filter"]
    UL -->|"phone OTP / phone+password"| L2["POST /api/auth/login-phone*<br/>CLIENT or PROFESSIONAL only"]
    UL -->|"Google button"| L4["GET /api/auth/google<br/>links any role by e-mail"]
    US --> L4
    US -->|"register -> e-mail link"| L5["POST /api/auth/verify-email"]
    AL -->|"username+password"| L6["POST /api/admin/login<br/>role ADMIN only (+ bootstrap)"]

    L1 --> CS
    L2 --> CS
    L4 --> CS
    L5 --> CS
    L6 --> CS

    CS["createSession()<br/>src/lib/auth.ts<br/>JWT HS256 {userId, role, sessionId}<br/>AUTH_SECRET, 7 days"]
    CS --> CK[["Cookie servio_session<br/>httpOnly, Lax, path /, 7d"]]
    CS --> ST[("sessions table<br/>same for all roles")]

    ADMINUSER(["ADMIN account"]) -.->|"can use"| L1
    ADMINUSER -.->|"can use (e-mail match)"| L4
    ADMINUSER -.->|"intended"| L6
    NONADMIN(["CLIENT / PROFESSIONAL"]) -.->|"rejected: role filter"| L6
```

## 2. Request-time authorization by role

```mermaid
flowchart TD
    R["Incoming request with servio_session"] --> P{"proxy.ts"}
    P -->|"mutating /api/* with bad/missing Origin"| X403["403"]
    P --> V["verifySession(): JWT + sessions row + User (DB role, isActive)"]
    V --> K{"Path?"}

    K -->|"/admin/* (not /admin/login)"| AR{"role == ADMIN?"}
    AR -->|"no"| RL["302 /admin/login"]
    AR -->|"yes"| AP["Admin page (client component)<br/>/admin and /admin/cms re-check ADMIN"]
    AP --> AAPI["/api/admin/* handlers<br/>each checks role == ADMIN<br/>(database-status: prod only)"]

    K -->|"listed user prefixes"| SP{"session present?"}
    SP -->|"no"| RLG["302 /login"]
    SP -->|"yes"| VE{"non-admin and e-mail unverified?"}
    VE -->|"yes"| RV["302 /verify"]
    VE -->|"no"| LG{"route group layout"}
    LG -->|"(client)"| LC{"role == CLIENT?"}
    LC -->|"PROFESSIONAL"| RPP["302 /professional-profile"]
    LC -->|"ADMIN"| RAD["302 /admin"]
    LC -->|"yes"| CP["Client page"]
    LG -->|"professional"| LP{"role == PROFESSIONAL?"}
    LP -->|"no"| RDX["302 /dashboard or /admin or /login"]
    LP -->|"yes"| PP["Professional page"]
    LG -->|"/project/*, /professional/my-jobs/*, /notifications"| NP["No page role check<br/>(any authenticated role renders)"]

    CP --> UAPI["User APIs<br/>CLIENT / PROFESSIONAL checks + ownership filters"]
    PP --> UAPI
    NP --> UAPI
    AP -.->|"shared endpoints also accept ADMIN:<br/>wallet GET, deposit/fail, v1/messages,<br/>portal project/payment-details/invoices,<br/>verification documents"| UAPI
    UAPI --> DB[("PostgreSQL (no RLS)")]
    AAPI --> DB
```

## 3. Realtime channel

```mermaid
flowchart LR
    B["Browser socket.io-client<br/>path /api/realtime"] --> H["server.mjs io.use()"]
    H --> J["jwtVerify(servio_session)"]
    J --> Q{"DATABASE_URL set and sessionId in JWT?"}
    Q -->|"yes"| SQL["SELECT sessions JOIN User<br/>revoked / expired / inactive -> reject"]
    Q -->|"no"| SKIP["check skipped (fail-open)"]
    SQL --> ROOMS
    SKIP --> ROOMS
    ROOMS{"JWT role claim == ADMIN?"}
    ROOMS -->|"yes"| RA["join user:ID, admins, admin:room"]
    ROOMS -->|"no"| RU["join user:ID"]
```

---

## Explanation

- **Separate pages, shared mechanism.** `/login` and `/admin/login` post to different endpoints, but both end in `createSession()` and the same `servio_session` cookie, JWT format, secret, TTL and `sessions` table. Logout for both uses `POST /api/auth/logout`.
- **The admin endpoint is exclusive; the user endpoint is not.** `POST /api/admin/login` only finds `role: ADMIN` users, so clients/professionals cannot use it. `POST /api/auth/login` and Google OAuth apply no role filter, so admin accounts can authenticate there too (phone-based login and phone reset exclude ADMIN).
- **Separation is enforced only by role checks at request time.** `proxy.ts` blocks non-admins from `/admin/*` pages, and every `/api/admin/*` handler checks `role === "ADMIN"` using the database role returned by `verifySession`. User pages are role-gated by route-group layouts; a few user routes rely solely on API-level checks.
- **No elevated controls for admins:** no MFA, no shorter session, no re-authentication, no audit trail for most admin actions, and no admin sub-roles.
- **Realtime** uses the JWT `role` claim (not the DB role) to join admin rooms.

## Key assumptions and limitations

- Based on static reading of `proxy.ts`, `src/lib/auth.ts`, `app/api/auth/[action]/route.ts`, `app/api/admin/login/route.ts`, layouts under `app/(portal)`, `app/admin/*`, all `app/api/**/route.ts(x)` handlers, and `server.mjs`; not validated against a running deployment.
- "Listed user prefixes" is the `isAuthenticatedPage` list in `proxy.ts:16-37`; `/job/[jobId]` and `/verification` are protected by layouts rather than that list.
- `/admin/*` API paths start with `/api/admin`, so the proxy's `/admin` page rule does not apply to them; protection there is entirely in the handlers.
- Whether production data actually contains admin accounts reachable via Google (matching Gmail/Workspace e-mail) or via seed credentials is `[NEEDS VALIDATION — not testable locally]`. Locally, the demo client/professional/admin credentials embedded in the login bundles sign in against a seeded database `[PARTIALLY VALIDATED 2026-09-17 · V-29]` ([log](../../validation/LOCAL_VALIDATION_LOG.md)).
- Runtime checks: `/api/admin/database-status` unauthenticated → 401 in production, 200 in development `[VALIDATED 2026-09-17 · V-30]`; with `DATABASE_URL` only in `.env`, the socket branch "DATABASE_URL set" is false and revoked tokens connect `[FOUND IN VALIDATION 2026-09-17 · V-10]`.
