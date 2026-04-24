"use client";

import type { MaterialCategory } from "@/features/application/types";
import type {
  TrackingActionName,
  TrackingPageName,
  TrackingStepName,
  TrackingUploadPayload,
} from "@/lib/tracking/types";

const SESSION_STORAGE_KEY = "autohire:tracking-session-id";
const REQUEST_HEADER = "x-autohire-request-id";
const SESSION_HEADER = "x-autohire-session-id";

function ensureBrowserCryptoUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateTrackingSessionId() {
  if (typeof window === "undefined") {
    return ensureBrowserCryptoUuid();
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const next = ensureBrowserCryptoUuid();
  window.localStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}

export function createTrackingRequestId() {
  return ensureBrowserCryptoUuid();
}

export function createUploadId() {
  return ensureBrowserCryptoUuid();
}

export function buildTrackedRequestHeaders(
  headers?: HeadersInit,
  requestId = createTrackingRequestId(),
) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set(SESSION_HEADER, getOrCreateTrackingSessionId());
  nextHeaders.set(REQUEST_HEADER, requestId);
  return nextHeaders;
}

type TrackEventInput = {
  eventType: string;
  pageName?: TrackingPageName;
  stepName?: TrackingStepName;
  actionName?: TrackingActionName;
  eventStatus?: "SUCCESS" | "FAIL";
  applicationId?: string | null;
  token?: string | null;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  landingPath?: string | null;
  payload?: Record<string, unknown> | null;
  upload?: TrackingUploadPayload | null;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
  } | null;
};

export async function trackEvent(input: TrackEventInput) {
  const requestId = createTrackingRequestId();
  const sessionId = getOrCreateTrackingSessionId();

  try {
    await fetch("/api/track", {
      method: "POST",
      credentials: "include",
      headers: buildTrackedRequestHeaders(
        {
          "Content-Type": "application/json",
        },
        requestId,
      ),
      body: JSON.stringify({
        event_type: input.eventType,
        event_time: new Date().toISOString(),
        page_name: input.pageName,
        step_name: input.stepName,
        action_name: input.actionName,
        event_status: input.eventStatus,
        session_id: sessionId,
        request_id: requestId,
        application_id: input.applicationId ?? undefined,
        token: input.token ?? undefined,
        duration_ms: input.durationMs ?? undefined,
        error_code: input.errorCode ?? undefined,
        error_message: input.errorMessage ?? undefined,
        referer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        landing_path:
          input.landingPath ??
          (typeof window !== "undefined" ? window.location.pathname : undefined),
        utm: input.utm ?? undefined,
        upload: input.upload
          ? {
              upload_id: input.upload.uploadId,
              kind: input.upload.kind,
              category: input.upload.category ?? null,
              file_name: input.upload.fileName,
              file_ext: input.upload.fileExt ?? undefined,
              file_size: input.upload.fileSize ?? undefined,
              failure_stage: input.upload.failureStage ?? undefined,
              object_key: input.upload.objectKey ?? undefined,
            }
          : undefined,
        payload: input.payload ?? undefined,
      }),
    });
  } catch {
    // Tracking must never block the user flow.
  }
}

export async function trackPageView(input: {
  pageName: TrackingPageName;
  stepName: TrackingStepName;
  applicationId?: string | null;
  token?: string | null;
}) {
  const eventTypeByPage: Record<TrackingPageName, string> = {
    apply_entry: "intro_page_viewed",
    apply_resume: "resume_page_viewed",
    apply_result: "analysis_result_viewed",
    apply_materials: "materials_page_viewed",
    apply_submission_complete: "feedback_viewed",
  };

  return trackEvent({
    eventType: eventTypeByPage[input.pageName],
    pageName: input.pageName,
    stepName: input.stepName,
    actionName: "page_view",
    eventStatus: "SUCCESS",
    applicationId: input.applicationId ?? null,
    token: input.token ?? null,
  });
}

export async function trackClick(input: {
  eventType: string;
  pageName: TrackingPageName;
  stepName: TrackingStepName;
  applicationId?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  return trackEvent({
    eventType: input.eventType,
    pageName: input.pageName,
    stepName: input.stepName,
    actionName: "button_click",
    eventStatus: "SUCCESS",
    applicationId: input.applicationId ?? null,
    payload: input.payload ?? null,
  });
}

export async function trackUploadStage(input: {
  eventType: string;
  applicationId: string;
  pageName: TrackingPageName;
  stepName: TrackingStepName;
  uploadId: string;
  kind: "resume" | "material";
  category?: MaterialCategory | null;
  file: File;
  failureStage?: "intent" | "put" | "confirm" | null;
  objectKey?: string | null;
  eventStatus: "SUCCESS" | "FAIL";
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  return trackEvent({
    eventType: input.eventType,
    pageName: input.pageName,
    stepName: input.stepName,
    actionName:
      input.eventType.endsWith("_started") || input.eventType.endsWith("_failed")
        ? input.eventStatus === "FAIL"
          ? "upload_fail"
          : "upload_start"
        : "upload_confirm",
    eventStatus: input.eventStatus,
    applicationId: input.applicationId,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    upload: {
      uploadId: input.uploadId,
      kind: input.kind,
      category: input.category ?? null,
      fileName: input.file.name,
      fileExt: input.file.name.split(".").pop()?.toLowerCase() ?? null,
      fileSize: input.file.size,
      failureStage: input.failureStage ?? null,
      objectKey: input.objectKey ?? null,
    },
  });
}
