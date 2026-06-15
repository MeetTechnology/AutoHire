import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  ALL_SECONDARY_FIELD_DEFINITIONS,
  buildEditableSecondaryField,
} from "@/features/analysis/secondary-fields";
import {
  createSecondaryCallbackEvent,
  findAutoSecondaryRunByExternalIds,
  findAutoSecondaryRunByIdempotencyKey,
  getApplicationById,
  getLatestAutoSecondaryRun,
  getResumeFileById,
  listSecondaryAnalysisFieldValues,
  updateSecondaryCallbackEvent,
  upsertAutoSecondaryRun,
  upsertSecondaryAnalysisFieldValues,
} from "@/lib/data/store";
import { getEnv } from "@/lib/env";
import {
  createDirectSecondaryRun,
  downloadDirectSecondaryExport,
  getDirectSecondaryRun,
  isAutoSecondaryOnUploadEnabled,
  ResumeAnalysisError,
  type DirectSecondaryRunResponse,
} from "@/lib/resume-analysis/client";
import { writeStoredObject } from "@/lib/storage/object-store";

const TERMINAL_RUN_STATUSES = new Set([
  "completed",
  "completed_partial",
  "failed",
]);
const CALLBACK_TOLERANCE_SECONDS = 5 * 60;

const callbackPayloadSchema = z.object({
  event: z.string().min(1),
  event_id: z.string().min(1),
  application_id: z.string().min(1),
  expert_id: z.string().min(1),
  resume_file_id: z.string().min(1),
  job_id: z.union([z.string(), z.number()]).transform(String),
  run_id: z.union([z.string(), z.number()]).transform(String),
  status: z.string().min(1),
  fields: z.array(
    z.object({
      no: z.number().int().min(1).max(41),
      column: z.string().nullable(),
      label: z.string(),
      value: z.string(),
      missing: z.boolean(),
    }),
  ),
  raw_results: z.array(z.record(z.string(), z.unknown())),
  export: z
    .object({
      status: z.string(),
      file_name: z.string().nullable().optional(),
      download_url: z.string().nullable().optional(),
      content_type: z.string().nullable().optional(),
      file_size: z.number().int().nonnegative().nullable().optional(),
      sha256: z.string().nullable().optional(),
      error_message: z.string().nullable().optional(),
    })
    .passthrough()
    .optional(),
});

export type DirectSecondaryCallbackPayload = z.infer<
  typeof callbackPayloadSchema
>;

type StoredField = {
  no: number;
  sourceValue: string | null;
  editedValue: string | null;
  hasOverride: boolean;
  savedAt: Date;
};

function nextRetryAt() {
  return new Date(Date.now() + 60_000);
}

function exportObjectKey(input: {
  applicationId: string;
  runId: string;
  fileName: string;
}) {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `applications/${input.applicationId}/secondary-exports/${input.runId}/${safeName}`;
}

function assertCompleteFieldCatalog(
  fields: DirectSecondaryCallbackPayload["fields"],
) {
  const uniqueNos = new Set(fields.map((field) => field.no));
  if (fields.length !== 41 || uniqueNos.size !== 41) {
    throw new Error(
      "The direct secondary result must contain exactly 41 fields.",
    );
  }
}

async function persistSourceFields(input: {
  applicationId: string;
  secondaryRunId: string;
  fields: DirectSecondaryCallbackPayload["fields"];
}) {
  assertCompleteFieldCatalog(input.fields);
  const incoming = new Map(input.fields.map((field) => [field.no, field]));
  const existing = (await listSecondaryAnalysisFieldValues(
    input.secondaryRunId,
  )) as StoredField[];
  const existingByNo = new Map(existing.map((field) => [field.no, field]));

  await upsertSecondaryAnalysisFieldValues({
    applicationId: input.applicationId,
    secondaryRunId: input.secondaryRunId,
    fields: ALL_SECONDARY_FIELD_DEFINITIONS.map((definition) => {
      const source = incoming.get(definition.no);
      const stored = existingByNo.get(definition.no);
      const sourceValue = source?.value ?? "";
      const editedValue = stored?.editedValue ?? "";
      const hasOverride = stored?.hasOverride ?? false;
      const effectiveValue = hasOverride ? editedValue : sourceValue;

      return buildEditableSecondaryField(definition, {
        sourceValue,
        editedValue,
        effectiveValue,
        hasOverride,
        isMissing: effectiveValue.trim().length === 0,
        isEdited: hasOverride && editedValue.trim() !== sourceValue.trim(),
        savedAt: stored?.savedAt?.toISOString() ?? new Date().toISOString(),
      });
    }),
  });
}

async function persistExport(input: {
  applicationId: string;
  resumeFileId: string;
  idempotencyKey: string;
  jobId: string;
  runId: string;
  status: string;
  export: DirectSecondaryRunResponse["export"];
}) {
  const metadata = input.export;
  if (!metadata || metadata.status !== "completed") {
    return {
      exportStatus: metadata?.status ?? null,
      exportObjectKey: null,
      exportFileName: metadata?.file_name ?? null,
      exportContentType: metadata?.content_type ?? null,
      exportFileSize: metadata?.file_size ?? null,
      exportSha256: metadata?.sha256 ?? null,
      exportErrorMessage: metadata?.error_message ?? null,
    };
  }

  if (!metadata.file_name || !metadata.sha256) {
    throw new Error(
      "Completed direct secondary export is missing file metadata.",
    );
  }

  const bytes = await downloadDirectSecondaryExport({
    applicationId: input.applicationId,
    jobId: input.jobId,
    runId: input.runId,
  });
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256.toLowerCase() !== metadata.sha256.toLowerCase()) {
    throw new Error("Direct secondary export SHA256 verification failed.");
  }

  const objectKey = exportObjectKey({
    applicationId: input.applicationId,
    runId: input.runId,
    fileName: metadata.file_name,
  });
  await writeStoredObject(
    objectKey,
    bytes,
    metadata.content_type ?? "application/vnd.ms-excel",
  );

  return {
    exportStatus: metadata.status,
    exportObjectKey: objectKey,
    exportFileName: metadata.file_name,
    exportContentType: metadata.content_type ?? "application/vnd.ms-excel",
    exportFileSize: metadata.file_size ?? bytes.length,
    exportSha256: metadata.sha256,
    exportErrorMessage: null,
  };
}

async function persistRunPayload(input: {
  localRun: Awaited<ReturnType<typeof findAutoSecondaryRunByIdempotencyKey>>;
  payload: DirectSecondaryRunResponse;
}) {
  if (!input.localRun) {
    throw new Error("Auto secondary run was not found.");
  }

  const fields = input.payload.fields ?? [];
  if (fields.length > 0) {
    await persistSourceFields({
      applicationId: input.localRun.applicationId,
      secondaryRunId: input.localRun.id,
      fields,
    });
  }

  const exportPatch =
    input.localRun.exportObjectKey &&
    input.payload.export?.status === "completed"
      ? {}
      : await persistExport({
          applicationId: input.localRun.applicationId,
          resumeFileId: input.localRun.resumeFileId!,
          idempotencyKey: input.localRun.idempotencyKey!,
          jobId: String(input.payload.job_id),
          runId: String(input.payload.run_id),
          status: input.payload.status,
          export: input.payload.export,
        });

  return upsertAutoSecondaryRun({
    applicationId: input.localRun.applicationId,
    resumeFileId: input.localRun.resumeFileId!,
    idempotencyKey: input.localRun.idempotencyKey!,
    externalJobId: String(input.payload.job_id),
    externalRunId: String(input.payload.run_id),
    status: input.payload.status,
    errorMessage:
      input.payload.status === "failed" ? "Direct secondary run failed." : null,
    runSummary: {
      totalPrompts: input.payload.total_prompts ?? null,
      completedPrompts: input.payload.completed_prompts ?? null,
      errorPrompts: input.payload.error_prompts ?? null,
      failedPromptIds: (input.payload.failed_prompt_ids ?? []).map(String),
      retryable: input.payload.retryable ?? false,
    },
    rawResults: input.payload.raw_results ?? [],
    ...exportPatch,
    lastSyncAt: new Date(),
    nextRetryAt: TERMINAL_RUN_STATUSES.has(input.payload.status)
      ? null
      : nextRetryAt(),
  });
}

export async function startAutoSecondaryForResume(resumeFileId: string) {
  if (!isAutoSecondaryOnUploadEnabled()) {
    return null;
  }

  const resumeFile = await getResumeFileById(resumeFileId);
  if (!resumeFile) return null;
  const application = await getApplicationById(resumeFile.applicationId);
  if (!application) return null;

  const idempotencyKey = `resume-secondary:${application.id}:${resumeFile.id}:${resumeFile.versionNo}`;
  const existing = await findAutoSecondaryRunByIdempotencyKey(idempotencyKey);
  if (existing?.externalJobId && existing.externalRunId) {
    return existing;
  }

  await upsertAutoSecondaryRun({
    applicationId: application.id,
    resumeFileId: resumeFile.id,
    idempotencyKey,
    status: "pending",
    errorMessage: null,
    nextRetryAt: nextRetryAt(),
  });

  try {
    const created = await createDirectSecondaryRun({
      applicationId: application.id,
      expertId: application.expertId,
      resumeFileId: resumeFile.id,
      versionNo: resumeFile.versionNo,
      fileName: resumeFile.fileName,
      fileType: resumeFile.fileType,
      objectKey: resumeFile.objectKey,
    });
    return upsertAutoSecondaryRun({
      applicationId: application.id,
      resumeFileId: resumeFile.id,
      idempotencyKey,
      externalJobId: created.jobId,
      externalRunId: created.runId,
      status: created.status,
      errorMessage: null,
      lastSyncAt: new Date(),
      nextRetryAt: nextRetryAt(),
    });
  } catch (error) {
    const permanentFailure =
      error instanceof ResumeAnalysisError && error.httpStatus === 409;
    console.error("Direct secondary run creation failed.", {
      applicationId: application.id,
      resumeFileId: resumeFile.id,
      idempotencyKey,
      httpStatus:
        error instanceof ResumeAnalysisError ? error.httpStatus : null,
      retryable: error instanceof ResumeAnalysisError ? error.retryable : false,
      upstreamPayload:
        error instanceof ResumeAnalysisError ? error.upstreamPayload : null,
      message:
        error instanceof Error
          ? error.message
          : "Direct secondary creation failed.",
    });
    await upsertAutoSecondaryRun({
      applicationId: application.id,
      resumeFileId: resumeFile.id,
      idempotencyKey,
      status: permanentFailure ? "create_failed_permanent" : "create_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Direct secondary creation failed.",
      nextRetryAt: permanentFailure ? null : nextRetryAt(),
    });
    return null;
  }
}

export async function syncAutoSecondaryForApplication(applicationId: string) {
  if (!isAutoSecondaryOnUploadEnabled()) {
    return null;
  }

  let run = await getLatestAutoSecondaryRun(applicationId);
  if (!run) return null;
  if (run.status === "create_failed_permanent") return run;
  if (!run.externalJobId || !run.externalRunId) {
    return startAutoSecondaryForResume(run.resumeFileId!);
  }
  if (
    TERMINAL_RUN_STATUSES.has(run.status) &&
    (run.exportStatus !== "completed" || run.exportObjectKey)
  ) {
    return run;
  }

  const payload = await getDirectSecondaryRun({
    applicationId,
    jobId: run.externalJobId,
    runId: run.externalRunId,
  });
  run = await persistRunPayload({ localRun: run, payload });
  return run;
}

export function verifyDirectSecondaryCallback(input: {
  headers: Headers;
  rawBody: string;
  nowSeconds?: number;
}) {
  const secret = getEnv().RESUME_ANALYSIS_CALLBACK_SECRET?.trim();
  if (!secret)
    throw new Error("Resume analysis callback secret is not configured.");
  const eventId = input.headers.get("x-event-id")?.trim() ?? "";
  const timestamp = input.headers.get("x-timestamp")?.trim() ?? "";
  const signature = input.headers.get("x-signature")?.trim() ?? "";
  const parsedTimestamp = Number.parseInt(timestamp, 10);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !eventId ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now - parsedTimestamp) > CALLBACK_TOLERANCE_SECONDS
  ) {
    throw new Error("Resume analysis callback headers are invalid or expired.");
  }

  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex")}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error("Resume analysis callback signature is invalid.");
  }
  return eventId;
}

export function parseDirectSecondaryCallback(rawBody: string) {
  return callbackPayloadSchema.parse(JSON.parse(rawBody));
}

export async function acceptDirectSecondaryCallback(
  payload: DirectSecondaryCallbackPayload,
) {
  const application = await getApplicationById(payload.application_id);
  if (!application || application.expertId !== payload.expert_id) {
    throw new Error("Resume analysis callback external reference is invalid.");
  }
  const run = await findAutoSecondaryRunByExternalIds({
    applicationId: payload.application_id,
    externalJobId: payload.job_id,
    externalRunId: payload.run_id,
  });
  if (!run || run.resumeFileId !== payload.resume_file_id) {
    throw new Error("Resume analysis callback run was not found.");
  }

  const eventResult = await createSecondaryCallbackEvent({
    eventId: payload.event_id,
    secondaryRunId: run.id,
    eventType: payload.event,
  });
  if (!eventResult.created && eventResult.event.status === "PROCESSED") {
    return { accepted: true, duplicate: true };
  }

  try {
    await persistRunPayload({
      localRun: run,
      payload: {
        job_id: Number(payload.job_id),
        run_id: Number(payload.run_id),
        status: payload.status,
        fields: payload.fields,
        raw_results: payload.raw_results,
        export: payload.export,
      },
    });
    await updateSecondaryCallbackEvent(payload.event_id, {
      status: "PROCESSED",
      errorMessage: null,
      processedAt: new Date(),
    });
    return { accepted: true, duplicate: false };
  } catch (error) {
    await updateSecondaryCallbackEvent(payload.event_id, {
      status: "FAILED",
      errorMessage:
        error instanceof Error ? error.message : "Callback processing failed.",
    });
    throw error;
  }
}
