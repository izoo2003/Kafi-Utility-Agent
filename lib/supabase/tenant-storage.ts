import type { SupabaseClient } from "@supabase/supabase-js";
import { TENANT_DOCUMENTS_BUCKET } from "@/lib/types/database";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type TenantDocumentKind = "agreements" | "payments";

export function isAllowedTenantDocumentFile(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

export function isAllowedTenantDocumentMime(mimeType: string, fileName?: string) {
  if (ALLOWED_TYPES.has(mimeType)) return true;
  const name = (fileName ?? "").toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

export function tenantDocumentObjectPath(
  kind: TenantDocumentKind,
  recordId: string,
  fileName: string,
) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
  return `${kind}/${recordId}/${Date.now()}-${safe}`;
}

export function fileNameFromStoragePath(path: string | null | undefined) {
  if (!path) return "";
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}

function extFromMime(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadTenantDocumentFile(
  supabase: SupabaseClient,
  kind: TenantDocumentKind,
  recordId: string,
  file: File,
) {
  const path = tenantDocumentObjectPath(kind, recordId, file.name);
  const { error } = await supabase.storage
    .from(TENANT_DOCUMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) return { path: null, error };
  return { path, error: null };
}

export async function uploadTenantDocumentBytes(
  supabase: SupabaseClient,
  kind: TenantDocumentKind,
  recordId: string,
  bytes: Buffer,
  mimeType: string,
  fileName?: string,
) {
  const name =
    fileName?.trim() || `document.${extFromMime(mimeType)}`;
  const path = tenantDocumentObjectPath(kind, recordId, name);
  const { error } = await supabase.storage
    .from(TENANT_DOCUMENTS_BUCKET)
    .upload(path, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: mimeType || "application/octet-stream",
    });
  if (error) return { path: null, error };
  return { path, error: null };
}

export async function createTenantDocumentSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60 * 60,
) {
  return supabase.storage
    .from(TENANT_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
}

export async function removeTenantDocument(
  supabase: SupabaseClient,
  path: string | null | undefined,
) {
  if (!path) return { error: null };
  return supabase.storage.from(TENANT_DOCUMENTS_BUCKET).remove([path]);
}
