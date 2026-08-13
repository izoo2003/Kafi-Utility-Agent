import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createGeneratorRunLog,
  listGeneratorRunLog,
} from "@/lib/supabase/generator";
import { generatorRunLogInsertSchema } from "@/lib/validations/generator";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listGeneratorRunLog(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, generatorRunLogInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createGeneratorRunLog(supabase, withUpdatedBy(parsed.data, user)),
  );
}
