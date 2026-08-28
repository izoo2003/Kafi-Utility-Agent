import { createClient } from "@/lib/supabase/server";
import { listChartOfAccountsEntries } from "@/lib/supabase/chart-of-accounts";
import { ChartOfAccountsPanel } from "@/components/dashboard/chart-of-accounts-panel";
import type { ChartOfAccountsEntry } from "@/lib/types/database";

export default async function ChartOfAccountsKwsbPage() {
  const supabase = await createClient();
  const { data, error } = await listChartOfAccountsEntries(
    supabase,
    "kwsb_clifton",
  );

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load KWSB Clifton ledger: {error.message}. If this mentions a
        missing table, run migration{" "}
        <code>20260828120000_chart_of_accounts.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <ChartOfAccountsPanel
      ledger="kwsb_clifton"
      initialEntries={(data ?? []) as ChartOfAccountsEntry[]}
    />
  );
}
