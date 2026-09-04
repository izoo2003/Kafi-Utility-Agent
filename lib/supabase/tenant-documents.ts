import type { SupabaseClient } from "@supabase/supabase-js";
import { withUpdatedBy } from "@/lib/api/with-user";
import type { User } from "@supabase/supabase-js";
import {
  getTenant,
  getTenantElectricBill,
  getTenantRentPayment,
  listTenantRentPayments,
  listTenantSchedule,
  updateTenant,
  updateTenantRentPayment,
} from "@/lib/supabase/tenants";
import {
  isAllowedTenantDocumentMime,
  removeTenantDocument,
  uploadTenantDocumentBytes,
  uploadTenantDocumentFile,
  type TenantDocumentKind,
} from "@/lib/supabase/tenant-storage";

export type ChatFilePayload = {
  mimeType: string;
  data: string;
  name?: string;
};

function fileFromChat(file: ChatFilePayload) {
  const bytes = Buffer.from(file.data, "base64");
  const fileName = file.name?.trim() || undefined;
  return { bytes, mimeType: file.mimeType, fileName };
}

async function replacePath(
  supabase: SupabaseClient,
  previous: string | null | undefined,
  kind: TenantDocumentKind,
  recordId: string,
  file: File | ChatFilePayload,
) {
  const uploaded =
    file instanceof File
      ? await uploadTenantDocumentFile(supabase, kind, recordId, file)
      : await uploadTenantDocumentBytes(
          supabase,
          kind,
          recordId,
          fileFromChat(file).bytes,
          file.mimeType,
          file.name,
        );
  if (uploaded.error || !uploaded.path) {
    return { path: null as string | null, error: uploaded.error };
  }
  if (previous && previous !== uploaded.path) {
    await removeTenantDocument(supabase, previous);
  }
  return { path: uploaded.path, error: null };
}

export async function setTenantAgreementFile(
  supabase: SupabaseClient,
  user: User,
  tenantId: string,
  file: File | ChatFilePayload,
) {
  const existing = await getTenant(supabase, tenantId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Tenant not found" } };
  }
  if (!(file instanceof File) && !isAllowedTenantDocumentMime(file.mimeType, file.name)) {
    return {
      data: null,
      error: { message: "Only PDF or image files (JPG/PNG/WebP) are allowed" },
    };
  }
  const uploaded = await replacePath(
    supabase,
    existing.data.agreement_file_url,
    "agreements",
    tenantId,
    file,
  );
  if (uploaded.error || !uploaded.path) {
    return {
      data: null,
      error: uploaded.error ?? { message: "Upload failed" },
    };
  }
  return updateTenant(
    supabase,
    tenantId,
    withUpdatedBy({ agreement_file_url: uploaded.path }, user),
  );
}

export async function clearTenantAgreementFile(
  supabase: SupabaseClient,
  user: User,
  tenantId: string,
) {
  const existing = await getTenant(supabase, tenantId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Tenant not found" } };
  }
  await removeTenantDocument(supabase, existing.data.agreement_file_url);
  return updateTenant(
    supabase,
    tenantId,
    withUpdatedBy({ agreement_file_url: null }, user),
  );
}

export async function setRentPaymentFile(
  supabase: SupabaseClient,
  user: User,
  paymentId: string,
  file: File | ChatFilePayload,
) {
  const existing = await getTenantRentPayment(supabase, paymentId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Payment not found" } };
  }
  if (!(file instanceof File) && !isAllowedTenantDocumentMime(file.mimeType, file.name)) {
    return {
      data: null,
      error: { message: "Only PDF or image files (JPG/PNG/WebP) are allowed" },
    };
  }
  const uploaded = await replacePath(
    supabase,
    existing.data.payment_file_url,
    "payments",
    paymentId,
    file,
  );
  if (uploaded.error || !uploaded.path) {
    return {
      data: null,
      error: uploaded.error ?? { message: "Upload failed" },
    };
  }
  return updateTenantRentPayment(
    supabase,
    paymentId,
    withUpdatedBy({ payment_file_url: uploaded.path }, user),
  );
}

export async function clearRentPaymentFile(
  supabase: SupabaseClient,
  user: User,
  paymentId: string,
) {
  const existing = await getTenantRentPayment(supabase, paymentId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Payment not found" } };
  }
  await removeTenantDocument(supabase, existing.data.payment_file_url);
  return updateTenantRentPayment(
    supabase,
    paymentId,
    withUpdatedBy({ payment_file_url: null }, user),
  );
}

/** Attach a receipt to the latest unpaid schedule month, or the last month. */
export async function setTenantPaymentFile(
  supabase: SupabaseClient,
  user: User,
  tenantId: string,
  file: File | ChatFilePayload,
) {
  const schedule = await listTenantSchedule(supabase, tenantId);
  if (schedule.error) return { data: null, error: schedule.error };
  const rows = schedule.data ?? [];
  if (rows.length === 0) {
    return { data: null, error: { message: "No rent schedule to attach a receipt to" } };
  }
  const payments = await listTenantRentPayments(
    supabase,
    rows.map((row) => row.id),
  );
  if (payments.error) return { data: null, error: payments.error };
  const receivedBy = new Map<string, number>();
  for (const payment of payments.data ?? []) {
    receivedBy.set(
      payment.schedule_id,
      (receivedBy.get(payment.schedule_id) ?? 0) + Number(payment.amount_received ?? 0),
    );
  }
  const target =
    rows.find((row) => (receivedBy.get(row.id) ?? 0) < Number(row.total_due ?? 0)) ??
    rows[rows.length - 1]!;
  const latestPayment = (payments.data ?? [])
    .filter((p) => p.schedule_id === target.id)
    .at(-1);
  if (latestPayment) {
    return setRentPaymentFile(supabase, user, latestPayment.id, file);
  }
  return { data: null, error: { message: "Record a payment before attaching a receipt" } };
}

export async function clearTenantPaymentFile(
  supabase: SupabaseClient,
  user: User,
  tenantId: string,
) {
  const existing = await getTenant(supabase, tenantId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Tenant not found" } };
  }
  if (existing.data.payment_file_url) {
    await removeTenantDocument(supabase, existing.data.payment_file_url);
    return updateTenant(
      supabase,
      tenantId,
      withUpdatedBy({ payment_file_url: null }, user),
    );
  }
  const tenant = await getTenant(supabase, tenantId);
  return { data: tenant.data, error: tenant.error };
}

export async function setElectricBillFile(
  supabase: SupabaseClient,
  user: User,
  billId: string,
  file: File | ChatFilePayload,
) {
  const existing = await getTenantElectricBill(supabase, billId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Electricity bill not found" } };
  }
  if (!(file instanceof File) && !isAllowedTenantDocumentMime(file.mimeType, file.name)) {
    return {
      data: null,
      error: { message: "Only PDF or image files (JPG/PNG/WebP) are allowed" },
    };
  }
  const uploaded = await replacePath(
    supabase,
    existing.data.bill_file_url,
    "electric-bills",
    billId,
    file,
  );
  if (uploaded.error || !uploaded.path) {
    return {
      data: null,
      error: uploaded.error ?? { message: "Upload failed" },
    };
  }
  return supabase
    .from("tenant_electric_bills")
    .update(withUpdatedBy({ bill_file_url: uploaded.path }, user))
    .eq("id", billId)
    .select("*")
    .single();
}

export async function clearElectricBillFile(
  supabase: SupabaseClient,
  user: User,
  billId: string,
) {
  const existing = await getTenantElectricBill(supabase, billId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Electricity bill not found" } };
  }
  await removeTenantDocument(supabase, existing.data.bill_file_url);
  return supabase
    .from("tenant_electric_bills")
    .update(withUpdatedBy({ bill_file_url: null }, user))
    .eq("id", billId)
    .select("*")
    .single();
}
