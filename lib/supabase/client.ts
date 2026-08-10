import { createBrowserClient } from "@supabase/ssr";
import { getPublishableKey, getSupabaseUrl } from "@/lib/supabase/keys";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getPublishableKey());
}
