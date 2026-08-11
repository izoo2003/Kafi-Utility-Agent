import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api/authorize-cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSemsLive } from "@/lib/sems/sync";

async function handle(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createAdminClient();
    const result = await syncSemsLive(supabase);
    if (!result.configured) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: result.error,
      });
    }
    if (result.error && !result.snapshot) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, data: result });
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
