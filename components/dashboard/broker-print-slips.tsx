import type { TenantBrokerListRow } from "@/lib/supabase/tenant-brokers";
import { breakdownFromStored } from "@/lib/tenants/broker-commission";
import { formatDate } from "@/lib/format/datetime";
import { BrokerCommissionDetail } from "@/components/dashboard/broker-commission-detail";

export function BrokerPrintSlips({
  rows,
}: {
  rows: TenantBrokerListRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No broker slips to print.</p>;
  }

  return (
    <div className="space-y-6">
      {rows.map((row) => {
        const breakdown = breakdownFromStored(row);
        return (
          <article
            key={row.id}
            className="broker-print-slip break-inside-avoid rounded-xl border border-black/20 bg-white px-5 py-5"
          >
            <header className="border-b border-black/15 pb-3">
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                Commission
                {row.survey_no ? ` · Survey ${row.survey_no}` : ""}
              </p>
              <h2 className="mt-1 font-heading text-lg font-semibold">
                {row.broker_name}
              </h2>
            </header>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Broker</dt>
                <dd className="font-medium">{row.broker_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tenant</dt>
                <dd className="font-medium">{row.tenant_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sqft</dt>
                <dd>{row.sqft == null ? "—" : Number(row.sqft).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rate</dt>
                <dd>{row.rate == null ? "—" : Number(row.rate).toLocaleString()}</dd>
              </div>
              {row.contract_start_date && row.contract_end_date ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Contract</dt>
                  <dd>
                    {formatDate(row.contract_start_date)} –{" "}
                    {formatDate(row.contract_end_date)}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 rounded-lg border border-black/10 px-3 py-3">
              <BrokerCommissionDetail
                title={
                  row.survey_no
                    ? `Commission — Survey ${row.survey_no}`
                    : `Commission — ${row.tenant_name || "tenant"}`
                }
                sqft={row.sqft}
                rate={row.rate}
                contractStart={row.contract_start_date}
                contractEnd={row.contract_end_date}
                breakdown={breakdown}
              />
            </div>
            {row.notes ? (
              <p className="mt-3 text-sm">
                <span className="text-muted-foreground">Notes: </span>
                {row.notes}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
