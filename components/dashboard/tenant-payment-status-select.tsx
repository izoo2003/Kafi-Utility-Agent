"use client";

import type { TenantPaymentStatus } from "@/lib/types/database";
import {
  TENANT_PAYMENT_STATUSES,
  TENANT_PAYMENT_STATUS_LABELS,
} from "@/lib/tenants/payment-status";
import { Label } from "@/components/ui/label";

export function PaymentStatusSelect({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: TenantPaymentStatus;
  onChange: (value: TenantPaymentStatus) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Payment status</Label>
      <select
        id={id}
        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as TenantPaymentStatus)}
      >
        {TENANT_PAYMENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {TENANT_PAYMENT_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
