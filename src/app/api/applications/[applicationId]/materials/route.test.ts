import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import {
  getEditableSecondaryAnalysisSnapshot,
  startSecondaryAnalysis,
} from "@/lib/application/service";
import { GET as getMaterialsRoute } from "@/app/api/applications/[applicationId]/materials/route";
import { POST as enterMaterialsRoute } from "@/app/api/applications/[applicationId]/materials/enter/route";
import { POST as submitRoute } from "@/app/api/applications/[applicationId]/submit/route";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildAuthorizedRequest(url: string, init?: RequestInit) {
  const token = createSessionToken({
    applicationId: "app_secondary",
    invitationId: "invitation_secondary",
    expertId: "expert_secondary",
  });

  return new NextRequest(url, {
    ...init,
    headers: {
      cookie: `${getSessionCookieName()}=${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

describe("materials stage routes", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("blocks materials access before detailed analysis review is complete", async () => {
    const response = await getMaterialsRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_secondary/materials"),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe("MATERIALS_STAGE_NOT_READY");
  });

  it("enters the materials stage after detailed analysis review is ready", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    const response = await enterMaterialsRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_secondary/materials/enter", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.applicationStatus).toBe("MATERIALS_IN_PROGRESS");
    expect(payload.nextRoute).toBe("/apply/materials");
  });

  it("blocks final submission before the materials stage starts", async () => {
    const response = await submitRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_secondary/submit", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe("SUBMISSION_STAGE_NOT_READY");
  });
});
