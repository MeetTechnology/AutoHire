import { describe, expect, it } from "vitest";

import type { MaterialCategoryReviewResult } from "@/lib/material-review/types";
import { MaterialSupplementServiceError } from "@/lib/material-supplement/errors";
import {
  adaptMaterialReviewCategoryResult,
  adaptSupplementReviewCallbackCategory,
} from "@/lib/material-supplement/result-adapter";

describe("material supplement result adapter", () => {
  it("adapts a supported supplement-required category result", () => {
    expect(
      adaptMaterialReviewCategoryResult({
        category: "EDUCATION",
        status: "COMPLETED",
        aiMessage: "Education proof is missing.",
        resultPayload: {
          supplementRequired: true,
          requests: [
            {
              title: "Doctoral degree proof required",
              reason: "The degree is not clearly proven.",
              suggestedMaterials: ["Doctoral degree certificate"],
              aiMessage: "Please upload doctoral degree proof.",
            },
          ],
        },
        rawResultPayload: {
          ignored: true,
        },
      }),
    ).toEqual({
      category: "EDUCATION",
      status: "COMPLETED",
      aiMessage: "Education proof is missing.",
      resultPayload: {
        supplementRequired: true,
        requests: [
          {
            title: "Doctoral degree proof required",
            reason: "The degree is not clearly proven.",
            suggestedMaterials: ["Doctoral degree certificate"],
            aiMessage: "Please upload doctoral degree proof.",
          },
        ],
      },
      requests: [
        {
          title: "Doctoral degree proof required",
          reason: "The degree is not clearly proven.",
          suggestedMaterials: ["Doctoral degree certificate"],
          aiMessage: "Please upload doctoral degree proof.",
          status: "PENDING",
          isSatisfied: false,
        },
      ],
      finishedAt: undefined,
    });
  });

  it("rejects unsupported categories", () => {
    expect(() =>
      adaptMaterialReviewCategoryResult({
        category: "PRODUCT",
        status: "COMPLETED",
        aiMessage: "Unsupported.",
        resultPayload: {
          supplementRequired: false,
          requests: [],
        },
      } as unknown as MaterialCategoryReviewResult),
    ).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 502,
        code: "SUPPLEMENT_REVIEW_RESULT_INVALID",
      }),
    );
  });

  it("rejects malformed result payloads", () => {
    expect(() =>
      adaptMaterialReviewCategoryResult({
        category: "EDUCATION",
        status: "COMPLETED",
        aiMessage: "Invalid payload.",
        resultPayload: null,
      } as unknown as MaterialCategoryReviewResult),
    ).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 502,
        code: "SUPPLEMENT_REVIEW_RESULT_INVALID",
      }),
    );
  });

  it("rejects supplement-required results with no requests", () => {
    expect(() =>
      adaptMaterialReviewCategoryResult({
        category: "EDUCATION",
        status: "COMPLETED",
        aiMessage: "Missing requests.",
        resultPayload: {
          supplementRequired: true,
          requests: [],
        },
      }),
    ).toThrowError(
      expect.objectContaining<Partial<MaterialSupplementServiceError>>({
        status: 502,
        code: "SUPPLEMENT_REVIEW_RESULT_INVALID",
      }),
    );
  });

  it("creates a satisfied request when no supplement is required", () => {
    expect(
      adaptMaterialReviewCategoryResult({
        category: "HONOR",
        status: "COMPLETED",
        aiMessage: "Honor materials are sufficient.",
        resultPayload: {
          supplementRequired: false,
          requests: [],
        },
      }),
    ).toMatchObject({
      category: "HONOR",
      requests: [
        {
          title: "Honor Documents complete",
          reason: "No supplement is required for Honor Documents.",
          suggestedMaterials: null,
          aiMessage: "Honor materials are sufficient.",
          status: "SATISFIED",
          isSatisfied: true,
        },
      ],
    });
  });

  it("preserves callback request statuses including satisfied", () => {
    expect(
      adaptSupplementReviewCallbackCategory({
        category: "EDUCATION",
        status: "COMPLETED",
        reviewedAt: "2026-05-07T09:00:00.000Z",
        aiMessage: "Education proof is complete.",
        resultPayload: {
          supplementRequired: true,
          requests: [
            {
              title: "Doctoral degree proof",
              reason: "The uploaded certificate resolves the request.",
              suggestedMaterials: ["Doctoral degree certificate"],
              aiMessage: "No more education supplement is needed.",
              status: "SATISFIED",
            },
          ],
        },
      }),
    ).toMatchObject({
      category: "EDUCATION",
      status: "COMPLETED",
      requests: [
        {
          title: "Doctoral degree proof",
          reason: "The uploaded certificate resolves the request.",
          suggestedMaterials: ["Doctoral degree certificate"],
          aiMessage: "No more education supplement is needed.",
          status: "SATISFIED",
          isSatisfied: true,
        },
      ],
      finishedAt: new Date("2026-05-07T09:00:00.000Z"),
    });
  });
});
