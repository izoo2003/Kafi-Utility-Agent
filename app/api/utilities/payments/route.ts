import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody } from "@/lib/api/parse";
import {
  createUtilityPaymentLog,
  listUtilityPaymentLogs,
} from "@/lib/supabase/utilities";
import { utilityPaymentLogInsertSchema } from "@/lib/validations/utilities";
import { withUpdatedBy } from "@/lib/api/with-user";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const accountId = new URL(request.url).searchParams.get("accountId") ?? undefined;
  const { data, error } = await listUtilityPaymentLogs(supabase, accountId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, utilityPaymentLogInsertSchema);
  if (parsed.error) return parsed.error;

  const { data, error, outcome } = await createUtilityPaymentLog(
    supabase,
    withUpdatedBy(parsed.data, user),
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data, outcome }, { status: 201 });
}
