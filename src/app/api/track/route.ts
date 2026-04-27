import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError, parseJsonBody } from "@/lib/http";
import { trackEventFromRequest } from "@/lib/tracking/service";

const trackEventSchema = z.object({
  event_type: z.string().min(1),
  event_time: z.string().datetime({ offset: true }).optional(),
  page_name: z
    .enum([
      "apply_entry",
      "apply_resume",
      "apply_result",
      "apply_materials",
      "apply_submission_complete",
    ])
    .optional(),
  step_name: z
    .enum([
      "invite_access",
      "intro",
      "resume_upload",
      "resume_extraction",
      "analysis_result",
      "supplemental",
      "secondary_analysis",
      "materials",
      "submit",
      "feedback",
    ])
    .optional(),
  action_name: z
    .enum([
      "page_view",
      "page_duration",
      "button_click",
      "intent_create",
      "upload_start",
      "upload_confirm",
      "upload_fail",
      "submit_confirm",
    ])
    .optional(),
  event_status: z.enum(["SUCCESS", "FAIL"]).optional(),
  session_id: z.string().min(1),
  request_id: z.string().min(1),
  application_id: z.string().min(1).optional(),
  token: z.string().min(1).optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  error_code: z.string().min(1).optional(),
  error_message: z.string().min(1).optional(),
  referer: z.string().optional(),
  landing_path: z.string().optional(),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
    })
    .optional(),
  upload: z
    .object({
      upload_id: z.string().min(1),
      kind: z.enum(["resume", "material"]),
      category: z
        .enum([
          "IDENTITY",
          "EMPLOYMENT",
          "EDUCATION",
          "HONOR",
          "PATENT",
          "PROJECT",
          "PAPER",
          "BOOK",
          "CONFERENCE",
          "PRODUCT",
        ])
        .nullable()
        .optional(),
      file_name: z.string().min(1),
      file_ext: z.string().optional(),
      file_size: z.number().int().nonnegative().optional(),
      failure_stage: z.enum(["intent", "put", "confirm"]).nullable().optional(),
      object_key: z.string().optional(),
    })
    .optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  const parsed = trackEventSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("event_type and session_id are required", 400, {
      code: "invalid_track_payload",
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await trackEventFromRequest(request, {
      eventType: parsed.data.event_type,
      eventTime: parsed.data.event_time
        ? new Date(parsed.data.event_time)
        : undefined,
      pageName: parsed.data.page_name ?? null,
      stepName: parsed.data.step_name ?? null,
      actionName: parsed.data.action_name ?? null,
      eventStatus: parsed.data.event_status ?? null,
      sessionId: parsed.data.session_id,
      requestId: parsed.data.request_id,
      applicationId: parsed.data.application_id ?? null,
      token: parsed.data.token ?? null,
      durationMs: parsed.data.duration_ms ?? null,
      errorCode: parsed.data.error_code ?? null,
      errorMessage: parsed.data.error_message ?? null,
      referer: parsed.data.referer ?? null,
      landingPath: parsed.data.landing_path ?? null,
      utm: parsed.data.utm ?? null,
      upload: parsed.data.upload
        ? {
            uploadId: parsed.data.upload.upload_id,
            kind: parsed.data.upload.kind,
            category: parsed.data.upload.category ?? null,
            fileName: parsed.data.upload.file_name,
            fileExt: parsed.data.upload.file_ext ?? null,
            fileSize: parsed.data.upload.file_size ?? null,
            failureStage: parsed.data.upload.failure_stage ?? null,
            objectKey: parsed.data.upload.object_key ?? null,
          }
        : null,
      payload: parsed.data.payload ?? null,
    });

    return NextResponse.json({
      ok: true,
      accepted: result.accepted,
      event_id: result.eventId,
      bound_context: {
        invitation_id: result.boundContext.invitationId,
        application_id: result.boundContext.applicationId,
      },
    });
  } catch {
    return jsonError("tracking write failed", 500, {
      code: "track_write_failed",
    });
  }
}
