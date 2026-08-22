"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Calculator, RefreshCw } from "lucide-react";
import type { SolarSitePublic } from "@/lib/sems/sites";
import type { KeBillExtraction } from "@/lib/solar/net-metering-ai";
import type { NetMeteringRowResult } from "@/lib/solar/net-metering-calc";
import { formatRs } from "@/lib/solar/net-metering-calc";
import type { SolarNetMeteringLog } from "@/lib/supabase/solar-net-metering";
import { apiFetch } from "@/lib/dashboard/api-client";
import { useSolarSiteId } from "@/lib/dashboard/use-solar-site";
import { PageHeader } from "@/components/dashboard/page-header";
import { SolarSectionNav } from "@/components/dashboard/solar-section-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type AnalysisResult = {
  extraction: KeBillExtraction;
  calculation: NetMeteringRowResult;
  formatted: Record<string, string>;
  narrative: string;
  sems_export_kwh: number | null;
  log: SolarNetMeteringLog | null;
  ledger: SolarNetMeteringLog[];
};

export function SolarNetMeteringPanel(
  props: {
    sites: SolarSitePublic[];
    initialSiteId: string;
    initialLogs: SolarNetMeteringLog[];
  },
) {
  return (
    <Suspense
      fallback={
        <div className="h-48 animate-pulse rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)]" />
      }
    >
      <SolarNetMeteringPanelInner {...props} />
    </Suspense>
  );
}

function SolarNetMeteringPanelInner({
  sites,
  initialSiteId,
  initialLogs,
}: {
  sites: SolarSitePublic[];
  initialSiteId: string;
  initialLogs: SolarNetMeteringLog[];
}) {
  const { siteId } = useSolarSiteId(sites, initialSiteId);
  const [file, setFile] = useState<File | null>(null);
  const [previousBalance, setPreviousBalance] = useState("");
  const [logs, setLogs] = useState(initialLogs);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ledger = useMemo(
    () =>
      [...logs].sort((a, b) =>
        (b.bill_month ?? "").localeCompare(a.bill_month ?? ""),
      ),
    [logs],
  );

  const loadLogs = useCallback(async () => {
    try {
      const data = await apiFetch<{ logs: SolarNetMeteringLog[] }>(
        "/api/solar/net-metering",
      );
      setLogs(data.logs);
    } catch {
      /* keep existing */
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function analyze() {
    if (!file) {
      setError("Upload a K-Electric bill PDF first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("site", siteId);
      if (previousBalance.trim()) {
        form.append("previous_balance_rs", previousBalance.trim());
      }
      form.append("save", "1");

      const res = await fetch("/api/solar/net-metering", {
        method: "POST",
        body: form,
      });
      const payload = (await res.json()) as {
        error?: string;
        data?: AnalysisResult;
        extraction?: KeBillExtraction;
      };
      if (!res.ok) {
        throw new Error(payload.error ?? `Request failed (${res.status})`);
      }
      if (!payload.data) throw new Error("Empty response");
      setResult(payload.data);
      setLogs(payload.data.ledger);
      if (payload.data.extraction.previous_balance_rs != null && !previousBalance) {
        setPreviousBalance(String(payload.data.extraction.previous_balance_rs));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solar · Net Metering"
        description="Upload a K-Electric bill to extract net metering credits, compute your running balance, and estimate the refundable amount from KE."
        icon="solar"
        accent="teal"
      />

      <SolarSectionNav active="net-metering" sites={sites} />

      <section className="space-y-4 rounded-xl border border-[oklch(0.88_0.04_145)] bg-[oklch(0.98_0.02_145)] px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 size-5 shrink-0 text-teal-700" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How the balance works</p>
            <p className="mt-1">
              Each month:{" "}
              <span className="font-mono text-xs">
                Gross balance = Previous balance + Net metering credit − Grid
                consumed cost
              </span>
              . When gross balance is positive, that is your estimated KE
              refund (apply to K-Electric like in your spreadsheet).
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-[oklch(0.9_0.02_185)] bg-white/80 px-4 py-4 sm:px-5">
        <h2 className="text-lg font-medium">Upload KE bill</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="previous-balance">Previous balance (Rs)</Label>
            <Input
              id="previous-balance"
              type="number"
              min="0"
              step="any"
              placeholder="Previous dues / last net balance"
              value={previousBalance}
              onChange={(e) => setPreviousBalance(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the bill&apos;s carry-forward or your last
              saved net balance for this account.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="ke-bill">K-Electric bill (PDF or image)</Label>
            <Input
              id="ke-bill"
              type="file"
              accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void analyze()} disabled={loading}>
            {loading ? (
              <>
                <RefreshCw className="mr-1 size-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Upload className="mr-1 size-4" />
                Calculate net metering
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadLogs()}
            disabled={loading}
          >
            Refresh ledger
          </Button>
        </div>
      </section>

      {result ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Net metering credit"
              value={formatRs(result.extraction.net_metering_rs)}
            />
            <MetricCard
              label="Grid consumed cost"
              value={formatRs(result.extraction.consumed_rs)}
            />
            <MetricCard
              label="Gross balance"
              value={formatRs(result.calculation.gross_balance_rs)}
              highlight
            />
            <MetricCard
              label="Estimated KE refund"
              value={formatRs(result.calculation.estimated_refund_rs)}
              accent="green"
            />
          </div>

          <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="font-medium">This month</h3>
              {result.extraction.bill_period_label ? (
                <Badge variant="secondary">
                  {result.extraction.bill_period_label}
                </Badge>
              ) : null}
              {result.extraction.confidence ? (
                <Badge variant="outline">
                  AI confidence: {result.extraction.confidence}
                </Badge>
              ) : null}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Account" value={result.extraction.ke_account_number} />
              <Row label="Consumer" value={result.extraction.consumer_name} />
              <Row
                label="Previous balance"
                value={formatRs(
                  result.log?.previous_balance_rs ??
                    (previousBalance ? Number(previousBalance) : null) ??
                    result.extraction.previous_balance_rs,
                )}
              />
              <Row
                label="Payable on bill"
                value={formatRs(result.extraction.payable_rs)}
              />
              <Row
                label="Net balance after refund"
                value={formatRs(result.calculation.net_balance_rs)}
              />
              {result.sems_export_kwh != null ? (
                <Row
                  label="SEMS export (same month)"
                  value={`${result.sems_export_kwh.toFixed(2)} kWh`}
                />
              ) : null}
            </dl>
            {result.extraction.extraction_notes ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {result.extraction.extraction_notes}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-[oklch(0.9_0.02_220)] bg-[oklch(0.985_0.005_220)] p-4">
            <h3 className="mb-2 font-medium">AI briefing</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-muted-foreground">
              {result.narrative}
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Net metering ledger</h2>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Net metering</TableHead>
                <TableHead className="text-right">Consumed</TableHead>
                <TableHead className="text-right">Gross balance</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead className="text-right">Net balance</TableHead>
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No saved calculations yet. Upload a KE bill above.
                  </TableCell>
                </TableRow>
              ) : (
                ledger.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.bill_period_label ?? row.bill_month ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatRs(row.net_metering_rs)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatRs(row.consumed_rs)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatRs(row.gross_balance_rs)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.refund_rs > 0 ? formatRs(row.refund_rs) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatRs(row.net_balance_rs)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.ke_account_number ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: "green";
}) {
  return (
    <div
      className={
        accent === "green"
          ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3"
          : highlight
            ? "rounded-xl border border-teal-200 bg-teal-50 px-4 py-3"
            : "rounded-xl border border-[oklch(0.9_0.02_185)] bg-white px-4 py-3"
      }
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-semibold tracking-tight">
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </div>
  );
}
