import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadClient(
  envOverrides: Record<string, string | undefined> = {},
  fileBytes = Buffer.from("resume-content"),
) {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    ...envOverrides,
  };
  vi.doMock("@/lib/storage/object-store", () => ({
    readStoredObject: vi.fn().mockResolvedValue(fileBytes),
  }));

  return import("@/lib/resume-analysis/client");
}

describe("resume analysis adapter", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates an eligible mock job when file name contains eligible", async () => {
    const { createResumeAnalysisJob } = await loadClient({
      RESUME_ANALYSIS_MODE: "mock",
    });
    const job = await createResumeAnalysisJob({
      applicationId: "app_1",
      fileName: "candidate-eligible.pdf",
    });

    expect(job.externalJobId).toContain("eligible");
  });

  it("returns missing fields for insufficient info scenarios", async () => {
    const { getResumeAnalysisResult } = await loadClient({
      RESUME_ANALYSIS_MODE: "mock",
    });
    const result = await getResumeAnalysisResult({
      externalJobId: "mock:insufficient_info:test",
    });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields?.length).toBeGreaterThan(0);
    expect(result.missingFields?.[0]?.sourceItemName).toBeTruthy();
  });

  it("returns eligible on reanalysis when required fields are present", async () => {
    const { reanalyzeWithSupplementalFields } = await loadClient({
      RESUME_ANALYSIS_MODE: "mock",
    });
    const job = await reanalyzeWithSupplementalFields({
      applicationId: "app_1",
      fields: {
        highest_degree: "Doctorate",
        current_employer: "Example University",
      },
    });

    expect(job.externalJobId).toContain("eligible");
  });

  it("uploads resume to live service with multipart form data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ job_id: 42, files_count: 1 }), {
        status: 202,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { createResumeAnalysisJob } = await loadClient({
      RESUME_ANALYSIS_MODE: "live",
      RESUME_ANALYSIS_BASE_URL: "http://resume.test/api/v1",
      RESUME_ANALYSIS_API_KEY: "secret",
    });
    const job = await createResumeAnalysisJob({
      applicationId: "app_live",
      fileName: "candidate.pdf",
      fileType: "application/pdf",
      objectKey: "applications/app_live/resume/candidate.pdf",
    });

    expect(job.externalJobId).toBe("42");
    expect(job.jobStatus).toBe("queued");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://resume.test/api/v1/resume-process/upload",
    );

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formData = requestInit.body as FormData;

    expect(requestInit.method).toBe("POST");
    expect((requestInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret",
    );
    expect(formData.get("file")).toBeTruthy();
  });

  it("maps completed upstream job without initial_result to processing while syncing result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          job: {
            id: 18,
            status: "completed",
            error_message: null,
          },
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

    const { getResumeAnalysisStatus } = await loadClient({
      RESUME_ANALYSIS_MODE: "live",
      RESUME_ANALYSIS_BASE_URL: "http://resume.test/api/v1",
      RESUME_ANALYSIS_API_KEY: "secret",
    });
    const status = await getResumeAnalysisStatus({
      externalJobId: "18",
    });

    expect(status.jobStatus).toBe("processing");
    expect(status.stageText).toBe("Syncing analysis result");
  });

  it("parses live initial_result into normalized eligibility result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          job: {
            id: 18,
            status: "completed",
            error_message: null,
          },
          initial_result: {
            status: "completed",
            raw_response: `[[[
Name: Jane Doe
Highest Degree: To be confirmed
]]]
!!!Highest Degree!!!`,
            parsed_result: {
              extracted_fields: {
                "*姓名": "Jane Doe",
              },
            },
          },
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

    const { getResumeAnalysisResult } = await loadClient({
      RESUME_ANALYSIS_MODE: "live",
      RESUME_ANALYSIS_BASE_URL: "http://resume.test/api/v1",
      RESUME_ANALYSIS_API_KEY: "secret",
    });
    const result = await getResumeAnalysisResult({
      externalJobId: "18",
    });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields?.[0]?.sourceItemName).toBe("Highest Degree");
    expect(result.extractedFields?.["*姓名"]).toBe("Jane Doe");
  });

  it("marks upstream 503 as retryable live error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "busy",
          message: "service busy",
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getResumeAnalysisStatus } = await loadClient({
      RESUME_ANALYSIS_MODE: "live",
      RESUME_ANALYSIS_BASE_URL: "http://resume.test/api/v1",
      RESUME_ANALYSIS_API_KEY: "secret",
    });

    await expect(
      getResumeAnalysisStatus({
        externalJobId: "18",
      }),
    ).rejects.toMatchObject({
      failureCode: "UPSTREAM_HTTP_ERROR",
      retryable: true,
      httpStatus: 503,
    });
  });
});
