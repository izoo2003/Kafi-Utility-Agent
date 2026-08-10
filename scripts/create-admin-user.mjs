/**
 * Create the single admin Auth user (username-based login).
 * Usage:
 *   node scripts/create-admin-user.mjs <username> <password>
 *
 * Supabase Auth stores a synthetic email: username@facility-ops.local
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTH_USERNAME_DOMAIN = "facility-ops.local";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function usernameToEmail(username) {
  const normalized = username.trim().toLowerCase();
  if (!normalized) throw new Error("Username is required");
  if (normalized.includes("@")) return normalized;
  return `${normalized}@${AUTH_USERNAME_DOMAIN}`;
}

loadEnvLocal();

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error(
    "Usage: node scripts/create-admin-user.mjs <username> <password>",
  );
  process.exit(1);
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const email = usernameToEmail(username);
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: existing } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
const already = existing?.users?.find(
  (u) => u.email?.toLowerCase() === email.toLowerCase(),
);

if (already) {
  const { error } = await supabase.auth.admin.updateUserById(already.id, {
    password,
    email_confirm: true,
    user_metadata: { username: username.trim().toLowerCase() },
  });
  if (error) {
    console.error("Failed to update admin user:", error.message);
    process.exit(1);
  }
  console.log("Admin user updated:", username.trim().toLowerCase(), already.id);
  process.exit(0);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { username: username.trim().toLowerCase() },
});

if (error) {
  console.error("Failed to create admin user:", error.message);
  process.exit(1);
}

console.log(
  "Admin user created:",
  username.trim().toLowerCase(),
  data.user?.id,
);
