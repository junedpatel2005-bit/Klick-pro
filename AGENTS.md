<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Database & Prisma Migration Rules (STRICT & MANDATORY)

## Rule 1: Every Database Change MUST Have a Migration File

- **ZERO UNTRACKED SCHEMA CHANGES**: Never modify `prisma/schema.prisma` or the PostgreSQL database without immediately creating and applying a corresponding migration file in `prisma/migrations/`.
- Every table creation, column addition, alteration, deletion, foreign key, index, or constraint change MUST be captured in a numbered migration folder:
  `prisma/migrations/<YYYYMMDDNNNN_description>/migration.sql`
- Never rely on `prisma db push` alone in development. Deployments run `prisma migrate deploy && next build` (see `package.json`), which strictly executes files in `prisma/migrations/`. Any unmigrated field will fail in production with Prisma error `P2022: The column does not exist`.

## Rule 2: Safe & Idempotent Migration DDL

- For column additions, always use safe DDL:
  `ALTER TABLE "<TableName>" ADD COLUMN IF NOT EXISTS "<column_name>" <TYPE> [DEFAULT ...];`
- For table creations:
  `CREATE TABLE IF NOT EXISTS "<TableName>" (...);`
- For index creations:
  `CREATE INDEX IF NOT EXISTS "<IndexName>" ON "<TableName>" (...);`
- For foreign keys and constraints, wrap inside `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;` blocks so migrations are safe to re-run.

## Rule 3: Verification Workflow for Any Database Change

Whenever any schema change is requested:

1. Update `prisma/schema.prisma`.
2. Format schema: `npx prisma format`.
3. Validate schema: `npx prisma validate`.
4. Create the migration file: `prisma/migrations/<timestamp>_<name>/migration.sql`.
5. Apply migration: `npx prisma migrate deploy`.
6. Regenerate Prisma client: `npx prisma generate`.
7. Verify migration status: `npx prisma migrate status`.
8. Run TypeScript check: `npm run typecheck`.

# Communication & Transparency Rules

## Rule 4: Always Explain What You Are Doing Before Execution

- **TRANSPARENCY FIRST**: Before executing multi-file edits, batch updates, or structural changes, always explain to the user what you are about to do, why, and how it will be implemented.
- **NEVER WORK IN SILENCE**: Keep the user fully in the loop with a clear breakdown of the planned steps and affected files so the user has complete visibility and control over all modifications.

# UI & Text Presentation Rules (STRICT & MANDATORY)

## Rule 5: First-Letter Capitalization for User-Entered & Displayed Details

- **ALWAYS CAPITALIZE USER-ENTERED DETAILS**: Across the entire website, whenever a user enters details in lowercase (small case) — including full names, first/last names, bank account holder names, bank names, UPI registered names, cities, states, addresses, company names, job titles, profession categories, proposals, and descriptions — the UI display MUST ALWAYS format and show them with the first letter capitalized.
- **NO RAW ALL-LOWERCASE RENDERING**: Never display raw unformatted lowercase strings for user details in cards, headers, navigation bars, tables, modal dialogs, receipts, or profile pages. Always apply capitalization utility functions (`capitalizeWords`, `capitalizeFirst`, or `formatUserDetail` from `@/lib/utils`) or CSS `capitalize` (`text-transform: capitalize;`).
- **TITLE CASING FOR NAMES & ENTITIES**: Proper nouns such as names (`john doe` → `John Doe`), bank names (`bank of baroda` → `Bank Of Baroda`), cities (`mumbai` → `Mumbai`), and designations (`software developer` → `Software Developer`) must have the first letter of each word capitalized.
- **SENTENCE CASING FOR DESCRIPTIONS & MESSAGES**: Descriptions, project overviews, bios, and message text must always begin with a capitalized first letter (`capitalizeFirst`).

