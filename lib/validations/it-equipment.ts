import { z } from "zod";
import { optionalDate, optionalText } from "@/lib/validations/helpers";

export const itEquipmentStatusSchema = z.enum([
  "active",
  "in_repair",
  "retired",
]);

export const itEquipmentInsertSchema = z.object({
  asset_tag: z.string().trim().min(1, "Asset tag is required"),
  item_name: z.string().trim().min(1, "Item name is required"),
  category: optionalText,
  assigned_to: optionalText,
  serial_number: optionalText,
  purchase_date: optionalDate,
  warranty_expiry: optionalDate,
  status: itEquipmentStatusSchema.default("active"),
  location: optionalText,
  notes: optionalText,
});

export const itEquipmentUpdateSchema = itEquipmentInsertSchema.partial().extend({
  id: z.string().uuid().optional(),
});

export type ItEquipmentInsertInput = z.infer<typeof itEquipmentInsertSchema>;
export type ItEquipmentUpdateInput = z.infer<typeof itEquipmentUpdateSchema>;
