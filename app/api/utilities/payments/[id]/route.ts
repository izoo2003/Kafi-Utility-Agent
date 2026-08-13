import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { deleteUtilityPaymentLog } from "@/lib/supabase/utilities";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const { error } = await deleteUtilityPaymentLog(supabase, id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { id } });
}
