"use client";

import { useState } from "react";
import type { Tenant, TenantElectricBill } from "@/lib/types/database";
import type { LedgerRow } from "@/lib/tenants/ledger";
import { TenantRentLedger } from "@/components/dashboard/tenant-rent-ledger";
import { TenantElectricityPanel } from "@/components/dashboard/tenant-electricity-panel";
import { cn } from "@/lib/utils";

export function TenantDetailTabs({
  tenant,
  schedule,
  bills,
}: {
  tenant: Tenant;
  schedule: LedgerRow[];
  bills: TenantElectricBill[];
}) {
  const [tab, setTab] = useState<"rent" | "electricity">("rent");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            tab === "rent"
              ? "bg-[oklch(0.28_0.04_230)] text-white"
              : "bg-[oklch(0.95_0.01_230)] text-[oklch(0.35_0.03_230)]",
          )}
          onClick={() => setTab("rent")}
        >
          Rent ledger
        </button>
        <button
          type="button"
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            tab === "electricity"
              ? "bg-[oklch(0.28_0.04_230)] text-white"
              : "bg-[oklch(0.95_0.01_230)] text-[oklch(0.35_0.03_230)]",
          )}
          onClick={() => setTab("electricity")}
        >
          Electricity
        </button>
      </div>
      {tab === "rent" ? (
        <TenantRentLedger tenantId={tenant.id} rows={schedule} />
      ) : (
        <TenantElectricityPanel
          initialTenants={[tenant]}
          initialBills={bills}
          initialTenantId={tenant.id}
          embedded
        />
      )}
    </div>
  );
}
