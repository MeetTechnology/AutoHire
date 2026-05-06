import { beforeEach, describe, expect, it } from "vitest";

import { createMaterialReviewRun } from "@/lib/data/store";
import {
  assertCategoryNotReviewing,
  assertReviewRoundLimit,
  assertSupportedSupplementCategory,
} from "@/lib/material-supplement/service";
import { MaterialSupplementServiceError } from "@/lib/material-supplement/errors";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("material supplement service guards", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("accepts supported supplement categories", () => {
    expect(assertSupportedSupplementCategory("EDUCATION")).toBe("EDUCATION");
  });

  it("rejects unsupported supplement categories", () => {
    expect(() => assertSupportedSupplementCategory("PRODUCT")).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 400,
        code: "SUPPLEMENT_CATEGORY_UNSUPPORTED",
      }),
    );
  });

  it("blocks a category while its latest review is processing", async () => {
    await expect(
      assertCategoryNotReviewing({
        applicationId: "app_supplement_reviewing",
        category: "IDENTITY",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_CATEGORY_REVIEWING",
      details: {
        category: "IDENTITY",
      },
    });
  });

  it("allows categories whose latest review is not processing", async () => {
    await expect(
      assertCategoryNotReviewing({
        applicationId: "app_supplement_required",
        category: "EMPLOYMENT",
      }),
    ).resolves.toBeUndefined();
  });

  it("allows applications that are still below the round limit", async () => {
    await expect(
      assertReviewRoundLimit({
        applicationId: "app_supplement_required",
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects applications that have reached the review round limit", async () => {
    await createMaterialReviewRun({
      applicationId: "app_supplement_required",
      runNo: 3,
      triggerType: "SUPPLEMENT_UPLOAD",
      triggeredCategory: "EMPLOYMENT",
      status: "QUEUED",
    });

    await expect(
      assertReviewRoundLimit({
        applicationId: "app_supplement_required",
      }),
    ).rejects.toMatchObject<Partial<MaterialSupplementServiceError>>({
      status: 409,
      code: "SUPPLEMENT_ROUND_LIMIT_REACHED",
      details: {
        maxRounds: 3,
      },
    });
  });
});
