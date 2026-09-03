import { z } from "zod";
import {
  optionalDate,
  optionalNumber,
  optionalText,
} from "@/lib/validations/helpers";

export const tenantPaymentStatusSchema = z.enum([
  "paid",
  "unpaid",
  "partial",
  "overdue",
]);

const moneyField = optionalNumber.pipe(
  z.union([z.number().nonnegative(), z.null()]),
);

export const tenantInsertSchema = z.object({
  tenant_name: z.string().trim().min(1, "Tenant name is required"),
  rent_amount: moneyField,
  rent_due_date: optionalDate,
  payment_status: tenantPaymentStatusSchema.optional(),
  payment_date: optionalDate,
  outstanding_amount: moneyField,
  agreement_expiry: optionalDate,
  notes: optionalText,
});

export const tenantUpdateSchema = tenantInsertSchema.partial().extend({
  id: z.string().uuid().optional(),
});

export const tenantRentLogInsertSchema = z.object({
  tenant_id: z.string().uuid(),
  rent_amount: moneyField,
  rent_due_date: optionalDate,
  payment_status: tenantPaymentStatusSchema.optional(),
  payment_date: optionalDate,
  outstanding_amount: moneyField,
  notes: optionalText,
});

export const tenantRentLogUpdateSchema = tenantRentLogInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });

export const tenantElectricBillInsertSchema = z.object({
  tenant_id: z.string().uuid(),
  ke_charges_amount: moneyField,
  due_date: optionalDate,
  payment_status: tenantPaymentStatusSchema.optional(),
  payment_date: optionalDate,
  outstanding_amount: moneyField,
  notes: optionalText,
});

export const tenantElectricBillUpdateSchema = tenantElectricBillInsertSchema
  .partial()
  .extend({
    id: z.string().uuid().optional(),
  });

export type TenantInsertInput = z.infer<typeof tenantInsertSchema>;
export type TenantUpdateInput = z.infer<typeof tenantUpdateSchema>;
export type TenantRentLogInsertInput = z.infer<typeof tenantRentLogInsertSchema>;
export type TenantElectricBillInsertInput = z.infer<
  typeof tenantElectricBillInsertSchema
>;
