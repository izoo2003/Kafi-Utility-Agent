import { randomUUID } from "node:crypto";
import { isSuccessCode } from "@/lib/sems/codes";
import type { RegionConfig } from "@/lib/sems/regions";
import { isTrustedApiBase } from "@/lib/sems/regions";
import {
  buildXSignature,
  hashPasswordForSemsPlus,
} from "@/lib/sems/signature";
import type { SemsSession } from "@/lib/sems/types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

const BROWSER_BRAND = "Chrome 150.0.0.0 Google Inc. en-GB Europe/Berlin";
const BROWSER_OS = "Windows 10.0.0 desktop";

type LoginData = {
  uid?: unknown;
  token?: unknown;
  timestamp?: unknown;
  api?: unknown;
  region?: unknown;
  uuid?: unknown;
  client?: unknown;
  version?: unknown;
  language?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function buildTraceparent(): string {
  const randomHex = (byteCount: number) =>
    Array.from({ length: byteCount }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0"),
    ).join("");
  return `00-${randomHex(16)}-${randomHex(8)}-01`;
}

function getDeviceId(): string {
  const fromEnv = process.env.SEMS_DEVICE_ID?.trim();
  if (fromEnv) return fromEnv;
  return randomUUID();
}

export function extractSession(
  json: unknown,
  region: RegionConfig,
  deviceId: string,
): SemsSession {
  const root = json as { code?: unknown; msg?: unknown; data?: LoginData };
  if (!isSuccessCode(root?.code)) {
    throw new Error(
      `SEMS+ login rejected: ${String(root?.msg ?? "unknown")} (code=${String(root?.code)})`,
    );
  }

  const data = root.data ?? (json as LoginData);
  const uid = asString(data.uid);
  const token = asString(data.token);
  if (!uid || !token) {
    throw new Error("SEMS+ login response missing uid/token");
  }

  const apiCandidate = asString(data.api);
  const api =
    apiCandidate && isTrustedApiBase(apiCandidate)
      ? apiCandidate.replace(/\/$/, "")
      : region.defaultGatewayApi;

  return {
    uid,
    token,
    timestamp: asString(data.timestamp) ?? String(Date.now()),
    api,
    region: asString(data.region) ?? region.code,
    uuid: asString(data.uuid) ?? deviceId,
    client: asString(data.client) ?? "semsPlusWeb",
    version: asString(data.version) ?? "",
    language: asString(data.language) ?? "en",
  };
}

export function semsBrowserHeaders(
  webOrigin: string,
  tokenJson: string,
  uidForSig: string,
  tokenForSig: string,
  uuid: string,
): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*",
    Origin: webOrigin,
    Referer: `${webOrigin}/`,
    "User-Agent": USER_AGENT,
    currentLang: "en",
    token: tokenJson,
    uuid,
    "X-Signature": buildXSignature(uidForSig, tokenForSig),
    brand: BROWSER_BRAND,
    os: BROWSER_OS,
    neutral: "0",
    traceparent: buildTraceparent(),
  };
}

export async function loginSemsPlus(
  region: RegionConfig,
  email: string,
  password: string,
): Promise<SemsSession> {
  const deviceId = getDeviceId();
  const url = `${region.webOrigin}/web/sems/sems-user/api/v1/auth/cross-login`;
  const emptyToken = JSON.stringify({
    uid: "",
    timestamp: 0,
    token: "",
    client: "semsPlusWeb",
    version: "",
    language: "en",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...semsBrowserHeaders(region.webOrigin, emptyToken, "", "", deviceId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account: email,
      pwd: hashPasswordForSemsPlus(password),
      agreement: 1,
      isLocal: false,
      isChinese: false,
    }),
  });

  const text = await response.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(
      `SEMS+ login returned non-JSON (${response.status}): ${text.slice(0, 200)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `SEMS+ login HTTP ${response.status}: ${text.slice(0, 200)}`,
    );
  }

  return extractSession(json, region, deviceId);
}
