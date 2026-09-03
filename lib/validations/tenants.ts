import { z } from "zod";
import {
  optionalDate,
  optionalNumber,
  optionalText,
  requiredDate,
} from "@/lib/validations/helpers";

export const tenantPaymentStatusSchema = z.enum([
  "paid",
  "unpaid",
  "partial",
  "overdue",
]);

export const tenantRateTypeSchema = z.enum(["per_sqft", "lum_sum"]);

const moneyField = optionalNumber.pipe(
  z.union([z.number().nonnegative(), z.null()]),
);

export const tenantLineItemInputSchema = z.object({
  label: z.string().trim().min(1, "Line item label is required"),
  amount: optionalNumber.pipe(z.number()),
});

export const tenantInsertSchema = z
  .object({
    tenant_name: z.string().trim().min(1, "Tenant name is required"),
    survey_no: optionalText,
    contract_start_date: requiredDate,
    contract_end_date: requiredDate,
    security_deposit_amount: moneyField,
    security_deposit_bank_account: optionalText,
    security_deposit_bank_name: optionalText,
    security_deposit_cheque_no: optionalText,
    sqft: moneyField,
    rate: moneyField,
    rate_type: tenantRateTypeSchema.optional(),
    gross_rent: moneyField,
    contract_detail: optionalText,
    notes: optionalText,
    line_items: z.array(tenantLineItemInputSchema).optional(),
  })
  .refine((v) => v.contract_end_date >= v.contract_start_date, {
    message: "Contract end must be on or after the start date",
    path: ["contract_end_date"],
  });

export const tenantUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_name: z.string().trim().min(1).optional(),
  survey_no: optionalText,
  contract_start_date: optionalDate,
  contract_end_date: optionalDate,
  security_deposit_amount: moneyField,
  security_deposit_bank_account: optionalText,
  security_deposit_bank_name: optionalText,
  security_deposit_cheque_no: optionalText,
  sqft: moneyField,
  rate: moneyField,
  rate_type: tenantRateTypeSchema.optional(),
  gross_rent: moneyField,
  contract_detail: optionalText,
  notes: optionalText,
  line_items: z.array(tenantLineItemInputSchema).optional(),
  regenerate_schedule: z.boolean().optional(),
});

export const tenantRentPaymentInsertSchema = z.object({
  schedule_id: z.string().uuid(),
  amount_received: optionalNumber.pipe(z.number().nonnegative()),
  payer_bank_account: optionalText,
  payer_bank_name: optionalText,
  payee_bank_account: optionalText,
  payee_bank_name: optionalText,
  cheque_no: optionalText,
  payment_reference: optionalText,
});

export const tenantRentPaymentUpdateSchema = tenantRentPaymentInsertSchema
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
export type TenantRentPaymentInsertInput = z.infer<
  typeof tenantRentPaymentInsertSchema
>;
export type TenantElectricBillInsertInput = z.infer<
  typeof tenantElectricBillInsertSchema
>;
