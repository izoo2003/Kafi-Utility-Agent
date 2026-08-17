import type { SupabaseClient } from "@supabase/supabase-js";
import { UTILITY_BILLS_BUCKET } from "@/lib/types/database";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isAllowedUtilityBillFile(file: File) {
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

export function utilityBillObjectPath(
  paymentId: string,
  fileName: string,
) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${paymentId}/${Date.now()}-${safe}`;
}

export async function uploadUtilityBillFile(
  supabase: SupabaseClient,
  paymentId: string,
  file: File,
) {
  const path = utilityBillObjectPath(paymentId, file.name);
  const { error } = await supabase.storage
    .from(UTILITY_BILLS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/pdf",
    });

  if (error) return { path: null, error };
  return { path, error: null };
}

export async function createUtilityBillSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60 * 60,
) {
  return supabase.storage
    .from(UTILITY_BILLS_BUCKET)
    .createSignedUrl(path, expiresIn);
}

export async function removeUtilityBillFile(
  supabase: SupabaseClient,
  path: string,
) {
  return supabase.storage.from(UTILITY_BILLS_BUCKET).remove([path]);
}
