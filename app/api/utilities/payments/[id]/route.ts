import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteUtilityPaymentLog,
  updateUtilityPaymentLog,
} from "@/lib/supabase/utilities";
import { utilityPaymentLogUpdateSchema } from "@/lib/validations/utilities";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, utilityPaymentLogUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _ignored, ...rest } = parsed.data;
  const { data, error } = await updateUtilityPaymentLog(
    supabase,
    id,
    withUpdatedBy(rest, user),
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  { params }: Params,
) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { error } = await deleteUtilityPaymentLog(supabase, id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { id } });
}
