import { z } from "zod";
import {
  optionalNumber,
  optionalText,
} from "@/lib/validations/helpers";

export const utilityTypeSchema = z.enum([
  "internet",
  "electricity",
  "gas",
  "water",
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
