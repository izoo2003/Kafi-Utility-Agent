import { z } from "zod";
import {
  optionalDate,
  optionalNumber,
  optionalText,
  requiredDate,
  requiredNumber,
} from "@/lib/validations/helpers";

export const generatorCheckupStatusSchema = z.enum(["done", "not_done"]);

export const generatorMaintenanceInsertSchema = z.object({
  service_date: requiredDate,
  next_service_due: optionalDate,
  service_type: optionalText,
  vendor: optionalText,
  cost: optionalNumber.pipe(z.union([z.number().nonnegative(), z.null()])),
  notes: optionalText,
  checkup_status: generatorCheckupStatusSchema.optional(),
  hour_meter: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
});

export const generatorMaintenanceUpdateSchema =
  generatorMaintenanceInsertSchema.partial().extend({
    id: z.string().uuid().optional(),
  });

export const generatorFuelLogInsertSchema = z.object({
  log_date: requiredDate,
  liters_added: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  running_hours: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  fuel_level_pct: optionalNumber.pipe(
    z.union([z.number().min(0).max(100), z.null()]),
  ),
  cost: optionalNumber.pipe(z.union([z.number().nonnegative(), z.null()])),
  notes: optionalText,
});

export const generatorFuelLogUpdateSchema = generatorFuelLogInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });

export const generatorRunLogInsertSchema = z.object({
  run_date: requiredDate,
  hours_run: requiredNumber.pipe(z.number().positive()),
  started_at: optionalText,
  ended_at: optionalText,
  notes: optionalText,
});

export const generatorRunLogUpdateSchema = generatorRunLogInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });

export const generatorExpenseInsertSchema = z.object({
  expense_date: requiredDate,
  account: optionalText,
  description: optionalText,
  debit: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ).transform((v) => v ?? 0),
  credit: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  notes: optionalText,
});

export const generatorExpenseUpdateSchema = generatorExpenseInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });
