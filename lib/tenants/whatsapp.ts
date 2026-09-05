import { formatMoney } from "@/lib/tenants/payment-status";

/** Pakistan mobiles: 03xx… / 3xx… / +92… → 92xxxxxxxxxx. Other E.164-ish digits kept. */
export function normalizeWhatsappNumber(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  let digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("03")) {
    digits = `92${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("3")) {
    digits = `92${digits}`;
  }
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export function formatWhatsappDisplay(digits: string | null | undefined) {
  const n = normalizeWhatsappNumber(digits);
  return n ? `+${n}` : "";
}

export function rentDueWhatsappText(input: {
  tenant_name: string;
  monthly_total: number | null | undefined;
  due_months?: string[];
}) {
  const name = input.tenant_name.trim() || "Tenant";
  const amount = formatMoney(input.monthly_total);
  const months = (input.due_months ?? []).filter(Boolean);
  const monthBit =
    months.length > 0
      ? ` for ${months.join(", ")}`
      : "";
  return [
    `Assalam-o-Alaikum ${name},`,
    ``,
    `This is a reminder that your rent of Rs. ${amount} is due${monthBit}.`,
    `Please arrange payment at your earliest.`,
    ``,
    `Thank you.`,
    `Facility Ops`,
  ].join("\n");
}

export function rentDueWhatsappHref(input: {
  whatsapp_number: string | null | undefined;
  tenant_name: string;
  monthly_total: number | null | undefined;
  due_months?: string[];
}) {
  const phone = normalizeWhatsappNumber(input.whatsapp_number);
  if (!phone) return null;
  const text = rentDueWhatsappText(input);
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
