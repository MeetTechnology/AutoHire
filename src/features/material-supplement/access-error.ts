import { ApplicationClientError } from "@/features/application/client";
import { MaterialSupplementClientError } from "@/features/material-supplement/client";

export type SupplementAccessErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "notSubmitted"
  | "loadFailed";

export type SupplementAccessErrorState = {
  kind: SupplementAccessErrorKind;
  title: string;
  description: string;
};

const SESSION_REQUIRED_CODES = new Set([
  "SESSION_REQUIRED",
  "INVALID_TOKEN",
  "DISABLED_TOKEN",
  "EXPIRED_TOKEN",
  "UNAUTHORIZED",
]);

const ACCESS_ERROR_COPY: Record<
  SupplementAccessErrorKind,
  SupplementAccessErrorState
> = {
  unauthorized: {
    kind: "unauthorized",
    title: "Supplement access has expired",
    description:
      "Your session or invitation link is no longer valid. Return to the application entry and reopen your application before viewing supplement materials.",
  },
  forbidden: {
    kind: "forbidden",
    title: "Supplement access is unavailable",
    description:
      "This session is not allowed to view the requested application. Return to the application entry to restore the correct access.",
  },
  notFound: {
    kind: "notFound",
    title: "Application could not be found",
    description:
      "We could not find the application for this supplement page. Return to the application entry to restore access.",
  },
  notSubmitted: {
    kind: "notSubmitted",
    title: "Supplement materials are not available yet",
    description:
      "This application has not been submitted, so AI supplement review is not available. Continue the application flow before returning here.",
  },
  loadFailed: {
    kind: "loadFailed",
    title: "Supplement page could not be loaded",
    description:
      "The supplement information is temporarily unavailable. Refresh this page or try again later.",
  },
};

function isUnauthorizedStatus(status: number) {
  return status === 401 || status === 410;
}

export function classifySupplementAccessError(
  error: unknown,
): SupplementAccessErrorState {
  if (error instanceof MaterialSupplementClientError) {
    if (isUnauthorizedStatus(error.status) || error.code === "UNAUTHORIZED") {
      return ACCESS_ERROR_COPY.unauthorized;
    }

    if (error.status === 403 || error.code === "FORBIDDEN") {
      return ACCESS_ERROR_COPY.forbidden;
    }

    if (error.status === 404 || error.code === "APPLICATION_NOT_FOUND") {
      return ACCESS_ERROR_COPY.notFound;
    }

    if (error.status === 409 || error.code === "APPLICATION_NOT_SUBMITTED") {
      return ACCESS_ERROR_COPY.notSubmitted;
    }

    return ACCESS_ERROR_COPY.loadFailed;
  }

  if (error instanceof ApplicationClientError) {
    if (
      isUnauthorizedStatus(error.status) ||
      SESSION_REQUIRED_CODES.has(error.code)
    ) {
      return ACCESS_ERROR_COPY.unauthorized;
    }

    if (error.status === 403) {
      return ACCESS_ERROR_COPY.forbidden;
    }

    if (error.status === 404 || error.code === "APPLICATION_NOT_FOUND") {
      return ACCESS_ERROR_COPY.notFound;
    }

    return ACCESS_ERROR_COPY.loadFailed;
  }

  return ACCESS_ERROR_COPY.loadFailed;
}

export function isBlockingSupplementAccessError(error: unknown) {
  return classifySupplementAccessError(error).kind !== "loadFailed";
}
