import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import { updateSolarSpecs } from "@/lib/supabase/solar";
import {
  isAllowedSolarSpecFile,
  removeSolarSpecFile,
  uploadSolarSpecFile,
} from "@/lib/supabase/solar-storage";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!isAllowedSolarSpecFile(file)) {
    return NextResponse.json(
      { error: "Only PDF, Word, or image files (JPG/PNG/WebP/GIF) are allowed" },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("solar_specs")
    .select("id, spec_file_url")
    .eq("id", id)
    .maybeSingle();

  if (existingError) return supabaseErrorResponse(existingError.message);
  if (!existing) {
    return NextResponse.json({ error: "Spec not found" }, { status: 404 });
  }

  const { path, error: uploadError } = await uploadSolarSpecFile(
    supabase,
    id,
    file,
  );
  if (uploadError || !path) {
    return supabaseErrorResponse(uploadError?.message ?? "Upload failed");
  }

  if (existing.spec_file_url) {
    await removeSolarSpecFile(supabase, existing.spec_file_url);
  }

  const { data, error } = await updateSolarSpecs(
    supabase,
    id,
    withUpdatedBy({ spec_file_url: path }, user),
  );
  if (error) return supabaseErrorResponse(error.message);

  return NextResponse.json({ data });
}
