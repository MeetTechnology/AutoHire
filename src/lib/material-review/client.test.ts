import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadClient(envOverrides: Record<string, string | undefined> = {}) {
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

  it("does not silently fall back to mock when live mode is selected", async () => {
    const { getMaterialReviewResult } = await loadClient({
      MATERIAL_REVIEW_MODE: "live",
      MATERIAL_REVIEW_BASE_URL: "https://material-review.test/api",
      MATERIAL_REVIEW_API_KEY: "secret",
    });

    await expect(
      getMaterialReviewResult({
        externalRunId: "run_live_001",
      }),
    ).rejects.toMatchObject({
      name: "MaterialReviewClientError",
      failureCode: "BACKEND_UNAVAILABLE",
      retryable: true,
      httpStatus: 503,
    });
  });
});
