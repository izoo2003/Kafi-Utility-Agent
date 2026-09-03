import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createSolarMaintenance,
  listSolarMaintenance,
} from "@/lib/supabase/solar";
import { withDefaultNextServiceDue } from "@/lib/generator/maintenance";
import { findSolarSite } from "@/lib/sems/sites";
import { solarMaintenanceInsertSchema } from "@/lib/validations/solar";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listSolarMaintenance(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, solarMaintenanceInsertSchema);
  if (parsed.error) return parsed.error;

  const site = findSolarSite(parsed.data.site_id);
  if (!site) {
    return NextResponse.json(
      { error: `Unknown solar plant "${parsed.data.site_id}"` },
      { status: 400 },
    );
  }

  const payload = withDefaultNextServiceDue({
    ...parsed.data,
    site_id: site.id,
    checkup_status: parsed.data.checkup_status ?? "done",
  });

  return domainWriteResponse(
    await createSolarMaintenance(supabase, withUpdatedBy(payload, user)),
  );
}
