import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { GET as exportBatch } from "@/app/api/ops/invitations/batches/[batchId]/export/route";
import { POST as generateBatch } from "@/app/api/ops/invitations/generate/route";
import {
  createAuditDashboardCookie,
  getAuditDashboardCookieName,
} from "@/lib/audit/auth";
import { resetEnvForTests } from "@/lib/env";
import type { InvitationGenerationBatchSummary } from "@/lib/invitations/generation";

const originalEnv = { ...process.env };

type GeneratePayload = {
  readonly batch: InvitationGenerationBatchSummary;
};

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function authCookieHeader() {
  return `${getAuditDashboardCookieName()}=${createAuditDashboardCookie("ops-token")}`;
}

function createGenerateRequest(body: unknown, authorized = true) {
  return new NextRequest("http://localhost/api/ops/invitations/generate", {
    method: "POST",
    headers: authorized
      ? {
          cookie: authCookieHeader(),
          "content-type": "application/json",
        }
      : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("ops invitation generation routes", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      APP_RUNTIME_MODE: "memory",
      APP_BASE_URL: "https://example.test",
      AUDIT_DASHBOARD_TOKENS: "ops-token",
      AUDIT_DASHBOARD_COOKIE_NAME: "ops_test_cookie",
      AUDIT_DASHBOARD_COOKIE_MAX_AGE_SECONDS: "300",
      INVITE_TOKEN_SECRET: "ops-route-secret",
    };
    resetEnvForTests();
    resetMemoryStore();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTests();
    resetMemoryStore();
  });

  it("requires an authorized ops cookie", async () => {
    const response = await generateBatch(
      createGenerateRequest(
        {
          algorithm: "SHA256",
          count: 1,
          idempotencyKey: "route-unauthorized",
        },
        false,
      ),
    );

    expect(response.status).toBe(401);
  });

  it("rejects invalid generation payloads", async () => {
    const response = await generateBatch(
      createGenerateRequest({
        algorithm: "MD5",
        count: 1001,
        idempotencyKey: "bad",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVITATION_GENERATION_INVALID_PAYLOAD",
    });
  });

  it("generates an idempotent batch", async () => {
    const body = {
      algorithm: "SHA384",
      count: 2,
      expiredDays: 30,
      idempotencyKey: "route-idempotent-key",
    };

    const first = await generateBatch(createGenerateRequest(body));
    const second = await generateBatch(createGenerateRequest(body));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstPayload = (await first.json()) as GeneratePayload;
    const secondPayload = (await second.json()) as GeneratePayload;

    expect(secondPayload.batch.id).toBe(firstPayload.batch.id);
    expect(
      secondPayload.batch.items.map((item) => item.plaintextToken),
    ).toEqual(firstPayload.batch.items.map((item) => item.plaintextToken));
  });

  it("exports the generated batch as an Excel workbook", async () => {
    const generated = await generateBatch(
      createGenerateRequest({
        algorithm: "SHA256",
        count: 2,
        idempotencyKey: "route-export-key",
      }),
    );
    const payload = (await generated.json()) as GeneratePayload;
    const response = await exportBatch(
      new NextRequest(
        `http://localhost/api/ops/invitations/batches/${payload.batch.id}/export`,
        { headers: { cookie: authCookieHeader() } },
      ),
      { params: Promise.resolve({ batchId: payload.batch.id }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    const bytes = Buffer.from(await response.arrayBuffer());
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const sheet = workbook.Sheets["Invitation Tokens"];
    expect(sheet).toBeDefined();

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    expect(rows).toHaveLength(2);
  });
});
