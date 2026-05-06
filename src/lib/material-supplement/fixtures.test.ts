import { describe, expect, it } from "vitest";

import { SAMPLE_TOKENS } from "@/lib/data/sample-data";
import { getMaterialSupplementSummaryData } from "@/lib/data/store";
import {
  MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS,
  getMaterialSupplementSampleFixtures,
} from "@/lib/material-supplement/fixtures";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("material supplement sample fixtures", () => {
  it("covers reviewing, required, and satisfied submitted applications", () => {
    const fixtures = getMaterialSupplementSampleFixtures(new Date("2026-01-01T00:00:00Z"));

    expect(fixtures.scenarios.reviewing.applicationId).toBe(
      MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
    );
    expect(
      fixtures.scenarios.reviewing.materialCategoryReviews.some(
        (review) => review.status === "PROCESSING" && review.isLatest,
      ),
    ).toBe(true);

    expect(
      fixtures.scenarios.required.supplementRequests.some(
        (request) => request.isLatest && request.status === "PENDING",
      ),
    ).toBe(true);

    expect(
      fixtures.scenarios.satisfied.supplementRequests.some(
        (request) => request.isLatest && request.status === "SATISFIED",
      ),
    ).toBe(true);
    expect(
      fixtures.scenarios.satisfied.supplementRequests.some(
        (request) => !request.isLatest,
      ),
    ).toBe(true);
  });

  it("preserves existing sample tokens while exposing new supplement tokens", () => {
    expect(SAMPLE_TOKENS.init).toBe("sample-init-token");
    expect(SAMPLE_TOKENS.progress).toBe("sample-progress-token");
    expect(SAMPLE_TOKENS.submitted).toBe("sample-submitted-token");
    expect(SAMPLE_TOKENS.supplementReviewing).toBe(
      "sample-supplement-reviewing-token",
    );
    expect(SAMPLE_TOKENS.supplementRequired).toBe(
      "sample-supplement-required-token",
    );
    expect(SAMPLE_TOKENS.supplementSatisfied).toBe(
      "sample-supplement-satisfied-token",
    );
  });

  it("keeps the original submitted sample without supplement data", async () => {
    process.env.APP_RUNTIME_MODE = "memory";
    resetMemoryStore();

    const summary = await getMaterialSupplementSummaryData("app_submitted");

    expect(summary.materialSupplementStatus).toBe("NOT_STARTED");
    expect(summary.pendingRequestCount).toBe(0);
    expect(summary.satisfiedRequestCount).toBe(0);
  });
});
