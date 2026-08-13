import { addCalendarMonths } from "@/lib/generator/maintenance";
import type { UtilityPaymentLog } from "@/lib/types/database";

/** Next bill due = one calendar month after last paid date. */
export function nextDueFromLastPaid(lastPaidOn: string): string {
  return addCalendarMonths(lastPaidOn, 1);
}

export function latestPayment(
  logs: UtilityPaymentLog[],
): UtilityPaymentLog | null {
  if (!logs.length) return null;
  return [...logs].sort((a, b) => {
    const byDate = b.paid_on.localeCompare(a.paid_on);
    if (byDate !== 0) return byDate;
    return b.created_at.localeCompare(a.created_at);
  })[0]!;
}

export function billStatus(
  nextDue: string | null,
  todayIso: string,
): "unknown" | "ok" | "due_soon" | "due_today" | "overdue" {
  if (!nextDue) return "unknown";
  if (nextDue < todayIso) return "overdue";
  if (nextDue === todayIso) return "due_today";
  const today = new Date(`${todayIso}T00:00:00`);
  const due = new Date(`${nextDue}T00:00:00`);
  const days = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 7) return "due_soon";
  return "ok";
}
