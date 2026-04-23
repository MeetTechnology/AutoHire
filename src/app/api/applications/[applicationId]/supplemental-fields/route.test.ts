import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST as supplementalPost } from "@/app/api/applications/[applicationId]/supplemental-fields/route";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { buildApplicationSnapshot, updateApplication } from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildAuthorizedRequest(
  input: {
    applicationId: string;
    invitationId: string;
    expertId: string;
  },
  init?: RequestInit,
) {
  const token = createSessionToken(input);
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${getSessionCookieName()}=${token}`);

  return new NextRequest(
    `http://localhost/api/applications/${input.applicationId}/supplemental-fields`,
    {
      method: init?.method,
      headers,
      body: init?.body,
      duplex: init?.body ? ("half" as const) : undefined,
    },
  );
}

describe("POST /api/applications/[applicationId]/supplemental-fields", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns eligible without analysis job for contact-only completion", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "INFO_REQUIRED",
      screeningPassportFullName: null,
      screeningContactEmail: null,
      screeningWorkEmail: null,
      screeningPhoneNumber: null,
    });

    const response = await supplementalPost(
      buildAuthorizedRequest(
        {
          applicationId: "app_secondary",
          invitationId: "invitation_secondary",
          expertId: "expert_secondary",
        },
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              name: "Route Expert",
              personal_email: "route.expert@example.com",
              work_email: "route.expert@university.edu",
            },
          }),
        },
      ),
      { params: Promise.resolve({ applicationId: "app_secondary" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      applicationId: "app_secondary",
      analysisJobId: null,
      applicationStatus: "ELIGIBLE",
    });

    const snapshot = await buildApplicationSnapshot("app_secondary");
    expect(snapshot?.screeningWorkEmail).toBe("route.expert@university.edu");
    expect(snapshot?.screeningPhoneNumber).toBeNull();
  });

  it("returns reanalyzing for insufficient-info submissions", async () => {
    const response = await supplementalPost(
      buildAuthorizedRequest(
        {
          applicationId: "app_progress",
          invitationId: "invitation_progress",
          expertId: "expert_progress",
        },
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              highest_degree: "Doctorate",
              current_employer: "Example University",
            },
          }),
        },
      ),
      { params: Promise.resolve({ applicationId: "app_progress" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      applicationId: "app_progress",
      applicationStatus: "REANALYZING",
    });
  });
});
