import { describe, expect, it } from "vitest";

import {
  createResumeAnalysisJob,
  getResumeAnalysisResult,
  reanalyzeWithSupplementalFields,
} from "@/lib/resume-analysis/client";

describe("resume analysis mock adapter", () => {
  it("creates an eligible mock job when file name contains eligible", async () => {
    const job = await createResumeAnalysisJob({
      applicationId: "app_1",
      fileName: "candidate-eligible.pdf",
    });

    expect(job.externalJobId).toContain("eligible");
  });

  it("returns missing fields for insufficient info scenarios", async () => {
    const result = await getResumeAnalysisResult({
      externalJobId: "mock:insufficient_info:test",
    });

    expect(result.eligibilityResult).toBe("INSUFFICIENT_INFO");
    expect(result.missingFields?.length).toBeGreaterThan(0);
  });

  it("returns eligible on reanalysis when required fields are present", async () => {
    const job = await reanalyzeWithSupplementalFields({
      applicationId: "app_1",
      fields: {
        highest_degree: "博士",
        current_employer: "Example University",
      },
    });

    expect(job.externalJobId).toContain("eligible");
  });
});
