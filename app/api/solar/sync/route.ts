import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSemsLive } from "@/lib/sems/sync";

/** Manual SEMS+ sync (authenticated dashboard user). Uses service role for snapshot write. */
export async function POST() {
  const { errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  try {
    const supabase = createAdminClient();
    const result = await syncSemsLive(supabase);
    if (result.error && !result.snapshot) {
      return NextResponse.json(
        { error: result.error, configured: result.configured },
        { status: result.configured ? 502 : 503 },
      );
    }
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SEMS+ sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
