"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SolarSitePublic } from "@/lib/sems/sites";
import { useSolarSiteId } from "@/lib/dashboard/use-solar-site";
import { apiFetch } from "@/lib/dashboard/api-client";
import { SolarSiteOfflineNotice } from "@/components/dashboard/solar-site-offline-notice";
import { SolarSiteStaticNotice } from "@/components/dashboard/solar-site-static-notice";
import type { SolarEnergySummary } from "@/lib/solar/energy-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GEN = "#0d9488";
const USE = "#ea580c";
const EXP = "#16a34a";

function fmtKwh(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
  return `${value.toFixed(2)} kWh`;
}

function fmtDelta(pct: number | null | undefined) {
  if (pct == null) return "vs last month —";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs last month`;
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-teal-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="h-56 w-full sm:h-64">{children}</div>
    </div>
  );
}

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function SolarEnergySummaryPanel(
  props: {
    sites: SolarSitePublic[];
    initialSiteId: string;
    initialMonth?: string;
  },
) {
  return (
    <Suspense
      fallback={
        <div className="h-48 animate-pulse rounded-xl border border-teal-100 bg-teal-50/30" />
      }
    >
      <SolarEnergySummaryPanelInner {...props} />
    </Suspense>
  );
}

function SolarEnergySummaryPanelInner({
  sites,
  initialSiteId,
  initialMonth,
}: {
  sites: SolarSitePublic[];
  initialSiteId: string;
  initialMonth?: string;
}) {
  const { siteId, site, isOffline, isStatic } = useSolarSiteId(sites, initialSiteId);
  const [month, setMonth] = useState(initialMonth || currentMonthValue());
  const [summary, setSummary] = useState<SolarEnergySummary | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isOffline) {
      setSummary(null);
      setAiText(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ summary: SolarEnergySummary }>(
        `/api/solar/energy-summary?site=${encodeURIComponent(siteId)}&month=${encodeURIComponent(month)}`,
      );
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load summary");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [siteId, month, isOffline]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAi() {
    if (isOffline) return;
    setAiLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        summary: SolarEnergySummary;
        ai: { summary: string };
      }>("/api/solar/energy-summary", {
        method: "POST",
        body: JSON.stringify({ month, site: siteId }),
      });
      setSummary(data.summary);
      setAiText(data.ai.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI summary failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {isOffline ? <SolarSiteOfflineNotice siteLabel={site?.label} /> : null}
      {isStatic ? <SolarSiteStaticNotice siteLabel={site?.label} /> : null}

      {!isOffline ? (
      <>
      <div className="flex flex-col gap-3 rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 via-white to-stone-50 px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="font-heading text-lg font-semibold text-stone-900">
            Solar Energy Summary
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Monthly generated, consumed, and grid-exported units — with
            comparison charts and AI briefing.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input
            type="month"
            className="h-9 w-[10.5rem] bg-white"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setAiText(null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void runAi()}
            disabled={aiLoading || loading}
          >
            {aiLoading ? "Analyzing…" : "AI monthly summary"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              title="Monthly Generated Units"
              value={fmtKwh(summary.generated_kwh)}
              hint={fmtDelta(summary.vs_prev.generated_pct)}
              accent="teal"
            />
            <KpiCard
              title="Monthly Consumed Units"
              value={fmtKwh(summary.consumed_kwh)}
              hint={fmtDelta(summary.vs_prev.consumed_pct)}
              accent="orange"
            />
            <KpiCard
              title="Units Exported to Grid"
              value={fmtKwh(summary.exported_kwh)}
              hint={fmtDelta(summary.vs_prev.exported_pct)}
              accent="green"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat
              label="To Load (self-used)"
              value={fmtKwh(summary.to_load_kwh)}
            />
            <MiniStat
              label="Self-consumption"
              value={
                summary.self_consumption_pct == null
                  ? "—"
                  : `${summary.self_consumption_pct}%`
              }
            />
            <MiniStat
              label="Export share of gen"
              value={
                summary.export_pct == null ? "—" : `${summary.export_pct}%`
              }
            />
          </div>

          {summary.alerts.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {summary.alerts.map((a) => (
                <div
                  key={`${a.severity}-${a.title}`}
                  className={
                    a.severity === "critical"
                      ? "rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-3"
                      : a.severity === "warning"
                        ? "rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-3"
                        : "rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-3"
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-900">
                      {a.title}
                    </p>
                    <Badge
                      variant={
                        a.severity === "critical"
                          ? "destructive"
                          : a.severity === "warning"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {a.severity}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-stone-700">
                    {a.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="This month vs last month"
              subtitle="Generated · Consumed · Exported"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.comparison_bars}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v) => [`${Number(v).toFixed(2)} kWh`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="this_month"
                    name="This month"
                    fill={GEN}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="last_month"
                    name="Last month"
                    fill="#94a3b8"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="6-month energy trend"
              subtitle="Generated, consumed, and grid export"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.month_trend}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v) => [`${Number(v).toFixed(2)} kWh`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="generated_kwh"
                    name="Generated"
                    fill={GEN}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="consumed_kwh"
                    name="Consumed"
                    fill={USE}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="exported_kwh"
                    name="Exported"
                    fill={EXP}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Daily units (from logs)"
              subtitle="Generation, consumption, and export within the month"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={summary.daily}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date ?? ""
                    }
                    formatter={(v) => [`${Number(v).toFixed(2)} kWh`, ""]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="generated_kwh"
                    name="Generated"
                    stroke={GEN}
                    fill={GEN}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="consumed_kwh"
                    name="Consumed"
                    stroke={USE}
                    fill={USE}
                    fillOpacity={0.14}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="exported_kwh"
                    name="Exported"
                    stroke={EXP}
                    fill={EXP}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-stone-900">
                Month comparison snapshot
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Side-by-side with{" "}
                {summary.previous?.label ?? "previous month"}
              </p>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                    <th className="pb-2 font-medium">Metric</th>
                    <th className="pb-2 font-medium">This month</th>
                    <th className="pb-2 font-medium">Last month</th>
                    <th className="pb-2 font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  <CompareRow
                    label="Generated"
                    a={summary.generated_kwh}
                    b={summary.previous?.generated_kwh ?? null}
                    delta={summary.vs_prev.generated_pct}
                  />
                  <CompareRow
                    label="Consumed"
                    a={summary.consumed_kwh}
                    b={summary.previous?.consumed_kwh ?? null}
                    delta={summary.vs_prev.consumed_pct}
                  />
                  <CompareRow
                    label="Exported"
                    a={summary.exported_kwh}
                    b={summary.previous?.exported_kwh ?? null}
                    delta={summary.vs_prev.exported_pct}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {aiText ? (
            <div className="rounded-2xl border border-teal-100 bg-white/90 px-4 py-4 shadow-sm sm:px-5">
              <h3 className="text-sm font-semibold text-stone-900">
                AI monthly energy summary
              </h3>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                {aiText}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Charts load from SEMS+ (month totals) and monitoring logs (daily /
              history). Click{" "}
              <span className="font-medium">AI monthly summary</span> for a
              written briefing.
            </p>
          )}
        </>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          Loading solar energy summary…
        </p>
      ) : null}
      </>
      ) : null}
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  accent: "teal" | "orange" | "green";
}) {
  const styles =
    accent === "teal"
      ? "border-teal-200 bg-teal-50/70"
      : accent === "orange"
        ? "border-orange-200 bg-orange-50/70"
        : "border-emerald-200 bg-emerald-50/70";
  return (
    <div className={`rounded-2xl border px-4 py-4 ${styles}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-600">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-stone-600">{hint}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-stone-900">
        {value}
      </p>
    </div>
  );
}

function CompareRow({
  label,
  a,
  b,
  delta,
}: {
  label: string;
  a: number | null;
  b: number | null;
  delta: number | null;
}) {
  return (
    <tr className="border-t border-stone-100">
      <td className="py-2.5 font-medium text-stone-800">{label}</td>
      <td className="py-2.5">{fmtKwh(a)}</td>
      <td className="py-2.5 text-stone-600">{fmtKwh(b)}</td>
      <td className="py-2.5">
        {delta == null ? (
          "—"
        ) : (
          <span
            className={
              delta > 0
                ? "text-emerald-700"
                : delta < 0
                  ? "text-rose-700"
                  : "text-stone-600"
            }
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
      </td>
    </tr>
  );
}
