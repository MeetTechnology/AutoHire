import { describe, expect, it } from "vitest";

import {
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
  SUPPLEMENT_INTERNAL_ERROR_CODES,
  jsonSupplementError,
} from "@/lib/material-supplement/errors";

describe("MaterialSupplementServiceError", () => {
  it("preserves status, code, and details", () => {
    const error = new MaterialSupplementServiceError({
      message: "This category is currently under review.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_CATEGORY_REVIEWING,
      details: {
        category: "EDUCATION",
      },
    });

    expect(error.message).toBe("This category is currently under review.");
    expect(error.status).toBe(409);
    expect(error.code).toBe(
      SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_CATEGORY_REVIEWING,
    );
    expect(error.details).toEqual({
      category: "EDUCATION",
    });
  });

  it("supports the newly added supplement expert error codes", () => {
    const error = new MaterialSupplementServiceError({
      message: "The supplement review round limit has been reached.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_ROUND_LIMIT_REACHED,
      details: {
        maxRounds: 3,
      },
    });

    expect(error.code).toBe(
      SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_ROUND_LIMIT_REACHED,
    );
    expect(SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_CATEGORY_UNSUPPORTED).toBe(
      "SUPPLEMENT_CATEGORY_UNSUPPORTED",
    );
  });
});

describe("jsonSupplementError", () => {
  it("returns the API spec error shape with details", async () => {
    const response = jsonSupplementError(
      "This category is currently under review. Please wait until the review is complete.",
      409,
      SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_CATEGORY_REVIEWING,
      { category: "EDUCATION" },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "SUPPLEMENT_CATEGORY_REVIEWING",
        message:
          "This category is currently under review. Please wait until the review is complete.",
        details: {
          category: "EDUCATION",
        },
      },
    });
  });

  it("omits details when none are provided", async () => {
    const response = jsonSupplementError(
      "The callback signature is invalid.",
      401,
      SUPPLEMENT_INTERNAL_ERROR_CODES.INTERNAL_SIGNATURE_INVALID,
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_SIGNATURE_INVALID",
        message: "The callback signature is invalid.",
      },
    });
  });
});
