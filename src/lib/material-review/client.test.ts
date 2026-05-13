import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadClient(
  envOverrides: Record<string, string | undefined> = {},
) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    ...envOverrides,
  };

  return import("@/lib/material-review/client");
}

describe("material review client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses mock mode by default", async () => {
    const { createInitialMaterialReview, getMaterialReviewResult } =
      await loadClient();
    const run = await createInitialMaterialReview({
      applicationId: "app_001",
    });
    const result = await getMaterialReviewResult({
      externalRunId: run.externalRunId,
    });

    expect(run.externalRunId).toContain("mock-material-review:initial:");
    expect(result.status).toBe("COMPLETED");
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it("uses the mock scenario from env in mock mode", async () => {
    const { createInitialMaterialReview, getMaterialReviewResult } =
      await loadClient({
        MATERIAL_REVIEW_MODE: "mock",
        MATERIAL_REVIEW_MOCK_SCENARIO: "reviewing",
      });
    const run = await createInitialMaterialReview({
      applicationId: "app_001",
    });
    const result = await getMaterialReviewResult({
      externalRunId: run.externalRunId,
    });

    expect(run.status).toBe("PROCESSING");
    expect(result.status).toBe("PROCESSING");
    expect(result.categories).toHaveLength(0);
  });

  it("maps invalid env mock scenarios to material review client errors", async () => {
    const { createInitialMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "mock",
      MATERIAL_REVIEW_MOCK_SCENARIO: "unknown",
    });

    await expect(
      createInitialMaterialReview({
        applicationId: "app_001",
      }),
    ).rejects.toMatchObject({
      name: "MaterialReviewClientError",
      failureCode: "RESULT_INVALID",
      httpStatus: 400,
    });
  });

  it("lets input mock scenario override env in mock mode", async () => {
    const { createInitialMaterialReview, getMaterialReviewResult } =
      await loadClient({
        MATERIAL_REVIEW_MODE: "mock",
        MATERIAL_REVIEW_MOCK_SCENARIO: "reviewing",
      });
    const run = await createInitialMaterialReview({
      applicationId: "app_001",
      mockScenario: "satisfied",
    });
    const result = await getMaterialReviewResult({
      externalRunId: run.externalRunId,
      mockScenario: "no_supplement_required",
    });

    expect(run.status).toBe("COMPLETED");
    expect(result.status).toBe("COMPLETED");
    expect(result.categories).toHaveLength(6);
    expect(
      result.categories.every(
        (category) => !category.resultPayload.supplementRequired,
      ),
    ).toBe(true);
  });

  it("throws a config error when live mode is missing base url", async () => {
    const { createInitialMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: undefined,
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      createInitialMaterialReview({
        applicationId: "app_001",
      }),
    ).rejects.toMatchObject({
      name: "MaterialReviewClientError",
      failureCode: "CONFIG_ERROR",
      message:
        "MATERIAL_REVIEW_BASE_URL is required when MATERIAL_REVIEW_MODE=live.",
    });
  });

  it("throws a config error when live mode is missing api key", async () => {
    const { createCategoryMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: undefined,
    });

    await expect(
      createCategoryMaterialReview({
        applicationId: "app_001",
        category: "EDUCATION",
      }),
    ).rejects.toMatchObject({
      name: "MaterialReviewClientError",
      failureCode: "CONFIG_ERROR",
      message:
        "MATERIAL_REVIEW_API_KEY is required when MATERIAL_REVIEW_MODE=live.",
    });
  });

  it("creates an initial review through the live client after registering the mapping", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            applicationId: "app_live",
            userId: 1,
            customerId: 9001,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            applicationId: "app_live",
            userId: 1,
            customerId: 9001,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            externalRunId: "run_live_001",
            status: "queued",
            startedAt: "2026-05-08T10:00:00.000Z",
            finishedAt: null,
          }),
          {
            status: 202,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { createInitialMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api/",
      MATERIAL_REVIEW_API_KEY: "secret",
    });
    const result = await createInitialMaterialReview({
      applicationId: "app_live",
    });

    expect(result).toMatchObject({
      externalRunId: "run_live_001",
      status: "QUEUED",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://material-review.test/api/reviews/applications/app_live/integration-identity",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://material-review.test/api/reviews/applications/app_live/mapping",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://material-review.test/api/reviews/initial",
    );

    const identityRequest = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const mappingRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const reviewRequest = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const reviewHeaders = reviewRequest.headers as Headers;

    expect(identityRequest.method).toBe("POST");
    expect(JSON.parse(identityRequest.body as string)).toEqual({
      applicationId: "app_live",
    });
    expect(mappingRequest.method).toBe("PUT");
    expect(JSON.parse(mappingRequest.body as string)).toEqual({
      userId: 1,
      customerId: 9001,
    });
    expect(reviewRequest.method).toBe("POST");
    expect(reviewHeaders.get("Authorization")).toBe("Bearer secret");
    expect(reviewHeaders.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(reviewRequest.body as string)).toEqual({
      applicationId: "app_live",
    });
  });

  it("creates a category review through the live client after registering the mapping", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            application_id: "app live",
            user_id: 1,
            customer_id: 9001,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ applicationId: "app live" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            external_run_id: "run_live_category_001",
            status: "processing",
          }),
          {
            status: 202,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { createCategoryMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });
    const result = await createCategoryMaterialReview({
      applicationId: "app live",
      category: "EDUCATION",
    });

    expect(result).toMatchObject({
      externalRunId: "run_live_category_001",
      status: "PROCESSING",
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://material-review.test/api/reviews/applications/app%20live/integration-identity",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://material-review.test/api/reviews/applications/app%20live/mapping",
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://material-review.test/api/reviews/categories/EDUCATION",
    );
    expect(
      JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string),
    ).toEqual({
      userId: 1,
      customerId: 9001,
    });
    expect(
      JSON.parse((fetchMock.mock.calls[2]?.[1] as RequestInit).body as string),
    ).toEqual({
      applicationId: "app live",
      category: "EDUCATION",
    });
  });

  it("rejects invalid integration identity responses before creating a review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          applicationId: "app_live",
          userId: 1,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createInitialMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      createInitialMaterialReview({
        applicationId: "app_live",
      }),
    ).rejects.toMatchObject({
      failureCode: "RESULT_INVALID",
      httpStatus: 502,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not create a review when mapping registration fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            applicationId: "app_live",
            userId: 1,
            customerId: 9001,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            message: "expert not found for user and customer",
            retryable: false,
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { createInitialMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      createInitialMaterialReview({
        applicationId: "app_live",
      }),
    ).rejects.toMatchObject({
      failureCode: "HTTP_ERROR",
      retryable: false,
      httpStatus: 409,
      message: "expert not found for user and customer",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gets and maps live review results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          externalRunId: "run_live_001",
          status: "completed",
          categories: [
            {
              category: "EDUCATION",
              status: "completed",
              ai_message: "Please provide a degree certificate.",
              result_payload: {
                supplement_required: true,
                requests: [
                  {
                    title: "Degree certificate required",
                    reason: "The degree evidence is unclear.",
                    suggested_materials: ["Degree certificate"],
                    status: "PENDING",
                  },
                ],
              },
              raw_result_payload: {
                source: "live",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });
    const result = await getMaterialReviewResult({
      externalRunId: "run_live_001",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://material-review.test/api/reviews/run_live_001",
    );
    expect(result).toMatchObject({
      externalRunId: "run_live_001",
      status: "COMPLETED",
      categories: [
        {
          category: "EDUCATION",
          status: "COMPLETED",
          aiMessage: "Please provide a degree certificate.",
          resultPayload: {
            supplementRequired: true,
            requests: [
              {
                title: "Degree certificate required",
                reason: "The degree evidence is unclear.",
                suggestedMaterials: ["Degree certificate"],
                status: "PENDING",
              },
            ],
          },
          rawResultPayload: {
            source: "live",
          },
        },
      ],
    });
  });

  it("returns in-progress live results without categories", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          externalRunId: "run_live_processing",
          status: "processing",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });
    const result = await getMaterialReviewResult({
      externalRunId: "run_live_processing",
    });

    expect(result).toMatchObject({
      externalRunId: "run_live_processing",
      status: "PROCESSING",
      categories: [],
    });
  });

  it("maps live 401 and 403 responses to non-retryable http errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "forbidden" }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      getMaterialReviewResult({
        externalRunId: "run_live_401",
      }),
    ).rejects.toMatchObject({
      failureCode: "HTTP_ERROR",
      retryable: false,
      httpStatus: 401,
      message: "unauthorized",
    });
    await expect(
      getMaterialReviewResult({
        externalRunId: "run_live_403",
      }),
    ).rejects.toMatchObject({
      failureCode: "HTTP_ERROR",
      retryable: false,
      httpStatus: 403,
      message: "forbidden",
    });
  });

  it("maps live 503 responses to retryable http errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "service busy" }), {
        status: 503,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      getMaterialReviewResult({
        externalRunId: "run_live_503",
      }),
    ).rejects.toMatchObject({
      failureCode: "HTTP_ERROR",
      retryable: true,
      httpStatus: 503,
      message: "service busy",
    });
  });

  it("maps live fetch failures to retryable network errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connection refused")),
    );

    const { createInitialMaterialReview } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      createInitialMaterialReview({
        applicationId: "app_live",
      }),
    ).rejects.toMatchObject({
      failureCode: "NETWORK_ERROR",
      retryable: true,
      httpStatus: 502,
      message: "connection refused",
    });
  });

  it("maps live request aborts to retryable timeout errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });
    const request = getMaterialReviewResult({
      externalRunId: "run_timeout",
    });
    const expectation = expect(request).rejects.toMatchObject({
      failureCode: "TIMEOUT",
      retryable: true,
      httpStatus: 504,
    });

    await vi.advanceTimersByTimeAsync(15_000);
    await expectation;
  });

  it("maps malformed live JSON to result invalid errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{", {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      getMaterialReviewResult({
        externalRunId: "run_malformed_json",
      }),
    ).rejects.toMatchObject({
      failureCode: "RESULT_INVALID",
      retryable: false,
      httpStatus: 502,
    });
  });

  it("maps live responses missing required fields to result invalid errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "completed" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      getMaterialReviewResult({
        externalRunId: "run_missing_fields",
      }),
    ).rejects.toMatchObject({
      failureCode: "RESULT_INVALID",
      retryable: false,
      httpStatus: 502,
    });
  });
});
