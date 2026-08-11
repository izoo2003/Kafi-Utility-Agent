import type { OpsAlert } from "@/lib/alerts/types";
import type { SolarLiveSnapshot } from "@/lib/types/database";

export type SemsAlertThresholds = {
  socMinPct: number;
  daytimePvMinKw: number;
  staleMinutes: number;
  dayStartHour: number;
  dayEndHour: number;
  timeZone: string;
};

export type SemsAlertFinding = {
  id: string;
  severity: OpsAlert["severity"];
  title: string;
  detail: string;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getSemsAlertThresholds(
  timeZone = process.env.SEMS_TIMEZONE?.trim() || "Asia/Karachi",
): SemsAlertThresholds {
  return {
    socMinPct: envNumber("SEMS_ALERT_SOC_MIN", 20),
    daytimePvMinKw: envNumber("SEMS_ALERT_PV_DAYTIME_MIN_KW", 0.1),
    staleMinutes: envNumber("SEMS_ALERT_STALE_MINUTES", 45),
    dayStartHour: envNumber("SEMS_ALERT_DAY_START_HOUR", 9),
    dayEndHour: envNumber("SEMS_ALERT_DAY_END_HOUR", 16),
    timeZone,
  };
}

function localHour(timeZone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}

function isDaytime(thresholds: SemsAlertThresholds, at: Date = new Date()) {
  const hour = localHour(thresholds.timeZone, at);
  return hour >= thresholds.dayStartHour && hour < thresholds.dayEndHour;
}

export type LiveMetricsInput = {
  fetchedAt?: string | null;
  lastError?: string | null;
  pvPowerKw?: number | null;
  batterySocPct?: number | null;
  generationTodayKwh?: number | null;
  /** When true, treat as a failed sync (critical). */
  syncFailed?: boolean;
};

/** Evaluate SEMS live metrics against baselines (used on sync + Home alerts). */
export function evaluateSemsAlerts(
  metrics: LiveMetricsInput,
  thresholds: SemsAlertThresholds = getSemsAlertThresholds(),
  now: Date = new Date(),
): SemsAlertFinding[] {
  const findings: SemsAlertFinding[] = [];

  if (metrics.syncFailed || metrics.lastError) {
    findings.push({
      id: "sems-sync-error",
      severity: "critical",
      title: "SEMS+ sync failed",
      detail:
        metrics.lastError?.trim() ||
        "Could not fetch live plant data from SEMS+.",
    });
  }

  if (metrics.fetchedAt) {
    const ageMs = now.getTime() - new Date(metrics.fetchedAt).getTime();
    const ageMinutes = ageMs / (60 * 1000);
    if (Number.isFinite(ageMinutes) && ageMinutes > thresholds.staleMinutes) {
      findings.push({
        id: "sems-stale",
        severity: "warning",
        title: "SEMS+ data is stale",
        detail: `Last successful reading was ${Math.round(ageMinutes)} minutes ago (threshold ${thresholds.staleMinutes} min).`,
      });
    }
  } else if (!metrics.syncFailed) {
    findings.push({
      id: "sems-no-snapshot",
      severity: "warning",
      title: "No SEMS+ snapshot yet",
      detail: "Sync the SEMS+ section to start monitoring live plant values.",
    });
  }

  // Skip metric baselines when the latest sync itself failed (error already raised).
  if (!metrics.syncFailed && !metrics.lastError) {
    if (
      metrics.batterySocPct != null &&
      metrics.batterySocPct < thresholds.socMinPct
    ) {
      findings.push({
        id: "sems-low-soc",
        severity: "critical",
        title: "Battery SOC below baseline",
        detail: `Battery at ${metrics.batterySocPct.toFixed(0)}% (baseline ${thresholds.socMinPct}%).`,
      });
    }

    if (
      isDaytime(thresholds, now) &&
      metrics.pvPowerKw != null &&
      metrics.pvPowerKw < thresholds.daytimePvMinKw
    ) {
      findings.push({
        id: "sems-low-pv-daytime",
        severity: "warning",
        title: "Low PV output during daytime",
        detail: `PV at ${metrics.pvPowerKw.toFixed(2)} kW during daytime hours ${thresholds.dayStartHour}:00–${thresholds.dayEndHour}:00 (baseline ${thresholds.daytimePvMinKw} kW).`,
      });
    }
  }

  return findings;
}

export function evaluateSnapshotAlerts(
  snapshot: SolarLiveSnapshot | null,
  thresholds?: SemsAlertThresholds,
): SemsAlertFinding[] {
  if (!snapshot) {
    return evaluateSemsAlerts({}, thresholds);
  }
  return evaluateSemsAlerts(
    {
      fetchedAt: snapshot.last_error ? null : snapshot.fetched_at,
      lastError: snapshot.last_error,
      pvPowerKw: snapshot.pv_power_kw,
      batterySocPct: snapshot.battery_soc_pct,
      generationTodayKwh: snapshot.generation_today_kwh,
      syncFailed: Boolean(snapshot.last_error),
    },
    thresholds,
  );
}

export function findingsToOpsAlerts(
  findings: SemsAlertFinding[],
): OpsAlert[] {
  return findings.map((f) => ({
    id: f.id,
    domain: "solar" as const,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
    href: "/dashboard/solar/sems",
  }));
}

export function formatAlertNotes(findings: SemsAlertFinding[]): string {
  if (findings.length === 0) return "Synced from SEMS+";
  return `SEMS+ auto-alert: ${findings.map((f) => f.title).join("; ")}`;
}
