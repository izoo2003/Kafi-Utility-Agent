import { NextResponse } from "next/server";

/** Prefer /api/solar/specs and /api/solar/monitoring */
export async function GET() {
  return NextResponse.json({
    endpoints: {
      specs: "/api/solar/specs",
      monitoring: "/api/solar/monitoring",
    },
  });
}
