import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSemsConfig, requireSolarSite } from "@/lib/sems/config";
import {
  buildSolarEnergySummary,
  currentSiteMonth,
} from "@/lib/solar/energy-summary";
import { generateSolarEnergySummaryAi } from "@/lib/solar/energy-summary-ai";

export async function GET(request: Request) {
  const { supabase, errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const url = new URL(request.url);
  const siteParam = url.searchParams.get("site")?.trim() || null;

  let config;
  try {
    config = siteParam ? requireSolarSite(siteParam) : getSemsConfig();
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
    const body = (await request.json()) as { month?: string; site?: string };
    config = body.site?.trim()
      ? requireSolarSite(body.site.trim())
      : getSemsConfig();
    if (!config) {
      return NextResponse.json(
        { error: "SEMS+ is not configured" },
        { status: 400 },
      );
    }
    let month = currentSiteMonth(config.timeZone);
    if (body.month?.trim()) month = body.month.trim();

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
