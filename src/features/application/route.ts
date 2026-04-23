import type {
  ApplicationSnapshot,
  ApplicationStatus,
} from "@/features/application/types";

export type ApplicationFlowStep = 0 | 1 | 2 | 3;

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
    return "/apply/resume";
  }

  if (status === "MATERIALS_IN_PROGRESS") {
    return "/apply/materials";
  }

  if (status === "SUBMITTED") {
    return "/apply/submission-complete";
  }

  return "/apply";
}

export function shouldRedirectFromApply(snapshot: ApplicationSnapshot) {
  return snapshot.applicationStatus !== "INIT";
}

export function getReachableFlowStep(
  status: ApplicationStatus,
): ApplicationFlowStep {
  if (status === "INIT") {
    return 0;
  }

  if (
    status === "INTRO_VIEWED" ||
    status === "CV_UPLOADED" ||
    status === "CV_ANALYZING" ||
    status === "REANALYZING" ||
    status === "INELIGIBLE"
  ) {
    return 1;
  }

  if (
    status === "ELIGIBLE" ||
    status === "INFO_REQUIRED" ||
    status === "SECONDARY_ANALYZING" ||
    status === "SECONDARY_REVIEW" ||
    status === "SECONDARY_FAILED"
  ) {
    return 2;
  }

  if (status === "MATERIALS_IN_PROGRESS") {
    return 2;
  }

  if (status === "SUBMITTED") {
    return 3;
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

/**
 * Stepper destinations for the four-step journey (with intro).
 * Step 2 ("Additional Information") opens materials upload except while
 * supplemental fields are required (`INFO_REQUIRED`), when it stays on the
 * unified CV Review route. After final submission, Step 2 opens materials in
 * review mode. Step 3 is always the submission-complete route.
 */
export function buildApplyFlowStepLinks(
  applicationStatus?: ApplicationStatus | null,
): readonly string[] {
  const additionalInformationHref =
    applicationStatus === "INFO_REQUIRED"
      ? "/apply/resume?view=additional"
      : applicationStatus === "SUBMITTED"
        ? "/apply/materials?view=review"
      : "/apply/materials";

  return [
    "/apply",
    "/apply/resume?view=review",
    additionalInformationHref,
    "/apply/submission-complete",
  ];
}
