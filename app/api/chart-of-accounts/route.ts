import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createChartOfAccountsEntry,
  listChartOfAccountsEntries,
} from "@/lib/supabase/chart-of-accounts";
import {
  chartOfAccountsEntryInsertSchema,
  chartOfAccountsLedgerSchema,
} from "@/lib/validations/chart-of-accounts";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const ledgerParam = url.searchParams.get("ledger");
  let ledger: ReturnType<typeof chartOfAccountsLedgerSchema.parse> | null =
    null;
  if (ledgerParam) {
    const parsed = chartOfAccountsLedgerSchema.safeParse(ledgerParam);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid ledger. Use solar_panel_clifton, eobi, k_electric_gondpass, or kwsb_clifton." },
        { status: 400 },
      );
    }
    ledger = parsed.data;
  }

  const { data, error } = await listChartOfAccountsEntries(supabase, ledger);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, chartOfAccountsEntryInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createChartOfAccountsEntry(
      supabase,
      withUpdatedBy(parsed.data, user),
    ),
  );
}
