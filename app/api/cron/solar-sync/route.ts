import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api/authorize-cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAllSemsLive } from "@/lib/sems/sync";

export const maxDuration = 60;

async function handle(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const results = await syncAllSemsLive(supabase);
    if (!results.length || !results[0]?.configured) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: results[0]?.error ?? "SEMS+ not configured",
      });
    }
    const failures = results.filter((result) => result.error && !result.snapshot);
    if (failures.length === results.length) {
      return NextResponse.json(
        { ok: false, error: failures[0]?.error ?? "SEMS+ sync failed", data: { results } },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: { results } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SEMS+ cron sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
