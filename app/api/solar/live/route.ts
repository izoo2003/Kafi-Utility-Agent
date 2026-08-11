import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseErrorResponse } from "@/lib/api/parse";
import { isSemsConfigured } from "@/lib/sems/config";
import { getLatestSolarLiveSnapshot } from "@/lib/supabase/solar";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await getLatestSolarLiveSnapshot(supabase);
  if (error) return supabaseErrorResponse(error.message);

  return NextResponse.json({
    data,
    configured: isSemsConfigured(),
  });
}
