import { z } from "zod";
import {
  optionalDate,
  optionalNumber,
  optionalText,
  requiredNumber,
} from "@/lib/validations/helpers";

export const kitchenInventoryInsertSchema = z.object({
  item_name: z.string().trim().min(1, "Item name is required"),
  category: optionalText,
  unit: optionalText,
  current_qty: requiredNumber.pipe(z.number().nonnegative()),
  reorder_level: requiredNumber.pipe(z.number().nonnegative()),
  reorder_qty: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  supplier: optionalText,
  cost_per_unit: optionalNumber.pipe(
    z.union([z.number().nonnegative(), z.null()]),
  ),
  last_restocked_at: optionalDate,
  notes: optionalText,
});

export const kitchenStockMovementSchema = z.object({
  direction: z.enum(["in", "out"]),
  qty: z.coerce.number().positive("Quantity must be greater than zero"),
  applied_on: optionalDate,
  notes: optionalText,
});

export type KitchenStockMovementInput = z.infer<
  typeof kitchenStockMovementSchema
>;

export const kitchenInventoryUpdateSchema = kitchenInventoryInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });

export type KitchenInventoryInsertInput = z.infer<
  typeof kitchenInventoryInsertSchema
>;
export type KitchenInventoryUpdateInput = z.infer<
  typeof kitchenInventoryUpdateSchema
>;
