import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  breakdownFromStored,
  computeBrokerCommission,
  monthlyRentForBroker,
  occupancyStay,
  stayLabel,
} from "./broker-commission";

function moneyish(n: number) {
  return Math.round(n * 100) / 100;
}

describe("occupancyStay", () => {
  it("counts Waheed 14/04–28/08 as 4 months + 15 days", () => {
    const stay = occupancyStay("2026-04-14", "2026-08-28");
    assert.equal(stay.full_months, 4);
    assert.equal(stay.leftover_days, 15);
    assert.equal(stay.stay_factor, 4.5);
  });

  it("treats 20 leftover days as 20/30 of a month", () => {
    const stay = occupancyStay("2026-04-14", "2026-08-02");
    assert.equal(stay.full_months, 3);
    assert.equal(stay.leftover_days, 20);
    assert.equal(stay.stay_factor, moneyish(3 + 20 / 30));
  });
});

describe("computeBrokerCommission", () => {
  it("matches the Osama / Waheed slip: 600,000 for 4.5 months → 225,000", () => {
    const c = computeBrokerCommission({
      monthly_rent: 600_000,
      contract_start_date: "2026-04-14",
      contract_end_date: "2026-08-28",
    });
    assert.equal(c.commission_per_month, 50_000);
    assert.equal(c.month_commission, 200_000);
    assert.equal(c.day_commission, 25_000);
    assert.equal(c.commission_amount, 225_000);
    assert.equal(stayLabel(c), "4 months + 15 days");
  });

  it("uses sqft × rate as the monthly rent", () => {
    assert.equal(monthlyRentForBroker({ sqft: 24_000, rate: 25 }), 600_000);
  });
});

describe("breakdownFromStored", () => {
  it("rebuilds For months / Day leftover / Total from a saved slip", () => {
    const c = breakdownFromStored({
      monthly_rent: 600_000,
      stay_months: 4,
      stay_days: 15,
      stay_factor: 4.5,
      commission_amount: 225_000,
    });
    assert.equal(c.commission_per_month, 50_000);
    assert.equal(c.month_commission, 200_000);
    assert.equal(c.day_commission, 25_000);
    assert.equal(c.commission_amount, 225_000);
    assert.equal(stayLabel(c), "4 months + 15 days");
  });
});
