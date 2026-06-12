/**
 * Standalone migration runner.  Reads every *.sql file in ./sql in lexical
 * order and runs each one inside a transaction.  A `schema_migrations` table
 * tracks which files have already been applied so re-runs are idempotent.
 *
 * Usage:  npx tsx src/migrate.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import "dotenv/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SQL_DIR = resolve(__dirname, "../sql");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function migrate() {
  const client = await pool.connect();
  try {
    // Ensure tracking table exists
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    // Collect applied migrations
    const { rows } = await client.query<{ filename: string }>(
      "select filename from schema_migrations order by filename",
    );
    const applied = new Set(rows.map((r) => r.filename));

    // Read SQL directory
    const files = (await readdir(SQL_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file} (already applied)`);
        continue;
      }
      const sql = await readFile(join(SQL_DIR, file), "utf8");
      console.log(`  apply ${file} …`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into schema_migrations (filename) values ($1)",
          [file],
        );
        await client.query("commit");
        ran++;
        console.log(`  ✓     ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }

    if (ran === 0) {
      console.log("No new migrations to apply.");
    } else {
      console.log(`\nApplied ${ran} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
