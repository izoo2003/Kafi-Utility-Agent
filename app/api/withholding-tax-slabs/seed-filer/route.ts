import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { replaceWithFilerRentSlabs } from "@/lib/supabase/withholding-tax-slabs";

export async function POST() {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await replaceWithFilerRentSlabs(supabase, user.id);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}
