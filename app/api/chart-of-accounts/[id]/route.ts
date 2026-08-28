import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteChartOfAccountsEntry,
  getChartOfAccountsEntry,
  updateChartOfAccountsEntry,
} from "@/lib/supabase/chart-of-accounts";
import { chartOfAccountsEntryUpdateSchema } from "@/lib/validations/chart-of-accounts";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await getChartOfAccountsEntry(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  if (!data) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, chartOfAccountsEntryUpdateSchema);
  if (parsed.error) return parsed.error;

  const { id: _ignored, ...rest } = parsed.data;
  const { data, error } = await updateChartOfAccountsEntry(
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

  const { error } = await deleteChartOfAccountsEntry(supabase, id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
