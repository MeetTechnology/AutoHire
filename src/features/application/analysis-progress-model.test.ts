import { describe, expect, it } from "vitest";

import {
  MS_LONG_WAIT,
  MS_SEGMENT_1_END,
  MS_SEGMENT_2_END,
  MS_SEGMENT_3_END,
  PRE_COMPLETE_CAP,
  getDisplayedProgressRatio,
  getPrimaryStageMessageIndex,
  getSecondaryStageMessageIndex,
  sanitizeProgressDisplayText,
  shouldShowApiProgressSecondary,
} from "./analysis-progress-model";

describe("getDisplayedProgressRatio", () => {
  it("is monotonic for increasing elapsed", () => {
    const steps = [0, 100, 3000, 6_000, 10_000, 16_000, 22_000, 30_000, 45_000];
    let previous = -1;

    for (const ms of steps) {
      const next = getDisplayedProgressRatio(ms);

      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it("matches design checkpoints", () => {
    expect(getDisplayedProgressRatio(0)).toBe(0);
    expect(getDisplayedProgressRatio(MS_SEGMENT_1_END)).toBeCloseTo(0.28, 5);
    expect(getDisplayedProgressRatio(MS_SEGMENT_2_END)).toBeCloseTo(0.78, 5);
    expect(getDisplayedProgressRatio(MS_SEGMENT_3_END)).toBeCloseTo(
      PRE_COMPLETE_CAP,
      5,
    );
    expect(getDisplayedProgressRatio(90_000)).toBe(PRE_COMPLETE_CAP);
  });

  it("at ~16s lands in 0.70–0.85 of full track (not cap-scaled)", () => {
    const r = getDisplayedProgressRatio(16_000);

    expect(r).toBeGreaterThanOrEqual(0.7);
    expect(r).toBeLessThanOrEqual(0.85);
  });
});

describe("getPrimaryStageMessageIndex", () => {
  it("advances at band boundaries", () => {
    expect(getPrimaryStageMessageIndex(0)).toBe(0);
    expect(getPrimaryStageMessageIndex(22_499)).toBe(0);
    expect(getPrimaryStageMessageIndex(22_500)).toBe(1);
    expect(getPrimaryStageMessageIndex(120_000)).toBe(1);
  });
});

describe("getSecondaryStageMessageIndex", () => {
  it("uses two bands", () => {
    expect(getSecondaryStageMessageIndex(0)).toBe(0);
    expect(getSecondaryStageMessageIndex(14_999)).toBe(0);
    expect(getSecondaryStageMessageIndex(15_000)).toBe(1);
    expect(getSecondaryStageMessageIndex(120_000)).toBe(1);
  });
});

describe("sanitizeProgressDisplayText", () => {
  it("strips delimiter patterns", () => {
    expect(sanitizeProgressDisplayText("Hello [[[x]]] world")).toBe("Hello x world");
    expect(sanitizeProgressDisplayText("{{{ok}}}")).toBe("ok");
    expect(sanitizeProgressDisplayText("!!!Year of Birth!!!")).toBe("Year of Birth");
  });
});

describe("shouldShowApiProgressSecondary", () => {
  it("detects queued job status", () => {
    expect(shouldShowApiProgressSecondary("QUEUED", "")).toBe(true);
  });

  it("detects sync wording", () => {
    expect(
      shouldShowApiProgressSecondary("PROCESSING", "Syncing the latest result."),
    ).toBe(true);
  });
});

describe("long-wait copy", () => {
  it("appends suffix after 60s for primary message", async () => {
    const { getPrimaryStageMessage } = await import("./analysis-progress-model");

    const normal = getPrimaryStageMessage(MS_LONG_WAIT);
    const long = getPrimaryStageMessage(MS_LONG_WAIT + 1);

    expect(long.length).toBeGreaterThan(normal.length);
    expect(long).toContain("Still processing");
  });
});
