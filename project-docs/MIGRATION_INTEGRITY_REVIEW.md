# Migration Integrity Review

## Scope

Reviewed `prisma/migrations/202608310001_database_integrity_guards/migration.sql`, the current Prisma schema, and migration ordering. No live or disposable database was contacted.

## Findings

- The migration has a preflight that checks the listed relationship orphans, duplicate client profiles, duplicate primary locations, and the principal negative/range violations.
- Foreign-key column and referenced primary-key types match for the reviewed `Int` relationships.
- Constraint and partial-index names are explicit and appear unique within the repository migration set.
- The checks use nullable-safe predicates for nullable budgets and optional foreign keys. Payment, progress, rating, and aggregate fields are non-null in the Prisma schema; live nullability still requires verification.
- `RESTRICT` is appropriate for payment/audit preservation on the reviewed financial parents. The existing `User` to wallet/profile cascades require product-owner confirmation before deployment because deletion removes dependent records.
- The migration contains no automatic row cleanup, merging, or monetary correction. It aborts when preflight finds violations.
- The migration depends on the referenced tables existing before this migration. Because `prisma/migrations/0_init/migration.sql` is empty, fresh replay remains blocked until `MIG-001` is resolved.

## Required Verification

Run `scripts/full-database-audit.sql` against a sanitized target, compare the target schema with `prisma/schema.prisma`, and apply the migration only after all preflight results are intentionally reconciled. Then replay the entire migration history on an empty disposable PostgreSQL database.

## Status

NEEDS LIVE VERIFICATION
