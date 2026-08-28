import { createClient } from "@/lib/supabase/server";
import { listChartOfAccountsEntries } from "@/lib/supabase/chart-of-accounts";
import { ChartOfAccountsPanel } from "@/components/dashboard/chart-of-accounts-panel";
import type { ChartOfAccountsEntry } from "@/lib/types/database";

export default async function ChartOfAccountsEobiPage() {
  const supabase = await createClient();
  const { data, error } = await listChartOfAccountsEntries(supabase, "eobi");

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load E.O.B.I ledger: {error.message}. If this mentions a
        missing table, run migration{" "}
        <code>20260828120000_chart_of_accounts.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <ChartOfAccountsPanel
      ledger="eobi"
      initialEntries={(data ?? []) as ChartOfAccountsEntry[]}
    />
  );
}
