import { describe, expect, it } from "vitest";

import { resolveRouteFromStatus } from "@/features/application/route";

describe("resolveRouteFromStatus", () => {
  it("routes intro states to apply", () => {
    expect(resolveRouteFromStatus("INIT")).toBe("/apply");
    expect(resolveRouteFromStatus("INTRO_VIEWED")).toBe("/apply");
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
});
