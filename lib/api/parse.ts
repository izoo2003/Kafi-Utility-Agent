import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      ),
    };
  }

  return { data: parsed.data, error: null };
}

export function supabaseErrorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
