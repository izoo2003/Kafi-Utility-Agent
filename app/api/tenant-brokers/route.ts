import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createTenantBroker,
  listTenantBrokers,
} from "@/lib/supabase/tenant-brokers";
import { tenantBrokerInsertSchema } from "@/lib/validations/tenants";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listTenantBrokers(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, tenantBrokerInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createTenantBroker(supabase, withUpdatedBy(parsed.data, user)),
  );
}
