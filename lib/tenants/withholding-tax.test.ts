import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FILER_RENT_SLABS_2026_27,
  computeProgressiveYearlyTax,
  withholdingForTenant,
} from "./withholding-tax";

describe("Filer 2026-27 progressive rent tax", () => {
  it("charges nothing on the first Rs. 300,000 of yearly rent", () => {
    assert.equal(computeProgressiveYearlyTax(300_000, FILER_RENT_SLABS_2026_27), 0);
    assert.equal(
      withholdingForTenant({
        classification: "official",
        monthlyRent: 20_000,
        slabs: FILER_RENT_SLABS_2026_27,
      }).withholding_tax,
      0,
    );
  });

  it("taxes only the amount above Rs. 300,000 at 5%", () => {
    // Yearly 480,000 → 180,000 above 300,000 × 5% = 9,000
    assert.equal(
      computeProgressiveYearlyTax(480_000, FILER_RENT_SLABS_2026_27),
      9_000,
    );
  });

  it("uses the published Rs. 15,000 + 10% formula in the third band", () => {
    // Yearly 800,000 → 15,000 + 10% of 200,000 = 35,000
    assert.equal(
      computeProgressiveYearlyTax(800_000, FILER_RENT_SLABS_2026_27),
      35_000,
    );
  });

  it("uses the published Rs. 155,000 + 25% formula above Rs. 2,000,000", () => {
    // Yearly 2,500,000 → 155,000 + 25% of 500,000 = 280,000
    assert.equal(
      computeProgressiveYearlyTax(2_500_000, FILER_RENT_SLABS_2026_27),
      280_000,
    );
  });

  it("does not apply tax to unofficial tenants", () => {
    const result = withholdingForTenant({
      classification: "unofficial",
      monthlyRent: 200_000,
      slabs: FILER_RENT_SLABS_2026_27,
    });
    assert.equal(result.withholding_tax, 0);
    assert.equal(result.total_due, 200_000);
  });

  it("stores a monthly WHT of yearly tax / 12 on official rent", () => {
    const monthly = 100_000; // yearly 1,200,000
    // 15,000 + 10% of 600,000 = 75,000 yearly → 6,250 / month
    const result = withholdingForTenant({
      classification: "official",
      monthlyRent: monthly,
      slabs: FILER_RENT_SLABS_2026_27,
    });
    assert.equal(result.yearly_tax, 75_000);
    assert.equal(result.withholding_tax, 6_250);
    assert.equal(result.total_due, 93_750);
  });
});
