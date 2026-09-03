import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import { createTenant, listTenantSummaries } from "@/lib/supabase/tenants";
import { tenantInsertSchema } from "@/lib/validations/tenants";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listTenantSummaries(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, tenantInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createTenant(supabase, withUpdatedBy(parsed.data, user)),
  );
}
