import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteSolarMaintenance,
  updateSolarMaintenance,
} from "@/lib/supabase/solar";
import { findSolarSite } from "@/lib/sems/sites";
import { solarMaintenanceUpdateSchema } from "@/lib/validations/solar";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, solarMaintenanceUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _ignored, ...rest } = parsed.data;
  if (rest.site_id) {
    const site = findSolarSite(rest.site_id);
    if (!site) {
      return NextResponse.json(
        { error: `Unknown solar plant "${rest.site_id}"` },
        { status: 400 },
      );
    }
    rest.site_id = site.id;
  }

  const { data, error } = await updateSolarMaintenance(
    supabase,
    id,
    withUpdatedBy(rest, user),
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { error } = await deleteSolarMaintenance(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
