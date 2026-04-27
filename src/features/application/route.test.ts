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
    expect(resolveRouteFromStatus("CV_EXTRACTING")).toBe("/apply/result");
    expect(resolveRouteFromStatus("CV_EXTRACTION_REVIEW")).toBe(
      "/apply/result",
    );
  });

  it("routes post-upload CV review states to the result page", () => {
    expect(resolveRouteFromStatus("CV_ANALYZING")).toBe("/apply/result");
    expect(resolveRouteFromStatus("INFO_REQUIRED")).toBe("/apply/result");
    expect(resolveRouteFromStatus("ELIGIBLE")).toBe("/apply/result");
    expect(resolveRouteFromStatus("SECONDARY_ANALYZING")).toBe("/apply/result");
    expect(resolveRouteFromStatus("SECONDARY_REVIEW")).toBe("/apply/result");
    expect(resolveRouteFromStatus("SECONDARY_FAILED")).toBe("/apply/result");
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
      "/apply/result?view=additional",
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

  it("keeps upload states on resume and post-upload states on result", () => {
    expect(buildApplyFlowStepLinks("INTRO_VIEWED")[1]).toBe(
      "/apply/resume?view=review",
    );
    expect(buildApplyFlowStepLinks("CV_UPLOADED")[1]).toBe(
      "/apply/resume?view=review",
    );
    expect(buildApplyFlowStepLinks("CV_EXTRACTING")[1]).toBe(
      "/apply/result?view=review",
    );
  });

  it("keeps Submission Complete on the submission-complete route", () => {
    expect(buildApplyFlowStepLinks("ELIGIBLE")[3]).toBe(
      "/apply/submission-complete",
    );
  });
});
