import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteGeneratorVendor,
  getGeneratorVendor,
  updateGeneratorVendor,
} from "@/lib/supabase/generator";
import { generatorVendorUpdateSchema } from "@/lib/validations/generator";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await getGeneratorVendor(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, generatorVendorUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _ignored, ...rest } = parsed.data;
  const { data, error } = await updateGeneratorVendor(
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

  const { error } = await deleteGeneratorVendor(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
