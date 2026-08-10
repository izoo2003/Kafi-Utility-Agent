import type { User } from "@supabase/supabase-js";

export function withUpdatedBy<T extends Record<string, unknown>>(
  input: T,
  user: User,
) {
  return { ...input, updated_by: user.id };
}
