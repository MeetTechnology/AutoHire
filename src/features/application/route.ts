import type {
  ApplicationSnapshot,
  ApplicationStatus,
} from "@/features/application/types";

export function resolveRouteFromStatus(status: ApplicationStatus) {
  if (status === "INIT" || status === "INTRO_VIEWED") {
    return "/apply";
  }

  if (
    status === "CV_UPLOADED" ||
    status === "CV_ANALYZING" ||
    status === "REANALYZING" ||
    status === "INFO_REQUIRED" ||
    status === "INELIGIBLE" ||
    status === "ELIGIBLE"
  ) {
    return status === "CV_UPLOADED" ? "/apply/resume" : "/apply/result";
  }

  if (status === "MATERIALS_IN_PROGRESS" || status === "SUBMITTED") {
    return "/apply/materials";
  }

  return "/apply";
}

export function shouldRedirectFromApply(snapshot: ApplicationSnapshot) {
  return !["INIT", "INTRO_VIEWED"].includes(snapshot.applicationStatus);
}
