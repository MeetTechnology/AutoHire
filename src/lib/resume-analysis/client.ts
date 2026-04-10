export async function createResumeAnalysisJob() {
  return {
    externalJobId: "stub-job-id",
  };
}

export async function getResumeAnalysisStatus() {
  return {
    status: "queued",
  };
}

export async function getResumeAnalysisResult() {
  return {
    eligibilityResult: "INSUFFICIENT_INFO",
  };
}
