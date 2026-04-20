import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import type { TrackingUtm } from "@/lib/tracking/types";

export const TRACKING_SESSION_HEADER = "x-autohire-session-id";
export const TRACKING_REQUEST_HEADER = "x-autohire-request-id";

export type RequestTrackingContext = {
  sessionId: string;
  requestId: string;
  referer: string | null;
  landingPath: string | null;
  ipAddress: string | null;
  ipHash: string | null;
  userAgent: string | null;
  utm: TrackingUtm | null;
};

export function buildTrackingIds() {
  return {
    sessionId: randomUUID(),
    requestId: randomUUID(),
  };
}

export function getTrackingRequestHeaders(input?: {
  sessionId?: string;
  requestId?: string;
}) {
  const ids = {
    sessionId: input?.sessionId ?? randomUUID(),
    requestId: input?.requestId ?? randomUUID(),
  };

  return {
    [TRACKING_SESSION_HEADER]: ids.sessionId,
    [TRACKING_REQUEST_HEADER]: ids.requestId,
  };
}

export function extractRequestTrackingContext(
  request: NextRequest,
): RequestTrackingContext {
  const referer = request.headers.get("referer");

  return {
    sessionId: request.headers.get(TRACKING_SESSION_HEADER) ?? randomUUID(),
    requestId: request.headers.get(TRACKING_REQUEST_HEADER) ?? randomUUID(),
    referer,
    landingPath: extractLandingPath(request, referer),
    ipAddress: extractIpAddress(request),
    ipHash: hashIpAddress(request),
    userAgent: request.headers.get("user-agent"),
    utm: extractUtmFromUrl(request),
  };
}

function extractLandingPath(request: NextRequest, referer: string | null) {
  if (referer) {
    try {
      return new URL(referer).pathname;
    } catch {
      return referer;
    }
  }

  return request.nextUrl.pathname;
}

function extractUtmFromUrl(request: NextRequest): TrackingUtm | null {
  const source = request.nextUrl.searchParams.get("utm_source");
  const medium = request.nextUrl.searchParams.get("utm_medium");
  const campaign = request.nextUrl.searchParams.get("utm_campaign");

  if (!source && !medium && !campaign) {
    return null;
  }

  return {
    source,
    medium,
    campaign,
  };
}

function extractIpAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0]?.trim() || realIp?.trim();

  if (!ip) {
    return null;
  }

  return ip;
}

function hashIpAddress(request: NextRequest) {
  const ip = extractIpAddress(request);

  if (!ip) {
    return null;
  }

  return createHash("sha256").update(ip).digest("hex");
}
