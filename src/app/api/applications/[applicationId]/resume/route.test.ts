import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST as resumePost } from "@/app/api/applications/[applicationId]/resume/route";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { buildApplicationSnapshot } from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildAuthorizedRequest(url: string, init?: RequestInit) {
  const token = createSessionToken({
    applicationId: "app_intro",
    invitationId: "invitation_init",
    expertId: "expert_init",
  });

  const headers = new Headers(init?.headers);
  headers.set("cookie", `${getSessionCookieName()}=${token}`);

  return new NextRequest(url, {
    method: init?.method,
    headers,
    body: init?.body,
    duplex: init?.body ? ("half" as const) : undefined,
  });
}

describe("POST /api/applications/[applicationId]/resume", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns 400 when CV review identity is missing", async () => {
    const response = await resumePost(
      buildAuthorizedRequest("http://localhost/api/applications/app_intro/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "cv.pdf",
          fileType: "application/pdf",
          fileSize: 1500,
          objectKey: "applications/app_intro/resume/cv.pdf",
        }),
      }),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(400);
  });

  it("persists CV review identity on confirm", async () => {
    const response = await resumePost(
      buildAuthorizedRequest("http://localhost/api/applications/app_intro/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: "cv.pdf",
          fileType: "application/pdf",
          fileSize: 1500,
          objectKey: "applications/app_intro/resume/cv.pdf",
          screeningPassportFullName: "  Passport User  ",
          screeningContactEmail: "  Passport.User@Example.COM ",
        }),
      }),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(200);

    const snapshot = await buildApplicationSnapshot("app_intro");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.screeningPassportFullName).toBe("Passport User");
    expect(snapshot?.screeningContactEmail).toBe("passport.user@example.com");
    expect(snapshot?.applicationStatus).toBe("CV_ANALYZING");
  });
});
