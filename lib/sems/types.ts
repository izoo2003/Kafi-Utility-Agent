export type SemsSession = {
  uid: string;
  token: string;
  timestamp: string;
  api: string;
  region: string;
  uuid: string;
  client: string;
  version: string;
  language: string;
};

export type StationDetail = {
  stationId: string;
  stationName?: string;
  stationType?: number;
  fromLogin?: boolean;
};

export function sessionTokenHeader(session: SemsSession): string {
  return JSON.stringify({
    uid: session.uid,
    timestamp: session.timestamp,
    token: session.token,
    client: session.client,
    version: session.version,
    language: session.language,
    api: session.api,
    region: session.region,
    uuid: session.uuid,
  });
}

export function parseStationDetailBlob(blob: string): StationDetail {
  const trimmed = blob.trim();
  try {
    const json = Buffer.from(trimmed, "base64").toString("utf8");
    const parsed = JSON.parse(json) as StationDetail;
    if (!parsed.stationId || typeof parsed.stationId !== "string") {
      throw new Error("missing stationId");
    }
    return parsed;
  } catch {
    throw new Error(
      "SEMS_STATION_DETAIL is not valid base64 JSON with stationId (copy the query after station_detail? from the SEMS+ URL)",
    );
  }
}
