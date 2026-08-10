import type { SupabaseClient } from "@supabase/supabase-js";
import { SOLAR_SPECS_BUCKET } from "@/lib/types/database";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedSolarSpecFile(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".doc") ||
    name.endsWith(".docx") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp") ||
    name.endsWith(".gif")
  );
}

export function solarSpecObjectPath(specId: string, fileName: string) {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${specId}/${Date.now()}-${safe}`;
}

export async function uploadSolarSpecFile(
  supabase: SupabaseClient,
  specId: string,
  file: File,
) {
  const path = solarSpecObjectPath(specId, file.name);
  const { error } = await supabase.storage
    .from(SOLAR_SPECS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) return { path: null, error };

  return { path, error: null };
}

export async function createSolarSpecSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn = 60 * 60,
) {
  return supabase.storage
    .from(SOLAR_SPECS_BUCKET)
    .createSignedUrl(path, expiresIn);
}

export async function removeSolarSpecFile(
  supabase: SupabaseClient,
  path: string,
) {
  return supabase.storage.from(SOLAR_SPECS_BUCKET).remove([path]);
}
