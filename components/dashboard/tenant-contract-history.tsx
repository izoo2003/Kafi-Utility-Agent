import type { TenantContractExtension } from "@/lib/types/database";
import { formatDate } from "@/lib/format/datetime";
import { formatMoney } from "@/lib/tenants/payment-status";

const FIELD_LABELS: Record<string, string> = {
  per_sqft: "Per sqft",
  lum_sum: "Lum sum",
};

export function formatChangeValue(field: string, value: unknown) {
  if (value == null) return "—";
  if (field === "line_items") {
    const items = value as Array<{ label: string; amount: number }>;
    if (items.length === 0) return "none";
    return items.map((item) => `${item.label}: Rs.${formatMoney(item.amount)}`).join(", ");
  }
  if (field === "rate_type") {
    return FIELD_LABELS[String(value)] ?? String(value);
  }
  if (field === "sqft" || field === "rate" || field === "gross_rent") {
    return `Rs.${formatMoney(Number(value))}`;
  }
  return String(value);
}

export function TenantContractHistory({
  extensions,
}: {
  extensions: TenantContractExtension[];
}) {
  if (extensions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[oklch(0.88_0.02_290)] py-8 text-center text-sm text-muted-foreground">
        No contract extensions logged yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {extensions.map((ext) => (
        <div
          key={ext.id}
          className="space-y-2 rounded-xl border border-[oklch(0.88_0.02_290)] bg-white/70 px-4 py-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Extended {formatDate(ext.extension_from)} – {formatDate(ext.extension_till)}
            </p>
            <p className="text-xs text-muted-foreground">
              Logged {formatDate(ext.created_at)}
            </p>
          </div>
          {ext.changes.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {ext.changes.map((change, index) => (
                <li key={index}>
                  <span className="font-medium">{change.label}: </span>
                  {formatChangeValue(change.field, change.old_value)}
                  {" → "}
                  {formatChangeValue(change.field, change.new_value)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Period extended; no terms changed.
            </p>
          )}
          {ext.notes ? (
            <p className="text-sm text-muted-foreground">{ext.notes}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
