import { NextResponse } from "next/server";

/** Placeholder response until the owning build phase implements the route. */
export function notImplementedYet(phase: string, domain: string) {
  return NextResponse.json(
    {
      error: "Not implemented",
      message: `${domain} API routes ship in ${phase}.`,
    },
    { status: 501 },
  );
}
