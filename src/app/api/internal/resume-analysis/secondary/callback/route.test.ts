import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/internal/resume-analysis/secondary/callback/route";
import { upsertAutoSecondaryRun } from "@/lib/data/store";
import { resetEnvForTests } from "@/lib/env";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("POST /api/internal/resume-analysis/secondary/callback", () => {
  beforeEach(() => {
    resetMemoryStore();
    process.env.NODE_ENV = "test";
    process.env.APP_RUNTIME_MODE = "memory";
    process.env.RESUME_ANALYSIS_CALLBACK_SECRET = "callback-secret";
    resetEnvForTests();
  });

  it("accepts a signed callback and returns duplicate success on replay", async () => {
    await upsertAutoSecondaryRun({
      applicationId: "app_intro",
      resumeFileId: "resume_intro",
      idempotencyKey: "resume-secondary:app_intro:resume_intro:1",
      externalJobId: "123",
      externalRunId: "456",
      status: "pending",
    });
    const rawBody = JSON.stringify({
      event: "resume_secondary.completed_partial",
      event_id: "route-event-123-456",
      application_id: "app_intro",
      expert_id: "expert_init",
      resume_file_id: "resume_intro",
      job_id: 123,
      run_id: 456,
      status: "completed_partial",
      fields: Array.from({ length: 41 }, (_, index) => ({
        no: index + 1,
        column: null,
        label: `NO.${index + 1}`,
        value: "",
        missing: true,
      })),
      raw_results: [],
      export: { status: "skipped" },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${createHmac("sha256", "callback-secret")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")}`;
    const request = () =>
      new NextRequest(
        "http://localhost/api/internal/resume-analysis/secondary/callback",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Event-ID": "route-event-123-456",
            "X-Timestamp": timestamp,
            "X-Signature": signature,
          },
          body: rawBody,
        },
      );

    const first = await POST(request());
    const replay = await POST(request());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ accepted: true, duplicate: false });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ accepted: true, duplicate: true });
  });
});
