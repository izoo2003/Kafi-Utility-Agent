import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createGeneratorMaintenance,
  listGeneratorMaintenance,
} from "@/lib/supabase/generator";
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

  const { data, error } = await createGeneratorMaintenance(
    supabase,
    withUpdatedBy(parsed.data, user),
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data }, { status: 201 });
}
