import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import {
  getEditableSecondaryAnalysisSnapshot,
  startSecondaryAnalysis,
} from "@/lib/application/service";
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

  const headers = new Headers(init?.headers);
  headers.set("cookie", `${getSessionCookieName()}=${token}`);

  return new NextRequest(url, {
    method: init?.method,
    headers,
    body: init?.body,
    duplex: init?.body ? ("half" as const) : undefined,
  });
}

describe("submit route minimum materials requirements", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("rejects submission when required materials are missing", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    await enterMaterialsRoute(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_secondary/materials/enter",
        { method: "POST" },
      ),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );

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
    expect(payload.code).toBe("MATERIALS_MINIMUM_REQUIREMENTS_NOT_MET");
  });
});
