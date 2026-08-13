import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createItEquipment,
  listItEquipment,
} from "@/lib/supabase/it-equipment";
import { itEquipmentInsertSchema } from "@/lib/validations/it-equipment";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listItEquipment(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, itEquipmentInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createItEquipment(supabase, withUpdatedBy(parsed.data, user)),
  );
}
