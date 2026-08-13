import { NextResponse } from "next/server";
import { supabaseErrorResponse } from "@/lib/api/parse";
import type { DomainWriteResult } from "@/lib/supabase/write-result";

/** JSON response for create endpoints that may create, update, or skip duplicates. */
export function domainWriteResponse<T>(result: DomainWriteResult<T>) {
  if (result.error) return supabaseErrorResponse(result.error.message);
  const status = result.outcome === "created" ? 201 : 200;
  return NextResponse.json(
    { data: result.data, outcome: result.outcome },
    { status },
  );
}
