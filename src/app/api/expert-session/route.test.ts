import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { GET as expertSessionGet } from "@/app/api/expert-session/route";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth/session";
import { getApplicationById, listInviteAccessLogs } from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("GET /api/expert-session", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("logs invalid invite access attempts", async () => {
    const response = await expertSessionGet(
      new NextRequest("http://localhost/api/expert-session?token=bad-token", {
        headers: {
          "x-autohire-session-id": "sess_invalid",
          "x-autohire-request-id": "req_invalid",
          "x-forwarded-for": "203.0.113.10",
          referer: "http://localhost/apply?t=bad-token",
        },
      }),
    );

    expect(response.status).toBe(401);

    const accessLogs = await listInviteAccessLogs();
    expect(accessLogs[0]).toMatchObject({
      accessResult: "INVALID",
      sessionId: "sess_invalid",
      requestId: "req_invalid",
      ipAddress: "203.0.113.10",
      applicationId: null,
    });
  });

  it("logs valid entry and session restore events", async () => {
    const initialResponse = await expertSessionGet(
      new NextRequest(
        "http://localhost/api/expert-session?token=sample-init-token",
        {
          headers: {
            "x-autohire-session-id": "sess_valid",
            "x-autohire-request-id": "req_valid",
            "x-forwarded-for": "198.51.100.20",
            referer: "http://localhost/apply?t=sample-init-token",
          },
        },
      ),
    );

    expect(initialResponse.status).toBe(200);

    const setCookie = initialResponse.headers.get("set-cookie");
    expect(setCookie).toContain(getSessionCookieName());
    const cookieValue =
      setCookie?.match(new RegExp(`${getSessionCookieName()}=([^;]+)`))?.[1] ??
      "";
    const session = verifySessionToken(cookieValue);
    expect(session).not.toBeNull();

    const restoredResponse = await expertSessionGet(
      new NextRequest("http://localhost/api/expert-session", {
        headers: {
          cookie: `${getSessionCookieName()}=${cookieValue}`,
          "x-autohire-session-id": "sess_restore",
          "x-autohire-request-id": "req_restore",
          "x-forwarded-for": "198.51.100.21",
          referer: "http://localhost/apply/resume",
        },
      }),
    );

    expect(restoredResponse.status).toBe(200);

    const accessLogs = await listInviteAccessLogs();
    expect(accessLogs.some((item) => item.accessResult === "VALID")).toBe(true);
    expect(
      accessLogs.some(
        (item) =>
          item.accessResult === "SESSION_RESTORE" &&
          item.sessionId === "sess_restore" &&
          item.ipAddress === "198.51.100.21",
      ),
    ).toBe(true);

    const application = await getApplicationById(session?.applicationId ?? "");
    expect(application?.firstAccessedAt).not.toBeNull();
    expect(application?.lastAccessedAt).not.toBeNull();
  });
});
