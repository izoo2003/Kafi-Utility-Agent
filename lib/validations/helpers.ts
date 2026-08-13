import { z } from "zod";

/** Empty form strings → null */
export const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === "" ? null : t;
  });

/** Normalize DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD for storage. */
export function normalizeToIsoDate(value: string): string | null {
  const t = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
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

export const optionalNumber = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}, z.union([z.number(), z.null()]));

export const requiredNumber = z.preprocess((v) => {
  if (typeof v === "number") return v;
  if (v === "" || v === null || v === undefined) return Number.NaN;
  return Number(v);
}, z.number({ error: "Invalid number" }));
