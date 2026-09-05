import { formatDate } from "@/lib/format/datetime";
import { formatMoney } from "@/lib/tenants/payment-status";
import {
  stayLabel,
  type BrokerCommissionBreakdown,
} from "@/lib/tenants/broker-commission";

export function BrokerCommissionDetail({
  title,
  sqft,
  rate,
  contractStart,
  contractEnd,
  breakdown,
}: {
  title?: string;
  sqft?: number | null;
  rate?: number | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  breakdown: BrokerCommissionBreakdown;
}) {
  const rateLine =
    sqft != null && rate != null
      ? `${formatMoney(sqft)} × ${formatMoney(rate)} = ${formatMoney(breakdown.monthly_rent)}`
      : formatMoney(breakdown.monthly_rent);

  return (
    <div className="broker-slip-detail text-sm">
      {title ? <p className="font-medium">{title}</p> : null}
      <dl className="mt-2 grid gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
          <dt className="text-muted-foreground">Monthly rent</dt>
          <dd className="text-right tabular-nums">{rateLine}</dd>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
          <dt className="text-muted-foreground">Stay</dt>
          <dd className="max-w-full text-right">
            {stayLabel(breakdown)}
            {contractStart && contractEnd
              ? ` (${formatDate(contractStart)} – ${formatDate(contractEnd)})`
              : ""}
          </dd>
        </div>
        {breakdown.full_months > 0 ? (
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
            <dt className="text-muted-foreground">
              For {breakdown.full_months} month
              {breakdown.full_months === 1 ? "" : "s"}
            </dt>
            <dd className="tabular-nums">
              {formatMoney(breakdown.month_commission)}
            </dd>
          </div>
        ) : null}
        {breakdown.leftover_days > 0 ? (
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5">
            <dt className="text-muted-foreground">
              Day {breakdown.leftover_days}
            </dt>
            <dd className="tabular-nums">
              {formatMoney(breakdown.day_commission)}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5 border-t border-[oklch(0.9_0.02_290)] pt-1.5 font-medium">
          <dt>Total commission</dt>
          <dd className="tabular-nums">
            {formatMoney(breakdown.commission_amount)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
