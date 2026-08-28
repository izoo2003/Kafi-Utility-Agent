import { requireUser } from "@/lib/auth/require-user";
import {
  getWarrantyCardSignedUrl,
  postWarrantyCard,
} from "@/lib/api/warranty-card";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  return getWarrantyCardSignedUrl(id, "it", supabase);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  return postWarrantyCard(request, id, "it", user, supabase);
}
