import {
  isSupplementCategory,
  SUPPORTED_SUPPLEMENT_CATEGORIES,
} from "@/features/material-supplement/constants";

import type {
  CreateCategoryMaterialReviewInput,
  CreateInitialMaterialReviewInput,
  CreateMaterialReviewResponse,
  GetMaterialReviewResultInput,
  GetMaterialReviewResultResponse,
  MaterialCategoryReviewResult,
  MaterialReviewRequest,
} from "@/lib/material-review/types";
import { MaterialReviewClientError as MaterialReviewClientErrorClass } from "@/lib/material-review/types";

function createTimestamp() {
  return new Date().toISOString();
}

function buildRunResponse(externalRunId: string): CreateMaterialReviewResponse {
  const finishedAt = createTimestamp();

  return {
    externalRunId,
    status: "COMPLETED",
    startedAt: finishedAt,
    finishedAt,
  };
}

function buildEducationRequests(): MaterialReviewRequest[] {
  return [
    {
      title: "Doctoral degree proof required",
      reason:
        "The submitted documents do not clearly prove the doctoral degree listed in the CV.",
      suggestedMaterials: [
        "Doctoral degree certificate",
        "Education verification report",
      ],
    },
  ];
}

function buildSatisfiedCategoryResult(
  category: MaterialCategoryReviewResult["category"],
): MaterialCategoryReviewResult {
  return {
    category,
    status: "COMPLETED",
    aiMessage: `${category} documents are sufficient for the current review.`,
    resultPayload: {
      supplementRequired: false,
      requests: [],
    },
    rawResultPayload: null,
  };
}

function buildCategoryResult(
  category: MaterialCategoryReviewResult["category"],
): MaterialCategoryReviewResult {
  if (category === "EDUCATION") {
    return {
      category,
      status: "COMPLETED",
      aiMessage:
        "Please provide proof of the doctoral degree listed in your CV.",
      resultPayload: {
        supplementRequired: true,
        requests: buildEducationRequests(),
      },
      rawResultPayload: null,
    };
  }

  return buildSatisfiedCategoryResult(category);
}

function parseCategoryRunId(externalRunId: string) {
  const prefix = "mock-material-review:category:";

  if (!externalRunId.startsWith(prefix)) {
    return null;
  }

  const parts = externalRunId.split(":");
  const category = parts[2] ?? null;

  if (category === null) {
    return null;
  }

  if (!isSupplementCategory(category)) {
    throw new MaterialReviewClientErrorClass({
      message: `Invalid mock material review category: ${category}.`,
      failureCode: "RESULT_INVALID",
      httpStatus: 400,
    });
  }

  return category;
}

export async function createInitialMaterialReview(
  input: CreateInitialMaterialReviewInput,
) {
  void input;
  return buildRunResponse(`mock-material-review:initial:${Date.now()}`);
}

export async function createCategoryMaterialReview(
  input: CreateCategoryMaterialReviewInput,
) {
  return buildRunResponse(
    `mock-material-review:category:${input.category}:${Date.now()}`,
  );
}

export async function getMaterialReviewResult(
  input: GetMaterialReviewResultInput,
): Promise<GetMaterialReviewResultResponse> {
  const finishedAt = createTimestamp();
  const categoryFromRunId = parseCategoryRunId(input.externalRunId);
  const categories = categoryFromRunId
    ? [buildCategoryResult(categoryFromRunId as MaterialCategoryReviewResult["category"])]
    : SUPPORTED_SUPPLEMENT_CATEGORIES.map((category) => buildCategoryResult(category));

  return {
    externalRunId: input.externalRunId,
    status: "COMPLETED",
    startedAt: finishedAt,
    finishedAt,
    categories,
  };
}
