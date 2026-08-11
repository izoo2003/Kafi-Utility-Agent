"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { SemsAlertFinding } from "@/lib/sems/alert-rules";
import type { SolarLiveSnapshot } from "@/lib/types/database";
import { apiFetch } from "@/lib/dashboard/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fmtKw(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)} kW`;
}

function fmtKwh(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)} kWh`;
}

function fmtPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(0)}%`;
}

/** Fixed locale/TZ so SSR and client markup match (avoids hydration errors). */
function formatFetchedAt(iso: string | null | undefined) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date) + " UTC";
  } catch {
    return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }
}

export function SolarLivePanel({
  initialSnapshot,
  initialAlerts = [],
  configured,
}: {
  initialSnapshot: SolarLiveSnapshot | null;
  initialAlerts?: SemsAlertFinding[];
  configured: boolean;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(
    initialSnapshot?.last_error ?? null,
  );

  async function syncNow() {
    setSyncing(true);
    setError(null);
    try {
      const result = await apiFetch<{
        configured: boolean;
        snapshot: SolarLiveSnapshot | null;
        alerts?: SemsAlertFinding[];
        error: string | null;
      }>("/api/solar/sync", { method: "POST" });

      if (result.snapshot) {
        setSnapshot(result.snapshot);
      }
      if (result.alerts) {
        setAlerts(result.alerts);
      }
      if (result.error) {
        setError(result.error);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!configured) {
    return (
      <section className="space-y-3 rounded-xl border border-dashed border-[oklch(0.86_0.02_185)] bg-[oklch(0.985_0.01_185)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-lg font-semibold">SEMS+ plant</h2>
          <Badge variant="secondary">Not configured</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Set SEMS credentials and station id in <code className="text-xs">.env</code>,
          restart the app, then sync.
        </p>
      </section>
    );
  }

  const powerMetrics = [
    { label: "PV power", value: fmtKw(snapshot?.pv_power_kw) },
    { label: "Load", value: fmtKw(snapshot?.load_power_kw) },
    { label: "Grid", value: fmtKw(snapshot?.grid_power_kw) },
    { label: "Battery power", value: fmtKw(snapshot?.battery_power_kw) },
  ];

  const energyMetrics = [
    { label: "Battery SOC", value: fmtPct(snapshot?.battery_soc_pct) },
    {
      label: "Today generation",
      value: fmtKwh(snapshot?.generation_today_kwh),
    },
    {
      label: "Today consumption",
      value: fmtKwh(snapshot?.consumption_today_kwh),
    },
  ];

  const plantDetails = [
    {
      label: "Station name",
      value: snapshot?.station_name ?? "—",
    },
    {
      label: "Station ID",
      value: snapshot?.station_id ?? "—",
    },
    {
      label: "Last sync",
      value: formatFetchedAt(snapshot?.fetched_at),
    },
    {
      label: "Snapshot updated",
      value: formatFetchedAt(snapshot?.updated_at),
    },
  ];

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">Live power flow</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              These are the live monitored SEMS+ values (PV, load, grid, battery),
              refreshed on Sync / cron — not a continuous websocket. Sync also
              updates today&apos;s monitoring log under Records and auto-flags
              baseline breaches.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={syncNow}
            disabled={syncing}
            className="self-start"
          >
            <RefreshCw
              className={`size-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Auto-alerts</h3>
            {alerts.length === 0 ? (
              <Badge variant="secondary">All clear</Badge>
            ) : (
              <Badge variant="destructive">{alerts.length} active</Badge>
            )}
          </div>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No baseline breaches on the latest reading.
            </p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={
                    alert.severity === "critical"
                      ? "rounded-lg border border-[oklch(0.82_0.08_25)] bg-[oklch(0.97_0.02_25)] px-3 py-2 text-sm"
                      : "rounded-lg border border-[oklch(0.86_0.07_85)] bg-[oklch(0.98_0.02_85)] px-3 py-2 text-sm"
                  }
                >
                  <p className="font-medium">{alert.title}</p>
                  <p className="mt-0.5 text-muted-foreground">{alert.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {powerMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)] px-3 py-3"
            >
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 font-heading text-lg font-semibold tracking-tight">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Energy & battery</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {energyMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-[oklch(0.9_0.02_185)] bg-[oklch(0.99_0.01_185)] px-3 py-3"
            >
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className="mt-1 font-heading text-lg font-semibold tracking-tight">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Plant details</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {plantDetails.map((row) => (
            <div
              key={row.label}
              className="rounded-xl border border-[oklch(0.9_0.02_220)] px-3 py-3"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="mt-1 break-all text-sm font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {snapshot?.raw && Object.keys(snapshot.raw).length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Raw SEMS+ fields</h2>
          <p className="text-sm text-muted-foreground">
            Extra keys returned by the live flow API (for debugging / future KPIs).
          </p>
          <div className="max-h-72 overflow-auto rounded-xl border border-[oklch(0.9_0.02_220)] bg-[oklch(0.985_0.005_220)] p-3">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pb-2 pr-3 font-medium">Field</th>
                  <th className="pb-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(snapshot.raw)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <tr key={key} className="border-t border-[oklch(0.92_0.01_220)]">
                      <td className="py-1.5 pr-3 align-top font-mono text-[oklch(0.4_0.02_230)]">
                        {key}
                      </td>
                      <td className="py-1.5 break-all font-mono">
                        {value == null
                          ? "—"
                          : typeof value === "object"
                            ? JSON.stringify(value)
                            : String(value)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
