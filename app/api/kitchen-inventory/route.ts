import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { domainWriteResponse } from "@/lib/api/dedupe-response";
import { withUpdatedBy } from "@/lib/api/with-user";
import {
  createKitchenInventoryItem,
  listKitchenInventory,
} from "@/lib/supabase/kitchen-inventory";
import { kitchenInventoryInsertSchema } from "@/lib/validations/kitchen-inventory";

export async function GET() {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { data, error } = await listKitchenInventory(supabase);
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const { user, supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const parsed = await parseJsonBody(request, kitchenInventoryInsertSchema);
  if (parsed.error) return parsed.error;

  return domainWriteResponse(
    await createKitchenInventoryItem(
      supabase,
      withUpdatedBy(parsed.data, user),
    ),
  );
}
