import type { MissingField } from "@/features/analysis/types";
import type {
  EligibilityResult,
  SecondaryAnalysisStatus,
} from "@/features/application/types";
import { z } from "zod";

import { getEnv } from "@/lib/env";
import {
  buildMissingFieldsFromItemNames,
  buildSupplementalFieldPayload,
} from "@/lib/resume-analysis/missing-field-registry";
import {
  normalizeAnalysisResultPayload,
  normalizeExtractionResultPayload,
} from "@/lib/resume-analysis/result-normalizer";
import { readStoredObject } from "@/lib/storage/object-store";

type ExternalJobStatus = "queued" | "processing" | "completed" | "failed";
type ExternalAnalysisStage = "initial" | "extraction" | "judgment";

type AnalysisResult = {
  eligibilityResult: EligibilityResult;
  reasonText?: string | null;
  displaySummary?: string | null;
  extractedFields?: Record<string, unknown>;
  missingFields?: MissingField[];
  rawReasoning?: string | null;
};

const REQUEST_TIMEOUT_MS = 15_000;

const numericIdSchema = z.union([
  z.number().int().nonnegative(),
  z
    .string()
    .trim()
    .regex(/^\d+$/)
    .transform((value) => Number.parseInt(value, 10)),
]);

const liveUploadResponseSchema = z.object({
  job_id: numericIdSchema,
  files_count: z.number().int().optional(),
  message: z.string().optional(),
});

const liveInitialResultSchema = z
  .object({
    raw_response: z.string().nullable().optional(),
    parsed_result: z.unknown().optional(),
    status: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
    extraction_raw_response: z.string().nullable().optional(),
    extraction_parsed_result: z.unknown().optional(),
    extraction_status: z.string().nullable().optional(),
    extraction_error_message: z.string().nullable().optional(),
    judgment_raw_response: z.string().nullable().optional(),
    judgment_parsed_result: z.unknown().optional(),
    judgment_status: z.string().nullable().optional(),
    judgment_error_message: z.string().nullable().optional(),
  })
  .passthrough();

const liveSecondaryResultSchema = z
  .object({
    id: numericIdSchema.optional(),
    secondary_run_id: numericIdSchema.optional(),
    prompt_id: numericIdSchema.optional(),
    generated_text: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
  })
  .passthrough();

const liveJobDetailSchema = z
  .object({
    job: z
      .object({
        id: numericIdSchema,
        status: z.string(),
        error_message: z.string().nullable().optional(),
        secondary_status: z.string().nullable().optional(),
        secondary_error_message: z.string().nullable().optional(),
      })
      .passthrough(),
    initial_result: liveInitialResultSchema.optional(),
    secondary_run: z
      .object({
        id: numericIdSchema.optional(),
        status: z.string().nullable().optional(),
        error_message: z.string().nullable().optional(),
        total_prompts: z.number().int().nullable().optional(),
        completed_prompts: z.number().int().nullable().optional(),
        failed_prompt_ids: z.array(numericIdSchema).optional(),
        retryable: z.boolean().optional(),
        retry_after_seconds: z.number().nullable().optional(),
      })
      .passthrough()
      .optional(),
    secondary_results: z.array(liveSecondaryResultSchema).optional(),
  })
  .passthrough();

const liveReanalyzeResponseSchema = z
  .object({
    externalJobId: z.string().optional(),
    job_id: numericIdSchema.optional(),
    jobStatus: z.string().optional(),
    status: z.string().optional(),
    stageText: z.string().nullable().optional(),
    stage_text: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
  })
  .passthrough();

const liveSecondaryTriggerResponseSchema = z
  .object({
    job_id: numericIdSchema.optional(),
    run_id: numericIdSchema,
    message: z.string().optional(),
  })
  .passthrough();

const liveExtractionCorrectionResponseSchema = z
  .object({
    message: z.string().optional(),
    job_id: numericIdSchema,
    extraction_raw_response: z.string(),
    extraction_status: z.string().nullable().optional(),
    raw_response: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    extraction_parsed_result: z.unknown().optional(),
    parsed_result: z.unknown().optional(),
  })
  .passthrough();

const upstreamErrorSchema = z
  .object({
    code: z.string().optional(),
    stage: z.string().optional(),
    message: z.string().optional(),
    retryable: z.boolean().optional(),
    retry_after: z.number().optional(),
  })
  .passthrough();

type LiveJobDetail = z.infer<typeof liveJobDetailSchema>;
type LiveSecondaryResult = z.infer<typeof liveSecondaryResultSchema>;

export class ResumeAnalysisError extends Error {
  failureCode: string;
  retryable: boolean;
  retryAfterSeconds: number | null;
  httpStatus: number | null;

  constructor(input: {
    message: string;
    failureCode: string;
    retryable?: boolean;
    retryAfterSeconds?: number | null;
    httpStatus?: number | null;
  }) {
    super(input.message);
    this.name = "ResumeAnalysisError";
    this.failureCode = input.failureCode;
    this.retryable = input.retryable ?? false;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
    this.httpStatus = input.httpStatus ?? null;
  }
}

function buildMockMissingFields(): MissingField[] {
  return buildMissingFieldsFromItemNames([
    "Year of Birth",
    "Highest Degree",
    "Current Employer",
  ]);
}

function getMockScenarioFromFileName(fileName: string) {
  const lower = fileName.toLowerCase();

  if (lower.includes("contact-missing")) {
    return "eligible_contact_missing";
  }

  if (lower.includes("eligible")) {
    return "eligible";
  }

  if (lower.includes("ineligible")) {
    return "ineligible";
  }

  return "insufficient_info";
}

function buildMockRawText(scenario: string) {
  if (scenario === "eligible_contact_missing") {
    return `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: !!!null!!!
- Work Email: !!!null!!!
- Phone Number: !!!null!!!
- Year of Birth: 1988
- Doctoral Degree Status: Doctorate completed
- Doctoral Graduation Time: 2018
- Current Title Equivalence: Associate Professor
- Current Country of Employment: United States
- Work Experience (2020-Present): 2020-2022, United States, Example University, Research Scientist; 2022-Present, United States, Example University, Associate Professor
- Research Area: Semiconductor materials

### 2. Analysis Process
[[[The core eligibility information is complete. Personal contact fields are still missing from the resume extract.]]]

### 3. Determination Result
{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}`;
  }

  if (scenario === "eligible") {
    return `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: jane.doe@example.com
- Work Email: jane.doe@university.edu
- Phone Number: +1 555 010 2000
- Year of Birth: 1988
- Doctoral Degree Status: Doctorate completed
- Doctoral Graduation Time: 2018
- Current Title Equivalence: Associate Professor
- Current Country of Employment: United States
- Work Experience (2020-Present): 2020-2022, United States, Example University, Research Scientist; 2022-Present, United States, Example University, Associate Professor
- Research Area: Semiconductor materials

### 2. Analysis Process
[[[Key eligibility information is complete and the applicant meets the threshold.]]]

### 3. Determination Result
{{{After evaluation, your qualifications meet the basic application requirements of this talent program}}}`;
  }

  if (scenario === "ineligible") {
    return `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: jane.doe@example.com
- Work Email: jane.doe@college.edu
- Phone Number: +1 555 010 2000
- Year of Birth: 1988
- Doctoral Degree Status: Master's only
- Doctoral Graduation Time: !!!null!!!
- Current Title Equivalence: Lecturer/Teaching/Research Assistant
- Current Country of Employment: United States
- Work Experience (2020-Present): 2020-Present, United States, Example College, Lecturer
- Research Area: Pure humanities

### 2. Analysis Process
[[[The current academic qualifications and research area do not meet the program requirements.]]]

### 3. Determination Result
{{{We regret to inform you that your qualifications do not meet the basic application requirements of this talent program. The specific reasons are: Your current academic qualifications and representative achievements do not meet the application requirements. If you have any questions, please feel free to contact us at any time by email, WeChat, phone, or WhatsApp}}}`;
  }

  return `### 1. Extracted Information
- Name: Jane Doe
- Personal Email: jane.doe@example.com
- Work Email: jane.doe@university.edu
- Phone Number: +1 555 010 2000
- Year of Birth: !!!null!!!
- Doctoral Degree Status: !!!null!!!
- Doctoral Graduation Time: !!!null!!!
- Current Title Equivalence: !!!null!!!
- Current Country of Employment: United States
- Work Experience (2020-Present): !!!null!!!
- Research Area: Semiconductor materials

### 2. Analysis Process
[[[Part of the applicant background can be identified, but key eligibility information is still missing.]]]

### 3. Determination Result
{{{Cannot make a final determination due to missing critical information. Missing fields: Year of Birth, Highest Degree, Current Employer}}}`;
}

function buildMockExtractedFields(scenario: string) {
  if (scenario === "eligible_contact_missing") {
    return {
      name: "Jane Doe",
      personal_email: "",
      work_email: "",
      phone_number: "",
      year_of_birth: "1988",
      doctoral_degree_status: "Doctorate completed",
      doctoral_graduation_time: "2018",
      current_title_equivalence: "Associate Professor",
      current_country_of_employment: "United States",
      work_experience_2020_present:
        "2020-2022, United States, Example University, Research Scientist; 2022-Present, United States, Example University, Associate Professor",
      research_area: "Semiconductor materials",
    };
  }

  if (scenario === "eligible") {
    return {
      name: "Jane Doe",
      personal_email: "jane.doe@example.com",
      work_email: "jane.doe@university.edu",
      phone_number: "+1 555 010 2000",
      year_of_birth: "1988",
      doctoral_degree_status: "Doctorate completed",
      doctoral_graduation_time: "2018",
      current_title_equivalence: "Associate Professor",
      current_country_of_employment: "United States",
      work_experience_2020_present:
        "2020-2022, United States, Example University, Research Scientist; 2022-Present, United States, Example University, Associate Professor",
      research_area: "Semiconductor materials",
    };
  }

  if (scenario === "ineligible") {
    return {
      name: "Jane Doe",
      personal_email: "jane.doe@example.com",
      work_email: "jane.doe@college.edu",
      phone_number: "+1 555 010 2000",
      year_of_birth: "1988",
      doctoral_degree_status: "Master's only",
      current_title_equivalence: "Lecturer/Teaching/Research Assistant",
      current_country_of_employment: "United States",
      research_area: "Pure humanities",
    };
  }

  return {
    name: "Jane Doe",
    personal_email: "jane.doe@example.com",
    work_email: "jane.doe@university.edu",
    phone_number: "+1 555 010 2000",
    year_of_birth: "",
    doctoral_degree_status: "",
    current_country_of_employment: "United States",
    research_area: "Semiconductor materials",
  };
}

function getMockJudgmentText(scenario: string) {
  const rawText = buildMockRawText(scenario);
  const judgmentStart = rawText.indexOf("### 2. Analysis Process");

  return judgmentStart >= 0 ? rawText.slice(judgmentStart).trim() : rawText;
}

function buildMockResult(
  scenario: string,
  externalJobId?: string,
): AnalysisResult {
  const correctedExtraction = externalJobId
    ? correctedMockExtractionRawResponses.get(externalJobId)
    : null;
  const extractedFields = correctedExtraction
    ? normalizeExtractionResultPayload({
        extraction_raw_response: correctedExtraction,
      }).extractedFields
    : buildMockExtractedFields(scenario);
  const normalized = normalizeAnalysisResultPayload({
    raw_response: correctedExtraction
      ? `${correctedExtraction}\n\n${getMockJudgmentText(scenario)}`
      : buildMockRawText(scenario),
    parsed_result: {
      extracted_fields: extractedFields,
    },
  });

  return {
    eligibilityResult: normalized.eligibilityResult,
    reasonText: normalized.reasonText,
    displaySummary: normalized.displaySummary,
    extractedFields: normalized.extractedFields,
    missingFields: normalized.missingFields,
    rawReasoning: normalized.rawReasoning,
  };
}

function buildMockExtractionRawText(scenario: string) {
  return buildMockRawText(scenario).split("### 2. Analysis Process")[0]?.trim() ?? "";
}

function buildMockExtractionResult(scenario: string) {
  return {
    extractedFields: buildMockExtractedFields(scenario),
    rawResponse: buildMockExtractionRawText(scenario),
  };
}

const judgedMockExternalJobIds = new Set<string>();
const correctedMockExtractionRawResponses = new Map<string, string>();

function parseMockExternalJobId(externalJobId: string) {
  const [, scenario = "insufficient_info"] = externalJobId.split(":");

  return scenario;
}

function buildMockSecondaryTexts(scenario: string) {
  if (scenario === "ineligible") {
    return [
      `NO.1###Jane Doe
NO.15###Master's
NO.22###Lecturer
NO.32###Materials science
NO.35###The current academic qualifications and representative achievements do not meet the target program requirements.`,
    ];
  }

  return [
    `NO.1###Jane Doe
NO.3###1989-01-01
NO.6###Russia
NO.15###Doctorate
NO.22###Senior researcher
NO.24###Russian Academy of Sciences
NO.29###National talent program (2023)
NO.32###Biochemistry^^^Biotechnology^^^Genetic engineering`,
    `NO.33###2013-2021 Scientific researcher, PIBOC FEB RAS^^^2021-present Senior researcher, PIBOC FEB RAS
NO.36###Marine polysaccharide degrading enzymes research
NO.37###20+ SCI papers
NO.39###3 patents
NO.41###Can communicate in Chinese by email`,
  ];
}

function normalizeSecondaryStatus(
  value: string | null | undefined,
): SecondaryAnalysisStatus {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "retrying" ||
    normalized === "completed" ||
    normalized === "completed_partial" ||
    normalized === "failed"
  ) {
    return normalized;
  }

  return "idle";
}

function buildMockSecondaryResponse(externalJobId: string, runId?: string | null) {
  const scenario = parseMockExternalJobId(externalJobId);

  return {
    runId: runId ?? "mock-run-1",
    status: "completed" as SecondaryAnalysisStatus,
    errorMessage: null,
    run: {
      id: runId ?? "mock-run-1",
      status: "completed" as SecondaryAnalysisStatus,
      totalPrompts: 2,
      completedPrompts: 2,
      failedPromptIds: [] as string[],
      errorMessage: null,
    },
    results: buildMockSecondaryTexts(scenario).map((generatedText, index) => ({
      id: `mock-secondary-${index + 1}`,
      promptId: String(index + 1),
      generatedText,
      status: "completed" as SecondaryAnalysisStatus,
      errorMessage: null,
    })),
  };
}

function isLiveMode() {
  const env = getEnv();

  return (
    env.RESUME_ANALYSIS_MODE === "live" &&
    Boolean(env.RESUME_ANALYSIS_BASE_URL) &&
    Boolean(env.RESUME_ANALYSIS_API_KEY)
  );
}

/**
 * Parses `ResumeAnalysisJob.externalJobId` from resume-process upload / polling
 * into a positive integer job_id. Returns null for mock ids or non-numeric values.
 */
export function parseResumeProcessNumericJobId(
  externalJobId: string | null | undefined,
): number | null {
  if (!externalJobId) {
    return null;
  }

  const trimmed = externalJobId.trim();

  if (trimmed.length === 0 || trimmed.toLowerCase().startsWith("mock:")) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const value = Number.parseInt(trimmed, 10);

  if (!Number.isFinite(value) || value < 1) {
    return null;
  }

  return value;
}

/**
 * Registers expert `ResumeAnalysisJob.id` (cuid) → resume-process numeric `job_id`
 * so upstream `POST …/jobs/{jobId}/reanalyze` can resolve cuid paths (GO_EIIE BFF).
 * Idempotent: upstream returns 200 when the mapping already exists with the same pair.
 */
export async function registerExpertResumeAnalysisMapping(input: {
  applicationId: string;
  expertAnalysisJobId: string;
  upstreamJobId: number;
}) {
  if (!isLiveMode()) {
    return;
  }

  const env = getEnv();
  const path =
    env.RESUME_ANALYSIS_MAPPINGS_PATH ?? "/internal/resume-analysis/mappings";

  await callLiveService(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      applicationId: input.applicationId,
      expertAnalysisJobId: input.expertAnalysisJobId,
      upstreamJobId: input.upstreamJobId,
    }),
  });
}

/** No-op in mock mode or when `externalJobId` is not a numeric resume-process job id. */
export async function syncExpertJobUpstreamMapping(input: {
  applicationId: string;
  expertAnalysisJobId: string;
  externalJobId: string | null | undefined;
}) {
  const upstreamJobId = parseResumeProcessNumericJobId(input.externalJobId);

  if (upstreamJobId === null) {
    return;
  }

  await registerExpertResumeAnalysisMapping({
    applicationId: input.applicationId,
    expertAnalysisJobId: input.expertAnalysisJobId,
    upstreamJobId,
  });
}

function buildLiveUrl(path: string) {
  const env = getEnv();

  return `${env.RESUME_ANALYSIS_BASE_URL?.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeLiveStatus(value: string | null | undefined): ExternalJobStatus {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "completed") {
    return "completed";
  }

  if (normalized === "failed") {
    return "failed";
  }

  if (normalized === "processing" || normalized === "retrying") {
    return "processing";
  }

  if (normalized === "pending" || normalized === "queued") {
    return "queued";
  }

  throw new ResumeAnalysisError({
    message: `Unknown upstream job status: ${value ?? "empty"}.`,
    failureCode: "UPSTREAM_STATUS_SCHEMA_INVALID",
    httpStatus: 502,
  });
}

function buildLiveProgressMessage(
  jobStatus: ExternalJobStatus,
  detail?: LiveJobDetail,
) {
  const initialStatus = detail?.initial_result?.status?.trim().toLowerCase();
  const extractionStatus =
    detail?.initial_result?.extraction_status?.trim().toLowerCase();
  const judgmentStatus =
    detail?.initial_result?.judgment_status?.trim().toLowerCase();

  if (jobStatus === "queued") {
    return extractionStatus
      ? "Your CV has been uploaded and is queued for information extraction."
      : "Your CV has been uploaded and is queued for analysis.";
  }

  if (jobStatus === "processing") {
    if (judgmentStatus && judgmentStatus !== "completed") {
      return "";
    }

    if (extractionStatus && extractionStatus !== "completed") {
      return "The system is extracting key information from your CV. Please wait.";
    }

    if (initialStatus === "completed") {
      return "The upstream analysis has completed. The system is syncing the result.";
    }

    return "The system is analyzing your CV. Please wait.";
  }

  if (jobStatus === "failed") {
    return "The analysis failed. Please try again later.";
  }

  return "The analysis has completed.";
}

function getLiveStatusFromDetail(detail: LiveJobDetail) {
  const jobStatus = normalizeLiveStatus(detail.job.status);
  const initialStatus = detail.initial_result?.status?.trim().toLowerCase();
  const extractionStatus =
    detail.initial_result?.extraction_status?.trim().toLowerCase();
  const judgmentStatus =
    detail.initial_result?.judgment_status?.trim().toLowerCase();
  const errorMessage =
    detail.initial_result?.judgment_error_message ??
    detail.initial_result?.extraction_error_message ??
    detail.initial_result?.error_message ??
    detail.job.error_message ??
    detail.secondary_run?.error_message ??
    null;

  if (
    initialStatus === "error" ||
    extractionStatus === "error" ||
    extractionStatus === "failed" ||
    judgmentStatus === "error" ||
    judgmentStatus === "failed"
  ) {
    return {
      jobStatus: "failed" as const,
      stageText: "Upstream analysis failed",
      progressMessage: buildLiveProgressMessage("failed", detail),
      errorMessage: errorMessage ?? "The upstream analysis job failed.",
      analysisStage: (judgmentStatus === "error" || judgmentStatus === "failed"
        ? "judgment"
        : extractionStatus
          ? "extraction"
          : "initial") as ExternalAnalysisStage,
    };
  }

  if (extractionStatus && judgmentStatus !== "completed") {
    if (
      extractionStatus === "completed" &&
      (!judgmentStatus ||
        judgmentStatus === "pending" ||
        judgmentStatus === "queued")
    ) {
      return {
        jobStatus: "completed" as const,
        stageText: "CV information extraction completed",
        progressMessage:
          "The key information has been extracted. Please review and confirm it.",
        errorMessage: null,
        analysisStage: "extraction" as ExternalAnalysisStage,
      };
    }

    if (judgmentStatus && judgmentStatus !== "completed") {
      return {
        jobStatus:
          judgmentStatus === "pending" || judgmentStatus === "queued"
            ? ("queued" as const)
            : ("processing" as const),
        stageText: "Eligibility judgment in progress",
        progressMessage: buildLiveProgressMessage("processing", detail),
        errorMessage: null,
        analysisStage: "judgment" as ExternalAnalysisStage,
      };
    }

    return {
      jobStatus,
      stageText:
        jobStatus === "queued"
          ? "Queued for information extraction"
          : "Extracting CV information",
      progressMessage: buildLiveProgressMessage(jobStatus, detail),
      errorMessage: null,
      analysisStage: "extraction" as ExternalAnalysisStage,
    };
  }

  if (jobStatus === "completed") {
    if (!detail.initial_result || initialStatus === "processing") {
      return {
        jobStatus: "processing" as const,
        stageText: "Syncing analysis result",
        progressMessage: buildLiveProgressMessage("processing", detail),
        errorMessage: null,
      };
    }

    return {
      jobStatus: "completed" as const,
      stageText: "CV review completed",
      progressMessage: buildLiveProgressMessage("completed", detail),
      errorMessage: null,
      analysisStage: (judgmentStatus === "completed"
        ? "judgment"
        : "initial") as ExternalAnalysisStage,
    };
  }

  if (jobStatus === "failed") {
    return {
      jobStatus,
      stageText: "Upstream analysis failed",
      progressMessage: buildLiveProgressMessage(jobStatus, detail),
      errorMessage: errorMessage ?? "The upstream analysis job failed.",
      analysisStage: "initial" as ExternalAnalysisStage,
    };
  }

  return {
    jobStatus,
    stageText: jobStatus === "queued" ? "Queued for analysis" : "Analyzing CV",
    progressMessage: buildLiveProgressMessage(jobStatus, detail),
    errorMessage: null,
    analysisStage: "initial" as ExternalAnalysisStage,
  };
}

async function parseResponsePayload(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function callLiveService(path: string, init?: RequestInit) {
  const env = getEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildLiveUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${env.RESUME_ANALYSIS_API_KEY}`,
        ...(init?.headers ?? {}),
      },
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
            ? parsedError.data.retryable ?? false
            : false;
      const retryAfterSeconds = parsedError.success
        ? parsedError.data.retry_after ?? null
        : null;
      const message = parsedError.success
        ? parsedError.data.message ??
          `CV review service error: ${response.status}`
        : `CV review service error: ${response.status}`;

      throw new ResumeAnalysisError({
        message,
        failureCode: "UPSTREAM_HTTP_ERROR",
        retryable,
        retryAfterSeconds,
        httpStatus: response.status,
      });
    }

    return parseResponsePayload(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ResumeAnalysisError({
        message: "Upstream CV review request timed out.",
        failureCode: "UPSTREAM_TIMEOUT",
        retryable: true,
        httpStatus: 504,
      });
    }

    if (error instanceof ResumeAnalysisError) {
      throw error;
    }

    throw new ResumeAnalysisError({
      message:
        error instanceof Error
          ? error.message
          : "Upstream CV review request failed.",
      failureCode: "UPSTREAM_NETWORK_ERROR",
      retryable: true,
      httpStatus: 502,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createResumeAnalysisJob(input: {
  applicationId: string;
  fileName: string;
  fileType?: string;
  objectKey?: string;
}) {
  if (isLiveMode()) {
    if (!input.objectKey) {
      throw new ResumeAnalysisError({
        message: "CV object key is required in live mode.",
        failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
        httpStatus: 500,
      });
    }

    const payload = liveUploadResponseSchema.parse(
      await callLiveService("/resume-process/upload", {
        method: "POST",
        body: await buildStoredResumeFormData(input),
      }),
    );

    return {
      externalJobId: String(payload.job_id),
      jobStatus: "queued" as ExternalJobStatus,
      stageText: "CV uploaded and queued for analysis",
      errorMessage: null,
    };
  }

  const scenario = getMockScenarioFromFileName(input.fileName);

  return {
    externalJobId: `mock:${scenario}:${Date.now()}`,
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "Mock analysis completed",
    errorMessage: null,
  };
}

async function buildStoredResumeFormData(input: {
  fileName: string;
  fileType?: string;
  objectKey?: string;
}) {
  if (!input.objectKey) {
    throw new ResumeAnalysisError({
      message: "CV object key is required in live mode.",
      failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
      httpStatus: 500,
    });
  }

  const fileBuffer = await readStoredObject(input.objectKey);
  const formData = new FormData();

  formData.append(
    "file",
    new Blob([new Uint8Array(fileBuffer)], {
      type: input.fileType || "application/octet-stream",
    }),
    input.fileName,
  );

  return formData;
}

export async function createResumeExtractionJob(input: {
  applicationId: string;
  fileName: string;
  fileType?: string;
  objectKey?: string;
}) {
  if (isLiveMode()) {
    const payload = liveUploadResponseSchema.parse(
      await callLiveService("/resume-process/extraction/upload", {
        method: "POST",
        body: await buildStoredResumeFormData(input),
      }),
    );

    return {
      externalJobId: String(payload.job_id),
      jobStatus: "queued" as ExternalJobStatus,
      stageText: "CV uploaded and queued for information extraction",
      errorMessage: null,
    };
  }

  const scenario = getMockScenarioFromFileName(input.fileName);

  return {
    externalJobId: `mock-extract:${scenario}:${Date.now()}`,
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "Mock extraction completed",
    errorMessage: null,
  };
}

export async function reanalyzeWithSupplementalFields(input: {
  applicationId: string;
  fields: Record<string, unknown>;
  valuesBySourceItemName?: Record<string, unknown>;
  latestAnalysisJobId?: string | null;
}) {
  if (isLiveMode()) {
    if (!input.latestAnalysisJobId) {
      throw new ResumeAnalysisError({
        message: "Latest analysis job id is required for live reanalysis.",
        failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
        httpStatus: 500,
      });
    }

    const env = getEnv();
    const reanalyzePathTemplate =
      env.RESUME_ANALYSIS_REANALYZE_PATH ??
      "/internal/resume-analysis/jobs/{jobId}/reanalyze";
    const reanalyzePath = reanalyzePathTemplate.replace(
      "{jobId}",
      encodeURIComponent(input.latestAnalysisJobId),
    );
    const payload = liveReanalyzeResponseSchema.parse(
      await callLiveService(reanalyzePath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          applicationId: input.applicationId,
          latestAnalysisJobId: input.latestAnalysisJobId,
          fields: input.valuesBySourceItemName ?? input.fields,
        }),
      }),
    );

    const externalJobId = payload.externalJobId ?? String(payload.job_id ?? "");

    if (!externalJobId) {
      throw new ResumeAnalysisError({
        message: "Live reanalysis response is missing external job id.",
        failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
        httpStatus: 502,
      });
    }

    return {
      externalJobId,
      jobStatus: normalizeLiveStatus(payload.jobStatus ?? payload.status ?? "queued"),
      stageText:
        payload.stageText ??
        payload.stage_text ??
        "Supplemental information submitted. Reanalysis is in progress.",
      errorMessage: payload.errorMessage ?? payload.error_message ?? null,
    };
  }

  const supplementalPayload = buildSupplementalFieldPayload(
    input.fields,
    buildMockMissingFields(),
  );
  const hasAllRequiredFields = Boolean(
    supplementalPayload.valuesByFieldKey.highest_degree &&
      supplementalPayload.valuesByFieldKey.current_employer,
  );
  const scenario = hasAllRequiredFields ? "eligible" : "insufficient_info";

  return {
    externalJobId: `mock:${scenario}:${Date.now()}`,
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "Mock reanalysis completed",
    errorMessage: null,
  };
}

export async function triggerSecondaryAnalysis(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    const payload = liveSecondaryTriggerResponseSchema.parse(
      await callLiveService(
        `/resume-process/jobs/${encodeURIComponent(input.externalJobId)}/trigger-secondary`,
        {
          method: "POST",
        },
      ),
    );

    return {
      runId: String(payload.run_id),
      status: "pending" as SecondaryAnalysisStatus,
    };
  }

  return {
    runId: `mock-run-${Date.now()}`,
    status: "completed" as SecondaryAnalysisStatus,
  };
}

export async function getSecondaryAnalysisResult(input: {
  externalJobId: string;
  runId?: string | null;
}) {
  if (isLiveMode()) {
    const search = input.runId
      ? `?run_id=${encodeURIComponent(input.runId)}`
      : "";
    const detail = liveJobDetailSchema.parse(
      await callLiveService(
        `/resume-process/jobs/${encodeURIComponent(input.externalJobId)}${search}`,
      ),
    );
    const secondaryStatus = normalizeSecondaryStatus(detail.job.secondary_status);
    const runId = detail.secondary_run?.id
      ? String(detail.secondary_run.id)
      : input.runId ?? null;

    return {
      runId,
      status: secondaryStatus,
      errorMessage:
        detail.job.secondary_error_message ??
        detail.secondary_run?.error_message ??
        null,
      run: detail.secondary_run
        ? {
            id: detail.secondary_run.id ? String(detail.secondary_run.id) : null,
            status: normalizeSecondaryStatus(detail.secondary_run.status),
            totalPrompts: detail.secondary_run.total_prompts ?? null,
            completedPrompts: detail.secondary_run.completed_prompts ?? null,
            failedPromptIds: (detail.secondary_run.failed_prompt_ids ?? []).map(
              (promptId) => String(promptId),
            ),
            errorMessage: detail.secondary_run.error_message ?? null,
          }
        : null,
      results: (detail.secondary_results ?? []).map(
        (result: LiveSecondaryResult, index) => ({
          id: result.id ? String(result.id) : `secondary-${index + 1}`,
          promptId: result.prompt_id ? String(result.prompt_id) : null,
          generatedText: result.generated_text ?? "",
          status: normalizeSecondaryStatus(result.status),
          errorMessage: result.error_message ?? null,
        }),
      ),
    };
  }

  return buildMockSecondaryResponse(input.externalJobId, input.runId);
}

export async function getResumeAnalysisStatus(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    const payload = liveJobDetailSchema.parse(
      await callLiveService(`/resume-process/jobs/${input.externalJobId}`),
    );

    return getLiveStatusFromDetail(payload);
  }

  if (input.externalJobId.startsWith("mock-extract:")) {
    const judgmentStarted = judgedMockExternalJobIds.has(input.externalJobId);

    return {
      jobStatus: "completed" as ExternalJobStatus,
      stageText: judgmentStarted
        ? "Mock eligibility judgment completed"
        : "Mock information extraction completed",
      progressMessage: judgmentStarted
        ? "The mock eligibility judgment has completed."
        : "The mock extraction has completed. Please review and confirm it.",
      errorMessage: null,
      analysisStage: judgmentStarted
        ? ("judgment" as ExternalAnalysisStage)
        : ("extraction" as ExternalAnalysisStage),
    };
  }

  return {
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "Mock analysis completed",
    progressMessage: "The mock analysis job has completed.",
    errorMessage: null,
    analysisStage: "initial" as ExternalAnalysisStage,
  };
}

export async function getResumeExtractionResult(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    const detail = liveJobDetailSchema.parse(
      await callLiveService(`/resume-process/jobs/${input.externalJobId}`),
    );

    if (!detail.initial_result) {
      throw new ResumeAnalysisError({
        message: "Upstream job detail is missing initial_result.",
        failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
        retryable: true,
        httpStatus: 502,
      });
    }

    const extractionStatus =
      detail.initial_result.extraction_status?.trim().toLowerCase();

    if (extractionStatus !== "completed") {
      throw new ResumeAnalysisError({
        message: "Upstream extraction result is not ready yet.",
        failureCode: "UPSTREAM_EXTRACTION_NOT_READY",
        retryable: true,
        httpStatus: 409,
      });
    }

    return normalizeExtractionResultPayload(detail.initial_result);
  }

  return buildMockExtractionResult(parseMockExternalJobId(input.externalJobId));
}

export async function triggerEligibilityJudgment(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    const payload = liveUploadResponseSchema.parse(
      await callLiveService(
        `/resume-process/jobs/${encodeURIComponent(input.externalJobId)}/judge-eligibility`,
        {
          method: "POST",
        },
      ),
    );

    return {
      externalJobId: String(payload.job_id),
      jobStatus: "queued" as ExternalJobStatus,
      stageText: "Eligibility judgment queued",
      errorMessage: null,
    };
  }

  judgedMockExternalJobIds.add(input.externalJobId);

  return {
    externalJobId: input.externalJobId,
    jobStatus: "completed" as ExternalJobStatus,
    stageText: "Mock eligibility judgment completed",
    errorMessage: null,
  };
}

export async function correctResumeExtraction(input: {
  externalJobId: string;
  extractionRawResponse: string;
}) {
  const extractionRawResponse = input.extractionRawResponse.trim();

  if (!extractionRawResponse) {
    throw new ResumeAnalysisError({
      message: "Corrected extraction information cannot be empty.",
      failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
      httpStatus: 400,
    });
  }

  if (isLiveMode()) {
    const payload = liveExtractionCorrectionResponseSchema.parse(
      await callLiveService(
        `/resume-process/jobs/${encodeURIComponent(input.externalJobId)}/extraction`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            extraction_raw_response: extractionRawResponse,
          }),
        },
      ),
    );
    const normalized = normalizeExtractionResultPayload(payload);

    return {
      externalJobId: String(payload.job_id),
      extractionStatus: payload.extraction_status ?? payload.status ?? null,
      rawResponse: normalized.rawResponse ?? extractionRawResponse,
      extractedFields: normalized.extractedFields,
    };
  }

  const normalized = normalizeExtractionResultPayload({
    extraction_raw_response: extractionRawResponse,
  });

  correctedMockExtractionRawResponses.set(
    input.externalJobId,
    extractionRawResponse,
  );

  return {
    externalJobId: input.externalJobId,
    extractionStatus: "completed",
    rawResponse: normalized.rawResponse ?? extractionRawResponse,
    extractedFields: normalized.extractedFields,
  };
}

export async function getResumeAnalysisResult(input: {
  externalJobId: string;
}) {
  if (isLiveMode()) {
    const detail = liveJobDetailSchema.parse(
      await callLiveService(`/resume-process/jobs/${input.externalJobId}`),
    );

    if (!detail.initial_result) {
      throw new ResumeAnalysisError({
        message: "Upstream job detail is missing initial_result.",
        failureCode: "UPSTREAM_RESULT_SCHEMA_INVALID",
        retryable: true,
        httpStatus: 502,
      });
    }

    if (detail.initial_result.status?.trim().toLowerCase() === "error") {
      throw new ResumeAnalysisError({
        message:
          detail.initial_result.error_message ?? "Upstream job returned error result.",
        failureCode: "UPSTREAM_JOB_FAILED",
        httpStatus: 502,
      });
    }

    const judgmentStatus =
      detail.initial_result.judgment_status?.trim().toLowerCase();

    if (
      detail.initial_result.extraction_status &&
      judgmentStatus !== "completed"
    ) {
      throw new ResumeAnalysisError({
        message: "Upstream eligibility judgment result is not ready yet.",
        failureCode: "UPSTREAM_JUDGMENT_NOT_READY",
        retryable: true,
        httpStatus: 409,
      });
    }

    const normalized = normalizeAnalysisResultPayload(detail.initial_result);

    return {
      eligibilityResult: normalized.eligibilityResult,
      reasonText: normalized.reasonText,
      displaySummary: normalized.displaySummary,
      extractedFields: normalized.extractedFields,
      missingFields: normalized.missingFields,
      rawReasoning: normalized.rawReasoning,
    };
  }

  if (
    input.externalJobId.startsWith("mock-extract:") &&
    !judgedMockExternalJobIds.has(input.externalJobId)
  ) {
    throw new ResumeAnalysisError({
      message: "Mock eligibility judgment result is not ready yet.",
      failureCode: "UPSTREAM_JUDGMENT_NOT_READY",
      retryable: true,
      httpStatus: 409,
    });
  }

  return buildMockResult(
    parseMockExternalJobId(input.externalJobId),
    input.externalJobId,
  );
}

export function isRetryableResumeAnalysisError(error: unknown) {
  return error instanceof ResumeAnalysisError && error.retryable;
}

export function getResumeAnalysisErrorMessage(error: unknown) {
  if (error instanceof ResumeAnalysisError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "CV review service request failed.";
}
