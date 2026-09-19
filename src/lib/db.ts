import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "@generated/prisma/client";

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
  prismaModelFingerprint?: string;
};

// Identifies the schema the cached dev client was generated from. Derived from
// the generated model list, so adding or removing a model invalidates the
// hot-reload client automatically — the previous version was a hand-maintained
// string plus four hardcoded model names, which went stale on every schema change.
const modelFingerprint = Object.keys(Prisma.ModelName).sort().join(",");

const connectionString =
  process.env.NODE_ENV === "test" ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    process.env.NODE_ENV === "test"
      ? "TEST_DATABASE_URL is required for database tests."
      : "DATABASE_URL is required.",
  );
}

// PrismaPg builds a new Pool per adapter when it is handed a config object, so
// a single shared Pool is constructed here and passed in instead.
//
// max is a PER-PROCESS cap: size it against the server's max_connections
// divided by the number of app processes, plus the pool in server.mjs.
const pgPool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
const adapter = new PrismaPg(pgPool);

// Set DB_QUERY_LOG=1 to count queries per process while profiling. Off by
// default: query logging is itself expensive.
const queryLogEnabled = process.env.DB_QUERY_LOG === "1";

function createClient() {
  if (!queryLogEnabled) return new PrismaClient({ adapter });
  const client = new PrismaClient({
    adapter,
    log: [{ emit: "event", level: "query" }],
  });
  let count = 0;
  client.$on("query", (event) => {
    count += 1;
    console.log(`[db] #${count} ${event.duration}ms ${event.query.slice(0, 120)}`);
  });
  return client;
}
// Regenerate the development singleton after a Prisma schema change. Without this
// guard, Next's hot-reload can retain a client created before a new model existed.
export const db =
  globalForPrisma.prisma &&
  globalForPrisma.prismaModelFingerprint === modelFingerprint &&
  globalForPrisma.pgPool
    ? globalForPrisma.prisma
    : createClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pgPool = pgPool;
  globalForPrisma.prismaModelFingerprint = modelFingerprint;
}
