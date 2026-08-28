import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import { createAppliance, listAppliances } from "@/lib/supabase/appliances";
import { applianceInsertSchema } from "@/lib/validations/appliances";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listAppliances(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, applianceInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createAppliance(supabase, withUpdatedBy(parsed.data, user)),
  );
}
