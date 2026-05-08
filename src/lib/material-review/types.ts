import type {
  SupplementCategory,
  SupplementRequestStatus,
} from "@/features/material-supplement/types";

export type MaterialReviewMode = "mock" | "live";

export const MATERIAL_REVIEW_MOCK_SCENARIOS = [
  "supplement_required",
  "no_supplement_required",
  "reviewing",
  "satisfied",
  "category_satisfied",
] as const;

export type MaterialReviewMockScenario =
  (typeof MATERIAL_REVIEW_MOCK_SCENARIOS)[number];

export type MaterialReviewJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type MaterialReviewRequestErrorCode =
  | "CONFIG_ERROR"
  | "BACKEND_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "RESULT_NOT_READY"
  | "RESULT_INVALID";

export type MaterialReviewRequest = {
  title: string;
  reason: string | null;
  suggestedMaterials: string[];
  aiMessage?: string | null;
  status?: SupplementRequestStatus;
};

export type MaterialReviewResultPayload = {
  supplementRequired: boolean;
  requests: MaterialReviewRequest[];
};

export type MaterialCategoryReviewResult = {
  category: SupplementCategory;
  status: MaterialReviewJobStatus;
  aiMessage: string | null;
  resultPayload: MaterialReviewResultPayload;
  rawResultPayload?: unknown | null;
};

export type CreateInitialMaterialReviewInput = {
  applicationId: string;
  mockScenario?: MaterialReviewMockScenario;
};

export type CreateCategoryMaterialReviewInput = {
  applicationId: string;
  category: SupplementCategory;
  mockScenario?: MaterialReviewMockScenario;
};

export type GetMaterialReviewResultInput = {
  externalRunId: string;
  mockScenario?: MaterialReviewMockScenario;
};

export type CreateMaterialReviewResponse = {
  externalRunId: string;
  status: MaterialReviewJobStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type GetMaterialReviewResultResponse = {
  externalRunId: string;
  status: MaterialReviewJobStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  categories: MaterialCategoryReviewResult[];
};

export class MaterialReviewClientError extends Error {
  failureCode: MaterialReviewRequestErrorCode;
  retryable: boolean;
  httpStatus: number | null;

  constructor(input: {
    message: string;
    failureCode: MaterialReviewRequestErrorCode;
    retryable?: boolean;
    httpStatus?: number | null;
  }) {
    super(input.message);
    this.name = "MaterialReviewClientError";
    this.failureCode = input.failureCode;
    this.retryable = input.retryable ?? false;
    this.httpStatus = input.httpStatus ?? null;
  }
}
