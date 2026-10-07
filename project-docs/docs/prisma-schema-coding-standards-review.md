# Prisma Schema Coding Standards Review

**File reviewed:** `prisma/schema.prisma`  
**Review date:** 28 August 2026  
**Project:** Servio Service Marketplace Platform

## Summary

The Prisma schema is syntactically valid and passes Prisma validation. However, it does not yet fully comply with the project coding standards. The highest-priority concerns are missing foreign-key relations, exposure of exact professional locations, unrestricted string-based business states, and insecure handling of verification-document URLs.

## Verification

| Check                       | Result                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| `npx prisma validate`       | Passed                                                                  |
| `npx prisma format --check` | Failed: unformatted files detected                                      |
| `npx prisma migrate status` | Could not complete because the database schema engine returned an error |

## Findings

### 1. High — Missing foreign-key relations

Several business-critical identifiers are scalar fields without Prisma relations or database constraints:

- `ProjectRequest.jobId`, `clientId`, and `professionalId` — lines 335–337
- `ProjectTracking.requestId`, `jobId`, `clientId`, and `professionalId` — lines 355–358
- `Payment.clientId`, `professionalId`, and `jobId` — lines 623–625
- `ProjectDispute.trackingId`, `clientId`, and `professionalId` — lines 731–735
- `Service.categoryId` — line 950

This violates the database standard requiring foreign keys and database-enforced integrity. Add explicit relations where the referenced model exists, and add migrations for the resulting constraints.

### 2. High — Exact professional location is stored directly

`User.professionalLatitude` and `User.professionalLongitude` are stored at lines 150–151.

The project standards require exact professional coordinates to remain protected and public-facing locations to use an obfuscated or display location. Move sensitive location data into a protected location model or repository boundary, and ensure public queries never return the exact coordinates.

### 3. High — Business states use unrestricted strings

Many fields such as `status`, `type`, `senderRole`, `provider`, and `paymentMethod` use `String` rather than enums. Examples include lines 236–237, 281–282, 301, 341–342, 359, 401, 416, 643, 698, and 808.

This permits invalid values and arbitrary state changes. Replace stable state fields with Prisma enums or database check constraints, and enforce legal transitions in domain services rather than accepting arbitrary status updates.

### 4. High — Verification documents use direct URL fields

`ProfessionalVerification` stores `governmentIdUrl`, `licenseUrl`, `insuranceUrl`, and `selfieUrl` at lines 803–807.

The project standards require private storage, signed URLs, short-lived access, and audit logging for verification documents. Use the secure file-storage model and ensure document access is restricted to authorized administrators.

### 5. Medium — Structured data is stored as `String`

Several fields represent JSON but are declared as strings, including:

- `professionalSkillsJson`
- `workPhotosJson`
- `certificationsJson`
- `attachmentsJson`
- `filesJson`
- `payloadJson`

Use Prisma `Json` fields where structured querying or validation is required. Validate all external input with the project’s Zod schemas before persistence.

### 6. Medium — Money fields do not clearly identify integer cents

Fields such as `amount`, `price`, `hourlyRate`, `budgetMin`, and `budgetMax` use generic names at lines 130–131, 220–221, 279–280, 399, 626–632, and 954.

The project standard requires integer money values and an associated currency. Prefer names such as `amountCents`, `priceCents`, `budgetMinCents`, and `budgetMaxCents`. Confirm that existing migrations and application code already store these values in the smallest currency unit before renaming or migrating data.

### 7. Medium — Duplicate or overlapping domain models

The schema contains parallel implementations for:

- Messaging: `SocketMessage` and `Message`
- Jobs and projects: `ClientJob`, `HireJob`, `ProjectRequest`, and `HireContract`
- Financial records: `Payment`, `WalletTransaction`, and `ProjectTransaction`

This conflicts with the DRY and single-source-of-truth standards. Document which model is authoritative for each workflow, then consolidate or clearly isolate legacy models before adding new features.

### 8. Medium — Inconsistent database table naming

Some models map to snake_case table names, while others map to PascalCase names:

- `ProjectTransaction` → `"ProjectTransaction"` — line 291
- `ProjectRequest` → `"ProjectRequest"` — line 350
- `ProjectTracking` → `"ProjectTracking"` — line 371

Use consistent snake_case table names, such as `project_transactions`, `project_requests`, and `project_tracking`, with explicit migrations where required.

### 9. Low — Missing timestamp defaults

Several timestamp fields must be manually supplied:

- `CmsPage.createdAt` and `updatedAt` — lines 25–26
- `CmsPageVersion.createdAt` — line 39
- `CmsMedia.createdAt` — line 52
- `WebsitePage.updatedAt` — line 78
- `LegalPage.updatedAt` — line 87

Use `@default(now())` for creation timestamps and `@updatedAt` for modification timestamps where the application does not intentionally manage them itself.

### 10. Low — Possible client-profile duplication

`User.clientProfiles` is an array at line 162, while the domain appears to support one client profile per user.

If one profile per user is the intended rule, use a one-to-one relation and make `ClientProfile.userId` unique:

```prisma
clientProfile ClientProfile?
```

## Recommended remediation order

1. Secure exact professional locations and verification documents.
2. Add missing relations and foreign-key constraints.
3. Define enums and legal state transitions for business workflows.
4. Confirm and document integer-cents handling for every financial field.
5. Consolidate or document overlapping models.
6. Convert JSON strings to Prisma `Json` fields where appropriate.
7. Standardize database table names.
8. Apply Prisma formatting and add/update migrations.

## Conclusion

`prisma/schema.prisma` is valid Prisma syntax, but a coding-standards review should be considered **not fully compliant** until the high-priority integrity, privacy, security, and state-model issues are addressed.
