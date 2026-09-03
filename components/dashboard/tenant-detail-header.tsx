import Link from "next/link";
import type { Tenant, TenantRentLineItem } from "@/lib/types/database";
import {
  contractDetailLine,
  contractDurationLabel,
} from "@/lib/tenants/ledger";
import { formatMoney } from "@/lib/tenants/payment-status";
import {
  agreementExpiryLabel,
  agreementExpiryStatus,
} from "@/lib/tenants/agreement";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TenantDetailHeader({
  tenant,
  lineItems,
}: {
  tenant: Tenant;
  lineItems: TenantRentLineItem[];
}) {
  const status = agreementExpiryStatus(
    tenant.contract_end_date ?? tenant.agreement_expiry,
  );
  const depositBits = [
    tenant.security_deposit_amount != null
      ? `Rs.${formatMoney(tenant.security_deposit_amount)}`
      : null,
    tenant.security_deposit_bank_name,
    tenant.security_deposit_cheque_no
      ? `CH# ${tenant.security_deposit_cheque_no}`
      : null,
    tenant.security_deposit_bank_account,
  ].filter(Boolean);

  return (
    <section className="overflow-hidden rounded-xl border border-[oklch(0.2_0.02_230)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[oklch(0.93_0.03_230)] px-4 py-2">
        <h2 className="font-heading text-lg font-semibold uppercase tracking-wide">
          {tenant.tenant_name}
        </h2>
        <Link
          href={`/dashboard/tenants/${tenant.id}/edit`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Edit tenant
        </Link>
      </div>
      <div className="space-y-2 px-4 py-3 text-sm">
        <p>
          <span className="font-medium">Contract duration: </span>
          {contractDurationLabel(
            tenant.contract_start_date,
            tenant.contract_end_date,
          )}
        </p>
        <p>
          <span className="font-medium">Security deposit: </span>
          {depositBits.length ? depositBits.join(" · ") : "—"}
        </p>
        <p>
          <span className="font-medium">Contract detail: </span>
          {contractDetailLine(tenant, lineItems)}
        </p>
        {tenant.notes ? (
          <p className="text-muted-foreground">{tenant.notes}</p>
        ) : null}
        <div className="flex justify-end">
          <span
            className={cn(
              "inline-flex rounded-md px-2 py-1 text-xs font-medium",
              status === "expired"
                ? "bg-[oklch(0.95_0.04_25)] text-[oklch(0.45_0.14_25)]"
                : status === "soon"
                  ? "bg-[oklch(0.95_0.04_85)] text-[oklch(0.45_0.12_70)]"
                  : "bg-[oklch(0.94_0.02_230)] text-[oklch(0.35_0.04_230)]",
            )}
          >
            {agreementExpiryLabel(status)}
          </span>
        </div>
      </div>
    </section>
  );
}
