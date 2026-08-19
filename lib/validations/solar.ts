import { z } from "zod";
import {
  optionalDate,
  optionalNumber,
  optionalText,
  requiredDate,
} from "@/lib/validations/helpers";

export const solarSpecsInsertSchema = z.object({
  panel_capacity_kw: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  inverter_model: optionalText,
  battery_capacity_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  install_date: optionalDate,
  vendor: optionalText,
  warranty_expiry: optionalDate,
  inverter_expiry: optionalDate,
  battery_expiry: optionalDate,
  spec_file_url: optionalText,
});

export const solarSpecsUpdateSchema = solarSpecsInsertSchema.partial().extend({
  id: z.string().uuid().optional(),
});

export const solarMonitoringLogInsertSchema = z.object({
  log_date: requiredDate,
  generation_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  consumption_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  to_load_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  to_grid_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  from_grid_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  from_pv_bat_kwh: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  battery_soc_pct: optionalNumber.pipe(
    z.union([z.number().min(0).max(100), z.null()]),
  ),
  alert_flag: z.preprocess((v) => {
    if (v === "true" || v === true || v === 1 || v === "1") return true;
    if (v === "false" || v === false || v === 0 || v === "0" || v == null)
      return false;
    return Boolean(v);
  }, z.boolean()),
  notes: optionalText,
});

export const solarMonitoringLogUpdateSchema = solarMonitoringLogInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });
