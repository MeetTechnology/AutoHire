import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import {
  getEditableSecondaryAnalysisSnapshot,
  startSecondaryAnalysis,
} from "@/lib/application/service";
import { updateApplication } from "@/lib/data/store";
import { GET as getMaterialsRoute } from "@/app/api/applications/[applicationId]/materials/route";
import { POST as enterMaterialsRoute } from "@/app/api/applications/[applicationId]/materials/enter/route";
import { POST as saveProductDescriptionRoute } from "@/app/api/applications/[applicationId]/materials/product-description/route";
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

describe("materials stage routes", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("blocks materials access before the materials stage is active", async () => {
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

  it("enters the materials stage when CV review allows materials entry", async () => {
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

  it("returns ten material categories after entering materials stage", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    await enterMaterialsRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_secondary/materials/enter", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );

    const response = await getMaterialsRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_secondary/materials"),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(payload).sort()).toEqual([
      "book",
      "conference",
      "education",
      "employment",
      "honor",
      "identity",
      "paper",
      "patent",
      "product",
      "project",
    ]);
  });

  it("saves product innovation description during materials stage", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    await enterMaterialsRoute(
      buildAuthorizedRequest("http://localhost/api/applications/app_secondary/materials/enter", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );

    const response = await saveProductDescriptionRoute(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_secondary/materials/product-description",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "Our aquatic drone reduces fuel use by 40%.",
          }),
        },
      ),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.productInnovationDescription).toContain("aquatic drone");
  });

  it("allows product innovation description updates after submission", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "SUBMITTED",
    });

    const response = await saveProductDescriptionRoute(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_secondary/materials/product-description",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "Submitted application with refreshed product summary.",
          }),
        },
      ),
      {
        params: Promise.resolve({ applicationId: "app_secondary" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.productInnovationDescription).toContain("refreshed product");
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
