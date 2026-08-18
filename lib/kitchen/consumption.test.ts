import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessKitchenStock,
  isSiteWeekday,
  matchConsumptionProfile,
  usageForDate,
} from "./consumption";

describe("kitchen consumption", () => {
  it("matches black tea and weekday burn", () => {
    const p = matchConsumptionProfile("Black Tea");
    assert.ok(p);
    assert.equal(p!.kind, "weekday");
    assert.ok(p!.daily_usage > 0.1);
    assert.equal(usageForDate(p!, "2026-08-16"), 0); // Sunday
    assert.ok(usageForDate(p!, "2026-08-18") > 0); // Tuesday
  });

  it("does not burn durables", () => {
    const p = matchConsumptionProfile("Oven");
    assert.ok(p);
    assert.equal(p!.kind, "none");
    assert.equal(usageForDate(p!, "2026-08-18"), 0);
  });

  it("does not burn company product jelly", () => {
    const p = matchConsumptionProfile("Mango Jelly (Export Leftovers)");
    assert.ok(p);
    assert.equal(p!.kind, "none");
    assert.equal(usageForDate(p!, "2026-08-18"), 0);
  });

  it("flags out / low / watch", () => {
    assert.equal(
      assessKitchenStock({
        item_name: "Green Tea",
        current_qty: 0,
        reorder_level: 1,
      }).status,
      "out",
    );
    assert.equal(
      assessKitchenStock({
        item_name: "Green Tea",
        current_qty: 0.5,
        reorder_level: 1,
      }).status,
      "low",
    );
    assert.equal(isSiteWeekday("2026-08-18"), true);
  });
});
