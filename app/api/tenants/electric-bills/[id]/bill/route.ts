import { requireUser } from "@/lib/auth/require-user";
import {
  deleteElectricBillFile,
  getElectricBillFileUrl,
  postElectricBillFile,
} from "@/lib/api/tenant-document";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  return getElectricBillFileUrl(id, supabase);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  return postElectricBillFile(request, id, user, supabase);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;
  return deleteElectricBillFile(id, user, supabase);
}
