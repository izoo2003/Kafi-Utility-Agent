"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/dashboard/api-client";
import type { SolarSitePublic } from "@/lib/sems/sites";
import { useSolarSiteId } from "@/lib/dashboard/use-solar-site";
import { SolarSiteOfflineNotice } from "@/components/dashboard/solar-site-offline-notice";
import { SolarSiteStaticNotice } from "@/components/dashboard/solar-site-static-notice";
import type { ConsumptionPeriod, ConsumptionStats } from "@/lib/sems/consumption-stats";
import { Button } from "@/components/ui/button";

type ApiPayload = {
  stats: ConsumptionStats;
  station_name?: string | null;
};

function fmtKwh(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} MWh`;
  return `${value.toFixed(2)} kWh`;
}

function pct(part: number | null | undefined, total: number | null | undefined) {
  if (part == null || total == null || total <= 0) return "—";
  return `${((part / total) * 100).toFixed(2)} %`;
}

function shiftAnchor(iso: string, period: ConsumptionPeriod, dir: -1 | 1) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (period === "day") dt.setUTCDate(dt.getUTCDate() + dir);
  else if (period === "week") dt.setUTCDate(dt.getUTCDate() + dir * 7);
  else if (period === "month") dt.setUTCMonth(dt.getUTCMonth() + dir);
  else dt.setUTCFullYear(dt.getUTCFullYear() + dir);
  return dt.toISOString().slice(0, 10);
}

function labelForPeriod(stats: ConsumptionStats) {
  if (stats.period === "day") {
    const [y, m, d] = stats.start_date.split("-");
    return `${d}/${m}/${y}`;
  }
  if (stats.period === "week") {
    const [y, m, d] = stats.start_date.split("-");
    // ISO week-ish display like SEMS "34/2026"
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    const oneJan = new Date(Date.UTC(Number(y), 0, 1));
    const week = Math.ceil(
      ((date.getTime() - oneJan.getTime()) / 86_400_000 + oneJan.getUTCDay() + 1) /
        7,
    );
    return `${week}/${y}`;
  }
  if (stats.period === "month") {
    const [y, m] = stats.start_date.split("-");
    return `${m}/${y}`;
  }
  return stats.start_date.slice(0, 4);
}

function Donut({
  left,
  right,
  leftColor,
  rightColor,
}: {
  left: number;
  right: number;
  leftColor: string;
  rightColor: string;
}) {
  const total = Math.max(left + right, 0.0001);
  const leftDeg = (left / total) * 360;
  return (
    <div
      className="mx-auto size-36 rounded-full"
      style={{
        background: `conic-gradient(${leftColor} 0deg ${leftDeg}deg, ${rightColor} ${leftDeg}deg 360deg)`,
        boxShadow: "inset 0 0 0 18px #0b0f14",
      }}
      aria-hidden
    />
  );
}

function SplitCard({
  title,
  total,
  leftLabel,
  leftValue,
  leftPct,
  rightLabel,
  rightValue,
  rightPct,
  leftColor,
  rightColor,
}: {
  title: string;
  total: number | null;
  leftLabel: string;
  leftValue: number | null;
  leftPct: string;
  rightLabel: string;
  rightValue: number | null;
  rightPct: string;
  leftColor: string;
  rightColor: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#121820] text-white shadow-lg">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-medium tracking-wide text-white/80">
          {title}
        </h3>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-5 sm:gap-4 sm:px-5">
        <div
          className="rounded-xl px-3 py-4 text-left"
          style={{
            backgroundImage: `linear-gradient(to right, color-mix(in srgb, ${leftColor} 35%, transparent), transparent)`,
          }}
        >
          <p className="text-xs text-white/60">{leftLabel}</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl">
            {fmtKwh(leftValue)}
          </p>
          <p className="mt-3 text-xs text-white/50">{leftPct}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Donut
            left={leftValue ?? 0}
            right={rightValue ?? 0}
            leftColor={leftColor}
            rightColor={rightColor}
          />
          <p className="text-sm font-medium text-sky-300">{fmtKwh(total)}</p>
        </div>
        <div
          className="rounded-xl px-3 py-4 text-right"
          style={{
            backgroundImage: `linear-gradient(to left, color-mix(in srgb, ${rightColor} 35%, transparent), transparent)`,
          }}
        >
          <p className="text-xs text-white/60">{rightLabel}</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl">
            {fmtKwh(rightValue)}
          </p>
          <p className="mt-3 text-xs text-white/50">{rightPct}</p>
        </div>
      </div>
    </section>
  );
}

export function SolarConsumptionPanel(
  props: {
    sites: SolarSitePublic[];
    initialSiteId: string;
    initialDate: string;
  },
) {
  return (
    <Suspense
      fallback={
        <div className="h-48 animate-pulse rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)]" />
      }
    >
      <SolarConsumptionPanelInner {...props} />
    </Suspense>
  );
}

function SolarConsumptionPanelInner({
  sites,
  initialSiteId,
  initialDate,
}: {
  sites: SolarSitePublic[];
  initialSiteId: string;
  initialDate: string;
}) {
  const { siteId, site, isOffline, isStatic } = useSolarSiteId(sites, initialSiteId);
  const [period, setPeriod] = useState<ConsumptionPeriod>("day");
  const [anchor, setAnchor] = useState(initialDate);
  const [stats, setStats] = useState<ConsumptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (isOffline) {
      setStats(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ApiPayload>(
        `/api/solar/consumption?site=${encodeURIComponent(siteId)}&period=${period}&date=${encodeURIComponent(anchor)}`,
      );
      setStats(result.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [siteId, period, anchor, isOffline]);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncToday() {
    setSyncing(true);
    setError(null);
    try {
      await apiFetch(`/api/solar/sync?site=${encodeURIComponent(siteId)}`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (isOffline) {
    return (
      <div className="space-y-4">
        <SolarSiteOfflineNotice siteLabel={site?.label} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isStatic ? <SolarSiteStaticNotice siteLabel={site?.label} /> : null}
      <div className="flex flex-col gap-3 rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div>
          <p className="text-sm font-medium">Consumption Monitoring</p>
          <p className="text-xs text-muted-foreground">
            {isStatic
              ? "Archived splits built from imported monitoring logs. Use the date arrows to browse historical days."
              : "SEMS+ style split: generation To Load vs To Grid, and consumption From PV&BAT vs From Grid."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-background px-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setAnchor((d) => shiftAnchor(d, period, -1))}
              aria-label="Previous period"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-24 text-center text-sm font-medium">
              {stats ? labelForPeriod(stats) : anchor}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setAnchor((d) => shiftAnchor(d, period, 1))}
              aria-label="Next period"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <select
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value as ConsumptionPeriod)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || syncing}
          >
            <RefreshCw className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void syncToday()}
            disabled={loading || syncing || isStatic}
            className={isStatic ? "hidden" : undefined}
          >
            {syncing ? "Syncing…" : "Sync today"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">Loading SEMS+ stats…</p>
      ) : stats ? (
        <div className="space-y-4">
          <SplitCard
            title="AC Generation"
            total={stats.generation_kwh}
            leftLabel="To Load"
            leftValue={stats.to_load_kwh}
            leftPct={pct(stats.to_load_kwh, stats.generation_kwh)}
            rightLabel="To Grid"
            rightValue={stats.to_grid_kwh}
            rightPct={pct(stats.to_grid_kwh, stats.generation_kwh)}
            leftColor="#f97316"
            rightColor="#22c55e"
          />
          <SplitCard
            title="Energy Consumption"
            total={stats.consumption_kwh}
            leftLabel="From PV&BAT"
            leftValue={stats.from_pv_bat_kwh}
            leftPct={pct(stats.from_pv_bat_kwh, stats.consumption_kwh)}
            rightLabel="From Grid"
            rightValue={stats.from_grid_kwh}
            rightPct={pct(stats.from_grid_kwh, stats.consumption_kwh)}
            leftColor="#f97316"
            rightColor="#38bdf8"
          />
        </div>
      ) : null}
    </div>
  );
}
