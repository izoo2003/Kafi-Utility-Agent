import { createClient } from "@/lib/supabase/server";
import {
  ensureSiteUtilityAccounts,
  listUtilityPaymentLogs,
} from "@/lib/supabase/utilities";
import { UtilitiesPanel } from "@/components/dashboard/utilities-panel";
import type {
  UtilityAccount,
  UtilityPaymentLog,
} from "@/lib/types/database";

export default async function UtilitiesPage() {
  const supabase = await createClient();
  const [{ data, error }, payments] = await Promise.all([
    ensureSiteUtilityAccounts(supabase),
    listUtilityPaymentLogs(supabase),
  ]);

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load utilities: {error.message}. If this mentions a missing
        table or constraint, run migration{" "}
        <code>20260813180000_utility_bills.sql</code> in Supabase.
      </p>
    );
  }

  if (payments.error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load payment logs: {payments.error.message}. Run migration{" "}
        <code>20260813180000_utility_bills.sql</code> in Supabase.
      </p>
    );
  }

  return (
    <UtilitiesPanel
      initialItems={(data ?? []) as UtilityAccount[]}
      initialPayments={(payments.data ?? []) as UtilityPaymentLog[]}
    />
  );
}
