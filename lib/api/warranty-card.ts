import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createWarrantyCardSignedUrl,
  isAllowedWarrantyCardFile,
  removeWarrantyCard,
  uploadWarrantyCard,
  type WarrantyDomain,
} from "@/lib/supabase/warranty-storage";

const TABLE_BY_DOMAIN = {
  it: "it_equipment",
  appliances: "appliances",
} as const;

export async function postWarrantyCard(
  request: Request,
  id: string,
  domain: WarrantyDomain,
  user: User,
  supabase: SupabaseClient,
) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!isAllowedWarrantyCardFile(file)) {
    return NextResponse.json(
      { error: "Only PDF or image files (JPG/PNG/WebP) are allowed" },
      { status: 400 },
    );
  }

  const table = TABLE_BY_DOMAIN[domain];
  const { data: existing, error: existingError } = await supabase
    .from(table)
    .select("id, warranty_card_url")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return supabaseErrorResponse(existingError.message);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { path, error: uploadError } = await uploadWarrantyCard(
    supabase,
    domain,
    id,
    file,
  );
  if (uploadError || !path) {
    return supabaseErrorResponse(uploadError?.message ?? "Upload failed");
  }

  if (existing.warranty_card_url) {
    await removeWarrantyCard(supabase, existing.warranty_card_url);
  }

  const { data, error } = await supabase
    .from(table)
    .update(withUpdatedBy({ warranty_card_url: path }, user))
    .eq("id", id)
    .select("*")
    .single();
  if (error) return supabaseErrorResponse(error.message);

  return NextResponse.json({ data });
}

export async function getWarrantyCardSignedUrl(
  id: string,
  domain: WarrantyDomain,
  supabase: SupabaseClient,
) {
  const table = TABLE_BY_DOMAIN[domain];
  const { data: existing, error } = await supabase
    .from(table)
    .select("warranty_card_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return supabaseErrorResponse(error.message);
  if (!existing?.warranty_card_url) {
    return NextResponse.json({ error: "No warranty card attached" }, { status: 404 });
  }

  const { data, error: signedError } = await createWarrantyCardSignedUrl(
    supabase,
    existing.warranty_card_url,
  );
  if (signedError || !data?.signedUrl) {
    return supabaseErrorResponse(signedError?.message ?? "Could not sign URL");
  }

  return NextResponse.json({ data: { url: data.signedUrl } });
}
