import type { SupabaseClient } from "@supabase/supabase-js";
import type { KitchenInventory } from "@/lib/types/database";
import { listKitchenInventory } from "@/lib/supabase/kitchen-inventory";
import { listKitchenConsumptionLog } from "@/lib/kitchen/stock-movements";
import { roundQty } from "@/lib/kitchen/consumption";

export type MonthlyConsumptionLine = {
  kitchen_item_id: string;
  item_name: string;
  unit: string | null;
  category: string | null;
  qty_in_month: number;
  qty_out_month: number;
  stock_now: number;
  qty_in_total: number;
  qty_out_total: number;
  cost_per_unit: number | null;
  estimated_out_cost: number | null;
  status: "ok" | "watch" | "low" | "out";
};

export type MonthlyConsumptionReport = {
  month: string; // YYYY-MM
  start_date: string;
  end_date: string;
  lines: MonthlyConsumptionLine[];
  totals: {
    items_with_out: number;
    qty_out_sum: number;
    qty_in_sum: number;
    estimated_out_cost_sum: number | null;
  };
};

function monthBounds(month: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) throw new Error("month must be YYYY-MM");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error("month must be YYYY-MM");
  const start = `${m[1]}-${m[2]}-01`;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const end = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function currentSiteMonth(timeZone = "Asia/Karachi"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${mo}`;
}

/**
 * Monthly consumption from Out movements (negative qty_delta in the log).
 * Also reports In for the same month for guidance.
 */
export async function buildMonthlyConsumptionReport(
  supabase: SupabaseClient,
  month: string,
): Promise<MonthlyConsumptionReport> {
  const { start, end } = monthBounds(month);
  const [{ data: items, error: itemsErr }, { data: logs, error: logsErr }] =
    await Promise.all([
      listKitchenInventory(supabase),
      listKitchenConsumptionLog(supabase, { from: start, to: end }),
    ]);

  if (itemsErr) throw new Error(itemsErr.message);
  if (logsErr) throw new Error(logsErr.message);

  const byId = new Map<string, KitchenInventory>();
  for (const item of items ?? []) byId.set(item.id, item);

  const monthIn = new Map<string, number>();
  const monthOut = new Map<string, number>();

  for (const row of logs ?? []) {
    const delta = Number(row.qty_delta) || 0;
    if (delta > 0) {
      monthIn.set(
        row.kitchen_item_id,
        roundQty((monthIn.get(row.kitchen_item_id) ?? 0) + delta),
      );
    } else if (delta < 0) {
      monthOut.set(
        row.kitchen_item_id,
        roundQty((monthOut.get(row.kitchen_item_id) ?? 0) + -delta),
      );
    }
  }

  const ids = new Set([...monthIn.keys(), ...monthOut.keys(), ...byId.keys()]);
  const lines: MonthlyConsumptionLine[] = [];

  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    const outM = monthOut.get(id) ?? 0;
    const inM = monthIn.get(id) ?? 0;
    // Include items that moved this month, or still have stock / totals.
    if (outM === 0 && inM === 0 && item.current_qty <= 0 && item.qty_out <= 0) {
      continue;
    }
    const cost =
      item.cost_per_unit != null && outM > 0
        ? roundQty(outM * Number(item.cost_per_unit))
        : null;
    const stock = roundQty(Number(item.current_qty) || 0);
    const reorder = Number(item.reorder_level) || 0;
    let status: MonthlyConsumptionLine["status"] = "ok";
    if (stock <= 0) status = "out";
    else if (stock <= reorder) status = "low";

    lines.push({
      kitchen_item_id: id,
      item_name: item.item_name,
      unit: item.unit,
      category: item.category,
      qty_in_month: inM,
      qty_out_month: outM,
      stock_now: stock,
      qty_in_total: roundQty(Number(item.qty_in) || 0),
      qty_out_total: roundQty(Number(item.qty_out) || 0),
      cost_per_unit: item.cost_per_unit,
      estimated_out_cost: cost,
      status,
    });
  }

  lines.sort((a, b) => b.qty_out_month - a.qty_out_month || a.item_name.localeCompare(b.item_name));

  const withOut = lines.filter((l) => l.qty_out_month > 0);
  const costParts = withOut
    .map((l) => l.estimated_out_cost)
    .filter((c): c is number => c != null);
  const estimated =
    costParts.length > 0
      ? roundQty(costParts.reduce((s, n) => s + n, 0))
      : null;

  return {
    month,
    start_date: start,
    end_date: end,
    lines,
    totals: {
      items_with_out: withOut.length,
      qty_out_sum: roundQty(
        withOut.reduce((s, l) => s + l.qty_out_month, 0),
      ),
      qty_in_sum: roundQty(lines.reduce((s, l) => s + l.qty_in_month, 0)),
      estimated_out_cost_sum: estimated,
    },
  };
}
