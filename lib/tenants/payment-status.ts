import type { TenantPaymentStatus } from "@/lib/types/database";

export const TENANT_PAYMENT_STATUSES = [
  "paid",
  "unpaid",
  "partial",
  "overdue",
] as const;

/** Manual status options for the electricity bill ledger's Status dropdown. */
export const ELECTRIC_BILL_PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "processing",
] as const;

export const TENANT_PAYMENT_STATUS_LABELS: Record<TenantPaymentStatus, string> =
  {
    paid: "Paid",
    unpaid: "Unpaid",
    partial: "Partial",
    overdue: "Overdue",
    processing: "Processing",
  };

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Unpaid/partial past the due date is treated as overdue for display and alerts. */
export function effectivePaymentStatus(
  status: TenantPaymentStatus,
  dueDate: string | null | undefined,
  today = todayIso(),
): TenantPaymentStatus {
  if (status === "paid" || status === "overdue") return status;
  if (dueDate && dueDate < today) return "overdue";
  return status;
}

export function paymentStatusBadgeClass(status: TenantPaymentStatus): string {
  switch (status) {
    case "overdue":
      return "bg-[oklch(0.95_0.04_25)] text-[oklch(0.45_0.14_25)]";
    case "unpaid":
      return "bg-[oklch(0.95_0.04_85)] text-[oklch(0.45_0.12_70)]";
    case "partial":
      return "bg-[oklch(0.95_0.04_85)] text-[oklch(0.45_0.12_70)]";
    case "processing":
      return "bg-[oklch(0.95_0.04_240)] text-[oklch(0.45_0.12_240)]";
    case "paid":
      return "bg-[oklch(0.95_0.03_155)] text-[oklch(0.4_0.1_155)]";
  }
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
