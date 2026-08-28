import { z } from "zod";
import { optionalDate, optionalText } from "@/lib/validations/helpers";

export const applianceStatusSchema = z.enum([
  "active",
  "in_repair",
  "retired",
]);

export const applianceSiteSchema = z.enum([
  "clifton_office",
  "gondpass_mill",
]);

export const applianceInsertSchema = z.object({
  site: applianceSiteSchema,
  asset_tag: z.string().trim().min(1, "Asset tag is required"),
  item_name: z.string().trim().min(1, "Item name is required"),
  category: optionalText,
  assigned_to: optionalText,
  serial_number: optionalText,
  purchase_date: optionalDate,
  warranty_expiry: optionalDate,
  status: applianceStatusSchema.default("active"),
  location: optionalText,
  notes: optionalText,
});

export const applianceUpdateSchema = applianceInsertSchema.partial().extend({
  id: z.string().uuid().optional(),
});

export type ApplianceInsertInput = z.infer<typeof applianceInsertSchema>;
export type ApplianceUpdateInput = z.infer<typeof applianceUpdateSchema>;
