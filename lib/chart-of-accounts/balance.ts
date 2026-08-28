import type { ChartOfAccountsEntry } from "@/lib/types/database";

/** Running balance = prior + debit − credit (Excel ledger convention). */
export function withRunningBalances(
  rows: ChartOfAccountsEntry[],
): Array<ChartOfAccountsEntry & { balance: number }> {
  let balance = 0;
  return rows.map((row) => {
    balance += (Number(row.debit) || 0) - (Number(row.credit) || 0);
    return { ...row, balance };
  });
}
