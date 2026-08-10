import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAlertDigest } from "@/lib/notifications/run-alert-digest";

function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 503 },
      ),
    };
  }

  const header = request.headers.get("authorization");
  const bearer =
    header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
  const querySecret = new URL(request.url).searchParams.get("secret");

  if (bearer === secret || querySecret === secret) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

async function handle(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  const force =
    new URL(request.url).searchParams.get("force") === "1" ||
    new URL(request.url).searchParams.get("force") === "true";

  try {
    const supabase = createAdminClient();
    const result = await runAlertDigest(supabase, { force });
    return NextResponse.json({ ok: true, data: result });
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
