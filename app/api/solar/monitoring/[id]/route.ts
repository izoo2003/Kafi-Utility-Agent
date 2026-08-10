import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteSolarMonitoringLog,
  updateSolarMonitoringLog,
} from "@/lib/supabase/solar";
import { solarMonitoringLogUpdateSchema } from "@/lib/validations/solar";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, solarMonitoringLogUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _ignored, ...rest } = parsed.data;
  const { data, error } = await updateSolarMonitoringLog(
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

  const { error } = await deleteSolarMonitoringLog(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
