import type { SupabaseClient } from "@supabase/supabase-js";
import { withUpdatedBy } from "@/lib/api/with-user";
import type { User } from "@supabase/supabase-js";
import {
  getTenant,
  getTenantRentLog,
  listTenantRentLogs,
  updateTenant,
  updateTenantRentLog,
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
  if (file instanceof File) {
    /* ok */
  } else if (!isAllowedTenantDocumentMime(file.mimeType, file.name)) {
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

export async function setRentLogPaymentFile(
  supabase: SupabaseClient,
  user: User,
  logId: string,
  file: File | ChatFilePayload,
) {
  const existing = await getTenantRentLog(supabase, logId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Rent log not found" } };
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
    logId,
    file,
  );
  if (uploaded.error || !uploaded.path) {
    return {
      data: null,
      error: uploaded.error ?? { message: "Upload failed" },
    };
  }
  const updated = await updateTenantRentLog(
    supabase,
    logId,
    withUpdatedBy({ payment_file_url: uploaded.path }, user),
  );
  return updated;
}

export async function clearRentLogPaymentFile(
  supabase: SupabaseClient,
  user: User,
  logId: string,
) {
  const existing = await getTenantRentLog(supabase, logId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) {
    return { data: null, error: { message: "Rent log not found" } };
  }
  const tenant = await getTenant(supabase, existing.data.tenant_id);
  const shared =
    tenant.data?.payment_file_url === existing.data.payment_file_url;
  if (!shared) {
    await removeTenantDocument(supabase, existing.data.payment_file_url);
  }
  return updateTenantRentLog(
    supabase,
    logId,
    withUpdatedBy({ payment_file_url: null }, user),
  );
}

/** Attach a payment receipt to the tenant snapshot and the latest (or matching due-date) rent log. */
export async function setTenantPaymentFile(
  supabase: SupabaseClient,
  user: User,
  tenantId: string,
  file: File | ChatFilePayload,
) {
  const logs = await listTenantRentLogs(supabase, tenantId);
  if (logs.error) return { data: null, error: logs.error };
  const latest = logs.data?.[0] ?? null;
  if (latest) {
    const result = await setRentLogPaymentFile(supabase, user, latest.id, file);
    if (result.error || !result.data) return result;
    const tenant = await getTenant(supabase, tenantId);
    return { data: tenant.data, error: tenant.error };
  }
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
    existing.data.payment_file_url,
    "payments",
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
    withUpdatedBy({ payment_file_url: uploaded.path }, user),
  );
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
  const logs = await listTenantRentLogs(supabase, tenantId);
  const latest = logs.data?.[0] ?? null;
  if (latest?.payment_file_url && latest.payment_file_url === existing.data.payment_file_url) {
    await updateTenantRentLog(
      supabase,
      latest.id,
      withUpdatedBy({ payment_file_url: null }, user),
    );
  } else {
    await removeTenantDocument(supabase, existing.data.payment_file_url);
    await updateTenant(
      supabase,
      tenantId,
      withUpdatedBy({ payment_file_url: null }, user),
    );
  }
  const tenant = await getTenant(supabase, tenantId);
  return { data: tenant.data, error: tenant.error };
}
