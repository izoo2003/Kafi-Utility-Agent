import { z } from "zod";
import {
  optionalDate,
  optionalNumber,
  optionalText,
  requiredDate,
} from "@/lib/validations/helpers";

export const generatorMaintenanceInsertSchema = z.object({
  service_date: requiredDate,
  next_service_due: optionalDate,
  service_type: optionalText,
  vendor: optionalText,
  cost: optionalNumber.pipe(z.union([z.number().nonnegative(), z.null()])),
  notes: optionalText,
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
