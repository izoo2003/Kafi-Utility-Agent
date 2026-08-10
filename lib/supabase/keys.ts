export function getSupabaseUrl() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL");
  }
  return url;
}

export function getPublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("Missing publishable / anon Supabase key");
  }
  return key;
}

/** Server-only. Never import into client components. */
export function getSecretKey() {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY");
  }
  return key;
}
