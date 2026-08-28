import type { SupabaseClient } from "@supabase/supabase-js";
import { WARRANTY_CARDS_BUCKET } from "@/lib/types/database";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type WarrantyDomain = "it" | "appliances";

export function isAllowedWarrantyCardFile(file: File) {
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

export function warrantyCardObjectPath(
  domain: WarrantyDomain,
  recordId: string,
  fileName: string,
) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${domain}/${recordId}/${Date.now()}-${safe}`;
}

export function fileNameFromStoragePath(path: string | null | undefined) {
  if (!path) return "";
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}

export async function uploadWarrantyCard(
  supabase: SupabaseClient,
  domain: WarrantyDomain,
  recordId: string,
  file: File,
) {
  const path = warrantyCardObjectPath(domain, recordId, file.name);
  const { error } = await supabase.storage
    .from(WARRANTY_CARDS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) return { path: null, error };
  return { path, error: null };
}

export async function createWarrantyCardSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60 * 60,
) {
  return supabase.storage
    .from(WARRANTY_CARDS_BUCKET)
    .createSignedUrl(path, expiresIn);
}

export async function removeWarrantyCard(
  supabase: SupabaseClient,
  path: string,
) {
  return supabase.storage.from(WARRANTY_CARDS_BUCKET).remove([path]);
}
