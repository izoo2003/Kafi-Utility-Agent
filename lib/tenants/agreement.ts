export const AGREEMENT_WARNING_DAYS = 30;

export type AgreementExpiryStatus = "none" | "ok" | "soon" | "expired";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntilAgreementExpiry(
  expiry: string | null | undefined,
  today = todayIso(),
) {
  if (!expiry) return null;
  const start = new Date(`${today}T00:00:00`);
  const end = new Date(`${expiry}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function agreementExpiryStatus(
  expiry: string | null | undefined,
  today = todayIso(),
): AgreementExpiryStatus {
  const remaining = daysUntilAgreementExpiry(expiry, today);
  if (remaining == null) return "none";
  if (remaining < 0) return "expired";
  if (remaining <= AGREEMENT_WARNING_DAYS) return "soon";
  return "ok";
}

export function agreementExpiryLabel(status: AgreementExpiryStatus) {
  if (status === "expired") return "Expired";
  if (status === "soon") return "Expires within 1 month";
  if (status === "ok") return "Active";
  return "No expiry set";
}
