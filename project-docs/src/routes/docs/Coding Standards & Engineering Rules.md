# Coding Standards & Engineering Rules

**Project:** Service Marketplace Platform  
**Applies to:** Next.js Web, React, API, PostgreSQL, Prisma, Flutter, shared packages, background jobs and integrations  
**Status:** Mandatory  
**Version:** 1.0

---

## 1. Core Engineering Principles

All code must follow these principles:

1. **No code duplication**
2. **No inline/static CSS**
3. **No business logic inside UI components**
4. **No direct database access from UI**
5. **No direct external-service calls from UI**
6. **Strong typing everywhere**
7. **Reusable components and services**
8. **Single source of truth**
9. **Server-side authorization is mandatory**
10. **All important operations must be observable**
11. **All production errors must be traceable**
12. **Every feature must be testable**
13. **Accessibility and responsive behavior are mandatory**
14. **Security must be enforced by architecture, not convention alone**
15. **Do not introduce a new library when an existing project capability already solves the problem**

---

# 2. Technology Rules

## Web

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI where required
- TanStack Query
- Zod
- REST API
- OpenAPI contract

## Backend

- Next.js server/API layer
- TypeScript
- Prisma
- PostgreSQL
- PostGIS
- Zod validation
- Structured logging
- Sentry/error monitoring

## Mobile

- Flutter
- Dart
- Riverpod
- go_router
- REST API
- Repository pattern
- MVVM architecture

Flutter's current architecture guidance strongly recommends separation between UI and data layers, repository-based data access, ViewModels/Views, dependency injection and testing.

---

# 3. TypeScript Rules

TypeScript must use strict mode.

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true
}
```

Mandatory:

- Never use `any`.
- Never use `@ts-ignore` without documented justification.
- Avoid `@ts-expect-error`; if required, explain why.
- Avoid non-null assertions (`!`) unless unavoidable and documented.
- Never use implicit `any`.
- Prefer explicit domain types.
- Prefer discriminated unions for state machines.
- Use `unknown` instead of `any` for unknown external data.
- Validate external data before using it.
- Never trust TypeScript types for API input validation.

Example:

```ts
const result: unknown = await externalApi();

const parsed = ExternalResponseSchema.parse(result);
```

---

# 4. No Code Duplication

DRY is mandatory.

Before creating code, developers must check:

1. Existing component
2. Existing utility
3. Existing service
4. Existing hook
5. Existing validation schema
6. Existing API client
7. Existing domain function
8. Existing design-system component

Do not create:

```text
UserCard.tsx
ProfessionalCard.tsx
AdminUserCard.tsx
```

if they can be represented by a reusable:

```text
ProfileCard.tsx
```

with controlled variants.

Avoid copy/paste implementations.

If the same logic appears twice, consider extracting it.

If the same logic appears three times, extraction is mandatory.

---

# 5. React Component Rules

Components must follow:

```text
UI
 ↓
Hook / ViewModel
 ↓
Service
 ↓
API
 ↓
Database
```

Components must not:

- Query Prisma
- Call Stripe
- Call Google Maps directly
- Call Twilio directly
- Contain business rules
- Perform authorization
- Contain complex calculations
- Contain large data transformation logic
- Contain duplicated validation

A component should primarily:

- Render UI
- Receive props
- Trigger actions
- Display loading/error/empty states
- Handle simple presentation logic

---

# 6. Component Size

Avoid giant components.

Recommended:

- Normal component: ≤150 lines
- Complex component: ≤250 lines
- > 250 lines requires review
- > 400 lines should normally be split

Do not split components artificially just to satisfy line counts.

Split based on responsibility.

---

# 7. React Server vs Client Components

Use Server Components by default.

Use `"use client"` only when required for:

- State
- Event handlers
- Browser APIs
- Interactive UI
- Client-side subscriptions
- Client-side libraries

Do not add `"use client"` to entire page trees unnecessarily.

Keep client boundaries as small as practical.

---

# 8. CSS / Styling Rules

## Absolute rule

**No inline CSS.**

Forbidden:

```tsx
<div style={{ marginTop: 20 }} />
```

Forbidden:

```tsx
<div style={{ color: "red" }} />
```

Also avoid:

```tsx
<div className="text-[17px] mt-[13px]" />
```

when a design-system token or standard Tailwind utility exists.

## Allowed

Tailwind classes:

```tsx
<div className="mt-4 text-sm text-muted-foreground" />
```

Reusable component classes:

```tsx
<Button variant="primary" />
```

CSS files:

```text
globals.css
components.css
```

only for genuinely global or reusable CSS behavior.

## Do not create

```text
tailwind.config.js
```

The existing project standard already explicitly requires Tailwind v4 and CSS-first configuration.

---

# 9. Design System

All UI must use a centralized design system.

Create reusable tokens for:

- Colors
- Typography
- Spacing
- Border radius
- Shadows
- Breakpoints
- Z-index
- Animation durations
- Form states
- Status colors

Do not invent random values per screen.

Instead of:

```text
mt-[13px]
rounded-[11px]
text-[#343434]
```

prefer project tokens.

---

# 10. Responsive Web Standard

The application must work on:

- Mobile
- Small tablet
- Large tablet
- Laptop
- Desktop
- Large desktop

Minimum target:

```text
320px → 1920px+
```

No page may depend on a specific screen size.

Avoid:

```css
width: 1200px;
```

Prefer responsive constraints:

```text
w-full
max-w-7xl
mx-auto
grid
flex
```

Every page must be tested at:

```text
320px
375px
768px
1024px
1280px
1440px
1920px
```

Responsive behavior must be implemented through the design system/Tailwind breakpoints rather than duplicated desktop/mobile components wherever possible.

---

# 11. Accessibility

Every interactive UI must support:

- Keyboard navigation
- Focus states
- Screen readers
- Semantic HTML
- Proper labels
- Accessible error messages
- Sufficient color contrast
- Appropriate ARIA attributes

Never use:

```tsx
<div onClick={...}>
```

when a semantic `<button>` is appropriate.

Images require meaningful `alt` text unless decorative.

Forms must associate labels with inputs.

---

# 12. Forms

All forms must have:

- Zod schema
- Client validation
- Server validation
- Loading state
- Error state
- Success state
- Disabled submission during processing
- Accessible error messages

The same validation schema should be reused where appropriate.

Do not duplicate:

```text
client validation
server validation
```

as separate manually maintained rule sets.

---

# 13. API Standards

All APIs must:

```text
/api/v1/...
```

Use REST conventions.

Example:

```text
GET    /api/v1/jobs
GET    /api/v1/jobs/:id
POST   /api/v1/jobs
PATCH  /api/v1/jobs/:id
DELETE /api/v1/jobs/:id
```

Responses must follow a predictable structure.

Errors:

```json
{
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Job was not found",
    "details": {}
  }
}
```

Never expose:

- Stack traces
- Database errors
- SQL
- Internal file paths
- Secrets
- Provider credentials

to clients.

---

# 14. API Contract

`openapi.yaml` is the API source of truth.

Every API change requires:

1. OpenAPI update
2. Type generation
3. Server implementation
4. Tests
5. Client update if applicable

Do not build an API first and document it later.

This follows the existing project's contract-first/mobile-ready rule.

---

# 15. Authentication & Authorization

Authentication and authorization are different concerns.

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
Are you allowed to do this?
```

Every protected API must perform server-side authorization.

Never trust:

- Hidden buttons
- Frontend roles
- Route guards alone
- Client state
- JWT claims alone for sensitive ownership decisions

Ownership must be checked against server-side data.

The existing project correctly requires authorization to be rechecked in handlers.

---

# 16. Database Rules

PostgreSQL is the source of truth for persistent business data.

Rules:

- Every schema change requires a migration.
- Never edit an applied migration.
- Use foreign keys.
- Use database constraints where possible.
- Use unique constraints for business uniqueness.
- Use indexes based on query patterns.
- Avoid unnecessary indexes.
- Use transactions for multi-step business operations.
- Never perform business-critical multi-record changes without transactional guarantees.

Prisma supports transactions for dependent writes, batch operations and read-modify-write workflows.

---

# 17. Prisma Rules

Use one shared Prisma client.

Do not create:

```ts
new PrismaClient();
```

inside every request.

Reuse the application client, especially in serverless environments. Prisma specifically recommends reusing a single Prisma Client instance to avoid exhausting database connections.

Avoid N+1 queries.

Bad:

```text
get jobs
for every job → get professional
```

Prefer appropriate relations/includes or batched queries.

For large datasets use cursor pagination where appropriate.

---

# 18. Raw SQL

Prisma ORM is the default.

Raw SQL is permitted only when:

- PostGIS functionality requires it
- Prisma cannot express the query
- A verified performance requirement exists
- Database-specific functionality is required

All raw queries must be parameterized.

Never concatenate user input into SQL.

Prisma explicitly recommends parameterized raw SQL and avoiding concatenated user input.

For this project, all protected geospatial operations remain inside:

```text
GeoRepository
```

as already defined in the project rules.

---

# 19. Money Rules

Money must always be represented as:

```text
integer cents + currency
```

Example:

```ts
{
  amount: 125000,
  currency: "CAD"
}
```

Never:

```ts
1250.5;
```

Never use floating-point arithmetic for money.

All:

- Quotes
- Commission
- Taxes
- Escrow
- Payouts
- Refunds
- Invoices

must use integer arithmetic.

This is already correctly established in the project source rules.

---

# 20. Financial Operations

Financial operations must be:

- Idempotent
- Auditable
- Transaction-safe
- Reversible where applicable
- Logged
- Associated with a business entity
- Associated with a provider event ID when applicable

Stripe webhook handlers must be idempotent.

Never assume a webhook arrives once.

Never assume webhooks arrive in order.

---

# 21. State Machines

Business states must be explicit.

Example:

```text
PUBLISHED
    ↓
QUOTED
    ↓
ASSIGNED
    ↓
IN_PROGRESS
    ↓
COMPLETED
    ↓
CLOSED
```

Illegal transitions must be rejected.

Do not allow arbitrary status changes:

```ts
status = input.status;
```

Instead use domain commands:

```text
assignJob()
startJob()
completeMilestone()
cancelJob()
```

Every transition must have tests.

The current project already requires testing illegal state transitions, which I strongly recommend retaining.

---

# 22. Error Handling & Logging

## Mandatory rule

**No swallowed errors.**

Forbidden:

```ts
try {
  await operation();
} catch {}
```

Also forbidden:

```ts
catch (error) {
  console.log(error);
}
```

unless the error is deliberately handled and documented.

---

# 23. Error Monitoring

Recommended initial solution:

### Sentry

Use Sentry for:

- Web errors
- API errors
- Flutter crashes
- Unhandled exceptions
- Performance monitoring where useful
- Release tracking

Sentry is preferable to relying on application log files for production error monitoring.

A serverless/Vercel application should **not depend on local log files** as its production logging mechanism because local filesystem persistence cannot be assumed.

Sentry currently provides runtime/error observability capabilities, while its newer tooling also incorporates errors, spans, logs and metrics.

---

# 24. Structured Application Logging

Use structured logs.

Example:

```json
{
  "level": "error",
  "event": "payment.capture.failed",
  "requestId": "req_123",
  "userId": "usr_123",
  "jobId": "job_123",
  "errorCode": "PAYMENT_CAPTURE_FAILED"
}
```

Do not log:

- Passwords
- OTPs
- JWTs
- Refresh tokens
- Stripe secrets
- API keys
- Full payment details
- Verification documents
- Exact professional coordinates
- Sensitive personal information

---

# 25. Request Correlation

Every API request should have a:

```text
requestId
```

Pass it through:

```text
Client
 ↓
API
 ↓
Service
 ↓
Repository
 ↓
External provider
```

When an error occurs, the developer should be able to search:

```text
requestId
```

and reconstruct what happened.

---

# 26. Error Classification

Use standard categories:

```text
VALIDATION_ERROR
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
NOT_FOUND
CONFLICT
RATE_LIMITED
EXTERNAL_SERVICE_ERROR
DATABASE_ERROR
PAYMENT_ERROR
INTERNAL_ERROR
```

Never return generic:

```text
Something went wrong
```

without also recording the internal diagnostic information.

---

# 27. Background Jobs

Anything that can take several seconds or does not need to block the user should be asynchronous.

Examples:

- Email
- SMS
- Push notifications
- Geocoding
- Bulk geolocation processing
- Reconciliation
- Reports
- Document processing
- Webhook retries

The existing project already specifies that external operations should not block user-facing requests beyond approximately 5 seconds.

---

# 28. External Services

Never call external services directly from React components.

Use:

```text
Component
 ↓
Hook
 ↓
Service
 ↓
Provider adapter
 ↓
External API
```

Example:

```text
PaymentService
 ↓
StripePaymentProvider
```

rather than scattering Stripe SDK calls throughout the application.

This allows providers to be replaced without rewriting business logic.

---

# 29. Provider Abstraction

Create interfaces for major external dependencies.

Examples:

```text
PaymentProvider
NotificationProvider
EmailProvider
SmsProvider
MapsProvider
StorageProvider
```

Implementation:

```text
StripePaymentProvider
TwilioSmsProvider
GoogleMapsProvider
SupabaseStorageProvider
```

Business logic should depend on the interface, not the provider SDK.

---

# 30. Flutter Architecture

Flutter must follow:

```text
Presentation
    ↓
ViewModel
    ↓
Repository
    ↓
API Service
    ↓
REST API
```

Recommended structure:

```text
lib/
  core/
    config/
    errors/
    network/
    routing/
    theme/
    utils/

  features/
    auth/
      data/
      presentation/

    jobs/
      data/
      presentation/

    quotes/
      data/
      presentation/

  shared/
    widgets/
    models/
```

Avoid putting business logic inside widgets.

Flutter's official architecture guidance explicitly recommends keeping widgets focused on UI and placing logic in ViewModels/data-layer components.

---

# 31. Flutter UI Rules

No:

```dart
Container(
  color: Colors.red,
)
```

for arbitrary screen-specific styling.

Prefer centralized theme/design tokens.

Use:

```text
ThemeData
ColorScheme
TextTheme
AppSpacing
AppRadius
AppColors
```

Create reusable widgets:

```text
AppButton
AppTextField
AppCard
AppDialog
AppLoader
AppErrorView
AppEmptyView
```

Do not create slightly different versions of the same widget.

---

# 32. Flutter Responsive Design

The Flutter application must support:

- Phone portrait
- Phone landscape
- Small tablets
- Large tablets

Do not assume:

```dart
MediaQuery.of(context).size.width == phone width
```

Use responsive layout utilities and constraints.

Do not duplicate entire screens for:

```text
mobile
tablet
```

unless the interaction model genuinely differs.

---

# 33. Flutter State Management

Use Riverpod consistently.

Do not mix:

```text
setState
Provider
Riverpod
Bloc
GetX
```

randomly.

`setState` is acceptable for purely local UI state.

Application/business state belongs in Riverpod/ViewModels.

---

# 34. API Models in Flutter

Do not manually duplicate API models everywhere.

Generate or centrally maintain API models from the OpenAPI contract where practical.

The backend contract remains:

```text
OpenAPI
```

Flutter consumes the same contract as the web application.

This prevents:

```text
Web API model ≠ Flutter API model
```

---

# 35. Shared Business Logic

Where business logic is platform-independent:

```text
Backend/domain
```

must remain the source of truth.

Do not implement important business rules independently in:

```text
Web
Flutter
Backend
```

Example:

Commission calculation must NOT be independently implemented in React and Flutter.

The backend determines the authoritative value.

Frontend calculates only for presentation where appropriate.

---

# 36. Loading / Error / Empty States

Every asynchronous screen must handle:

```text
Loading
Success
Empty
Error
Retry
Unauthorized
Forbidden
Offline
```

Do not show blank screens.

Do not show infinite spinners.

---

# 37. API Retry Rules

Do not blindly retry all requests.

Safe candidates:

```text
GET
idempotent operations
temporary network failures
```

Be careful with:

```text
POST payment
POST appointment
POST quote acceptance
```

Use idempotency keys for operations where duplicate execution could cause financial or business damage.

---

# 38. Security

Mandatory:

- Environment variables for secrets
- No secrets in Git
- No secrets in frontend bundles
- No credentials in logs
- Server-side authorization
- Input validation
- Output serialization
- Rate limiting
- CSRF protection where applicable
- Secure headers
- Content Security Policy where practical
- File upload validation
- File type restrictions
- File size limits
- Signed URLs for private files

Never trust uploaded file names or MIME types alone.

---

# 39. Location Privacy

Professional location data is highly sensitive.

Rules from the existing architecture remain mandatory:

- Never expose exact coordinates publicly.
- Never expose professional home address.
- Never put a marker at the real base location.
- Public location uses `displayPoint`.
- Protected geospatial columns remain inside `GeoRepository`.
- Obfuscation salt must never change after production data exists.

---

# 40. File Uploads

Never save uploaded files to the application filesystem.

Use:

```text
Supabase Storage
```

Private buckets must use signed URLs.

Verification documents:

```text
Admin only
+
short-lived signed URL
+
audit log
```

This follows the existing project security rules.

---

# 41. Testing Standards

Every feature should have appropriate tests.

## Backend

- Unit tests
- Service tests
- Repository tests
- API tests
- Authorization tests
- State transition tests

## Web

- Component tests
- Hook tests
- Integration tests
- Accessibility tests
- Critical user-flow E2E tests

## Flutter

- Unit tests
- ViewModel tests
- Repository tests
- Widget tests
- Integration tests

Flutter's current guidance specifically recommends unit testing services/repositories/ViewModels and widget testing views.

---

# 42. Minimum API Test Requirement

Every protected endpoint must have at least:

```text
1 authorized success
1 unauthorized failure
1 validation failure
```

Sensitive endpoints should additionally test:

```text
wrong owner
wrong role
expired authentication
missing resource
conflict
```

---

# 43. Privacy Testing

For every API returning user-related data, test that forbidden fields are absent.

Example:

```text
Client response
❌ password
❌ phone of unrelated user
❌ email of unrelated user
❌ exact coordinates
❌ verification document URL
```

Privacy tests are mandatory.

---

# 44. Performance Standards

Avoid:

- N+1 queries
- Unbounded queries
- Large API responses
- Large client bundles
- Unnecessary re-renders
- Duplicate API calls
- Blocking external API calls
- Repeated expensive calculations

Every list endpoint must support pagination.

Large lists must never return the entire database.

---

# 45. Database Query Standards

Every new query should be reviewed for:

```text
Indexes
Pagination
N+1
Select fields
Authorization
Data exposure
Query cost
Transaction requirements
```

Do not automatically fetch:

```text
SELECT *
```

equivalent data when only a few fields are required.

---

# 46. Caching

Cache only when there is a clear reason.

Good candidates:

- Categories
- Public configuration
- Static reference data
- Frequently accessed public data

Do not cache sensitive user-specific information without a defined invalidation strategy.

Never cache financial state blindly.

---

# 47. Git Standards

Branches:

```text
feature/...
fix/...
refactor/...
chore/...
hotfix/...
```

Commits should be small and meaningful.

Example:

```text
feat(jobs): add radius-based job discovery
fix(payments): make Stripe webhook idempotent
test(quotes): cover concurrent acceptance
```

Do not commit:

- `.env`
- secrets
- build artifacts
- logs containing sensitive data
- generated temporary files

---

# 48. Pull Request Rules

Every PR must answer:

```text
What changed?
Why?
What files/modules changed?
How was it tested?
Any database migration?
Any API contract change?
Any security/privacy impact?
Any performance impact?
```

No PR should be merged if:

- TypeScript fails
- Tests fail
- Lint fails
- Build fails
- Security-sensitive tests fail
- API contract is inconsistent

---

# 49. CI/CD Quality Gates

Every PR should run:

```text
lint
typecheck
unit tests
integration tests where applicable
build
API contract validation
```

For sensitive modules additionally run:

```text
security tests
privacy tests
authorization tests
```

---

# 50. Environment Management

Maintain:

```text
.env.local
.env.test
.env.production
```

Secrets must come from environment/secret management.

Never hardcode:

```text
API keys
JWT secrets
Stripe secrets
Google API keys
Twilio credentials
database credentials
Sentry DSN where it is intended to remain private
```

Public frontend configuration must be explicitly identified as public.

---

# 51. Documentation Rules

Every major module must document:

```text
Purpose
Responsibilities
Dependencies
API endpoints
Database entities
Important business rules
Error behavior
Security considerations
Testing approach
```

Complex business rules require comments.

Do not comment obvious code.

Bad:

```ts
// Increment count by one
count++;
```

Good:

```ts
// Commission is frozen at appointment time so later admin rate changes
// cannot alter historical financial calculations.
```

---

# 52. No Magic Numbers

Avoid:

```ts
if (days > 14)
```

Prefer:

```ts
const REVIEW_WINDOW_DAYS = 14;
```

For business configuration, prefer database/configuration values where appropriate.

---

# 53. No Magic Strings

Avoid:

```ts
if (status === "ASSIGNED")
```

throughout the application.

Centralize enums/constants where appropriate.

---

# 54. Dates and Time

Never manually manipulate dates using string operations.

Use a consistent date/time strategy.

Rules:

- Store timestamps in UTC.
- Convert to user timezone at presentation.
- Never assume server timezone.
- Province/timezone-specific behavior must be explicit.
- Financial timestamps must be immutable/auditable.

---

# 55. Notifications

Notification creation must be decoupled from business logic.

Instead of:

```text
appoint professional
→ send SMS
→ send email
→ send push
```

prefer:

```text
appoint professional
→ create notification event
→ background processing
→ email/SMS/push
```

Failures in notification delivery must not roll back successful business transactions unless explicitly required.

---

# 56. Audit Logging

Audit important actions:

```text
Login
Logout/security events
Role changes
Verification approval/rejection
Profile changes
Job status changes
Quote acceptance
Appointment
Payment
Refund
Escrow release
Payout
Dispute
Admin actions
Document access
```

Audit records should contain:

```text
actor
action
entity
entityId
timestamp
requestId
metadata
```

Do not store secrets in audit metadata.

---

# 57. Observability

The production system should provide:

```text
Error monitoring
Structured logs
Request IDs
Performance metrics
Database monitoring
External API failure tracking
Payment event tracking
Background-job monitoring
```

Recommended starting stack:

```text
Sentry
+
structured application logs
+
Vercel logs
+
PostgreSQL/Supabase monitoring
```

This is preferable to trying to maintain application-level `.log` files on Vercel.

---

# 58. Feature Development Rule

Every feature should follow:

```text
Requirement
 ↓
Domain rules
 ↓
Database/API contract
 ↓
Backend service
 ↓
Tests
 ↓
Web UI
 ↓
Responsive testing
 ↓
Flutter API readiness
 ↓
Observability
 ↓
Documentation
```

A feature is **not complete** merely because the UI works.

---

# 59. Definition of Done

A feature is complete only when:

- [ ] Business rules implemented
- [ ] API implemented
- [ ] OpenAPI updated
- [ ] Validation implemented
- [ ] Authorization implemented
- [ ] Database migration completed
- [ ] Tests added
- [ ] Error handling implemented
- [ ] Logging/monitoring implemented
- [ ] Responsive web UI completed
- [ ] Accessibility checked
- [ ] Loading state implemented
- [ ] Empty state implemented
- [ ] Error state implemented
- [ ] Security/privacy checked
- [ ] No duplicated code
- [ ] No inline CSS
- [ ] TypeScript/lint passes
- [ ] Build passes
- [ ] Documentation updated
- [ ] Flutter API compatibility confirmed

---

# 60. Golden Rule

Before writing new code, ask:

> **"Does this functionality already exist somewhere in the system?"**

If yes, reuse it.

Before adding a dependency:

> **"Can the existing stack solve this?"**

If yes, do not add another dependency.

Before adding CSS:

> **"Can the design system solve this?"**

If yes, use the existing token/component.

Before adding business logic to UI:

> **"Does this belong to the backend/domain/service layer?"**

If yes, move it there.

Before catching an error:

> **"Will this error be observable and diagnosable?"**

If no, add structured logging/error monitoring.

Before exposing data:

> **"Should this role actually receive this field?"**

If uncertain, do not expose it until authorization/privacy is established.

---

# 61. Non-Negotiable Rules

The following are automatic code-review failures:

1. Inline CSS
2. `any`
3. Swallowed exceptions
4. Hardcoded secrets
5. Business logic inside UI
6. Direct Prisma access from components
7. Direct Stripe/Twilio/Google API calls from components
8. Duplicate business logic
9. Missing authorization
10. Missing API validation
11. Missing error monitoring
12. Unbounded database queries
13. N+1 database queries
14. Unparameterized raw SQL
15. Floating-point money calculations
16. Exact professional location exposure
17. Client-side-only security
18. Missing tests for critical business rules
19. Arbitrary status mutation
20. Production dependency on local filesystem
21. Undocumented database changes
22. API implementation without OpenAPI update
23. Creating a new component when an existing reusable component can handle the requirement
24. Creating a new library without architectural justification
25. Logging sensitive user/payment/security information

---

# 62. Architecture Principle

The final architecture should consistently follow:

```text
                 ┌──────────────────┐
                 │      Web UI      │
                 │ Next.js / React  │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │   API Contract   │
                 │     OpenAPI      │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │ Application/API  │
                 │     Services     │
                 └────────┬─────────┘
                          │
                 ┌────────▼─────────┐
                 │   Domain/Core    │
                 │ Business Rules   │
                 └────────┬─────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
       ┌──────▼──────┐         ┌──────▼──────┐
       │ Repository  │         │  Providers  │
       │ Prisma/PG   │         │ Stripe/etc. │
       └──────┬──────┘         └─────────────┘
              │
       ┌──────▼──────┐
       │ PostgreSQL  │
       │  + PostGIS  │
       └─────────────┘


Flutter:

Flutter UI
    ↓
ViewModel
    ↓
Repository
    ↓
API Client
    ↓
OpenAPI REST API
```

The important architectural decision is that **Web and Flutter are clients of the same backend contract**, rather than each becoming a separate implementation of business rules.
