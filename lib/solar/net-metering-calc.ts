export type NetMeteringRowInput = {
  previous_balance_rs: number;
  net_metering_rs: number;
  consumed_rs: number;
  refund_rs?: number;
};

export type NetMeteringRowResult = {
  monthly_delta_rs: number;
  gross_balance_rs: number;
  refund_rs: number;
  net_balance_rs: number;
  estimated_refund_rs: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Spreadsheet logic: Gross = Previous + (Net Metering − Consumed); Net = Gross − Refund. */
export function computeNetMeteringRow(
  input: NetMeteringRowInput,
): NetMeteringRowResult {
  const previous = Number(input.previous_balance_rs) || 0;
  const netMetering = Number(input.net_metering_rs) || 0;
  const consumed = Number(input.consumed_rs) || 0;
  const refund = Number(input.refund_rs) || 0;

  const monthly_delta_rs = round2(netMetering - consumed);
  const gross_balance_rs = round2(previous + monthly_delta_rs);
  const net_balance_rs = round2(gross_balance_rs - refund);
  const estimated_refund_rs = gross_balance_rs > 0 ? gross_balance_rs : 0;

  return {
    monthly_delta_rs,
    gross_balance_rs,
    refund_rs: round2(refund),
    net_balance_rs,
    estimated_refund_rs: round2(estimated_refund_rs),
  };
}

export function formatRs(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `Rs ${value.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
