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

const password = process.env.SUPABASE_DB_PASSWORD;
const ref = "rfmcpoocpaohpdjvjhlg";
if (!password) {
  console.error("Missing SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const sql = readFileSync(
  "supabase/migrations/20260818120000_kitchen_auto_consumption.sql",
  "utf8",
);

const regions = [
  "ap-south-1",
  "ap-southeast-1",
  "eu-west-1",
  "eu-central-1",
  "us-east-1",
];

async function main() {
  let lastErr;
  for (const region of regions) {
    const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      await client.query(sql);
      console.log("Applied kitchen auto-consumption migration via", region);
      await client.end();
      return;
    } catch (e) {
      lastErr = e;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  console.error(lastErr);
  process.exit(1);
}

main();
