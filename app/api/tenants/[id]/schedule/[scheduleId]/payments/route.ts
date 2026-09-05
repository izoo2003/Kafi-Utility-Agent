import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createTenantRentPayment,
  getTenantScheduleRow,
  updateTenantScheduleWhtReceived,
} from "@/lib/supabase/tenants";
import { tenantRentPaymentInsertSchema } from "@/lib/validations/tenants";

type Params = { params: Promise<{ id: string; scheduleId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id, scheduleId } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const row = await getTenantScheduleRow(supabase, scheduleId);
  if (row.error) return supabaseErrorResponse(row.error.message);
  if (!row.data || row.data.tenant_id !== id) {
    return NextResponse.json({ error: "Schedule row not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(
    request,
    tenantRentPaymentInsertSchema.omit({ schedule_id: true }),
  );
  if (parsed.error) return parsed.error;

  const { withholding_tax_received, ...payment } = parsed.data;
  if (withholding_tax_received !== undefined && withholding_tax_received !== null) {
    const wht = await updateTenantScheduleWhtReceived(
      supabase,
      scheduleId,
      Number(withholding_tax_received),
      user.id,
    );
    if (wht.error) return supabaseErrorResponse(wht.error.message);
  }

  return domainWriteResponse(
    await createTenantRentPayment(
      supabase,
      withUpdatedBy({ ...payment, schedule_id: scheduleId }, user),
    ),
  );
}
