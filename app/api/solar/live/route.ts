import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { getSolarSite, isSemsConfigured } from "@/lib/sems/config";
import {
  isSolarSiteOffline,
  solarSiteOfflinePayload,
} from "@/lib/sems/site-offline";
import {
  isSolarSiteStatic,
  solarSiteStaticPayload,
} from "@/lib/sems/site-static";
import { getSolarLiveSnapshot } from "@/lib/supabase/solar";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const siteId = new URL(request.url).searchParams.get("site")?.trim() || null;
  const site = getSolarSite(siteId);
  if (!site) {
    return NextResponse.json(
      { error: siteId ? `Unknown solar site "${siteId}"` : "No solar sites configured" },
      { status: siteId ? 404 : 400 },
    );
  }
  if (isSolarSiteOffline(site)) {
    return NextResponse.json(solarSiteOfflinePayload(site.label), {
      status: 503,
    });
  }

  const { data, error } = await getSolarLiveSnapshot(supabase, site.stationId);
  if (error) return supabaseErrorResponse(error.message);

  return NextResponse.json({
    data,
    site: {
      id: site.id,
      label: site.label,
      stationId: site.stationId,
      stationName: site.stationName,
    },
    configured: isSemsConfigured(),
    ...(isSolarSiteStatic(site) ? solarSiteStaticPayload(site.label) : {}),
  });
}
