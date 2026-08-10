import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteItEquipment,
  getItEquipment,
  updateItEquipment,
} from "@/lib/supabase/it-equipment";
import { itEquipmentUpdateSchema } from "@/lib/validations/it-equipment";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await getItEquipment(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, itEquipmentUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _ignored, ...rest } = parsed.data;
  const { data, error } = await updateItEquipment(
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

  const { error } = await deleteItEquipment(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
