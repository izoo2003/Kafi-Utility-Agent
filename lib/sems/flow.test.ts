import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFlowPayload } from "./flow";

/** Real SEMS+ shape observed for station flow (topology + metrics). */
const LIVE_SHAPE = {
  code: "00000",
  description: "成功",
  data: {
    id: "a8d23a64-bc87-4321-82f4-83b8f2881625",
    name: "kafi commodities",
    status: "1",
    isGoodweInverter: true,
    flows: {
      pSystem: ["pConsum", "pBat"],
      pGrid: ["pConsum"],
    },
    pSystem: 4.7203,
    pAc: 3.11366,
    pBat: -1.60664,
    pGrid: -0.051,
    soc: 36,
    pConsum: 3.16466,
    consumFlag: false,
    refreshTime: "2026-08-17T14:29:04.749",
  },
};

describe("parseFlowPayload", () => {
  it("reads power/SOC when flows topology comes first", () => {
    const flow = parseFlowPayload(LIVE_SHAPE);
    assert.equal(flow.pSystem, 4.7203);
    assert.equal(flow.pConsum, 3.16466);
    assert.equal(flow.pGrid, -0.051);
    assert.equal(flow.pBat, -1.60664);
    assert.equal(flow.soc, 36);
  });

  it("still reads power when numeric fields come before flows (regression)", () => {
    const data = {
      pSystem: 4.72,
      pConsum: 3.16,
      pGrid: -0.05,
      pBat: -1.6,
      soc: 36,
      flows: {
        pSystem: ["pConsum", "pBat"],
        pGrid: ["pConsum"],
      },
    };
    const flow = parseFlowPayload({ code: "00000", data });
    assert.equal(flow.pSystem, 4.72);
    assert.equal(flow.pConsum, 3.16);
    assert.equal(flow.pGrid, -0.05);
    assert.equal(flow.pBat, -1.6);
    assert.equal(flow.soc, 36);
  });

  it("ignores topology-only payload (no false numbers from arrays)", () => {
    const flow = parseFlowPayload({
      data: {
        flows: { pSystem: ["pConsum", "pBat"], pGrid: ["pConsum"] },
      },
    });
    assert.equal(flow.pSystem, undefined);
    assert.equal(flow.pGrid, undefined);
  });

  it("accepts string-encoded numbers", () => {
    const flow = parseFlowPayload({
      data: { pSystem: "1.5", soc: "42", pConsum: "0.8" },
    });
    assert.equal(flow.pSystem, 1.5);
    assert.equal(flow.soc, 42);
    assert.equal(flow.pConsum, 0.8);
  });
});
