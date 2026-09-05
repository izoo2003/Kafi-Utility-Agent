import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import {
  getTenantScheduleRow,
  updateTenantScheduleWhtReceived,
} from "@/lib/supabase/tenants";
import { tenantScheduleWhtReceivedSchema } from "@/lib/validations/tenants";

type Params = { params: Promise<{ id: string; scheduleId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, scheduleId } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const row = await getTenantScheduleRow(supabase, scheduleId);
  if (row.error) return supabaseErrorResponse(row.error.message);
  if (!row.data || row.data.tenant_id !== id) {
    return NextResponse.json({ error: "Schedule row not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, tenantScheduleWhtReceivedSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await updateTenantScheduleWhtReceived(
    supabase,
    scheduleId,
    Number(parsed.data.withholding_tax_received ?? 0),
    user.id,
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}
