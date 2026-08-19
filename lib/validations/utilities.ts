import { z } from "zod";
import {
  optionalNumber,
  optionalText,
  requiredDate,
} from "@/lib/validations/helpers";
export const utilityTypeSchema = z.enum([
  "internet",
  "electricity",
  "gas",
  "water",
  "mobile",
]);

export const siteUtilityProviderKeySchema = z.enum([
  "k-electric",
  "ssgc",
  "kwsb",
  "ptcl",
  "jazz",
]);

export const utilityAccountInsertSchema = z.object({
  utility_type: utilityTypeSchema,
  provider: optionalText,
  account_number: optionalText,
  billing_cycle: optionalText,
  monthly_avg_cost: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  due_date_day: optionalNumber.pipe(
    z.union([z.number().int().min(1).max(31), z.null()]),
  ),
  contact_person: optionalText,
  /** Password-manager entry name only — never store credentials */
  notes: optionalText,
});

export const utilityAccountUpdateSchema = utilityAccountInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });

export const utilityPaymentLogInsertSchema = z.object({
  utility_account_id: z.string().uuid(),
  paid_on: requiredDate,
  amount: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  units_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  bill_period: optionalText,
  invoice_number: optionalText,
  bill_file_url: optionalText,
  notes: optionalText,
});

export const utilityPaymentLogUpdateSchema = utilityPaymentLogInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });
