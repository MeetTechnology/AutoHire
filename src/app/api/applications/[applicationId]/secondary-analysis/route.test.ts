import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { startSecondaryAnalysis } from "@/lib/application/service";
import { GET as getEditableRoute } from "@/app/api/applications/[applicationId]/secondary-analysis/editable/route";
import { POST as saveEditableRoute } from "@/app/api/applications/[applicationId]/secondary-analysis/save/route";

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

describe("secondary analysis editable routes", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns the editable secondary snapshot", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    const request = buildAuthorizedRequest(
      `http://localhost/api/applications/app_secondary/secondary-analysis/editable?runId=${started.runId}`,
    );

    const response = await getEditableRoute(request, {
      params: Promise.resolve({ applicationId: "app_secondary" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.runId).toBe(started.runId);
    expect(payload.fields.length).toBeGreaterThan(0);
    expect(payload).toHaveProperty("missingCount");
  });

  it("saves editable secondary fields using both field keys and NO numbers", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    const request = buildAuthorizedRequest(
      "http://localhost/api/applications/app_secondary/secondary-analysis/save",
      {
        method: "POST",
        body: JSON.stringify({
          runId: started.runId,
          fields: {
            secondary_field_01: {
              value: "Edited Through Field Key",
              hasOverride: true,
            },
            15: {
              value: "",
              hasOverride: true,
            },
          },
        }),
      },
    );

    const response = await saveEditableRoute(request, {
      params: Promise.resolve({ applicationId: "app_secondary" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(
      payload.fields.find((field: { no: number }) => field.no === 1)?.effectiveValue,
    ).toBe("Edited Through Field Key");
    expect(
      payload.fields.find((field: { no: number }) => field.no === 15)?.effectiveValue,
    ).toBe("");
  });

  it("rejects unsupported editable secondary fields", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    const request = buildAuthorizedRequest(
      "http://localhost/api/applications/app_secondary/secondary-analysis/save",
      {
        method: "POST",
        body: JSON.stringify({
          runId: started.runId,
          fields: {
            unsupported_field: "bad",
          },
        }),
      },
    );

    const response = await saveEditableRoute(request, {
      params: Promise.resolve({ applicationId: "app_secondary" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe("SECONDARY_ANALYSIS_FIELD_UNSUPPORTED");
  });

  it("returns not found when the secondary run does not exist", async () => {
    const request = buildAuthorizedRequest(
      "http://localhost/api/applications/app_secondary/secondary-analysis/save",
      {
        method: "POST",
        body: JSON.stringify({
          runId: "missing-run",
          fields: {
            secondary_field_01: "Edited name",
          },
        }),
      },
    );

    const response = await saveEditableRoute(request, {
      params: Promise.resolve({ applicationId: "app_secondary" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.code).toBe("SECONDARY_ANALYSIS_RUN_NOT_FOUND");
  });
});
