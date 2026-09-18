/// <reference types="node" />

import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/prisma_validate";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
  // Prisma CLI commands such as migrate deploy need a session-capable connection (DIRECT_URL).
  // Falls back to DATABASE_URL if DIRECT_URL is not set.
  datasource: { url: datasourceUrl },
});
