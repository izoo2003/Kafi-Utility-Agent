import { z } from "zod";
import {
  optionalNumber,
  optionalText,
  requiredDate,
} from "@/lib/validations/helpers";

export const chartOfAccountsLedgerSchema = z.enum([
  "solar_panel_clifton",
  "eobi",
  "k_electric_gondpass",
  "kwsb_clifton",
]);

export const chartOfAccountsEntryInsertSchema = z.object({
  ledger: chartOfAccountsLedgerSchema,
  entry_date: requiredDate,
  ref_no: optionalText,
  account_description: optionalText,
  document_no: optionalText,
  debit: optionalNumber
    .pipe(z.union([z.number().nonnegative(), z.null()]))
    .transform((v) => v ?? 0),
  credit: optionalNumber
    .pipe(z.union([z.number().nonnegative(), z.null()]))
    .transform((v) => v ?? 0),
  notes: optionalText,
});

export const chartOfAccountsEntryUpdateSchema =
  chartOfAccountsEntryInsertSchema.partial().extend({
    id: z.string().uuid().optional(),
  });
