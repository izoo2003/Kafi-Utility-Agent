import { requireUser } from "@/lib/auth/require-user";
import {
  deleteTenantPaymentFile,
  getTenantPaymentUrl,
  postTenantPayment,
} from "@/lib/api/tenant-document";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  return getTenantPaymentUrl(id, supabase);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  return postTenantPayment(request, id, user, supabase);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  return deleteTenantPaymentFile(id, user, supabase);
}
