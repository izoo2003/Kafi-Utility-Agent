import { NextResponse } from "next/server";

/** Prefer /api/generator/maintenance and /api/generator/fuel */
export async function GET() {
  return NextResponse.json({
    endpoints: {
      maintenance: "/api/generator/maintenance",
      fuel: "/api/generator/fuel",
      runs: "/api/generator/runs",
      expenses: "/api/generator/expenses",
      vendors: "/api/generator/vendors",
    },
  });
}
