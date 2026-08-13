import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteGeneratorRunLog,
  updateGeneratorRunLog,
} from "@/lib/supabase/generator";
import { generatorRunLogUpdateSchema } from "@/lib/validations/generator";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, generatorRunLogUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _id, ...fields } = parsed.data;
  const { data, error } = await updateGeneratorRunLog(
    supabase,
    id,
    withUpdatedBy(fields, user),
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const { error } = await deleteGeneratorRunLog(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data: { id } });
}
