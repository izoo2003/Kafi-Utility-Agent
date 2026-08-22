import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import {
  getSolarSitesConfigError,
  listSolarSitesPublic,
} from "@/lib/sems/config";

export async function GET() {
  const { errorResponse } = await requireUser();
  if (errorResponse) return errorResponse;

  const configError = getSolarSitesConfigError();

  return NextResponse.json({
    ok: true,
    data: {
      sites: listSolarSitesPublic(),
      config_error: configError,
    },
  });
}
