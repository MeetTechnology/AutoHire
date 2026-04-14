import type {
  ApplicationSnapshot,
  ApplicationStatus,
} from "@/features/application/types";

export type ApplicationFlowStep = 0 | 1 | 2 | 3 | 4;

export function resolveRouteFromStatus(status: ApplicationStatus) {
  if (status === "INIT") {
    return "/apply";
  }

  if (
    status === "INTRO_VIEWED" ||
    status === "CV_UPLOADED" ||
    status === "CV_ANALYZING" ||
    status === "REANALYZING" ||
    status === "INFO_REQUIRED" ||
    status === "INELIGIBLE" ||
    status === "ELIGIBLE" ||
    status === "SECONDARY_ANALYZING" ||
    status === "SECONDARY_REVIEW" ||
    status === "SECONDARY_FAILED"
  ) {
    return status === "INTRO_VIEWED" || status === "CV_UPLOADED"
      ? "/apply/resume"
      : "/apply/result";
  }

  if (status === "MATERIALS_IN_PROGRESS" || status === "SUBMITTED") {
    return "/apply/materials";
  }

  return "/apply";
}

export function shouldRedirectFromApply(snapshot: ApplicationSnapshot) {
  return snapshot.applicationStatus !== "INIT";
}

export function getReachableFlowStep(status: ApplicationStatus): ApplicationFlowStep {
  if (status === "INIT") {
    return 0;
  }

  if (status === "INTRO_VIEWED" || status === "CV_UPLOADED") {
    return 1;
  }

  if (
    status === "CV_ANALYZING" ||
    status === "REANALYZING" ||
    status === "INELIGIBLE" ||
    status === "ELIGIBLE"
  ) {
    return 2;
  }

  if (
    status === "INFO_REQUIRED" ||
    status === "SECONDARY_ANALYZING" ||
    status === "SECONDARY_REVIEW" ||
    status === "SECONDARY_FAILED"
  ) {
    return 3;
  }

  if (status === "MATERIALS_IN_PROGRESS" || status === "SUBMITTED") {
    return 4;
  }

  return 0;
}

export function canAccessFlowStep(
  status: ApplicationStatus,
  step: ApplicationFlowStep,
) {
  return getReachableFlowStep(status) >= step;
}

export function isFlowStepReadOnly(
  status: ApplicationStatus,
  step: ApplicationFlowStep,
) {
  return getReachableFlowStep(status) > step;
}
