import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import { createContractExtension } from "@/lib/supabase/tenants";
import { tenantContractExtensionSchema } from "@/lib/validations/tenants";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, tenantContractExtensionSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createContractExtension(
      supabase,
      id,
      withUpdatedBy(parsed.data, user),
    ),
  );
}
