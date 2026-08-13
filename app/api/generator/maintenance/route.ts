import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createGeneratorMaintenance,
  listGeneratorMaintenance,
} from "@/lib/supabase/generator";
import { withDefaultNextServiceDue } from "@/lib/generator/maintenance";
import { generatorMaintenanceInsertSchema } from "@/lib/validations/generator";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listGeneratorMaintenance(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, generatorMaintenanceInsertSchema);
  if (parsed.error) return parsed.error;

  const payload = withDefaultNextServiceDue({
    ...parsed.data,
    checkup_status: parsed.data.checkup_status ?? "done",
  });

  return domainWriteResponse(
    await createGeneratorMaintenance(supabase, withUpdatedBy(payload, user)),
  );
}
