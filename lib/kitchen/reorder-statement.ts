import { formatDate } from "@/lib/format/datetime";
import {
  assessKitchenStock,
  siteTodayIso,
  type KitchenStockLevel,
} from "@/lib/kitchen/consumption";

export type KitchenReorderNotice = {
  status: KitchenStockLevel;
  /** Human statement for table / alerts / chat (not a numeric reorder level). */
  statement: string;
  severity: "none" | "warning" | "critical";
};

/**
 * Reorder guidance as a dated statement (not a raw number).
 * Numeric reorder_level still drives when stock is "low"; this is what operators see.
 */
export function kitchenReorderNotice(
  item: {
    item_name: string;
    current_qty: number;
    reorder_level: number;
    unit?: string | null;
  },
  asOfDate: string = siteTodayIso(),
): KitchenReorderNotice {
  const assessment = assessKitchenStock(item);
  const dateLabel = formatDate(asOfDate);
  const name = item.item_name.trim() || "This item";
  const unit = item.unit?.trim() ? ` ${item.unit.trim()}` : "";
  const qty = `${item.current_qty}${unit}`;

  if (assessment.status === "out") {
    return {
      status: "out",
      severity: "critical",
      statement: `Reorder immediately — ${name} has completely run out (as of ${dateLabel}).`,
    };
  }

  if (assessment.status === "low") {
    return {
      status: "low",
      severity: "warning",
      statement: `Quantity is low on ${dateLabel} (${qty} left) — consider reordering ${name}.`,
    };
  }

  if (assessment.status === "watch") {
    const days =
      assessment.days_remaining != null
        ? ` ~${assessment.days_remaining} day(s) left`
        : "";
    return {
      status: "watch",
      severity: "warning",
      statement: `Quantity may run out soon (as of ${dateLabel}${days}) — consider reordering ${name}.`,
    };
  }

  return {
    status: "ok",
    severity: "none",
    statement: `Stock is sufficient (as of ${dateLabel}) — no reorder needed.`,
  };
}
