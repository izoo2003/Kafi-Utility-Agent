import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createTenantRentLog,
  listTenantRentLogs,
} from "@/lib/supabase/tenants";
import { tenantRentLogInsertSchema } from "@/lib/validations/tenants";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const tenantId =
    new URL(request.url).searchParams.get("tenantId") ?? undefined;
  const { data, error } = await listTenantRentLogs(supabase, tenantId);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, tenantRentLogInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createTenantRentLog(supabase, withUpdatedBy(parsed.data, user)),
  );
}
