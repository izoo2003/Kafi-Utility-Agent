import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { parseJsonBody, supabaseErrorResponse } from "@/lib/api/parse";
import { recordKitchenStockMovement } from "@/lib/kitchen/stock-movements";
import { kitchenStockMovementSchema } from "@/lib/validations/kitchen-inventory";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const parsed = await parseJsonBody(request, kitchenStockMovementSchema);
  if (parsed.error) return parsed.error;

  const { data, error } = await recordKitchenStockMovement(supabase, id, {
    direction: parsed.data.direction,
    qty: parsed.data.qty,
    applied_on: parsed.data.applied_on ?? undefined,
    notes: parsed.data.notes,
  });
  if (error) return supabaseErrorResponse(error.message);
  return NextResponse.json({ data });
}
