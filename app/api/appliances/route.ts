import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import { createAppliance, listAppliances } from "@/lib/supabase/appliances";
import {
  applianceInsertSchema,
  applianceSiteSchema,
} from "@/lib/validations/appliances";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const siteParam = new URL(request.url).searchParams.get("site");
  const site = siteParam ? applianceSiteSchema.safeParse(siteParam) : null;
  if (siteParam && !site?.success) {
    return NextResponse.json(
      { error: "site must be clifton_office or gondpass_mill" },
      { status: 400 },
    );
  }

  const { data, error } = await listAppliances(
    supabase,
    site?.success ? site.data : null,
  );
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
