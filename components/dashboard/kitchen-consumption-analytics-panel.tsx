"use client";

import { useCallback, useEffect, useState } from "react";
import type { MonthlyConsumptionReport } from "@/lib/kitchen/monthly-consumption";
import type { KitchenEdaAnalytics } from "@/lib/kitchen/eda-analytics";
import { apiFetch } from "@/lib/dashboard/api-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { KitchenSectionNav } from "@/components/dashboard/kitchen-section-nav";
import { KitchenEdaCharts } from "@/components/dashboard/kitchen-eda-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function KitchenConsumptionAnalyticsPanel() {
  const [month, setMonth] = useState(currentMonthValue);
  const [report, setReport] = useState<MonthlyConsumptionReport | null>(null);
  const [eda, setEda] = useState<KitchenEdaAnalytics | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  const loadMonthly = useCallback(async () => {
    setMonthLoading(true);
    setMonthError(null);
    try {
      const data = await apiFetch<{
        eda: KitchenEdaAnalytics;
        report: MonthlyConsumptionReport;
      }>(`/api/kitchen-inventory/monthly?month=${encodeURIComponent(month)}`);
      setEda(data.eda);
      setReport(data.report);
    } catch (e) {
      setMonthError(e instanceof Error ? e.message : "Failed to load month");
      setReport(null);
      setEda(null);
    } finally {
      setMonthLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadMonthly();
  }, [loadMonthly]);

  async function generateAiSummary() {
    setAiLoading(true);
    setMonthError(null);
    try {
      const data = await apiFetch<{
        eda: KitchenEdaAnalytics;
        report: MonthlyConsumptionReport;
        ai: { summary: string };
      }>("/api/kitchen-inventory/monthly", {
        method: "POST",
        body: JSON.stringify({ month }),
      });
      setEda(data.eda);
      setReport(data.report);
      setAiSummary(data.ai.summary);
    } catch (e) {
      setMonthError(e instanceof Error ? e.message : "AI summary failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kitchen · Consumption Analytics"
        description="Exploratory charts and AI insights from In/Out history. Monthly consumption is based on Out."
        icon="kitchen"
        accent="amber"
      />

      <KitchenSectionNav active="analytics" />

      <section className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 via-white to-stone-50 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-amber-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-heading text-base font-semibold text-stone-900">
              Monthly consumption
            </h2>
            <p className="text-xs text-muted-foreground">
              Charts + alerts from Out movements. Use AI for findings, risks, and
              actions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              className="h-9 w-[10.5rem] bg-white"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setAiSummary(null);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadMonthly()}
              disabled={monthLoading}
            >
              {monthLoading ? "Loading…" : "Refresh"}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void generateAiSummary()}
              disabled={aiLoading || monthLoading}
            >
              {aiLoading ? "Analyzing…" : "AI EDA insights"}
            </Button>
          </div>
        </div>

        {monthError ? (
          <p className="px-4 py-2 text-sm text-destructive" role="alert">
            {monthError}
          </p>
        ) : null}

        {report ? (
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-5">
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/70">
                In this month
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">
                {report.totals.qty_in_sum}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-rose-800/70">
                Out this month
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-900">
                {report.totals.qty_out_sum}
              </p>
              <p className="mt-1 text-xs text-rose-800/70">
                {report.totals.items_with_out} item
                {report.totals.items_with_out === 1 ? "" : "s"} consumed
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Est. Out cost
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                {report.totals.estimated_out_cost_sum == null
                  ? "—"
                  : report.totals.estimated_out_cost_sum.toLocaleString()}
              </p>
            </div>
          </div>
        ) : null}

        {eda ? (
          <div className="border-t border-amber-100 px-3 py-4 sm:px-5">
            <KitchenEdaCharts data={eda} />
          </div>
        ) : monthLoading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
            Building charts…
          </p>
        ) : null}

        {aiSummary ? (
          <div className="border-t border-amber-100 bg-white/80 px-4 py-4 sm:px-5">
            <h3 className="text-sm font-semibold text-stone-900">
              AI exploratory insights
            </h3>
            <div className="prose prose-sm mt-2 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
              {aiSummary}
            </div>
          </div>
        ) : (
          <p className="border-t border-amber-100 px-4 py-3 text-xs text-muted-foreground sm:px-5">
            Charts load automatically. Click{" "}
            <span className="font-medium">AI EDA insights</span> for findings,
            alerts, trends, and next actions.
          </p>
        )}

        {report && report.lines.some((l) => l.qty_out_month > 0 || l.qty_in_month > 0) ? (
          <div className="overflow-x-auto border-t border-amber-100">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50/90 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium sm:px-5">Item</th>
                  <th className="px-3 py-2 font-medium">In</th>
                  <th className="px-3 py-2 font-medium">Out</th>
                  <th className="px-3 py-2 font-medium">Stock now</th>
                  <th className="px-4 py-2 font-medium sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.lines
                  .filter((l) => l.qty_out_month > 0 || l.qty_in_month > 0)
                  .slice(0, 20)
                  .map((line) => (
                    <tr
                      key={line.kitchen_item_id}
                      className="border-t border-stone-100"
                    >
                      <td className="px-4 py-2.5 sm:px-5">
                        <span className="font-medium text-stone-900">
                          {line.item_name}
                        </span>
                        {line.unit ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({line.unit})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-emerald-700">
                        {line.qty_in_month}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-rose-700">
                        {line.qty_out_month}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium">
                        {line.stock_now}
                      </td>
                      <td className="px-4 py-2.5 sm:px-5">
                        <Badge
                          variant={
                            line.status === "ok" ? "secondary" : "destructive"
                          }
                        >
                          {line.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
