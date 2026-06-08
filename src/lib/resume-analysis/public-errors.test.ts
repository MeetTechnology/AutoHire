import { describe, expect, it } from "vitest";

import {
  PUBLIC_RESUME_ANALYSIS_ERROR,
  sanitizeAnalysisStatusForClient,
  toPublicAnalysisStageText,
  toPublicProgressMessage,
  toPublicResumeAnalysisErrorMessage,
} from "@/lib/resume-analysis/public-errors";

const INTERNAL_FAILURE_MESSAGE =
  '生成失败: primary failed: API call failed: error reading from stream: doRequest: error sending request: Post "https://aiplatform.googleapis.com/v1beta1/projects/vertexai-491808/locations/global/publishers/google/models/gemini-3.1-pro-preview:streamGenerateContent?alt=sse": oauth2: cannot fetch token: Post "https://oauth2.googleapis.com/token": proxyconnect tcp: dial tcp 127.0.0.1:7897: connectex: No connection could be made because the target machine actively refused it.; fallback docling failed: docling extraction failed for source file 14585: exit status 1';

describe("toPublicResumeAnalysisErrorMessage", () => {
  it("replaces upstream internal failures with a public analysis message", () => {
    expect(toPublicResumeAnalysisErrorMessage(INTERNAL_FAILURE_MESSAGE)).toBe(
      PUBLIC_RESUME_ANALYSIS_ERROR.analysis,
    );
  });

  it("keeps allowlisted user-facing messages", () => {
    expect(
      toPublicResumeAnalysisErrorMessage(
        "Corrected extraction information cannot be empty.",
      ),
    ).toBe("Corrected extraction information cannot be empty.");
  });

  it("maps timeout messages to a public timeout message", () => {
    expect(
      toPublicResumeAnalysisErrorMessage("Upstream CV review request timed out."),
    ).toBe(PUBLIC_RESUME_ANALYSIS_ERROR.timeout);
  });

  it("uses extraction-specific fallback when requested", () => {
    expect(
      toPublicResumeAnalysisErrorMessage("docling conversion failed", "extraction"),
    ).toBe(PUBLIC_RESUME_ANALYSIS_ERROR.extraction);
  });
});

describe("toPublicAnalysisStageText", () => {
  it("hides upstream stage labels", () => {
    expect(toPublicAnalysisStageText("Upstream analysis failed", "FAILED")).toBe(
      "Analysis failed",
    );
  });
});

describe("toPublicProgressMessage", () => {
  it("keeps safe progress copy unchanged", () => {
    expect(
      toPublicProgressMessage(
        "The analysis failed. Please review the input and try again.",
        "FAILED",
      ),
    ).toBe("The analysis failed. Please review the input and try again.");
  });
});

describe("sanitizeAnalysisStatusForClient", () => {
  it("sanitizes the analysis-status payload shown to applicants", () => {
    expect(
      sanitizeAnalysisStatusForClient({
        jobStatus: "FAILED",
        stageText: "Upstream analysis failed",
        progressMessage:
          "The analysis failed. Please review the input and try again.",
        errorMessage: INTERNAL_FAILURE_MESSAGE,
      }),
    ).toEqual({
      jobStatus: "FAILED",
      stageText: "Analysis failed",
      progressMessage:
        "The analysis failed. Please review the input and try again.",
      errorMessage: PUBLIC_RESUME_ANALYSIS_ERROR.analysis,
    });
  });
});
