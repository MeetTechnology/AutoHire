import { buildTrackedRequestHeaders } from "@/lib/tracking/client";

import type {
  SupplementCategory,
  SupplementHistoryItem,
  SupplementSnapshot,
  SupplementSummary,
  SupplementUploadBatchStatus,
} from "@/features/material-supplement/types";

type SupplementErrorDetails = Record<string, unknown>;

type SupplementErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: SupplementErrorDetails;
  };
};

export class MaterialSupplementClientError extends Error {
  status: number;
  code: string;
  details?: SupplementErrorDetails;

  constructor(input: {
    message: string;
    status: number;
    code: string;
    details?: SupplementErrorDetails;
  }) {
    super(input.message);
    this.name = "MaterialSupplementClientError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

export type SupplementHistoryFilters = {
  category?: SupplementCategory;
  runNo?: number;
};

export type SupplementHistoryResponse = {
  applicationId: string;
  filters: {
    category: SupplementCategory | null;
    runNo: number | null;
  };
  items: SupplementHistoryItem[];
};

export type EnsureInitialReviewResponse = {
  applicationId: string;
  reviewRunId: string;
  runNo: number;
  status: string;
  created: boolean;
};

export type SupplementUploadBatchResponse = {
  uploadBatchId: string;
  applicationId: string;
  category: SupplementCategory;
  status: SupplementUploadBatchStatus;
  fileCount: number;
  createdAt: string;
};

export type CreateSupplementUploadBatchInput = {
  category: SupplementCategory;
};

export type SupplementUploadIntentResponse = {
  uploadId: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  objectKey: string;
  deduped: boolean;
};

export type CreateSupplementUploadIntentInput = {
  uploadBatchId: string;
  category: SupplementCategory;
  supplementRequestId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export type ConfirmSupplementFileUploadInput = {
  uploadBatchId: string;
  category: SupplementCategory;
  supplementRequestId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectKey: string;
};

export type ConfirmSupplementFileUploadResponse = {
  file: {
    id: string;
    uploadBatchId: string;
    category: SupplementCategory;
    supplementRequestId: string | null;
    fileName: string;
    fileType: string;
    fileSize: number;
    uploadedAt: string;
    status: "DRAFT" | "CONFIRMED" | "REVIEWING" | "COMPLETED";
  };
};

export type DeleteSupplementDraftFileResponse = {
  deleted: true;
  fileId: string;
  uploadBatchId: string;
};

export type ConfirmSupplementUploadBatchInput = {
  category: SupplementCategory;
};

export type ConfirmSupplementUploadBatchResponse = {
  uploadBatchId: string;
  applicationId: string;
  category: SupplementCategory;
  fileCount: number;
  reviewRunId: string;
  status: "REVIEWING";
};

function buildSupplementFetchOptions(init?: RequestInit) {
  return {
    ...init,
    headers: buildTrackedRequestHeaders(init?.headers),
  } satisfies RequestInit;
}

async function parseSupplementResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | SupplementErrorPayload
      | null;
    const code = payload?.error?.code ?? "REQUEST_FAILED";
    const message = payload?.error?.message ?? "Request failed.";
    throw new MaterialSupplementClientError({
      message,
      status: response.status,
      code,
      details: payload?.error?.details,
    });
  }

  return response.json() as Promise<T>;
}

function buildSupplementBasePath(applicationId: string) {
  return `/api/applications/${applicationId}/material-supplement`;
}

export async function fetchSupplementSummary(applicationId: string) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/summary`,
    buildSupplementFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseSupplementResponse<SupplementSummary>(response);
}

export async function ensureInitialReview(applicationId: string) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/reviews/initial`,
    buildSupplementFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({}),
    }),
  );

  return parseSupplementResponse<EnsureInitialReviewResponse>(response);
}

export async function fetchSupplementSnapshot(applicationId: string) {
  const response = await fetch(
    buildSupplementBasePath(applicationId),
    buildSupplementFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseSupplementResponse<SupplementSnapshot>(response);
}

export async function fetchSupplementHistory(
  applicationId: string,
  filters?: SupplementHistoryFilters,
) {
  const params = new URLSearchParams();

  if (filters?.category) {
    params.set("category", filters.category);
  }

  if (filters?.runNo !== undefined) {
    params.set("runNo", String(filters.runNo));
  }

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/history${query}`,
    buildSupplementFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseSupplementResponse<SupplementHistoryResponse>(response);
}

export async function createSupplementUploadBatch(
  applicationId: string,
  input: CreateSupplementUploadBatchInput,
) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/upload-batches`,
    buildSupplementFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    }),
  );

  return parseSupplementResponse<SupplementUploadBatchResponse>(response);
}

export async function createSupplementUploadIntent(
  applicationId: string,
  input: CreateSupplementUploadIntentInput,
) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/upload-intent`,
    buildSupplementFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    }),
  );

  return parseSupplementResponse<SupplementUploadIntentResponse>(response);
}

export async function confirmSupplementFileUpload(
  applicationId: string,
  input: ConfirmSupplementFileUploadInput,
) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/files`,
    buildSupplementFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    }),
  );

  return parseSupplementResponse<ConfirmSupplementFileUploadResponse>(response);
}

export async function deleteSupplementDraftFile(
  applicationId: string,
  fileId: string,
) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/files/${fileId}`,
    buildSupplementFetchOptions({
      method: "DELETE",
      credentials: "include",
    }),
  );

  return parseSupplementResponse<DeleteSupplementDraftFileResponse>(response);
}

export async function confirmSupplementUploadBatch(
  applicationId: string,
  batchId: string,
  input: ConfirmSupplementUploadBatchInput,
) {
  const response = await fetch(
    `${buildSupplementBasePath(applicationId)}/upload-batches/${batchId}/confirm`,
    buildSupplementFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    }),
  );

  return parseSupplementResponse<ConfirmSupplementUploadBatchResponse>(
    response,
  );
}
