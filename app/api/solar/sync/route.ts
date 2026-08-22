import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSolarSite } from "@/lib/sems/config";
import { isSolarSiteOffline, solarSiteOfflinePayload } from "@/lib/sems/site-offline";
import { syncAllSemsLive, syncSemsLive } from "@/lib/sems/sync";

/** Manual SEMS+ sync (authenticated dashboard user). Uses service role for snapshot write. */
export async function POST(request: Request) {
  const { errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const siteParam = url.searchParams.get("site")?.trim() || null;
  const syncAll = url.searchParams.get("all") === "1";

  try {
    const supabase = createAdminClient();

    if (syncAll) {
      const results = await syncAllSemsLive(supabase);
      const failures = results.filter((result) => result.error && !result.snapshot);
      if (failures.length === results.length) {
        return NextResponse.json(
          {
            error: failures[0]?.error ?? "SEMS+ sync failed",
            configured: failures[0]?.configured ?? false,
            data: { results },
          },
          { status: failures[0]?.configured ? 502 : 503 },
        );
      }
      return NextResponse.json({ ok: true, data: { results } });
    }

    if (siteParam) {
      const site = requireSolarSite(siteParam);
      if (isSolarSiteOffline(site)) {
        return NextResponse.json(solarSiteOfflinePayload(site.label), {
          status: 503,
        });
      }
    }

    const result = await syncSemsLive(supabase, siteParam);
    if (result.error && !result.snapshot) {
      return NextResponse.json(
        { error: result.error, configured: result.configured, data: result },
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
