import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createTenantRentPayment,
  getTenantScheduleRow,
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

  return domainWriteResponse(
    await createTenantRentPayment(
      supabase,
      withUpdatedBy({ ...parsed.data, schedule_id: scheduleId }, user),
    ),
  );
}
