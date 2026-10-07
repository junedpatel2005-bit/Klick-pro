# Authentication Flow

Last verified against code: 2026-09-16 (commit cd8f4fb); runtime-validated 2026-09-17

Related: [../authentication-and-authorization.md](../authentication-and-authorization.md), [user-vs-admin-flow.md](user-vs-admin-flow.md), [../../08-operations/security.md](../../08-operations/security.md).

All browser calls go to `/api/v1/*`, which `next.config.ts` rewrites to `/api/*`. Every mutating `/api/*` request first passes the `proxy.ts` Origin check.

---

## 1. Email + password login and authenticated request

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser (src/routes/login.tsx)
    participant PX as proxy.ts
    participant A as POST /api/auth/login<br/>(app/api/auth/[action]/route.ts)
    participant RL as rate-limit.ts<br/>(in-memory Map)
    participant DB as PostgreSQL<br/>(User, sessions)

    U->>PX: POST /api/v1/auth/login {email, password}<br/>Origin: https://app
    PX->>PX: Origin == nextUrl.origin or APP_URL? else 403
    PX->>A: forward (rewrite /api/v1 -> /api)
    A->>RL: rateLimit(login:XFF:email, 5, 60s)
    alt limit exceeded
        A-->>U: 429
    end
    A->>DB: user.findUnique({ email: lower-cased })
    A->>A: bcrypt.compare(password, passwordHash), isActive
    alt bad credentials / inactive
        A-->>U: 401 "Invalid email or password."
    else emailVerifiedAt is null
        A-->>U: 403 EMAIL_NOT_VERIFIED (redirect /verify), no cookie
    else ok (any role, including ADMIN)
        A->>DB: update lastLoginAt (+ welcome notification on first login)
        A->>RL: clearRateLimit(key)
        A->>A: createSession(): sessionId = randomUUID()<br/>JWT HS256 {userId, role, sessionId}, exp 7d
        A->>DB: sessions.create {id: sessionId, userId, expiresAt: +7d}
        A-->>U: 200 {redirect, token, user}<br/>Set-Cookie servio_session (httpOnly, Lax, path /, 7d, secure in prod)
    end

    Note over U,DB: Subsequent request
    U->>PX: GET /dashboard (cookie)
    PX->>DB: verifySession: jwtVerify + sessions row (not revoked, not expired)<br/>+ user.isActive, user.id match
    PX->>PX: /admin/* needs ADMIN, listed prefixes need session,<br/>non-admin without emailVerifiedAt -> /verify
    PX->>U: page (layouts re-run verifySession and role checks)
    U->>A: fetch /api/v1/... (cookie)
    A->>DB: handler helper -> verifySession -> role/ownership check
```

## 2. Registration with phone proof and e-mail verification

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser (src/routes/signup.tsx)
    participant A as /api/auth/[action]
    participant OTP as phone-otp-provider.ts
    participant TW as Twilio Verify<br/>(only if PHONE_OTP_PROVIDER=twilio)
    participant BG as background-jobs
    participant M as SMTP (nodemailer)
    participant DB as PostgreSQL

    opt phone supplied
        U->>A: POST send-phone-otp {phone, role}
        A->>DB: phone already used? -> 409
        A->>OTP: requestPhoneOtp(phone, role)
        alt provider = twilio
            OTP->>TW: verifications.create(sms)
        else development provider
            OTP->>DB: OtpCode {codeHash = sha256(DEV_PHONE_OTP or default/random)}<br/>no SMS sent
        end
        U->>A: POST verify-phone {phone, code, role}
        A->>OTP: verifyPhoneOtp (5 attempts, 10 min)
        A-->>U: Set-Cookie servio_phone_verification<br/>(HS256 proof, 10 min)
    end
    U->>A: POST register {firstName, lastName, email, phone?, password, role CLIENT|PROFESSIONAL, terms}
    A->>A: zod, then phone proof must match phone+role
    A->>DB: duplicate e-mail/phone? -> 409
    A->>DB: user.create (bcrypt 12)
    A->>DB: ApiToken {sha256(token), EMAIL_VERIFICATION, 24h}
    A->>BG: notify admins (+clients if PROFESSIONAL), send verification e-mail
    BG->>M: link {publicAppOrigin(request)}/verify-email?token=...
    A-->>U: 201 {redirect: /verify} (no session)
    U->>A: POST verify-email {token}
    A->>DB: token unused & unexpired -> mark used, set emailVerifiedAt
    A->>DB: createSession -> sessions row
    A-->>U: 200 {redirect: profile setup} + Set-Cookie servio_session
```

## 3. Phone login (OTP) and phone password reset

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser
    participant A as /api/auth/[action]
    participant OTP as phone-otp-provider.ts
    participant DB as PostgreSQL

    U->>A: POST send-phone-login-otp {phone}
    A->>DB: active CLIENT/PROFESSIONAL with phone? else 404
    A->>OTP: requestPhoneOtp(phone, user.role)
    U->>A: POST login-phone {phone, code}
    A->>OTP: verifyPhoneOtp
    alt emailVerifiedAt null
        A-->>U: 403 EMAIL_NOT_VERIFIED
    else ok
        A->>DB: createSession
        A-->>U: 200 + Set-Cookie servio_session
    end

    Note over U,DB: Variant login-phone-password: bcrypt check, then Set-Cookie is sent<br/>even when the response is 403 for an unverified e-mail

    U->>A: POST forgot-password-phone {phone} (3/10 min)
    A->>OTP: requestPhoneOtp (if active CLIENT/PROFESSIONAL)
    U->>A: POST verify-forgot-password-phone {phone, code} (5/10 min)
    A->>DB: ApiToken PASSWORD_RESET (30 min)
    A-->>U: 200 {token: raw}
    U->>A: POST reset-password {token, password}
    A->>DB: mark token used, update passwordHash, revoke ALL sessions
```

## 4. Google OAuth

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser
    participant A as GET /api/auth/google
    participant G as Google (accounts / oauth2 / openidconnect)
    participant DB as PostgreSQL

    U->>A: GET /api/v1/auth/google?role=&next=
    A->>A: GOOGLE_CLIENT_ID & SECRET set? else /login?oauthError=google-not-configured
    A-->>U: 302 accounts.google.com (scope openid email profile, state)<br/>Set-Cookie servio_google_oauth {state, role, nextPath} 10 min
    U->>G: consent
    G-->>U: 302 /api/v1/auth/google?code&state
    U->>A: callback
    A->>A: state == cookie.state
    A->>G: POST oauth2.googleapis.com/token (code, client secret)
    A->>G: GET userinfo (Bearer access_token)
    A->>A: require sub, email, email_verified === true
    A->>DB: findFirst {googleId = sub OR email}
    alt not found
        A->>DB: create user {role from cookie (CLIENT default), GOOGLE, emailVerifiedAt now}
    else found without googleId (any role, incl. ADMIN)
        A->>DB: link googleId, authProvider GOOGLE, emailVerifiedAt now
    end
    A->>DB: createSession (isActive not checked here)
    A-->>U: 302 next (starts "/" not "//") or role home<br/>Set-Cookie servio_session, clear oauth cookie
```

## 5. Logout and revocation

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser (ClientAccountMenu / AdminHeader)
    participant A as POST /api/auth/logout
    participant DB as PostgreSQL
    participant IO as Socket.IO (server.mjs)

    U->>A: POST /api/v1/auth/logout (cookie)
    A->>A: jwtVerify(token)
    alt JWT invalid
        A-->>U: 500, cookie NOT cleared
    else valid
        A->>DB: sessions.updateMany {id, revokedAt null} -> revokedAt now
        A-->>U: 200 + Set-Cookie servio_session maxAge 0
    end
    Note over IO: Already-open sockets are not disconnected,<br/>new handshakes are rejected (revoked_at set)
```

---

## Explanation

- There is exactly one session mechanism for every login method and every role: a 7-day HS256 JWT carried in the `servio_session` cookie and bound to a `sessions` row. `verifySession` (`src/lib/auth.ts:23-45`) re-reads the row and the user on each check, so revocation, deactivation and role changes are effective immediately for HTTP traffic.
- Login methods differ only in how the user is identified (password, OTP, Google profile, verification link); all converge on `createSession` (`src/lib/auth.ts:12-22`).
- E-mail verification is enforced at login (e-mail and phone-OTP paths), in `proxy.ts` for pages, and in the portal layout — not in API handlers.
- Password reset (both variants) is the only user-initiated way to revoke all sessions.

## Key assumptions and limitations

- Diagrams show the code paths at commit `cd8f4fb`; deployed configuration (`PHONE_OTP_PROVIDER`, `DEV_PHONE_OTP`, Google credentials, SMTP) determines which branches are live `[NEEDS VALIDATION — not testable locally]`.
- Local runtime checks ([log](../../validation/LOCAL_VALIDATION_LOG.md)): register sets no session; unverified e-mail login and phone OTP login → 403 without cookie; `login-phone-password` → 403 **with** a working session cookie `[VALIDATED 2026-09-17 · V-22, V-23]`. Development OTP: code printed to the server log, and verification always fails when the DB session TimeZone is not UTC (raw `"expiresAt" > NOW()`) `[FOUND IN VALIDATION 2026-09-17 · V-27]`. Mixed-case registered e-mails can never log in by e-mail/password `[VALIDATED 2026-09-17 · V-21]`. Reset links follow `X-Forwarded-Host` `[VALIDATED 2026-09-17 · V-25]`.
- Background e-mail dispatch is via `enqueueBackgroundJob`; its delivery guarantees (in-process vs durable) are documented elsewhere and are not modelled here.
- The admin login flow is intentionally omitted here and shown in [user-vs-admin-flow.md](user-vs-admin-flow.md).
- Rate limits shown are per-process in-memory counters keyed on `X-Forwarded-For`; they are not reliable across instances, and rotating the header bypasses them entirely `[VALIDATED 2026-09-17 · V-26]`.
- Twilio Verify internal behaviour (expiry, attempt limits) is external and not verified.
