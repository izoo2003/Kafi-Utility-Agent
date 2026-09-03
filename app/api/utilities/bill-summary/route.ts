import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { getUtilityAccount } from "@/lib/supabase/utilities";
import type { UtilityAccount } from "@/lib/types/database";
import { runUtilityBillSummary } from "@/lib/utilities/run-bill-summary";

const bodySchema = z.object({
  utility_account_id: z.string().uuid(),
  regenerate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, bodySchema);
  if (parsed.error) return parsed.error;

  const account = await getUtilityAccount(
    supabase,
    parsed.data.utility_account_id,
  );
  if (account.error) return supabaseErrorResponse(account.error.message);
  if (!account.data) {
    return NextResponse.json({ error: "Utility account not found" }, { status: 404 });
  }

  const result = await runUtilityBillSummary({
    supabase,
    user,
    account: account.data as UtilityAccount,
    regenerate: parsed.data.regenerate === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result.data });
}
