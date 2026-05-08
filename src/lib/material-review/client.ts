import { getEnv } from "@/lib/env";
import {
  createCategoryMaterialReview as createCategoryMaterialReviewLive,
  createInitialMaterialReview as createInitialMaterialReviewLive,
  getMaterialReviewResult as getMaterialReviewResultLive,
} from "@/lib/material-review/live";
import {
  createCategoryMaterialReview as createCategoryMaterialReviewMock,
  createInitialMaterialReview as createInitialMaterialReviewMock,
  getMaterialReviewResult as getMaterialReviewResultMock,
} from "@/lib/material-review/mock";
import {
  MaterialReviewClientError,
  type CreateCategoryMaterialReviewInput,
  type CreateInitialMaterialReviewInput,
  type GetMaterialReviewResultInput,
  type MaterialReviewMode,
} from "@/lib/material-review/types";

function getMaterialReviewMode(): MaterialReviewMode {
  return getEnv().MATERIAL_REVIEW_MODE;
}

function isLiveMode() {
  return getMaterialReviewMode() === "live";
}

export async function createInitialMaterialReview(
  input: CreateInitialMaterialReviewInput,
) {
  if (!isLiveMode()) {
    return createInitialMaterialReviewMock(input);
  }

  return createInitialMaterialReviewLive(input);
}

export async function createCategoryMaterialReview(
  input: CreateCategoryMaterialReviewInput,
) {
  if (!isLiveMode()) {
    return createCategoryMaterialReviewMock(input);
  }

  return createCategoryMaterialReviewLive(input);
}

export async function getMaterialReviewResult(
  input: GetMaterialReviewResultInput,
) {
  if (!isLiveMode()) {
    return getMaterialReviewResultMock(input);
  }

  return getMaterialReviewResultLive(input);
}

export function isRetryableMaterialReviewError(error: unknown) {
  return error instanceof MaterialReviewClientError && error.retryable;
}
