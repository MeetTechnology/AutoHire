import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { updateApplication } from "@/lib/data/store";
import { assertSupplementAccess } from "@/lib/material-supplement/access";
import { MaterialSupplementServiceError } from "@/lib/material-supplement/errors";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildRequest(url: string, token?: string) {
  const headers = new Headers();

  if (token) {
    headers.set("cookie", `${getSessionCookieName()}=${token}`);
  }

  return new NextRequest(url, { headers });
}

describe("assertSupplementAccess", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("rejects requests without a valid session", async () => {
    await expect(
      assertSupplementAccess({
        request: buildRequest("http://localhost/api/applications/app_secondary"),
        applicationId: "app_secondary",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("returns application not found when the session matches a missing application", async () => {
    const token = createSessionToken({
      applicationId: "app_missing",
      invitationId: "invitation_secondary",
      expertId: "expert_secondary",
    });

    await expect(
      assertSupplementAccess({
        request: buildRequest(
          "http://localhost/api/applications/app_missing/material-supplement",
          token,
        ),
        applicationId: "app_missing",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 404,
      code: "APPLICATION_NOT_FOUND",
    });
  });

  it("does not leak whether a foreign application exists", async () => {
    const token = createSessionToken({
      applicationId: "app_intro",
      invitationId: "invitation_init",
      expertId: "expert_init",
    });

    await expect(
      assertSupplementAccess({
        request: buildRequest(
          "http://localhost/api/applications/app_missing/material-supplement",
          token,
        ),
        applicationId: "app_missing",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("rejects sessions that do not belong to the target application", async () => {
    const token = createSessionToken({
      applicationId: "app_intro",
      invitationId: "invitation_init",
      expertId: "expert_init",
    });

    await expect(
      assertSupplementAccess({
        request: buildRequest(
          "http://localhost/api/applications/app_secondary/material-supplement",
          token,
        ),
        applicationId: "app_secondary",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("rejects applications that are not submitted", async () => {
    const token = createSessionToken({
      applicationId: "app_secondary",
      invitationId: "invitation_secondary",
      expertId: "expert_secondary",
    });

    await expect(
      assertSupplementAccess({
        request: buildRequest(
          "http://localhost/api/applications/app_secondary/material-supplement",
          token,
        ),
        applicationId: "app_secondary",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "APPLICATION_NOT_SUBMITTED",
    });
  });

  it("returns application and session for a valid submitted application", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    const token = createSessionToken({
      applicationId: "app_secondary",
      invitationId: "invitation_secondary",
      expertId: "expert_secondary",
    });

    await expect(
      assertSupplementAccess({
        request: buildRequest(
          "http://localhost/api/applications/app_secondary/material-supplement",
          token,
        ),
        applicationId: "app_secondary",
      }),
    ).resolves.toMatchObject({
      application: {
        id: "app_secondary",
        applicationStatus: "SUBMITTED",
      },
      session: {
        applicationId: "app_secondary",
        invitationId: "invitation_secondary",
      },
    });
  });
});
