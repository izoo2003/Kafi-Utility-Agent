import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSemsConfig } from "@/lib/sems/config";
import {
  buildSolarEnergySummary,
  currentSiteMonth,
} from "@/lib/solar/energy-summary";
import { generateSolarEnergySummaryAi } from "@/lib/solar/energy-summary-ai";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  let config;
  try {
    config = getSemsConfig();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid SEMS config",
      },
      { status: 500 },
    );
  }
  if (!config) {
    return NextResponse.json(
      { error: "SEMS+ is not configured" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const month =
    url.searchParams.get("month")?.trim() ||
    currentSiteMonth(config.timeZone);
  const withAi = url.searchParams.get("ai") === "1";

  try {
    const summary = await buildSolarEnergySummary(supabase, config, month);
    if (!withAi) {
      return NextResponse.json({ ok: true, data: { summary } });
    }
    const ai = await generateSolarEnergySummaryAi(summary);
    return NextResponse.json({ ok: true, data: { summary, ai } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build solar energy summary",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  let config;
  try {
    config = getSemsConfig();
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid SEMS config",
      },
      { status: 500 },
    );
  }
  if (!config) {
    return NextResponse.json(
      { error: "SEMS+ is not configured" },
      { status: 400 },
    );
  }

  let month = currentSiteMonth(config.timeZone);
  try {
    const body = (await request.json()) as { month?: string };
    if (body.month?.trim()) month = body.month.trim();
  } catch {
    /* empty ok */
  }

  try {
    const summary = await buildSolarEnergySummary(supabase, config, month);
    const ai = await generateSolarEnergySummaryAi(summary);
    return NextResponse.json({ ok: true, data: { summary, ai } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate solar energy AI summary",
      },
      { status: 500 },
    );
  }
}
