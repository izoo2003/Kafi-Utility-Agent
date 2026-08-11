import { NextResponse } from "next/server";

export function authorizeCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 503 },
      ),
    };
  }

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : null;
  const querySecret = new URL(request.url).searchParams.get("secret");

  if (bearer === secret || querySecret === secret) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}
