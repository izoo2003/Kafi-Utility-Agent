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

const regions = [
  "ap-southeast-1",
  "ap-south-1",
  "eu-west-1",
  "eu-central-1",
  "us-east-1",
  "us-west-1",
];

const sql = readFileSync(
  "supabase/migrations/20260817180000_utility_payment_bill_fields.sql",
  "utf8",
);

let lastError = null;
for (const region of regions) {
  const connectionString = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log(JSON.stringify({ ok: true, region, migration: "20260817180000" }));
    await client.end();
    process.exit(0);
  } catch (e) {
    lastError = { region, message: String(e.message || e) };
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

console.error(JSON.stringify({ ok: false, lastError }));
process.exit(1);
