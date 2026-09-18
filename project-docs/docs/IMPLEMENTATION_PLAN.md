# Servio implementation plan

This plan is based on the current repository and the reviewed planning documents. Do not start feature development until Step 1 is approved, because the documents disagree on product phases, architecture, payments, and platforms.

## 1. Decide the Phase 1 product baseline

```text
Create a Phase 1 product decision record for Servio:
- Responsive Next.js web only in Phase 1
- Flutter iOS/Android deferred to Phase 2
- Payments, wallet, and messaging deferred to Phase 2
- Confirm launch country, currency, cities, service categories, commission model, and privacy/contact-release policy
- Resolve proposal, dispute, review, and notification decisions
Write the decisions in docs/product-baseline.md.
```

## 2. Document the current architecture

```text
Inspect the current repository and create docs/current-architecture.md.
Document the real npm/Next.js 16/app/src/prisma structure, existing routes, APIs, Prisma schema, authentication, environment variables, and missing foundations.
Do not describe planned monorepo files as if they exist.
```

## 3. Organize the documentation

```text
Move approved planning documents from src/routes/docs into the root docs folder.
Keep one source of truth for product scope, architecture, engineering rules, and delivery plan.
Exclude duplicate ZIP archives from the source-of-truth documentation.
Do not delete files without confirmation.
```

## 4. Establish engineering foundations

```text
Add a test framework, typecheck script, CI workflow, formatting checks, and pull-request checklist to the current npm Next.js project.
Verify npm run lint, typecheck, test, and build run successfully in CI.
```

## 5. Create the API and service foundation

```text
Create a framework-independent service layer and versioned /api/v1 route structure.
Add a standard API error envelope, Zod validation, authorization wrapper, public/private DTOs, OpenAPI contract, and API test template.
Keep existing endpoints working during migration.
```

## 6. Upgrade authentication

```text
Migrate authentication from a 7-day HS256 cookie session to short-lived access tokens plus rotating refresh tokens.
Use secure password hashing, hashed refresh tokens, replay detection, rate limiting, password-reset session revocation, server-side role checks, and tests.
Document the migration and preserve existing users safely.
```

## 7. Build profiles, media, and verification

```text
Build client and professional profile services, secure media uploads, verification-document workflow, derived badges, role-separated admin review, and audit logging.
Verification documents must never be exposed to clients.
```

## 8. Build location-safe jobs and discovery

```text
Implement job posting, categories, filtering, pagination, location privacy, and map-ready discovery.
Use the approved geospatial design only after launch geography and privacy rules are confirmed.
Public responses must not expose exact addresses, phone numbers, emails, or true map coordinates.
```

## 9. Build quotes, hiring, and work tracking

```text
Implement quote submission, revision, atomic quote acceptance, appointment, milestones, work proof, revisions, timelines, and reviews.
Add state-machine and authorization tests for every transition.
```

## 10. Build admin operations

```text
Implement role-protected admin workflows for verification, user management, categories, disputes, and audit logs.
Add MFA before production admin access.
```

## 11. Add notifications and communications

```text
Implement only the Phase 1 notification events approved in docs/product-baseline.md.
Use an asynchronous, idempotent job system with retry, dead-letter handling, monitoring, and user preferences.
Keep chat in Phase 2 unless the product baseline explicitly moves it forward.
```

## 12. Build payments after legal approval

```text
After written legal and Stripe-flow approval, create a separate Phase 2 payments specification.
Implement Stripe Connect, payment state machines, tax calculation, invoices, refunds, webhooks, reconciliation, and financial audit logs with full test coverage.
```

## 13. Harden and launch

```text
Perform accessibility, privacy, security, responsive, performance, backup/recovery, monitoring, UAT, and production-readiness checks.
Add required About, Contact, Privacy Policy, and Terms pages before launch.
```
