import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api/authorize-cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyDailyKitchenConsumption } from "@/lib/kitchen/apply-daily-consumption";
import { runAlertDigest } from "@/lib/notifications/run-alert-digest";
import { syncAllSemsLive } from "@/lib/sems/sync";

async function handle(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true";

  try {
    const supabase = createAdminClient();
    // Kitchen burn + alert digest. Solar sync is /api/cron/solar-sync (daily on Hobby);
    // keep a daily backup here in case the hourly job is skipped on Hobby.
    const kitchen = await applyDailyKitchenConsumption(supabase);
    const solar = await syncAllSemsLive(supabase);
    const result = await runAlertDigest(supabase, { force });
    return NextResponse.json({
      ok: true,
      data: { kitchen, solar, alerts: result },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Alert digest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Vercel Cron calls GET */
export async function GET(request: Request) {
  return handle(request);
}

/** Manual trigger: POST with same auth */
export async function POST(request: Request) {
  return handle(request);
}
