import { createClient } from "@supabase/supabase-js";
import { getSecretKey, getSupabaseUrl } from "@/lib/supabase/keys";

/** Service-role client. Server-only — bypasses RLS. */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
