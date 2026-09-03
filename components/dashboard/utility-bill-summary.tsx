"use client";

import { useMemo, useState } from "react";
import { FileText, RefreshCw } from "lucide-react";
import type { UtilityAccount, UtilityPaymentLog } from "@/lib/types/database";
import type { SiteUtilityProvider } from "@/lib/utilities/providers";
import {
  buildBillComparison,
  formatPct,
  formatSigned,
} from "@/lib/utilities/bill-comparison";
import { apiFetch } from "@/lib/dashboard/api-client";
import { formatDate } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function unitsText(
  n: number | null | undefined,
  utilityType: string,
  menuKey: string,
) {
  if (n == null) return "—";
  if (utilityType === "electricity") return `${n} kWh`;
  if (utilityType === "gas") return `${n} CM`;
  if (menuKey === "water-tanker") return `${n} tankers`;
  return String(n);
}

type SummaryResponse = {
  comparison: ReturnType<typeof buildBillComparison>;
  summary: string | null;
  model: string | null;
  generated_at: string | null;
  payment?: UtilityPaymentLog;
  cached?: boolean;
};

export function UtilityBillSummary({
  account,
  provider,
  payments,
  onPaymentUpdated,
}: {
  account: UtilityAccount | null;
  provider: SiteUtilityProvider;
  payments: UtilityPaymentLog[];
  onPaymentUpdated: (log: UtilityPaymentLog) => void;
}) {
  const comparison = useMemo(() => buildBillComparison(payments), [payments]);
  const latest =
    payments.find((p) => p.id === comparison.current?.id) ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = latest?.ai_summary ?? null;
  const model = latest?.ai_summary_model ?? null;
  const generatedAt = latest?.ai_summary_at ?? null;

  async function generate(regenerate: boolean) {
    if (!account) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<SummaryResponse>(
        "/api/utilities/bill-summary",
        {
          method: "POST",
          body: JSON.stringify({
            utility_account_id: account.id,
            regenerate,
          }),
        },
      );
      if (data.payment) onPaymentUpdated(data.payment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate summary");
    } finally {
      setBusy(false);
    }
  }

  if (!account || !comparison.current) {
    return (
      <div className="rounded-xl border border-dashed border-[oklch(0.88_0.02_220)] bg-[oklch(0.99_0.005_220)] px-4 py-4">
        <p className="text-sm font-medium">Bill summary</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Log a payment first — then generate an AI report of why this bill
          came as it did versus the previous one.
        </p>
      </div>
    );
  }

  const { current, previous } = comparison;
  const units = (n: number | null | undefined) =>
    unitsText(n, provider.utility_type, provider.menuKey);

  return (
    <div className="space-y-3 rounded-xl border border-[oklch(0.88_0.03_250)] bg-[oklch(0.985_0.015_250)] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-[oklch(0.45_0.08_250)]" />
            <h3 className="text-base font-medium">Bill summary</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Why this {provider.siteLabel ?? provider.label} bill is this amount,
            compared with the previous bill.
          </p>
        </div>
        <Button
          type="button"
          variant={summary ? "outline" : "default"}
          onClick={() => void generate(Boolean(summary))}
          disabled={busy}
        >
          {busy ? (
            <>
              <RefreshCw className="mr-1 size-4 animate-spin" />
              Analyzing…
            </>
          ) : summary ? (
            "Refresh AI report"
          ) : (
            "Generate AI report"
          )}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Metric</TableHead>
              <TableHead>This bill</TableHead>
              <TableHead>Previous</TableHead>
              <TableHead>Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Paid on</TableCell>
              <TableCell>{formatDate(current.paid_on)}</TableCell>
              <TableCell>
                {previous ? formatDate(previous.paid_on) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Period</TableCell>
              <TableCell>{current.bill_period ?? "—"}</TableCell>
              <TableCell>{previous?.bill_period ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Amount</TableCell>
              <TableCell>{formatMoney(current.amount)}</TableCell>
              <TableCell>
                {previous ? formatMoney(previous.amount) : "—"}
              </TableCell>
              <TableCell>
                {formatSigned(comparison.amount_delta)}{" "}
                <span className="text-muted-foreground">
                  ({formatPct(comparison.amount_pct)})
                </span>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Units</TableCell>
              <TableCell>{units(current.units)}</TableCell>
              <TableCell>
                {previous ? units(previous.units) : "—"}
              </TableCell>
              <TableCell>
                {formatSigned(comparison.units_delta)}{" "}
                <span className="text-muted-foreground">
                  ({formatPct(comparison.units_pct)})
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {comparison.recent.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          Recent amounts:{" "}
          {comparison.recent
            .map(
              (row) =>
                `${formatDate(row.paid_on)} ${formatMoney(row.amount)}`,
            )
            .join(" · ")}
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">AI report</p>
            {model ? (
              <span className="text-xs text-muted-foreground">{model}</span>
            ) : null}
            {generatedAt ? (
              <span className="text-xs text-muted-foreground">
                {new Date(generatedAt).toLocaleString("en-GB")}
              </span>
            ) : null}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {summary}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Numbers above are from logged payments. Generate the AI report to
          explain why this bill came as it did
          {current.has_bill_file
            ? " (it will also read the attached bill)."
            : "."}
        </p>
      )}
    </div>
  );
}
