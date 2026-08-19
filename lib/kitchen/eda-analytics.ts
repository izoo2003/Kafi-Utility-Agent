import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KitchenConsumptionLog,
  KitchenInventory,
} from "@/lib/types/database";
import { listKitchenInventory } from "@/lib/supabase/kitchen-inventory";
import { listKitchenConsumptionLog } from "@/lib/kitchen/stock-movements";
import { roundQty } from "@/lib/kitchen/consumption";
import {
  buildMonthlyConsumptionReport,
  type MonthlyConsumptionReport,
} from "@/lib/kitchen/monthly-consumption";

export type DailyFlowPoint = {
  date: string;
  label: string;
  in_qty: number;
  out_qty: number;
  net_qty: number;
};

export type TopItemBar = {
  name: string;
  short: string;
  out: number;
  in: number;
  unit: string | null;
};

export type CategorySlice = {
  category: string;
  out: number;
  in: number;
  items: number;
};

export type StockHealthSlice = {
  status: "ok" | "watch" | "low" | "out";
  count: number;
};

export type MonthTrendPoint = {
  month: string;
  label: string;
  out: number;
  in: number;
};

export type KitchenAlertInsight = {
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export type KitchenEdaAnalytics = {
  month: string;
  report: MonthlyConsumptionReport;
  daily_flow: DailyFlowPoint[];
  top_out_items: TopItemBar[];
  category_mix: CategorySlice[];
  stock_health: StockHealthSlice[];
  month_trend: MonthTrendPoint[];
  alerts: KitchenAlertInsight[];
  kpis: {
    avg_daily_out: number;
    peak_out_day: string | null;
    peak_out_qty: number;
    items_out_of_stock: number;
    items_low: number;
    restock_coverage_pct: number | null;
    days_with_activity: number;
  };
};

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function dayLabel(iso: string): string {
  const [, , d] = iso.split("-");
  return d;
}

function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    const [y, m, d] = cur.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cur = next.toISOString().slice(0, 10);
  }
  return out;
}

function shortName(name: string, max = 14): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function buildAlerts(
  report: MonthlyConsumptionReport,
  daily: DailyFlowPoint[],
  kpis: KitchenEdaAnalytics["kpis"],
): KitchenAlertInsight[] {
  const alerts: KitchenAlertInsight[] = [];

  if (kpis.items_out_of_stock > 0) {
    const names = report.lines
      .filter((l) => l.status === "out")
      .slice(0, 5)
      .map((l) => l.item_name);
    alerts.push({
      severity: "critical",
      title: `${kpis.items_out_of_stock} item(s) out of stock`,
      detail: names.length
        ? `Empty now: ${names.join(", ")}. Record In as soon as restocked.`
        : "Restock empty items before the next office day.",
    });
  }

  if (kpis.items_low > 0) {
    const names = report.lines
      .filter((l) => l.status === "low")
      .slice(0, 5)
      .map((l) => l.item_name);
    alerts.push({
      severity: "warning",
      title: `${kpis.items_low} item(s) at/below reorder`,
      detail: names.length
        ? `Low: ${names.join(", ")}.`
        : "Review low-stock thresholds and place orders.",
    });
  }

  if (
    kpis.restock_coverage_pct != null &&
    kpis.restock_coverage_pct < 70 &&
    report.totals.qty_out_sum > 0
  ) {
    alerts.push({
      severity: "warning",
      title: "Restocks lagging consumption",
      detail: `In covered only ${kpis.restock_coverage_pct}% of Out this month — stock may keep dropping.`,
    });
  }

  if (kpis.peak_out_day && kpis.peak_out_qty > 0 && kpis.avg_daily_out > 0) {
    const ratio = kpis.peak_out_qty / Math.max(kpis.avg_daily_out, 0.001);
    if (ratio >= 2.2) {
      alerts.push({
        severity: "info",
        title: "Spike day detected",
        detail: `${kpis.peak_out_day} Out was ${ratio.toFixed(1)}× the daily average (${kpis.peak_out_qty} vs ~${kpis.avg_daily_out}/day).`,
      });
    }
  }

  const lateOutHeavy = daily
    .slice(-7)
    .reduce((s, d) => s + d.out_qty, 0);
  const earlyOut = daily
    .slice(0, Math.max(1, daily.length - 7))
    .reduce((s, d) => s + d.out_qty, 0);
  if (daily.length >= 14 && lateOutHeavy > earlyOut * 1.35 && earlyOut > 0) {
    alerts.push({
      severity: "info",
      title: "Usage rising late in the month",
      detail:
        "Recent 7-day Out is materially higher than earlier days — review top items before month-end.",
    });
  }

  if (alerts.length === 0 && report.totals.qty_out_sum > 0) {
    alerts.push({
      severity: "info",
      title: "Consumption looks steady",
      detail:
        "No critical stock gaps from this month’s ledger. Keep recording In/Out so trends stay accurate.",
    });
  }

  return alerts;
}

/**
 * Exploratory analytics for kitchen inventory: daily flow, top items,
 * category mix, stock health, multi-month trend, and rule-based alerts.
 */
export async function buildKitchenEdaAnalytics(
  supabase: SupabaseClient,
  month: string,
): Promise<KitchenEdaAnalytics> {
  const report = await buildMonthlyConsumptionReport(supabase, month);
  const [{ data: items }, { data: logs }] = await Promise.all([
    listKitchenInventory(supabase),
    listKitchenConsumptionLog(supabase, {
      from: report.start_date,
      to: report.end_date,
    }),
  ]);

  const byDayIn = new Map<string, number>();
  const byDayOut = new Map<string, number>();
  for (const row of (logs ?? []) as KitchenConsumptionLog[]) {
    const delta = Number(row.qty_delta) || 0;
    if (delta > 0) {
      byDayIn.set(
        row.applied_on,
        roundQty((byDayIn.get(row.applied_on) ?? 0) + delta),
      );
    } else if (delta < 0) {
      byDayOut.set(
        row.applied_on,
        roundQty((byDayOut.get(row.applied_on) ?? 0) + -delta),
      );
    }
  }

  const daily_flow: DailyFlowPoint[] = eachDateInclusive(
    report.start_date,
    report.end_date,
  ).map((date) => {
    const in_qty = byDayIn.get(date) ?? 0;
    const out_qty = byDayOut.get(date) ?? 0;
    return {
      date,
      label: dayLabel(date),
      in_qty,
      out_qty,
      net_qty: roundQty(in_qty - out_qty),
    };
  });

  const top_out_items: TopItemBar[] = report.lines
    .filter((l) => l.qty_out_month > 0)
    .slice(0, 10)
    .map((l) => ({
      name: l.item_name,
      short: shortName(l.item_name),
      out: l.qty_out_month,
      in: l.qty_in_month,
      unit: l.unit,
    }));

  const catMap = new Map<string, CategorySlice>();
  for (const line of report.lines) {
    if (line.qty_out_month <= 0 && line.qty_in_month <= 0) continue;
    const key = (line.category || "Uncategorized").trim() || "Uncategorized";
    const cur = catMap.get(key) ?? {
      category: key,
      out: 0,
      in: 0,
      items: 0,
    };
    cur.out = roundQty(cur.out + line.qty_out_month);
    cur.in = roundQty(cur.in + line.qty_in_month);
    cur.items += 1;
    catMap.set(key, cur);
  }
  const category_mix = [...catMap.values()].sort((a, b) => b.out - a.out);

  const healthCounts: Record<StockHealthSlice["status"], number> = {
    ok: 0,
    watch: 0,
    low: 0,
    out: 0,
  };
  for (const item of (items ?? []) as KitchenInventory[]) {
    const stock = Number(item.current_qty) || 0;
    const reorder = Number(item.reorder_level) || 0;
    if (stock <= 0) healthCounts.out += 1;
    else if (stock <= reorder) healthCounts.low += 1;
    else healthCounts.ok += 1;
  }
  const stock_health: StockHealthSlice[] = (
    ["out", "low", "ok"] as const
  ).map((status) => ({ status, count: healthCounts[status] }));

  const months = [0, -1, -2, -3, -4, -5].map((d) => addMonths(month, d)).reverse();
  const trendStart = `${months[0]}-01`;
  const { data: trendLogs, error: trendErr } = await listKitchenConsumptionLog(
    supabase,
    { from: trendStart, to: report.end_date },
  );
  if (trendErr) throw new Error(trendErr.message);

  const monthInTot = new Map<string, number>();
  const monthOutTot = new Map<string, number>();
  for (const row of (trendLogs ?? []) as KitchenConsumptionLog[]) {
    const ym = row.applied_on.slice(0, 7);
    const delta = Number(row.qty_delta) || 0;
    if (delta > 0) {
      monthInTot.set(ym, roundQty((monthInTot.get(ym) ?? 0) + delta));
    } else if (delta < 0) {
      monthOutTot.set(ym, roundQty((monthOutTot.get(ym) ?? 0) + -delta));
    }
  }
  const month_trend: MonthTrendPoint[] = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    out: monthOutTot.get(m) ?? 0,
    in: monthInTot.get(m) ?? 0,
  }));

  const activeDays = daily_flow.filter((d) => d.out_qty > 0 || d.in_qty > 0);
  const outDays = daily_flow.filter((d) => d.out_qty > 0);
  const avg_daily_out = outDays.length
    ? roundQty(
        outDays.reduce((s, d) => s + d.out_qty, 0) / outDays.length,
      )
    : 0;
  let peak_out_day: string | null = null;
  let peak_out_qty = 0;
  for (const d of daily_flow) {
    if (d.out_qty > peak_out_qty) {
      peak_out_qty = d.out_qty;
      peak_out_day = d.date;
    }
  }

  const items_out_of_stock = report.lines.filter((l) => l.status === "out").length;
  const items_low = report.lines.filter((l) => l.status === "low").length;
  const restock_coverage_pct =
    report.totals.qty_out_sum > 0
      ? roundQty(
          (report.totals.qty_in_sum / report.totals.qty_out_sum) * 100,
        )
      : null;

  const kpis = {
    avg_daily_out,
    peak_out_day,
    peak_out_qty,
    items_out_of_stock,
    items_low,
    restock_coverage_pct,
    days_with_activity: activeDays.length,
  };

  return {
    month,
    report,
    daily_flow,
    top_out_items,
    category_mix,
    stock_health,
    month_trend,
    alerts: buildAlerts(report, daily_flow, kpis),
    kpis,
  };
}
