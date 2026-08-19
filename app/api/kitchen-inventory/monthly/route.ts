import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { currentSiteMonth } from "@/lib/kitchen/monthly-consumption";
import { buildKitchenEdaAnalytics } from "@/lib/kitchen/eda-analytics";
import { generateKitchenEdaInsights } from "@/lib/kitchen/monthly-summary-ai";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const month = url.searchParams.get("month")?.trim() || currentSiteMonth();
  const withAi = url.searchParams.get("ai") === "1";

  try {
    const eda = await buildKitchenEdaAnalytics(supabase, month);
    if (!withAi) {
      return NextResponse.json({
        ok: true,
        data: { eda, report: eda.report },
      });
    }
    const ai = await generateKitchenEdaInsights(eda);
    return NextResponse.json({
      ok: true,
      data: { eda, report: eda.report, ai },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build kitchen analytics",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  let month = currentSiteMonth();
  try {
    const body = (await request.json()) as { month?: string };
    if (body.month?.trim()) month = body.month.trim();
  } catch {
    /* empty body ok */
  }

  try {
    const eda = await buildKitchenEdaAnalytics(supabase, month);
    const ai = await generateKitchenEdaInsights(eda);
    return NextResponse.json({
      ok: true,
      data: { eda, report: eda.report, ai },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate kitchen EDA insights",
      },
      { status: 500 },
    );
  }
}
