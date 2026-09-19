/// <reference types="node" />

import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma CLI commands such as `migrate deploy` need a session-capable connection
// (DIRECT_URL), falling back to DATABASE_URL.
//
// There is deliberately NO default here. A hardcoded fallback made a mis-set
// environment look like success while pointing at some other database, which is
// the same failure mode as an inherited shell DATABASE_URL overriding .env.
const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error(
    "DIRECT_URL or DATABASE_URL is required for Prisma CLI commands. Check your .env, and note that an exported shell variable overrides it.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
    // Required by `prisma migrate dev` when the database role lacks CREATEDB.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
