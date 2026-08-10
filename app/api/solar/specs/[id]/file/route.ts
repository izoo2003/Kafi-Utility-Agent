import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { createSolarSpecSignedUrl } from "@/lib/supabase/solar-storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data: existing, error } = await supabase
    .from("solar_specs")
    .select("spec_file_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return supabaseErrorResponse(error.message);
  if (!existing?.spec_file_url) {
    return NextResponse.json({ error: "No file attached" }, { status: 404 });
  }

  const { data, error: signedError } = await createSolarSpecSignedUrl(
    supabase,
    existing.spec_file_url,
  );
  if (signedError || !data?.signedUrl) {
    return supabaseErrorResponse(signedError?.message ?? "Could not sign URL");
  }

  return NextResponse.json({ data: { url: data.signedUrl } });
}
