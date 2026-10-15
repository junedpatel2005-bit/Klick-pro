import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ Error: DATABASE_URL environment variable is missing.");
  process.exit(1);
}

const backupsDir = path.resolve(process.cwd(), "backups");
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

function timestampStr(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function performNativeDump(urlStr: string): Promise<string | null> {
  try {
    execSync("pg_dump --version", { stdio: "ignore" });
  } catch {
    return null; // pg_dump not installed or not in PATH
  }

  const filename = `klickpro_backup_${timestampStr()}.sql`;
  const targetPath = path.join(backupsDir, filename);

  try {
    console.log(`📦 Running native pg_dump to ${filename}...`);
    execSync(`pg_dump "${urlStr}" -f "${targetPath}" --no-owner --no-privileges`, {
      stdio: "inherit",
    });
    return targetPath;
  } catch (err) {
    console.warn("⚠️ Native pg_dump failed, falling back to JSON snapshot...", err);
    return null;
  }
}

async function performJsonSnapshot(urlStr: string): Promise<string> {
  const pool = new Pool({ connectionString: urlStr, max: 2 });
  const client = await pool.connect();
  const filename = `db_snapshot_${timestampStr()}.json`;
  const targetPath = path.join(backupsDir, filename);

  try {
    console.log("🔍 Inspecting public tables in PostgreSQL database...");
    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
         AND table_type = 'BASE TABLE'
         AND table_name NOT LIKE '_prisma_%'
       ORDER BY table_name ASC`,
    );

    const tables = tablesRes.rows.map((r) => r.table_name);
    console.log(`📋 Found ${tables.length} tables to snapshot.`);

    const snapshotData: Record<string, unknown[]> = {};
    let totalRows = 0;

    for (const table of tables) {
      const res = await client.query(`SELECT * FROM "${table}"`);
      snapshotData[table] = res.rows;
      totalRows += res.rows.length;
      console.log(`  ├─ ${table.padEnd(35, " ")}: ${res.rows.length} rows`);
    }

    const payload = {
      meta: {
        timestamp: new Date().toISOString(),
        tablesCount: tables.length,
        totalRows,
        databaseUrlRedacted: urlStr.replace(/:[^:@]+@/, ":****@"),
      },
      tables: snapshotData,
    };

    fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), "utf8");
    console.log(`\n💾 Snapshot saved: ${targetPath}`);
    console.log(`📊 Total: ${tables.length} tables, ${totalRows} records.\n`);
    return targetPath;
  } finally {
    client.release();
    await pool.end();
  }
}

async function restoreJsonSnapshot(filePath: string, urlStr: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Backup file not found: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const tables: Record<string, any[]> = parsed.tables || {};

  const pool = new Pool({ connectionString: urlStr, max: 2 });
  const client = await pool.connect();

  try {
    console.log(`🔄 Restoring data from ${path.basename(filePath)}...`);
    await client.query("BEGIN");

    for (const [table, rows] of Object.entries(tables)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      console.log(`  Restoring ${rows.length} rows into ${table}...`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const colNames = cols.map((c) => `"${c}"`).join(", ");
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        const values = cols.map((c) => row[c]);
        await client.query(
          `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values,
        );
      }
    }

    await client.query("COMMIT");
    console.log("✅ Restore completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Restore failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const restoreIndex = args.indexOf("--restore");

  if (restoreIndex !== -1) {
    const fileToRestore = args[restoreIndex + 1];
    if (!fileToRestore) {
      console.error("❌ Please provide the backup file path to restore: --restore <path>");
      process.exit(1);
    }
    await restoreJsonSnapshot(path.resolve(process.cwd(), fileToRestore), connectionString);
    return;
  }

  console.log("===============================================================================");
  console.log("  KLICK-PRO DATABASE BACKUP UTILITY");
  console.log("===============================================================================\n");

  const dumpResult = await performNativeDump(connectionString);
  if (dumpResult) {
    console.log(`✅ Native pg_dump backup completed: ${dumpResult}`);
    return;
  }

  const snapshotResult = await performJsonSnapshot(connectionString);
  console.log(`✅ Snapshot backup completed: ${snapshotResult}`);
}

main().catch((err) => {
  console.error("❌ Fatal backup error:", err);
  process.exit(1);
});
