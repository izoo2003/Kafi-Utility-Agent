import { z } from "zod";

/** Empty form strings → null */
export const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === "" ? null : t;
  });

export const optionalDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return null;
    return String(v);
  })
  .pipe(z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]));

export const requiredDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

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
