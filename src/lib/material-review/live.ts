import { z } from "zod";

import { getEnv } from "@/lib/env";
import {
  MaterialReviewClientError,
  type CreateCategoryMaterialReviewInput,
  type CreateInitialMaterialReviewInput,
  type CreateMaterialReviewResponse,
  type GetMaterialReviewResultInput,
  type GetMaterialReviewResultResponse,
  type MaterialReviewIntegrationIdentity,
  type MaterialReviewJobStatus,
} from "@/lib/material-review/types";

const REQUEST_TIMEOUT_MS = 15_000;

const liveStatusSchema = z.string().transform((value, ctx) => {
  const normalized = value.trim().toUpperCase();

  if (normalized === "PENDING") {
    return "QUEUED" as const;
  }

  if (
    normalized === "QUEUED" ||
    normalized === "PROCESSING" ||
    normalized === "COMPLETED" ||
    normalized === "FAILED"
  ) {
    return normalized as MaterialReviewJobStatus;
  }

  ctx.addIssue({
    code: "custom",
    message: `Unknown material review status: ${value}.`,
  });

  return z.NEVER;
});

const supplementCategorySchema = z.enum([
  "IDENTITY",
  "EDUCATION",
  "EMPLOYMENT",
  "PROJECT",
  "PATENT",
  "HONOR",
]);

const supplementRequestStatusSchema = z
  .enum([
    "PENDING",
    "UPLOADED_WAITING_REVIEW",
    "REVIEWING",
    "SATISFIED",
    "HISTORY_ONLY",
  ])
  .optional();

const liveCreateResponseSchema = z
  .object({
    externalRunId: z.string().min(1).optional(),
    external_run_id: z.string().min(1).optional(),
    status: liveStatusSchema,
    startedAt: z.string().nullable().optional(),
    started_at: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value, ctx): CreateMaterialReviewResponse => {
    const externalRunId = value.externalRunId ?? value.external_run_id;

    if (!externalRunId) {
      ctx.addIssue({
        code: "custom",
        message: "Live material review response is missing externalRunId.",
      });

      return z.NEVER;
    }

    return {
      externalRunId,
      status: value.status,
      startedAt: value.startedAt ?? value.started_at ?? null,
      finishedAt: value.finishedAt ?? value.finished_at ?? null,
    };
  });

const liveRequestSchema = z
  .object({
    title: z.string().min(1),
    reason: z.string().nullable().optional(),
    suggestedMaterials: z.array(z.string()).optional(),
    suggested_materials: z.array(z.string()).optional(),
    aiMessage: z.string().nullable().optional(),
    ai_message: z.string().nullable().optional(),
    status: supplementRequestStatusSchema,
  })
  .passthrough()
  .transform((value) => ({
    title: value.title,
    reason: value.reason ?? null,
    suggestedMaterials:
      value.suggestedMaterials ?? value.suggested_materials ?? [],
    aiMessage: value.aiMessage ?? value.ai_message ?? null,
    status: value.status,
  }));

const liveResultPayloadSchema = z
  .object({
    supplementRequired: z.boolean().optional(),
    supplement_required: z.boolean().optional(),
    requests: z.array(liveRequestSchema),
  })
  .passthrough()
  .transform((value, ctx) => {
    const supplementRequired =
      value.supplementRequired ?? value.supplement_required;

    if (supplementRequired === undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          "Live material review result payload is missing supplementRequired.",
      });

      return z.NEVER;
    }

    return {
      supplementRequired,
      requests: value.requests,
    };
  });

const liveCategoryResultSchema = z
  .object({
    category: supplementCategorySchema,
    status: liveStatusSchema,
    aiMessage: z.string().nullable().optional(),
    ai_message: z.string().nullable().optional(),
    resultPayload: liveResultPayloadSchema.optional(),
    result_payload: liveResultPayloadSchema.optional(),
    rawResultPayload: z.unknown().nullable().optional(),
    raw_result_payload: z.unknown().nullable().optional(),
  })
  .passthrough()
  .transform((value, ctx) => {
    const resultPayload = value.resultPayload ?? value.result_payload;

    if (!resultPayload) {
      ctx.addIssue({
        code: "custom",
        message:
          "Live material review category result is missing resultPayload.",
      });

      return z.NEVER;
    }

    return {
      category: value.category,
      status: value.status,
      aiMessage: value.aiMessage ?? value.ai_message ?? null,
      resultPayload,
      rawResultPayload:
        value.rawResultPayload ?? value.raw_result_payload ?? null,
    };
  });

const liveResultResponseSchema = z
  .object({
    externalRunId: z.string().min(1).optional(),
    external_run_id: z.string().min(1).optional(),
    status: liveStatusSchema,
    startedAt: z.string().nullable().optional(),
    started_at: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional(),
    finished_at: z.string().nullable().optional(),
    categories: z.array(liveCategoryResultSchema).default([]),
  })
  .passthrough()
  .transform((value, ctx): GetMaterialReviewResultResponse => {
    const externalRunId = value.externalRunId ?? value.external_run_id;

    if (!externalRunId) {
      ctx.addIssue({
        code: "custom",
        message:
          "Live material review result response is missing externalRunId.",
      });

      return z.NEVER;
    }

    return {
      externalRunId,
      status: value.status,
      startedAt: value.startedAt ?? value.started_at ?? null,
      finishedAt: value.finishedAt ?? value.finished_at ?? null,
      categories: value.categories,
    };
  });

const upstreamErrorSchema = z
  .object({
    message: z.string().optional(),
    retryable: z.boolean().optional(),
  })
  .passthrough();

const positiveIntegerSchema = z.number().int().positive();

const liveIntegrationIdentityResponseSchema = z
  .object({
    applicationId: z.string().min(1).optional(),
    application_id: z.string().min(1).optional(),
    userId: positiveIntegerSchema.optional(),
    user_id: positiveIntegerSchema.optional(),
    customerId: positiveIntegerSchema.optional(),
    customer_id: positiveIntegerSchema.optional(),
  })
  .passthrough()
  .transform((value, ctx): MaterialReviewIntegrationIdentity => {
    const applicationId = value.applicationId ?? value.application_id;
    const userId = value.userId ?? value.user_id;
    const customerId = value.customerId ?? value.customer_id;

    if (!applicationId) {
      ctx.addIssue({
        code: "custom",
        message:
          "Live material review identity response is missing applicationId.",
      });

      return z.NEVER;
    }

    if (userId === undefined || customerId === undefined) {
      ctx.addIssue({
        code: "custom",
        message:
          "Live material review identity response is missing userId or customerId.",
      });

      return z.NEVER;
    }

    return {
      applicationId,
      userId,
      customerId,
    };
  });

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

function buildApplicationPath(pathTemplate: string, applicationId: string) {
  const encodedApplicationId = encodeURIComponent(applicationId);

  return pathTemplate.replaceAll("{applicationId}", encodedApplicationId);
}

async function parseResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      throw new MaterialReviewClientError({
        message: "Live material review response contains invalid JSON.",
        failureCode: "RESULT_INVALID",
        retryable: false,
        httpStatus: 502,
      });
    }
  }

  return response.text();
}

async function callLiveService(path: string, init?: RequestInit) {
  const env = assertLiveConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${env.MATERIAL_REVIEW_API_KEY}`);

    const response = await fetch(buildLiveUrl(path), {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawPayload = await parseResponsePayload(response).catch(() => ({}));
      const parsedError = upstreamErrorSchema.safeParse(rawPayload);
      const retryable =
        response.status === 429 || response.status >= 500
          ? true
          : parsedError.success
            ? (parsedError.data.retryable ?? false)
            : false;
      const message = parsedError.success
        ? (parsedError.data.message ??
          `Material review service error: ${response.status}.`)
        : `Material review service error: ${response.status}.`;

      throw new MaterialReviewClientError({
        message,
        failureCode: "HTTP_ERROR",
        retryable,
        httpStatus: response.status,
      });
    }

    return parseResponsePayload(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new MaterialReviewClientError({
        message: "Live material review request timed out.",
        failureCode: "TIMEOUT",
        retryable: true,
        httpStatus: 504,
      });
    }

    if (error instanceof MaterialReviewClientError) {
      throw error;
    }

    throw new MaterialReviewClientError({
      message:
        error instanceof Error
          ? error.message
          : "Live material review request failed.",
      failureCode: "NETWORK_ERROR",
      retryable: true,
      httpStatus: 502,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseLivePayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new MaterialReviewClientError({
      message: "Live material review response shape is invalid.",
      failureCode: "RESULT_INVALID",
      httpStatus: 502,
    });
  }

  return result.data;
}

async function createOrGetIntegrationIdentity(applicationId: string) {
  const env = assertLiveConfig();
  const path = buildApplicationPath(
    env.MATERIAL_REVIEW_INTEGRATION_IDENTITY_PATH,
    applicationId,
  );

  return parseLivePayload(
    liveIntegrationIdentityResponseSchema,
    await callLiveService(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        applicationId,
      }),
    }),
  );
}

async function upsertApplicationMapping(
  applicationId: string,
  identity: MaterialReviewIntegrationIdentity,
) {
  const env = assertLiveConfig();
  const path = buildApplicationPath(
    env.MATERIAL_REVIEW_MAPPING_PATH,
    applicationId,
  );

  await callLiveService(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId: identity.userId,
      customerId: identity.customerId,
    }),
  });
}

async function ensureLiveMaterialReviewApplicationMapping(applicationId: string) {
  const identity = await createOrGetIntegrationIdentity(applicationId);

  if (identity.applicationId !== applicationId) {
    throw new MaterialReviewClientError({
      message:
        "Live material review identity response applicationId does not match the request.",
      failureCode: "RESULT_INVALID",
      retryable: false,
      httpStatus: 502,
    });
  }

  await upsertApplicationMapping(applicationId, identity);
}

export async function createInitialMaterialReview(
  input: CreateInitialMaterialReviewInput,
) {
  await ensureLiveMaterialReviewApplicationMapping(input.applicationId);

  return parseLivePayload(
    liveCreateResponseSchema,
    await callLiveService("/reviews/initial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        applicationId: input.applicationId,
      }),
    }),
  );
}

export async function createCategoryMaterialReview(
  input: CreateCategoryMaterialReviewInput,
) {
  await ensureLiveMaterialReviewApplicationMapping(input.applicationId);

  return parseLivePayload(
    liveCreateResponseSchema,
    await callLiveService(
      `/reviews/categories/${encodeURIComponent(input.category)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: input.applicationId,
          category: input.category,
        }),
      },
    ),
  );
}

export async function getMaterialReviewResult(
  input: GetMaterialReviewResultInput,
) {
  return parseLivePayload(
    liveResultResponseSchema,
    await callLiveService(
      `/reviews/${encodeURIComponent(input.externalRunId)}`,
      {
        method: "GET",
      },
    ),
  );
}
