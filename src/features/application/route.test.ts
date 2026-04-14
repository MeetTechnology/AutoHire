import { describe, expect, it } from "vitest";

import {
  getReachableFlowStep,
  resolveRouteFromStatus,
} from "@/features/application/route";

describe("resolveRouteFromStatus", () => {
  it("routes initial and post-intro states to the expected entry pages", () => {
    expect(resolveRouteFromStatus("INIT")).toBe("/apply");
    expect(resolveRouteFromStatus("INTRO_VIEWED")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("CV_UPLOADED")).toBe("/apply/resume");
  });

  it("routes result states to result page", () => {
    expect(resolveRouteFromStatus("CV_ANALYZING")).toBe("/apply/result");
    expect(resolveRouteFromStatus("INFO_REQUIRED")).toBe("/apply/result");
    expect(resolveRouteFromStatus("ELIGIBLE")).toBe("/apply/result");
    expect(resolveRouteFromStatus("SECONDARY_ANALYZING")).toBe("/apply/result");
    expect(resolveRouteFromStatus("SECONDARY_REVIEW")).toBe("/apply/result");
    expect(resolveRouteFromStatus("SECONDARY_FAILED")).toBe("/apply/result");
  });

  it("routes submitted state to materials page", () => {
    expect(resolveRouteFromStatus("SUBMITTED")).toBe("/apply/materials");
  });

  it("maps later review states to the additional-information step", () => {
    expect(getReachableFlowStep("ELIGIBLE")).toBe(2);
    expect(getReachableFlowStep("INFO_REQUIRED")).toBe(3);
    expect(getReachableFlowStep("SECONDARY_REVIEW")).toBe(3);
    expect(getReachableFlowStep("MATERIALS_IN_PROGRESS")).toBe(4);
    expect(getReachableFlowStep("SUBMITTED")).toBe(4);
  });
});
