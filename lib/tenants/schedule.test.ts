import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inclusiveDays,
  ledgerPeriods,
  periodProrateFactor,
} from "./schedule";
import { amountsForPeriod } from "./ledger";

describe("ledgerPeriods rent-day cycles", () => {
  it("builds Waheed-style rows: 14/04–28/08 with a 15-day August stub", () => {
    const rows = ledgerPeriods("2026-04-14", "2026-08-28");
    assert.equal(rows.length, 5);
    assert.deepEqual(
      rows.map((r) => [r.period_start, r.period_end]),
      [
        ["2026-04-14", "2026-05-13"],
        ["2026-05-14", "2026-06-13"],
        ["2026-06-14", "2026-07-13"],
        ["2026-07-14", "2026-08-13"],
        ["2026-08-14", "2026-08-28"],
      ],
    );
    assert.equal(inclusiveDays("2026-08-14", "2026-08-28"), 15);
    assert.equal(periodProrateFactor("2026-08-14", "2026-08-28"), 0.5);
    assert.equal(periodProrateFactor("2026-04-14", "2026-05-13"), 1);
  });

  it("folds a same-day anniversary onto the last full month", () => {
    const rows = ledgerPeriods("2026-05-26", "2026-08-26");
    assert.equal(rows.length, 3);
    assert.equal(rows[2]!.period_start, "2026-07-26");
    assert.equal(rows[2]!.period_end, "2026-08-26");
    assert.equal(periodProrateFactor(rows[2]!.period_start, rows[2]!.period_end), 1);
  });

  it("charges a short-only contract by days / 30", () => {
    const rows = ledgerPeriods("2026-04-14", "2026-04-20");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.period_start, "2026-04-14");
    assert.equal(rows[0]!.period_end, "2026-04-20");
    assert.equal(periodProrateFactor("2026-04-14", "2026-04-20"), 7 / 30);
  });

  it("halves 600,000 gross rent for a 15-day stub", () => {
    const billed = amountsForPeriod({
      period_start: "2026-08-14",
      period_end: "2026-08-28",
      gross_rent: 600_000,
      line_items: [],
      classification: "unofficial",
      slabs: [],
    });
    assert.equal(billed.factor, 0.5);
    assert.equal(billed.gross_rent, 300_000);
    assert.equal(billed.total_due, 300_000);
  });
});
