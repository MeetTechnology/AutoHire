import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/ask-ai/source-preview/route";
import { createSourcePreviewToken } from "@/lib/ask-ai/source-preview";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import { resetEnvForTests } from "@/lib/env";

const originalEnv = { ...process.env };
const allowedUrl =
  "https://dashscope-file-datacenter-prod-01.oss-cn-beijing.aliyuncs.com/189/106/file.md?Expires=1779353502&OSSAccessKeyId=test&Signature=secret";

afterEach(() => {
  process.env = { ...originalEnv };
  resetEnvForTests();
  vi.restoreAllMocks();
});

describe("Ask AI source preview route", () => {
  it("requires an active session", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/ask-ai/source-preview", {
        method: "POST",
        body: JSON.stringify({ token: "invalid" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid tokens", async () => {
    const response = await POST(createPreviewRequest({ token: "invalid" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "ask_ai_source_preview_invalid_token",
    });
  });

  it("returns markdown for a valid whitelisted source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const body = new TextEncoder().encode("# Source");

        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/markdown",
            "content-length": String(body.byteLength),
          },
        });
      }),
    );

    const token = createSourcePreviewToken({
      url: allowedUrl,
      title: "A03",
      expiresAt: Date.now() + 60_000,
    });
    const response = await POST(createPreviewRequest({ token }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      title: "A03",
      markdown: "# Source",
    });
  });
});

function createPreviewRequest(body: unknown) {
  const cookie = `${getSessionCookieName()}=${createSessionToken({
    invitationId: "invite_test",
    applicationId: "app_test",
    expertId: "expert_test",
  })}`;

  return new NextRequest("http://localhost/api/ask-ai/source-preview", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
