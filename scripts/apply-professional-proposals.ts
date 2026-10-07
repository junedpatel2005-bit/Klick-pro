import "dotenv/config";
import { execFileSync } from "node:child_process";

if (process.env.ALLOW_LEGACY_MIGRATION_SCRIPT !== "true") {
  throw new Error(
    "This legacy wrapper is disabled. Use `npx prisma migrate deploy`; set ALLOW_LEGACY_MIGRATION_SCRIPT=true only for an explicitly approved non-production run.",
  );
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Legacy migration wrappers cannot run in production.");
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
execFileSync(executable, ["prisma", "migrate", "deploy"], { stdio: "inherit" });
