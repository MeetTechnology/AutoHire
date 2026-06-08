export type ResumeAnalysisErrorContext = "analysis" | "extraction" | "generic";

export const PUBLIC_RESUME_ANALYSIS_ERROR = {
  analysis: "CV review failed. Please check your file and try again.",
  extraction:
    "We could not extract information from your CV. Please check the file and try again.",
  serviceUnavailable:
    "CV review service is temporarily unavailable. Please try again later.",
  timeout: "CV review timed out. Please try again later.",
  generic: "CV review failed. Please try again later.",
} as const;

const PUBLIC_ERROR_ALLOWLIST = new Set<string>([
  PUBLIC_RESUME_ANALYSIS_ERROR.analysis,
  PUBLIC_RESUME_ANALYSIS_ERROR.extraction,
  PUBLIC_RESUME_ANALYSIS_ERROR.serviceUnavailable,
  PUBLIC_RESUME_ANALYSIS_ERROR.timeout,
  PUBLIC_RESUME_ANALYSIS_ERROR.generic,
  "The analysis failed. Please try again later.",
  "The extraction failed.",
  "Corrected extraction information cannot be empty.",
  "CV review service request failed.",
  "CV review failed. Please try again later.",
]);

const INTERNAL_ERROR_PATTERNS = [
  /https?:\/\//i,
  /\\Users\\/i,
  /site-packages/i,
  /\boauth2\b/i,
  /proxyconnect/i,
  /dial tcp/i,
  /\bdocling\b/i,
  /\brapidocr\b/i,
  /\bpydantic\b/i,
  /\bvertexai\b/i,
  /streamGenerateContent/i,
  /googleapis\.com/i,
  /primary failed/i,
  /\bfallback\b/i,
  /生成失败/,
  /exit status/i,
  /\u001b\[/,
  /API call failed/i,
  /modelscope/i,
  /python\d/i,
  /UserWarning/i,
  /\bpost\s+"/i,
  /\.pth\b/i,
  /cannot fetch token/i,
  /error reading from stream/i,
  /\bupstream\b/i,
  /doRequest/i,
  /connectex/i,
  /127\.0\.0\.1/i,
];

const INTERNAL_PROGRESS_MESSAGE_PATTERNS = [
  ...INTERNAL_ERROR_PATTERNS,
  /\bupstream\b/i,
];

const PUBLIC_STAGE_TEXT: Record<string, string> = {
  "Upstream analysis failed": "Analysis failed",
  "Retrying analysis status request": "Processing",
};

function resolveFallbackMessage(context: ResumeAnalysisErrorContext) {
  switch (context) {
    case "extraction":
      return PUBLIC_RESUME_ANALYSIS_ERROR.extraction;
    case "analysis":
      return PUBLIC_RESUME_ANALYSIS_ERROR.analysis;
    default:
      return PUBLIC_RESUME_ANALYSIS_ERROR.generic;
  }
}

function looksLikeInternalMessage(message: string) {
  const trimmed = message.trim();

  if (trimmed.length > 240) {
    return true;
  }

  return INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function toPublicResumeAnalysisErrorMessage(
  message: string | null | undefined,
  context: ResumeAnalysisErrorContext = "analysis",
): string | null {
  if (!message?.trim()) {
    return null;
  }

  const trimmed = message.trim();

  if (/timed out/i.test(trimmed)) {
    return PUBLIC_RESUME_ANALYSIS_ERROR.timeout;
  }

  if (/temporarily unavailable|keep retrying/i.test(trimmed)) {
    return PUBLIC_RESUME_ANALYSIS_ERROR.serviceUnavailable;
  }

  if (PUBLIC_ERROR_ALLOWLIST.has(trimmed)) {
    return trimmed;
  }

  if (looksLikeInternalMessage(trimmed)) {
    return resolveFallbackMessage(context);
  }

  return resolveFallbackMessage(context);
}

export function toPublicAnalysisStageText(
  stageText: string | null | undefined,
  jobStatus?: string,
) {
  if (!stageText?.trim()) {
    return jobStatus === "FAILED" ? "Analysis failed" : "Processing";
  }

  const trimmed = stageText.trim();

  if (PUBLIC_STAGE_TEXT[trimmed]) {
    return PUBLIC_STAGE_TEXT[trimmed];
  }

  if (/^upstream\b/i.test(trimmed) || /retrying analysis status request/i.test(trimmed)) {
    if (/failed/i.test(trimmed)) {
      return "Analysis failed";
    }

    if (/extraction/i.test(trimmed)) {
      return "Extracting CV information";
    }

    return "Processing";
  }

  return trimmed;
}

export function toPublicProgressMessage(
  progressMessage: string | null | undefined,
  jobStatus?: string,
) {
  if (!progressMessage?.trim()) {
    return progressMessage ?? "";
  }

  const trimmed = progressMessage.trim();

  if (INTERNAL_PROGRESS_MESSAGE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return jobStatus === "FAILED"
      ? "The analysis failed. Please review the input and try again."
      : "The system is processing your request. Please wait.";
  }

  return trimmed;
}

export function sanitizeAnalysisStatusForClient<
  T extends {
    jobStatus: string;
    stageText?: string | null;
    progressMessage?: string;
    errorMessage?: string | null;
  },
>(status: T): T {
  const context: ResumeAnalysisErrorContext =
    status.stageText?.toLowerCase().includes("extraction") ||
    status.progressMessage?.toLowerCase().includes("extraction")
      ? "extraction"
      : "analysis";

  return {
    ...status,
    stageText: toPublicAnalysisStageText(status.stageText, status.jobStatus),
    progressMessage:
      typeof status.progressMessage === "string"
        ? toPublicProgressMessage(status.progressMessage, status.jobStatus)
        : status.progressMessage,
    errorMessage: status.errorMessage
      ? toPublicResumeAnalysisErrorMessage(status.errorMessage, context)
      : (status.errorMessage ?? null),
  };
}
