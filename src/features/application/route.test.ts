import { describe, expect, it } from "vitest";

import {
  buildApplyFlowStepLinks,
  getReachableFlowStep,
  resolveRouteFromStatus,
} from "@/features/application/route";

describe("resolveRouteFromStatus", () => {
  it("routes initial and post-intro states to the expected entry pages", () => {
    expect(resolveRouteFromStatus("INIT")).toBe("/apply");
    expect(resolveRouteFromStatus("INTRO_VIEWED")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("CV_UPLOADED")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("CV_EXTRACTING")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("CV_EXTRACTION_REVIEW")).toBe("/apply/resume");
  });

  it("routes CV review states to the unified CV Review page", () => {
    expect(resolveRouteFromStatus("CV_ANALYZING")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("INFO_REQUIRED")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("ELIGIBLE")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("SECONDARY_ANALYZING")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("SECONDARY_REVIEW")).toBe("/apply/resume");
    expect(resolveRouteFromStatus("SECONDARY_FAILED")).toBe("/apply/resume");
  });

  it("routes submitted state to the submission-complete page", () => {
    expect(resolveRouteFromStatus("SUBMITTED")).toBe(
      "/apply/submission-complete",
    );
  });

  it("maps later review states to the additional-information step", () => {
    expect(getReachableFlowStep("CV_ANALYZING")).toBe(1);
    expect(getReachableFlowStep("CV_EXTRACTING")).toBe(1);
    expect(getReachableFlowStep("CV_EXTRACTION_REVIEW")).toBe(1);
    expect(getReachableFlowStep("INELIGIBLE")).toBe(1);
    expect(getReachableFlowStep("ELIGIBLE")).toBe(2);
    expect(getReachableFlowStep("INFO_REQUIRED")).toBe(2);
    expect(getReachableFlowStep("SECONDARY_REVIEW")).toBe(2);
    expect(getReachableFlowStep("MATERIALS_IN_PROGRESS")).toBe(2);
    expect(getReachableFlowStep("SUBMITTED")).toBe(3);
  });
});

describe("buildApplyFlowStepLinks", () => {
  it("sends Additional Information to the correct editable or review surface", () => {
    expect(buildApplyFlowStepLinks("INFO_REQUIRED")[2]).toBe(
      "/apply/resume?view=additional",
    );
    expect(buildApplyFlowStepLinks("ELIGIBLE")[2]).toBe("/apply/materials");
    expect(buildApplyFlowStepLinks("SECONDARY_REVIEW")[2]).toBe(
      "/apply/materials",
    );
    expect(buildApplyFlowStepLinks("MATERIALS_IN_PROGRESS")[2]).toBe(
      "/apply/materials",
    );
    expect(buildApplyFlowStepLinks("SUBMITTED")[2]).toBe(
      "/apply/materials?view=review",
    );
    expect(buildApplyFlowStepLinks(null)[2]).toBe("/apply/materials");
  });

  it("keeps CV Review on the unified route", () => {
    expect(buildApplyFlowStepLinks("INTRO_VIEWED")[1]).toBe(
      "/apply/resume?view=review",
    );
  });

  it("keeps Submission Complete on the submission-complete route", () => {
    expect(buildApplyFlowStepLinks("ELIGIBLE")[3]).toBe(
      "/apply/submission-complete",
    );
  });
});
