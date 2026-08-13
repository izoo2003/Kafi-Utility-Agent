import { z } from "zod";

/** Empty form strings → null */
export const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === "" ? null : t;
  });

/** Normalize DD/MM/YYYY or YYYY-MM-DD (optional time) → YYYY-MM-DD. */
export function normalizeToIsoDate(value: string): string | null {
  const t = value.trim();
  const isoDay = t.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  if (isoDay) return isoDay[1]!;
  const dmY = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmY) {
    const day = Number(dmY[1]);
    const month = Number(dmY[2]);
    const year = Number(dmY[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** Inclusive From/To check; blank bounds mean open-ended. */
export function isIsoDateInRange(
  value: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  const d = value ? normalizeToIsoDate(value) : null;
  if (!d) return false;
  const fromIso = from ? normalizeToIsoDate(from) : null;
  const toIso = to ? normalizeToIsoDate(to) : null;
  if (fromIso && d < fromIso) return false;
  if (toIso && d > toIso) return false;
  return true;
}

export const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return null;
    return normalizeToIsoDate(String(v));
  })
  .pipe(z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]));

export const requiredDate = z
  .string()
  .transform((v, ctx) => {
    const iso = normalizeToIsoDate(v);
    if (!iso) {
      ctx.addIssue({
        code: "custom",
        message: "Date must be DD/MM/YYYY or YYYY-MM-DD",
      });
      return z.NEVER;
    }
    return iso;
  });

/** Parse numbers that may include commas, %, or unit suffixes (L, litres, hrs). */
export function parseLooseNumber(value: unknown): number | null | unknown {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : value;
  }
  if (typeof value !== "string") {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  const cleaned = value
    .trim()
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(
      /\b(ltrs?|litres?|liters?|hrs?|hours?|hmr|pct|percent)\b/gi,
      "",
    )
    .replace(/\s+/g, "")
    .replace(/l$/i, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isNaN(n) ? value : n;
}

export const optionalNumber = z.preprocess(
  parseLooseNumber,
  z.union([z.number(), z.null()]),
);

export const requiredNumber = z.preprocess((v) => {
  const parsed = parseLooseNumber(v);
  if (parsed === null || parsed === undefined || parsed === "") {
    return Number.NaN;
  }
  return parsed;
}, z.number({ error: "Invalid number" }));
