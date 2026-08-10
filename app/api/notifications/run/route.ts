import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAlertDigest } from "@/lib/notifications/run-alert-digest";

/** Authenticated manual trigger (for testing Phase 6 digests). */
export async function POST(request: Request) {
  const { errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true";

  try {
    const admin = createAdminClient();
    const result = await runAlertDigest(admin, { force });
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Alert digest failed";
    const status = message.includes("alert_notifications") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
