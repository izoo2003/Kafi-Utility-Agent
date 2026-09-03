import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteTenantRentPayment,
  getTenantRentPayment,
  updateTenantRentPayment,
} from "@/lib/supabase/tenants";
import { tenantRentPaymentUpdateSchema } from "@/lib/validations/tenants";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, tenantRentPaymentUpdateSchema);
  if (parsed.error) return parsed.error;
  const { id: _ignored, schedule_id: _sid, ...rest } = parsed.data;
  const { data, error } = await updateTenantRentPayment(
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

  const existing = await getTenantRentPayment(supabase, id);
  if (existing.error) return supabaseErrorResponse(existing.error.message);
  if (!existing.data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { error } = await deleteTenantRentPayment(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
