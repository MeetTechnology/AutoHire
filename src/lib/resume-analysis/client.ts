import type { MissingField } from "@/features/analysis/types";
import type { EligibilityResult } from "@/features/application/types";
import { getEnv } from "@/lib/env";

type ExternalJobStatus = "queued" | "processing" | "completed" | "failed";

type AnalysisResult = {
  eligibilityResult: EligibilityResult;
  reasonText?: string | null;
  displaySummary?: string | null;
  extractedFields?: Record<string, unknown>;
  missingFields?: MissingField[];
};

function buildMockMissingFields(): MissingField[] {
  return [
    {
      fieldKey: "highest_degree",
      label: "最高学历",
      type: "select",
      required: true,
      options: ["本科", "硕士", "博士", "其他"],
      helpText: "请填写已获得的最高学历",
    },
    {
      fieldKey: "current_employer",
      label: "当前工作单位",
      type: "text",
      required: true,
      helpText: "请填写您当前任职的工作单位",
    },
  ];
}

function getMockScenarioFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.includes("eligible")) {
    return "eligible";
  }

  if (lower.includes("ineligible")) {
    return "ineligible";
  }

  return "insufficient_info";
}

function buildMockResult(scenario: string): AnalysisResult {
  if (scenario === "eligible") {
    return {
      eligibilityResult: "ELIGIBLE",
      reasonText: "符合基本申报条件。",
      displaySummary: "您已通过初步资格判断，请继续上传证明材料。",
      extractedFields: {
        highest_degree: "博士",
        current_employer: "Example University",
      },
      missingFields: [],
    };
  }

  if (scenario === "ineligible") {
    return {
      eligibilityResult: "INELIGIBLE",
      reasonText: "当前条件未达到申报要求。",
      displaySummary: "根据现有信息，您暂不符合申报资格。",
      extractedFields: {},
      missingFields: [],
    };
  }

  return {
    eligibilityResult: "INSUFFICIENT_INFO",
    reasonText: "缺少最高学历与当前工作单位信息。",
    displaySummary: "当前无法完成资格判断，缺少关键信息。",
    extractedFields: {},
    missingFields: buildMockMissingFields(),
  };
}

function parseMockExternalJobId(externalJobId: string) {
  const [, scenario = "insufficient_info"] = externalJobId.split(":");

  return scenario;
}

function isLiveMode() {
  const env = getEnv();

  return (
    env.RESUME_ANALYSIS_MODE === "live" &&
    Boolean(env.RESUME_ANALYSIS_BASE_URL) &&
    Boolean(env.RESUME_ANALYSIS_API_KEY)
  );
}

async function callLiveService(path: string, init?: RequestInit) {
  const env = getEnv();
  const response = await fetch(`${env.RESUME_ANALYSIS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESUME_ANALYSIS_API_KEY}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Resume analysis service error: ${response.status}`);
  }

  return response.json();
}

export async function createResumeAnalysisJob(input: {
  applicationId: string;
  fileName: string;
}) {
  if (isLiveMode()) {
    return callLiveService("/jobs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  const scenario = getMockScenarioFromFileName(input.fileName);

  return {
    externalJobId: `mock:${scenario}:${Date.now()}`,
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "模拟分析已完成",
    errorMessage: null,
  };
}

export async function reanalyzeWithSupplementalFields(input: {
  applicationId: string;
  fields: Record<string, unknown>;
}) {
  if (isLiveMode()) {
    return callLiveService("/jobs/reanalyze", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  const hasAllRequiredFields = Boolean(
    input.fields.highest_degree && input.fields.current_employer,
  );
  const scenario = hasAllRequiredFields ? "eligible" : "insufficient_info";

  return {
    externalJobId: `mock:${scenario}:${Date.now()}`,
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "模拟二次分析已完成",
    errorMessage: null,
  };
}

export async function getResumeAnalysisStatus(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    return callLiveService(`/jobs/${input.externalJobId}`);
  }

  return {
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "模拟分析已完成",
    progressMessage: "模拟分析任务已完成。",
    errorMessage: null,
  };
}

export async function getResumeAnalysisResult(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    return callLiveService(`/jobs/${input.externalJobId}/result`);
  }

  return buildMockResult(parseMockExternalJobId(input.externalJobId));
}
