import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  deleteContractExtension,
  updateContractExtension,
} from "@/lib/supabase/tenants";
import { tenantContractExtensionSchema } from "@/lib/validations/tenants";

type Params = { params: Promise<{ id: string; extensionId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id, extensionId } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, tenantContractExtensionSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await updateContractExtension(
      supabase,
      id,
      extensionId,
      withUpdatedBy(parsed.data, user),
    ),
  );
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id, extensionId } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { error } = await deleteContractExtension(
    supabase,
    id,
    extensionId,
    user.id,
  );
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ ok: true });
}
