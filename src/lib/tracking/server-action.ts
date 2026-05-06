import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";

import { trackEvent } from "@/lib/tracking/service";
import type { TrackingEventInput } from "@/lib/tracking/types";

export async function trackEventFromServerAction(
  input: Omit<
    TrackingEventInput,
    | "sessionId"
    | "requestId"
    | "ipHash"
    | "userAgent"
    | "referer"
    | "landingPath"
    | "utm"
    | "ipAddress"
  > &
    Partial<
      Pick<
        TrackingEventInput,
        | "sessionId"
        | "requestId"
        | "ipAddress"
        | "ipHash"
        | "userAgent"
        | "referer"
        | "landingPath"
        | "utm"
      >
    >,
) {
  const requestHeaders = await headers();
  const ipAddress =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    requestHeaders.get("x-real-ip") ??
    null;
  const ipHash = ipAddress
    ? createHash("sha256").update(ipAddress).digest("hex")
    : null;

  return trackEvent({
    ...input,
    sessionId: input.sessionId ?? randomUUID(),
    requestId: input.requestId ?? randomUUID(),
    ipAddress: input.ipAddress ?? ipAddress,
    ipHash: input.ipHash ?? ipHash,
    userAgent: input.userAgent ?? requestHeaders.get("user-agent"),
    referer: input.referer ?? requestHeaders.get("referer"),
    landingPath: input.landingPath ?? null,
    utm: input.utm ?? null,
  });
}
