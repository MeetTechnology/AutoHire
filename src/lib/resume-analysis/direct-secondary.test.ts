import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  acceptDirectSecondaryCallback,
  parseDirectSecondaryCallback,
  verifyDirectSecondaryCallback,
} from "@/lib/resume-analysis/direct-secondary";
import {
  getLatestAutoSecondaryRun,
  listSecondaryAnalysisFieldValues,
  upsertAutoSecondaryRun,
} from "@/lib/data/store";
import { resetEnvForTests } from "@/lib/env";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function fields() {
  return Array.from({ length: 41 }, (_, index) => ({
    no: index + 1,
    column: null,
    label: `NO.${index + 1}`,
    value: index === 0 ? "Direct Expert" : "",
    missing: index !== 0,
  }));
}

describe("direct secondary integration", () => {
  beforeEach(() => {
    resetMemoryStore();
    process.env.NODE_ENV = "test";
    process.env.APP_RUNTIME_MODE = "memory";
    process.env.RESUME_ANALYSIS_CALLBACK_SECRET = "callback-secret";
    resetEnvForTests();
  });

  it("verifies the raw callback body and unix timestamp signature", () => {
    const rawBody = JSON.stringify({ event_id: "event-1" });
    const timestamp = "1781222400";
    const signature = `sha256=${createHmac("sha256", "callback-secret")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex")}`;
    const headers = new Headers({
      "X-Event-ID": "event-1",
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    });

    expect(
      verifyDirectSecondaryCallback({
        headers,
        rawBody,
        nowSeconds: 1781222400,
      }),
    ).toBe("event-1");
  });

  it("persists 41 callback fields and treats event replay as duplicate", async () => {
    await upsertAutoSecondaryRun({
      applicationId: "app_intro",
      resumeFileId: "resume_intro",
      idempotencyKey: "resume-secondary:app_intro:resume_intro:1",
      externalJobId: "123",
      externalRunId: "456",
      status: "pending",
    });
    const payload = parseDirectSecondaryCallback(
      JSON.stringify({
        event: "resume_secondary.completed_partial",
        event_id: "event-123-456",
        application_id: "app_intro",
        expert_id: "expert_init",
        resume_file_id: "resume_intro",
        job_id: 123,
        run_id: 456,
        status: "completed_partial",
        fields: fields(),
        raw_results: [],
        export: { status: "skipped" },
      }),
    );

    await expect(acceptDirectSecondaryCallback(payload)).resolves.toEqual({
      accepted: true,
      duplicate: false,
    });
    await expect(acceptDirectSecondaryCallback(payload)).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });

    const run = await getLatestAutoSecondaryRun("app_intro");
    expect(run?.status).toBe("completed_partial");
    const stored = await listSecondaryAnalysisFieldValues(run!.id);
    expect(stored).toHaveLength(41);
    expect(stored[0]).toMatchObject({
      no: 1,
      sourceValue: "Direct Expert",
      effectiveValue: "Direct Expert",
      isMissing: false,
    });
  });
});
