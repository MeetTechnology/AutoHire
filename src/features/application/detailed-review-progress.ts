import type {
  ApplicationStatus,
  SecondaryAnalysisRunSummary,
  SecondaryAnalysisStatus,
} from "@/features/application/types";

export type DetailedReviewProgressSummary = {
  completedPrompts: number;
  totalPrompts: number;
  progressLabel: string;
  statusValue: SecondaryAnalysisStatus | "idle";
  isComplete: boolean;
};

function clampPromptCount(value: number, max: number) {
  if (value < 0) {
    return 0;
  }

  return value > max ? max : value;
}

export function getDetailedReviewProgressSummary(
  run: SecondaryAnalysisRunSummary | null,
  fallbackStatus: SecondaryAnalysisStatus,
): DetailedReviewProgressSummary | null {
  const totalPrompts = run?.totalPrompts ?? 0;

  if (totalPrompts <= 0) {
    return null;
  }

  const completedPrompts = clampPromptCount(run?.completedPrompts ?? 0, totalPrompts);
  const statusValue = run?.status ?? fallbackStatus;

  return {
    completedPrompts,
    totalPrompts,
    progressLabel: `${completedPrompts}/${totalPrompts}`,
    statusValue,
    isComplete: completedPrompts >= totalPrompts,
  };
}

export function isDetailedReviewReadyForUi(
  applicationStatus: ApplicationStatus | null | undefined,
  progress: DetailedReviewProgressSummary | null,
) {
  if (applicationStatus !== "SECONDARY_REVIEW") {
    return false;
  }

  if (!progress) {
    return true;
  }

  return progress.isComplete;
}

export function shouldShowDetailedReviewStartedNotice(
  runId: string | null | undefined,
  progress: DetailedReviewProgressSummary | null,
) {
  if (!runId) {
    return false;
  }

  return !progress?.isComplete;
}
