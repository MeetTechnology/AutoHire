import type { NextRequest } from "next/server";

import { hashInviteToken } from "@/lib/auth/token";
import type {
  AccessResult,
  AccessTokenStatusSnapshot,
  EventStatus,
  UploadFailureStage,
  UploadKind,
} from "@/lib/data/store";
import {
  createApplicationEventLog,
  createInviteAccessLog,
  findApplicationEventByIdempotency,
  findInvitationById,
  findInvitationByTokenHash,
  findOpenApplicationByInvitationId,
  getApplicationById,
  updateApplication,
  upsertFileUploadAttempt,
} from "@/lib/data/store";
import {
  extractRequestTrackingContext,
  type RequestTrackingContext,
} from "@/lib/tracking/context";
import type { TrackingEventInput } from "@/lib/tracking/types";

const ACCESS_EVENT_TO_RESULT: Record<string, AccessResult> = {
  invite_link_opened: "VALID",
  session_restored: "SESSION_RESTORE",
  invite_link_invalid: "INVALID",
  invite_link_expired: "EXPIRED",
  invite_link_disabled: "DISABLED",
};

const FILE_UPLOAD_EVENT_TO_STAGE: Record<string, UploadFailureStage | null> = {
  resume_upload_intent_created: null,
  resume_upload_started: null,
  resume_upload_confirmed: null,
  resume_upload_failed: "CONFIRM",
  material_upload_intent_created: null,
  material_upload_started: null,
  material_upload_confirmed: null,
  material_upload_failed: "CONFIRM",
};

export async function trackEvent(input: TrackingEventInput) {
  const eventTime = input.eventTime ?? new Date();
  const resolved = await resolveBoundContext(input);
  let eventId: string | null = null;

  if (isAccessEvent(input.eventType)) {
    const accessLog = await createInviteAccessLog({
      occurredAt: eventTime,
      invitationId: resolved.invitationId,
      applicationId: resolved.applicationId,
      tokenStatus: resolveTokenStatusSnapshot({
        accessResult: ACCESS_EVENT_TO_RESULT[input.eventType],
        invitationTokenStatus: resolved.invitationTokenStatus,
      }),
      accessResult: ACCESS_EVENT_TO_RESULT[input.eventType],
      ipAddress: input.ipAddress ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      referer: input.referer ?? null,
      landingPath: input.landingPath ?? null,
      sessionId: input.sessionId,
      requestId: input.requestId,
      utmSource: input.utm?.source ?? null,
      utmMedium: input.utm?.medium ?? null,
      utmCampaign: input.utm?.campaign ?? null,
    });
    eventId = accessLog.id;
  }

  if (resolved.applicationId && !isAccessEvent(input.eventType)) {
    const existing =
      input.sessionId && input.requestId
        ? await findApplicationEventByIdempotency({
            applicationId: resolved.applicationId,
            eventType: input.eventType,
            sessionId: input.sessionId,
            requestId: input.requestId,
          })
        : null;

    const applicationEvent =
      existing ??
      (await createApplicationEventLog({
        applicationId: resolved.applicationId,
        eventType: input.eventType,
        eventTime,
        pageName: input.pageName ?? null,
        stepName: input.stepName ?? null,
        actionName: input.actionName ?? null,
        eventStatus: (input.eventStatus ?? null) as EventStatus | null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
        sessionId: input.sessionId,
        requestId: input.requestId,
        ipAddress: input.ipAddress ?? null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        referer: input.referer ?? null,
        eventPayload: buildEventPayload(input),
      }));

    eventId ??= applicationEvent.id;

    if (input.upload) {
      await upsertFileUploadAttempt({
        applicationId: resolved.applicationId,
        uploadId: input.upload.uploadId,
        kind: mapUploadKind(input.upload.kind),
        category: input.upload.category ?? null,
        fileName: input.upload.fileName,
        fileExt: input.upload.fileExt ?? null,
        fileSize: input.upload.fileSize ?? null,
        intentCreatedAt:
          input.eventType.endsWith("_intent_created") ? eventTime : null,
        uploadStartedAt:
          input.eventType.endsWith("_upload_started") ? eventTime : null,
        uploadConfirmedAt:
          input.eventType.endsWith("_upload_confirmed") ? eventTime : null,
        uploadFailedAt:
          input.eventType.endsWith("_upload_failed") ? eventTime : null,
        failureCode: input.errorCode ?? null,
        failureStage:
          mapUploadFailureStage(input.upload.failureStage) ??
          FILE_UPLOAD_EVENT_TO_STAGE[input.eventType] ??
          null,
        objectKey: input.upload.objectKey ?? null,
        sessionId: input.sessionId,
        requestId: input.requestId,
      });
    }

  }

  if (resolved.applicationId) {
    await applyMilestones({
      applicationId: resolved.applicationId,
      eventType: input.eventType,
      eventTime,
    });
  }

  return {
    ok: true,
    accepted: true,
    eventId,
    boundContext: {
      invitationId: resolved.invitationId,
      applicationId: resolved.applicationId,
    },
  };
}

export async function trackEventFromRequest(
  request: NextRequest,
  input: Omit<
    TrackingEventInput,
    "sessionId" | "requestId" | "ipHash" | "userAgent" | "referer" | "landingPath" | "utm"
    | "ipAddress"
  > &
    Partial<
      Pick<
        TrackingEventInput,
        "sessionId" | "requestId" | "ipAddress" | "ipHash" | "userAgent" | "referer" | "landingPath" | "utm"
      >
    >,
) {
  const context = extractRequestTrackingContext(request);

  return trackEvent({
    ...input,
    sessionId: input.sessionId ?? context.sessionId,
    requestId: input.requestId ?? context.requestId,
    ipAddress: input.ipAddress ?? context.ipAddress,
    ipHash: input.ipHash ?? context.ipHash,
    userAgent: input.userAgent ?? context.userAgent,
    referer: input.referer ?? context.referer,
    landingPath: input.landingPath ?? context.landingPath,
    utm: input.utm ?? context.utm,
  });
}

export function buildTrackingInputFromRequest(
  request: NextRequest,
): RequestTrackingContext {
  return extractRequestTrackingContext(request);
}

async function resolveBoundContext(input: TrackingEventInput) {
  const explicitApplication = input.applicationId
    ? await getApplicationById(input.applicationId)
    : null;

  if (explicitApplication) {
    const invitation = await findInvitationById(explicitApplication.invitationId);

    return {
      applicationId: explicitApplication.id,
      invitationId: invitation?.id ?? explicitApplication.invitationId,
      invitationTokenStatus: invitation?.tokenStatus ?? null,
    };
  }

  if (!input.token) {
    return {
      applicationId: null,
      invitationId: null,
      invitationTokenStatus: null,
    };
  }

  const invitation = await findInvitationByTokenHash(hashInviteToken(input.token));
  const application = invitation
    ? await findOpenApplicationByInvitationId(invitation.id)
    : null;

  return {
    applicationId: application?.id ?? null,
    invitationId: invitation?.id ?? null,
    invitationTokenStatus: invitation?.tokenStatus ?? null,
  };
}

async function applyMilestones(input: {
  applicationId: string;
  eventType: string;
  eventTime: Date;
}) {
  const application = await getApplicationById(input.applicationId);

  if (!application) {
    return;
  }

  const patch: Parameters<typeof updateApplication>[1] = {};

  if (
    input.eventType === "invite_link_opened" ||
    input.eventType === "session_restored"
  ) {
    patch.firstAccessedAt = application.firstAccessedAt ?? input.eventTime;
    patch.lastAccessedAt = input.eventTime;
  } else {
    patch.lastAccessedAt = input.eventTime;
  }

  if (input.eventType === "start_apply_clicked") {
    patch.introConfirmedAt = application.introConfirmedAt ?? input.eventTime;
  }

  if (input.eventType === "resume_upload_intent_created") {
    patch.resumeUploadStartedAt =
      application.resumeUploadStartedAt ?? input.eventTime;
  }

  if (input.eventType === "resume_upload_confirmed") {
    patch.resumeUploadedAt = input.eventTime;
  }

  if (input.eventType === "analysis_started") {
    patch.analysisStartedAt = input.eventTime;
  }

  if (input.eventType === "analysis_completed") {
    patch.analysisCompletedAt = input.eventTime;
  }

  if (input.eventType === "materials_page_viewed") {
    patch.materialsEnteredAt = application.materialsEnteredAt ?? input.eventTime;
  }

  if (input.eventType === "application_submitted") {
    patch.submittedAt = input.eventTime;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  await updateApplication(input.applicationId, patch);
}

function buildEventPayload(input: TrackingEventInput) {
  const payload: Record<string, unknown> = {};

  if (input.payload) {
    payload.payload = input.payload;
  }

  if (input.utm) {
    payload.utm = input.utm;
  }

  if (input.upload) {
    payload.upload = input.upload;
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function resolveTokenStatusSnapshot(input: {
  accessResult: AccessResult;
  invitationTokenStatus: string | null;
}): AccessTokenStatusSnapshot {
  if (input.accessResult === "INVALID") {
    return "UNKNOWN";
  }

  if (input.accessResult === "EXPIRED") {
    return "EXPIRED";
  }

  if (input.accessResult === "DISABLED") {
    return "DISABLED";
  }

  if (input.invitationTokenStatus === "EXPIRED") {
    return "EXPIRED";
  }

  if (input.invitationTokenStatus === "DISABLED") {
    return "DISABLED";
  }

  return "ACTIVE";
}

function isAccessEvent(eventType: string) {
  return eventType in ACCESS_EVENT_TO_RESULT;
}

function mapUploadKind(kind: "resume" | "material"): UploadKind {
  return kind === "resume" ? "RESUME" : "MATERIAL";
}

function mapUploadFailureStage(
  value: "intent" | "put" | "confirm" | null | undefined,
): UploadFailureStage | null {
  if (value === "intent") {
    return "INTENT";
  }

  if (value === "put") {
    return "PUT";
  }

  if (value === "confirm") {
    return "CONFIRM";
  }

  return null;
}
