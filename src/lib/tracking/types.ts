import type { MaterialCategory } from "@/features/application/types";

export type TrackingPageName =
  | "apply_entry"
  | "apply_resume"
  | "apply_result"
  | "apply_materials"
  | "apply_submission_complete";

export type TrackingStepName =
  | "invite_access"
  | "intro"
  | "resume_upload"
  | "resume_extraction"
  | "analysis_result"
  | "supplemental"
  | "secondary_analysis"
  | "materials"
  | "submit"
  | "feedback";

export type TrackingActionName =
  | "page_view"
  | "page_duration"
  | "button_click"
  | "intent_create"
  | "upload_start"
  | "upload_confirm"
  | "upload_fail"
  | "submit_confirm";

export type TrackingEventStatus = "SUCCESS" | "FAIL";

export type TrackingUtm = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
};

export type TrackingUploadPayload = {
  uploadId: string;
  kind: "resume" | "material";
  category?: MaterialCategory | null;
  fileName: string;
  fileExt?: string | null;
  fileSize?: number | null;
  failureStage?: "intent" | "put" | "confirm" | null;
  objectKey?: string | null;
};

export type TrackingEventInput = {
  eventType: string;
  eventTime?: Date;
  pageName?: TrackingPageName | null;
  stepName?: TrackingStepName | null;
  actionName?: TrackingActionName | null;
  eventStatus?: TrackingEventStatus | null;
  sessionId: string;
  requestId: string;
  applicationId?: string | null;
  token?: string | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  referer?: string | null;
  landingPath?: string | null;
  ipAddress?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  utm?: TrackingUtm | null;
  upload?: TrackingUploadPayload | null;
  payload?: Record<string, unknown> | null;
};
