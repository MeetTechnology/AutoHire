import { getEnv } from "@/lib/env";
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

const REQUEST_TIMEOUT_MS = 15_000;

function getMaterialReviewMode(): MaterialReviewMode {
  return getEnv().MATERIAL_REVIEW_MODE;
}

function isLiveMode() {
  return getMaterialReviewMode() === "live";
}

function assertLiveConfig() {
  const env = getEnv();

  if (!env.MATERIAL_REVIEW_BASE_URL) {
    throw new MaterialReviewClientError({
      message:
        "MATERIAL_REVIEW_BASE_URL is required when MATERIAL_REVIEW_MODE=live.",
      failureCode: "CONFIG_ERROR",
      httpStatus: 500,
    });
  }

  if (!env.MATERIAL_REVIEW_API_KEY) {
    throw new MaterialReviewClientError({
      message:
        "MATERIAL_REVIEW_API_KEY is required when MATERIAL_REVIEW_MODE=live.",
      failureCode: "CONFIG_ERROR",
      httpStatus: 500,
    });
  }

  return env;
}

function buildLiveUrl(path: string) {
  const env = assertLiveConfig();

  return `${env.MATERIAL_REVIEW_BASE_URL.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function callLiveService(path: string, init?: RequestInit): Promise<never> {
  assertLiveConfig();
  void path;
  void init;

  throw new MaterialReviewClientError({
    message:
      "Live material review client is not implemented yet. Use mock mode until the external protocol is confirmed.",
    failureCode: "BACKEND_UNAVAILABLE",
    retryable: true,
    httpStatus: 503,
  });
}

export async function createInitialMaterialReview(
  input: CreateInitialMaterialReviewInput,
) {
  if (!isLiveMode()) {
    return createInitialMaterialReviewMock(input);
  }

  return callLiveService(buildLiveUrl("/reviews/initial"), {
    method: "POST",
  });
}

export async function createCategoryMaterialReview(
  input: CreateCategoryMaterialReviewInput,
) {
  if (!isLiveMode()) {
    return createCategoryMaterialReviewMock(input);
  }

  return callLiveService(
    buildLiveUrl(`/reviews/categories/${encodeURIComponent(input.category)}`),
    {
      method: "POST",
    },
  );
}

export async function getMaterialReviewResult(
  input: GetMaterialReviewResultInput,
) {
  if (!isLiveMode()) {
    return getMaterialReviewResultMock(input);
  }

  return callLiveService(
    buildLiveUrl(`/reviews/${encodeURIComponent(input.externalRunId)}`),
    {
      method: "GET",
    },
  );
}

export function isRetryableMaterialReviewError(error: unknown) {
  return error instanceof MaterialReviewClientError && error.retryable;
}

void REQUEST_TIMEOUT_MS;
