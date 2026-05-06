import { describe, expect, it } from "vitest";

import {
  createCategoryMaterialReview,
  createInitialMaterialReview,
  getMaterialReviewResult,
} from "@/lib/material-review/mock";

describe("material review mock client", () => {
  it("creates a completed initial review run with a stable prefix", async () => {
    const run = await createInitialMaterialReview({
      applicationId: "app_001",
    });

    expect(run.externalRunId).toContain("mock-material-review:initial:");
    expect(run.status).toBe("COMPLETED");
    expect(run.startedAt).toBeTruthy();
    expect(run.finishedAt).toBeTruthy();
  });

  it("creates a category-specific completed review run", async () => {
    const run = await createCategoryMaterialReview({
      applicationId: "app_001",
      category: "EDUCATION",
    });

    expect(run.externalRunId).toContain("mock-material-review:category:EDUCATION:");
    expect(run.status).toBe("COMPLETED");
  });

  it("returns an initial review result with multiple categories", async () => {
    const result = await getMaterialReviewResult({
      externalRunId: "mock-material-review:initial:test",
    });
    const educationCategory = result.categories.find(
      (category) => category.category === "EDUCATION",
    );

    expect(result.status).toBe("COMPLETED");
    expect(result.categories.length).toBeGreaterThan(1);
    expect(educationCategory).toMatchObject({
      category: "EDUCATION",
      status: "COMPLETED",
    });
    expect(educationCategory?.resultPayload.supplementRequired).toBe(true);
    expect(Array.isArray(educationCategory?.resultPayload.requests)).toBe(true);
    expect(
      educationCategory?.resultPayload.requests[0]?.suggestedMaterials,
    ).toBeInstanceOf(Array);
  });

  it("returns category-only results for category review runs", async () => {
    const result = await getMaterialReviewResult({
      externalRunId: "mock-material-review:category:EDUCATION:test",
    });

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.category).toBe("EDUCATION");
    expect(result.categories[0]?.resultPayload.supplementRequired).toBe(true);
  });

  it("rejects malformed category review run ids", async () => {
    await expect(
      getMaterialReviewResult({
        externalRunId: "mock-material-review:category:FOO:test",
      }),
    ).rejects.toMatchObject({
      name: "MaterialReviewClientError",
      failureCode: "RESULT_INVALID",
      httpStatus: 400,
    });
  });
});
