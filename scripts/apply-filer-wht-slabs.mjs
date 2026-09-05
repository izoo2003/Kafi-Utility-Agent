import { readFileSync, existsSync } from "node:fs";
import pg from "pg";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv(".env");
loadEnv(".env.local");

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = readFileSync(
  "supabase/migrations/20260905120000_filer_rent_wht_slabs.sql",
  "utf8",
);

async function main() {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    const { rows } = await client.query(
      `select label, min_amount, max_amount, rate_percent
       from public.withholding_tax_slabs
       order by min_amount asc`,
    );
    console.log("Wrote Filer 2026-27 WHT slabs:");
    for (const row of rows) {
      console.log(
        `  ${row.label}: ${row.min_amount}–${row.max_amount ?? "∞"} @ ${row.rate_percent}%`,
      );
    }
  } catch (e) {
    console.error(e.message ?? e);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

main();
