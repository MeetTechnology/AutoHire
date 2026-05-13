import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/internal/material-review/applications/[applicationId]/context/route";
import { resetEnvForTests } from "@/lib/env";

const originalEnv = { ...process.env };

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function setBaseEnv(input?: { apiKey?: string }) {
  process.env = {
    ...originalEnv,
    APP_BASE_URL: "http://autohire.test",
    APP_RUNTIME_MODE: "memory",
    FILE_STORAGE_MODE: "mock",
    MATERIAL_REVIEW_MODE: "mock",
    MATERIAL_REVIEW_API_KEY: input?.apiKey,
  };
}

function buildContextRequest(url: string, token?: string) {
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return new NextRequest(url, { headers });
}

describe("material review internal context route", () => {
  beforeEach(() => {
    resetEnvForTests();
    resetMemoryStore();
    setBaseEnv({ apiKey: "review-context-key" });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    resetEnvForTests();
  });

  it("requires MATERIAL_REVIEW_API_KEY to be configured", async () => {
    setBaseEnv();
    resetEnvForTests();

    const response = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_satisfied/context",
        "review-context-key",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_satisfied" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toContain("MATERIAL_REVIEW_API_KEY");
  });

  it("rejects missing or incorrect bearer tokens", async () => {
    const missing = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_required/context",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_required" }),
      },
    );
    const incorrect = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_required/context",
        "wrong-key",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_required" }),
      },
    );

    expect(missing.status).toBe(401);
    expect(incorrect.status).toBe(401);
  });

  it("returns resume analysis and six-category materials with download URLs", async () => {
    const response = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_satisfied/context",
        "review-context-key",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_satisfied" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.applicationId).toBe("app_supplement_satisfied");
    expect(payload.expert).toMatchObject({
      name: "Supplement Satisfied Expert",
      email: "supplement.satisfied@example.com",
      phone: "+1 555 010 3300",
    });
    expect(Object.keys(payload.materials).sort()).toEqual([
      "EDUCATION",
      "EMPLOYMENT",
      "HONOR",
      "IDENTITY",
      "PATENT",
      "PROJECT",
    ]);
    expect(payload.resume.file).toMatchObject({
      fileName: "candidate-supplement-satisfied.pdf",
      objectKey:
        "applications/app_supplement_satisfied/resume/candidate-supplement-satisfied.pdf",
      contentType: "application/pdf",
      sizeBytes: 2048,
    });
    expect(payload.resume.file.downloadUrl).toBe(
      "http://autohire.test/api/mock-storage?key=applications%2Fapp_supplement_satisfied%2Fresume%2Fcandidate-supplement-satisfied.pdf",
    );
    expect(payload.resume.extractedData["*姓名"]).toBe(
      "Supplement Satisfied Expert",
    );
    expect(payload.resume.analysisResult).toMatchObject({
      eligibilityResult: "ELIGIBLE",
      analysisRound: 1,
    });
    expect(payload.materials.IDENTITY[0]).toMatchObject({
      source: "INITIAL_SUBMISSION",
      category: "IDENTITY",
      fileName: "passport.pdf",
      objectKey:
        "applications/app_supplement_satisfied/materials/IDENTITY/passport.pdf",
      downloadUrl:
        "http://autohire.test/api/mock-storage?key=applications%2Fapp_supplement_satisfied%2Fmaterials%2FIDENTITY%2Fpassport.pdf",
    });
    expect(payload.materials.EMPLOYMENT[0]).toMatchObject({
      source: "SUPPLEMENT_UPLOAD",
      category: "EMPLOYMENT",
      fileName: "employment-proof-final.pdf",
      objectKey:
        "applications/app_supplement_satisfied/supplements/EMPLOYMENT/employment-proof-final.pdf",
    });
  });

  it("keeps a stable six-category shape when filtering by category", async () => {
    const response = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_required/context?category=IDENTITY&includeResume=false&downloadUrlTtlSeconds=60",
        "review-context-key",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_required" }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.resume).toBeNull();
    expect(payload.materials.IDENTITY).toHaveLength(1);
    expect(payload.materials.EMPLOYMENT).toEqual([]);
    expect(payload.materials.EDUCATION).toEqual([]);
    expect(Object.keys(payload.materials).sort()).toEqual([
      "EDUCATION",
      "EMPLOYMENT",
      "HONOR",
      "IDENTITY",
      "PATENT",
      "PROJECT",
    ]);
  });

  it("rejects invalid query params and returns 404 for unknown applications", async () => {
    const invalidCategory = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_required/context?category=PAPER",
        "review-context-key",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_required" }),
      },
    );
    const invalidTtl = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/app_supplement_required/context?downloadUrlTtlSeconds=30",
        "review-context-key",
      ),
      {
        params: Promise.resolve({ applicationId: "app_supplement_required" }),
      },
    );
    const missingApplication = await GET(
      buildContextRequest(
        "http://localhost/api/internal/material-review/applications/missing_app/context",
        "review-context-key",
      ),
      {
        params: Promise.resolve({ applicationId: "missing_app" }),
      },
    );

    expect(invalidCategory.status).toBe(400);
    expect(invalidTtl.status).toBe(400);
    expect(missingApplication.status).toBe(404);
  });
});
