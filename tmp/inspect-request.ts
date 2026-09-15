import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(`
  SELECT id, "jobId", "professionalId", "clientId", status, origin, "bidAmount", duration, "coverLetter"
  FROM "ProjectRequest" WHERE "jobId" = 217 ORDER BY id
`);
console.log(JSON.stringify(result.rows, null, 2));
await pool.end();
