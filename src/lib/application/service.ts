import { parseSecondaryFieldSourceValues } from "@/features/analysis/secondary";
import {
  SECONDARY_FIELD_DEFINITIONS,
  buildEditableSecondaryField,
  getSecondaryFieldDefinition,
} from "@/features/analysis/secondary-fields";
import { translateVisibleFieldValue } from "@/features/analysis/display";
import type {
  EditableSecondaryField,
  MissingField,
} from "@/features/analysis/types";
import type {
  AnalysisJobStatus,
  ApplicationStatus,
  EditableSecondaryAnalysisSnapshot,
  EligibilityResult,
  MaterialCategory,
  SecondaryAnalysisSnapshot,
} from "@/features/application/types";
import { createSessionToken } from "@/lib/auth/session";
import { hashInviteToken } from "@/lib/auth/token";
import {
  buildApplicationSnapshot,
  createAnalysisJob,
  createAnalysisResult,
  createApplication,
  createEvent,
  createMaterial,
  createResumeFile,
  createSupplementalFieldSubmission,
  findInvitationById,
  findInvitationByTokenHash,
  findOpenApplicationByInvitationId,
  findSecondaryAnalysisRunByExternalRunId,
  getApplicationById,
  getLatestAnalysisJob,
  getLatestAnalysisResult,
  getLatestResumeFile,
  getLatestResumeVersion,
  getLatestSecondaryAnalysisRun,
  listMaterials,
  listSecondaryAnalysisFieldValues,
  softDeleteMaterial,
  updateAnalysisJob,
  updateApplication,
  upsertSecondaryAnalysisFieldValues,
  upsertSecondaryAnalysisRun,
} from "@/lib/data/store";
import {
  createResumeAnalysisJob,
  getResumeAnalysisErrorMessage,
  getResumeAnalysisResult,
  getResumeAnalysisStatus,
  getSecondaryAnalysisResult,
  isRetryableResumeAnalysisError,
  reanalyzeWithSupplementalFields,
  syncExpertJobUpstreamMapping,
  triggerSecondaryAnalysis,
} from "@/lib/resume-analysis/client";
import {
  buildSupplementalFieldPayload,
  enrichMissingFieldWithRegistry,
} from "@/lib/resume-analysis/missing-field-registry";

export class ApplicationServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApplicationServiceError";
    this.status = status;
    this.code = code;
  }
}

type StoredSecondaryFieldValue = {
  no: number;
  columnName: string | null;
  label: string;
  sourceValue: string | null;
  editedValue: string | null;
  effectiveValue: string | null;
  hasOverride: boolean;
  isMissing: boolean;
  isEdited: boolean;
  savedAt: Date;
};

export async function resolveInviteToken(token: string) {
  return findInvitationByTokenHash(hashInviteToken(token));
}

export async function createOrRestoreApplication(invitation: {
  id: string;
  expertId: string;
}) {
  const existing = await findOpenApplicationByInvitationId(invitation.id);

  if (existing) {
    return existing;
  }

  return createApplication({
    expertId: invitation.expertId,
    invitationId: invitation.id,
    applicationStatus: "INIT",
    currentStep: "intro",
  });
}

export async function createSessionForApplication(applicationId: string) {
  const snapshot = await buildApplicationSnapshot(applicationId);

  if (!snapshot) {
    return null;
  }

  return createSessionToken({
    applicationId: snapshot.applicationId,
    expertId: snapshot.expertId,
    invitationId: snapshot.invitationId,
  });
}

export async function getSnapshot(applicationId: string) {
  return buildApplicationSnapshot(applicationId);
}

export async function confirmIntro(applicationId: string) {
  const application = await getApplicationById(applicationId);

  if (!application) {
    return null;
  }

  const nextStatus =
    application.applicationStatus === "INIT"
      ? ("INTRO_VIEWED" as const)
      : application.applicationStatus;

  const updated = await updateApplication(applicationId, {
    applicationStatus: nextStatus,
    currentStep: "resume",
  });

  return updated;
}

export async function createResumeUploadRecord(input: {
  applicationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectKey: string;
  screeningPassportFullName: string;
  screeningContactEmail: string;
}) {
  const versionNo = (await getLatestResumeVersion(input.applicationId)) + 1;
  const record = await createResumeFile({
    applicationId: input.applicationId,
    fileName: input.fileName,
    fileType: input.fileType,
    fileSize: input.fileSize,
    objectKey: input.objectKey,
    versionNo,
  });

  await updateApplication(input.applicationId, {
    applicationStatus: "CV_UPLOADED",
    currentStep: "resume",
    screeningPassportFullName: input.screeningPassportFullName,
    screeningContactEmail: input.screeningContactEmail,
  });

  return record;
}

function mapEligibilityToApplicationStatus(
  eligibilityResult: EligibilityResult,
): ApplicationStatus {
  if (eligibilityResult === "ELIGIBLE") {
    return "ELIGIBLE";
  }

  if (eligibilityResult === "INELIGIBLE") {
    return "INELIGIBLE";
  }

  if (eligibilityResult === "INSUFFICIENT_INFO") {
    return "INFO_REQUIRED";
  }

  return "CV_ANALYZING";
}

function mapSecondaryStatusToApplicationStatus(
  status:
    | SecondaryAnalysisSnapshot["status"]
    | EditableSecondaryAnalysisSnapshot["status"],
): ApplicationStatus | null {
  if (["pending", "processing", "retrying"].includes(status)) {
    return "SECONDARY_ANALYZING";
  }

  if (status === "completed" || status === "completed_partial") {
    return "SECONDARY_REVIEW";
  }

  if (status === "failed") {
    return "SECONDARY_FAILED";
  }

  return null;
}

async function syncSecondaryApplicationState(input: {
  applicationId: string;
  status:
    | SecondaryAnalysisSnapshot["status"]
    | EditableSecondaryAnalysisSnapshot["status"];
  errorMessage: string | null;
}) {
  const nextStatus = mapSecondaryStatusToApplicationStatus(input.status);

  if (!nextStatus) {
    return null;
  }

  const application = await getApplicationById(input.applicationId);

  if (
    !application ||
    application.applicationStatus === "MATERIALS_IN_PROGRESS" ||
    application.applicationStatus === "SUBMITTED" ||
    application.applicationStatus === nextStatus
  ) {
    return application;
  }

  const updated = await updateApplication(input.applicationId, {
    applicationStatus: nextStatus,
    currentStep: "result",
  });

  const eventType =
    nextStatus === "SECONDARY_REVIEW"
      ? "SECONDARY_ANALYSIS_COMPLETED"
      : nextStatus === "SECONDARY_FAILED"
        ? "SECONDARY_ANALYSIS_FAILED"
        : "SECONDARY_ANALYSIS_SYNCED";

  await createEvent(input.applicationId, eventType, {
    status: input.status,
    errorMessage: input.errorMessage,
  });

  return updated;
}

async function requireApplicationStage(input: {
  applicationId: string;
  allowedStatuses: ApplicationStatus[];
  message: string;
  code: string;
}) {
  const application = await getApplicationById(input.applicationId);

  if (!application) {
    throw new ApplicationServiceError(
      "The application could not be found.",
      404,
      "APPLICATION_NOT_FOUND",
    );
  }

  if (!input.allowedStatuses.includes(application.applicationStatus)) {
    throw new ApplicationServiceError(input.message, 409, input.code);
  }

  return application;
}

function mapExternalJobStatus(jobStatus: string): AnalysisJobStatus {
  const normalized = jobStatus.trim().toLowerCase();

  if (normalized === "completed") {
    return "COMPLETED";
  }

  if (normalized === "failed") {
    return "FAILED";
  }

  if (normalized === "processing") {
    return "PROCESSING";
  }

  return "QUEUED";
}

export async function startInitialAnalysis(input: {
  applicationId: string;
  fileName: string;
  resumeFileId: string;
}) {
  const latestResumeFile = await getLatestResumeFile(input.applicationId);
  const analysis = await createResumeAnalysisJob({
    applicationId: input.applicationId,
    fileName: input.fileName,
    fileType: latestResumeFile?.fileType,
    objectKey: latestResumeFile?.objectKey,
  });

  const job = await createAnalysisJob({
    applicationId: input.applicationId,
    resumeFileId: input.resumeFileId,
    externalJobId: analysis.externalJobId,
    jobType: "INITIAL",
    jobStatus: mapExternalJobStatus(analysis.jobStatus),
    stageText: analysis.stageText ?? null,
    errorMessage: analysis.errorMessage ?? null,
    finishedAt:
      analysis.jobStatus === "completed" || analysis.jobStatus === "failed"
        ? new Date()
        : null,
  });

  await updateApplication(input.applicationId, {
    applicationStatus: "CV_ANALYZING",
    currentStep: "result",
    latestAnalysisJobId: job.id,
  });

  return job;
}

export async function refreshAnalysisState(applicationId: string) {
  const job = await getLatestAnalysisJob(applicationId);

  if (!job) {
    return null;
  }

  if (job.jobStatus === "FAILED") {
    return {
      jobStatus: "FAILED" as const,
      stageText: job.stageText ?? "Analysis failed",
      progressMessage: "The analysis failed. Please review the input and try again.",
      errorMessage: job.errorMessage ?? "The analysis failed. Please try again later.",
    };
  }

  const existingResult = await getLatestAnalysisResult(applicationId);

  if (job.jobStatus === "COMPLETED" && existingResult?.analysisJobId === job.id) {
    await syncExpertJobUpstreamMapping({
      applicationId,
      expertAnalysisJobId: job.id,
      externalJobId: job.externalJobId,
    });

    const snapshot = await buildApplicationSnapshot(applicationId);

    return {
      jobStatus: "COMPLETED" as const,
      stageText: job.stageText ?? "Analysis completed",
      progressMessage:
        snapshot?.latestResult?.displaySummary ?? "The analysis has completed.",
      errorMessage: null,
    };
  }

  let status;

  try {
    status = await getResumeAnalysisStatus({
      externalJobId: job.externalJobId ?? "",
    });
  } catch (error) {
    if (isRetryableResumeAnalysisError(error)) {
      const progressJobStatus =
        job.jobStatus === "COMPLETED" ? "PROCESSING" : job.jobStatus;

      if (job.jobStatus === "COMPLETED") {
        await updateAnalysisJob(job.id, {
          jobStatus: "PROCESSING",
          stageText: "Syncing analysis result",
          errorMessage: null,
          finishedAt: null,
        });
      }

      return {
        jobStatus: progressJobStatus,
        stageText:
          progressJobStatus === "QUEUED"
            ? job.stageText ?? "Queued for analysis"
            : job.stageText ?? "Retrying analysis status request",
        progressMessage:
          "The upstream service is temporarily unavailable. The system will keep retrying.",
        errorMessage: null,
      };
    }

    const errorMessage = getResumeAnalysisErrorMessage(error);

    await updateAnalysisJob(job.id, {
      jobStatus: "FAILED",
      stageText: "Analysis failed",
      errorMessage,
      finishedAt: new Date(),
    });

    return {
      jobStatus: "FAILED" as const,
      stageText: "Analysis failed",
      progressMessage: "The analysis failed. Please review the input and try again.",
      errorMessage,
    };
  }

  const mappedJobStatus = mapExternalJobStatus(status.jobStatus);

  await updateAnalysisJob(job.id, {
    jobStatus: mappedJobStatus,
    stageText: status.stageText ?? null,
    errorMessage: status.errorMessage ?? null,
    finishedAt:
      mappedJobStatus === "COMPLETED" || mappedJobStatus === "FAILED"
        ? new Date()
        : null,
  });

  if (mappedJobStatus !== "COMPLETED") {
    return {
      jobStatus: mappedJobStatus,
      stageText: status.stageText ?? "Processing",
      progressMessage:
        mappedJobStatus === "FAILED"
          ? "The analysis failed. Please review the input and try again."
          : (status.progressMessage ??
            "The system is processing your request. Please wait."),
      errorMessage: status.errorMessage ?? null,
    };
  }

  if (!existingResult || existingResult.analysisJobId !== job.id) {
    try {
      const result = await getResumeAnalysisResult({
        externalJobId: job.externalJobId ?? "",
      });
      const extractedFields = result.extractedFields ?? {};

      if (result.rawReasoning) {
        extractedFields.__rawReasoning = result.rawReasoning;
      }

      await createAnalysisResult({
        applicationId,
        analysisJobId: job.id,
        analysisRound: job.jobType === "REANALYSIS" ? 2 : 1,
        eligibilityResult: result.eligibilityResult,
        reasonText: result.reasonText ?? null,
        displaySummary: result.displaySummary ?? null,
        extractedFields,
        missingFields: result.missingFields ?? [],
      });

      const nextStatus = mapEligibilityToApplicationStatus(
        result.eligibilityResult,
      );

      await updateApplication(applicationId, {
        applicationStatus: nextStatus,
        currentStep: "result",
        eligibilityResult: result.eligibilityResult,
      });

      await syncExpertJobUpstreamMapping({
        applicationId,
        expertAnalysisJobId: job.id,
        externalJobId: job.externalJobId,
      });
    } catch (error) {
      if (isRetryableResumeAnalysisError(error)) {
        await updateAnalysisJob(job.id, {
          jobStatus: "PROCESSING",
          stageText: "Syncing analysis result",
          errorMessage: null,
          finishedAt: null,
        });

        return {
          jobStatus: "PROCESSING" as const,
          stageText: "Syncing analysis result",
          progressMessage:
            "The upstream analysis has completed. The system is syncing the result.",
          errorMessage: null,
        };
      }

      const errorMessage = getResumeAnalysisErrorMessage(error);

      await updateAnalysisJob(job.id, {
        jobStatus: "FAILED",
        stageText: "Analysis failed",
        errorMessage,
        finishedAt: new Date(),
      });

      return {
        jobStatus: "FAILED" as const,
        stageText: "Analysis failed",
        progressMessage: "The analysis failed. Please review the input and try again.",
        errorMessage,
      };
    }
  }

  const snapshot = await buildApplicationSnapshot(applicationId);

  return {
    jobStatus: "COMPLETED" as const,
    stageText: "Analysis completed",
    progressMessage:
      snapshot?.latestResult?.displaySummary ?? "The analysis has completed.",
  };
}

export async function submitSupplementalFields(input: {
  applicationId: string;
  fields: Record<string, unknown>;
}) {
  const latestJob = await getLatestAnalysisJob(input.applicationId);
  const latestResumeFile = await getLatestResumeFile(input.applicationId);
  const latestResult = await getLatestAnalysisResult(input.applicationId);
  const currentMissingFields =
    ((latestResult?.missingFields as MissingField[] | null) ?? []).map((field) =>
      enrichMissingFieldWithRegistry({
        ...field,
        sourceItemName: field.sourceItemName || field.label || field.fieldKey,
      }),
    );
  const normalizedPayload = buildSupplementalFieldPayload(
    input.fields,
    currentMissingFields,
  );

  await createSupplementalFieldSubmission({
    applicationId: input.applicationId,
    analysisJobId: latestJob?.id ?? null,
    fieldValues: {
      ...normalizedPayload,
      missingFieldsSnapshot: currentMissingFields,
    },
  });

  if (latestJob?.id && latestJob.externalJobId) {
    await syncExpertJobUpstreamMapping({
      applicationId: input.applicationId,
      expertAnalysisJobId: latestJob.id,
      externalJobId: latestJob.externalJobId,
    });
  }

  const analysis = await reanalyzeWithSupplementalFields({
    applicationId: input.applicationId,
    fields: normalizedPayload.valuesByFieldKey,
    valuesBySourceItemName: normalizedPayload.valuesBySourceItemName,
    latestAnalysisJobId: latestJob?.id ?? null,
  });

  const job = await createAnalysisJob({
    applicationId: input.applicationId,
    resumeFileId: latestResumeFile?.id ?? null,
    externalJobId: analysis.externalJobId,
    jobType: "REANALYSIS",
    jobStatus: mapExternalJobStatus(analysis.jobStatus),
    stageText: analysis.stageText ?? null,
    errorMessage: analysis.errorMessage ?? null,
    finishedAt:
      analysis.jobStatus === "completed" || analysis.jobStatus === "failed"
        ? new Date()
        : null,
  });

  await updateApplication(input.applicationId, {
    applicationStatus: "REANALYZING",
    currentStep: "result",
    latestAnalysisJobId: job.id,
  });

  return job;
}

export async function startSecondaryAnalysis(applicationId: string) {
  const existingRun = await getLatestSecondaryAnalysisRun(applicationId);

  if (existingRun && !isPlaceholderSecondaryRun(existingRun)) {
    throw new ApplicationServiceError(
      "Secondary analysis can only be started once for this application.",
      409,
      "SECONDARY_ANALYSIS_ALREADY_STARTED",
    );
  }

  const application = await requireApplicationStage({
    applicationId,
    allowedStatuses: ["ELIGIBLE"],
    message:
      "Detailed analysis can only be started after the initial eligibility review has passed.",
    code: "SECONDARY_ANALYSIS_NOT_READY",
  });
  const latestJob = await getLatestAnalysisJob(applicationId);

  if (!latestJob?.externalJobId) {
    throw new ApplicationServiceError(
      "No completed analysis job is available for secondary analysis.",
      409,
      "SECONDARY_ANALYSIS_NOT_AVAILABLE",
    );
  }

  const secondary = await triggerSecondaryAnalysis({
    externalJobId: latestJob.externalJobId,
  });

  if (secondary.runId) {
    await upsertSecondaryAnalysisRun({
      applicationId,
      analysisJobId: latestJob.id,
      externalRunId: secondary.runId,
      status: secondary.status,
      errorMessage: null,
      runSummary: {
        id: secondary.runId,
        status: secondary.status,
        totalPrompts: null,
        completedPrompts: null,
        failedPromptIds: [],
        errorMessage: null,
      },
      rawResults: null,
    });
  }

  await updateApplication(applicationId, {
    applicationStatus: "SECONDARY_ANALYZING",
    currentStep: "result",
    eligibilityResult: application.eligibilityResult,
  });

  return secondary;
}

function buildSecondaryRunSummary(
  run: SecondaryAnalysisSnapshot["run"] | EditableSecondaryAnalysisSnapshot["run"],
) {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    totalPrompts: run.totalPrompts,
    completedPrompts: run.completedPrompts,
    failedPromptIds: run.failedPromptIds,
    errorMessage: run.errorMessage,
  } satisfies Record<string, unknown>;
}

function buildEditableFieldsFromSource(input: {
  sourceValuesByNo: Map<number, string>;
  storedFields: StoredSecondaryFieldValue[];
}) {
  const storedByNo = new Map(input.storedFields.map((field) => [field.no, field]));

  return SECONDARY_FIELD_DEFINITIONS.map((definition) => {
    const stored = storedByNo.get(definition.no);
    const rawSourceValue = input.sourceValuesByNo.get(definition.no) ?? "";
    const sourceValue = translateVisibleFieldValue(definition.no, rawSourceValue);
    const hasOverride = stored?.hasOverride ?? false;
    const editedValue = stored?.editedValue ?? "";
    const effectiveValue = hasOverride ? editedValue : sourceValue;

    return buildEditableSecondaryField(definition, {
      sourceValue,
      editedValue,
      effectiveValue,
      hasOverride,
      isMissing: effectiveValue.trim().length === 0,
      isEdited: hasOverride && editedValue.trim() !== sourceValue.trim(),
      savedAt: stored?.savedAt ? stored.savedAt.toISOString() : null,
    });
  });
}

function isPlaceholderSecondaryRun(
  run:
    | {
        externalRunId: string;
        status: string;
        runSummary: unknown;
        rawResults: unknown;
      }
    | null
    | undefined,
) {
  if (!run) {
    return false;
  }

  const runSummary =
    run.runSummary && typeof run.runSummary === "object" && !Array.isArray(run.runSummary)
      ? (run.runSummary as Record<string, unknown>)
      : null;
  const rawResults = Array.isArray(run.rawResults) ? run.rawResults : null;
  const summaryId =
    runSummary && typeof runSummary.id === "string" ? runSummary.id.trim() : "";

  return (
    run.status === "idle" &&
    run.externalRunId === "latest" &&
    summaryId.length === 0 &&
    (rawResults?.length ?? 0) === 0
  );
}

async function persistSecondaryAnalysisSnapshot(input: {
  applicationId: string;
  analysisJobId: string | null;
  runId: string;
  status: SecondaryAnalysisSnapshot["status"];
  errorMessage: string | null;
  run: SecondaryAnalysisSnapshot["run"];
  results: Array<{
    id: string;
    promptId: string | null;
    generatedText: string;
    status: string;
    errorMessage: string | null;
  }>;
}) {
  const runRecord = await upsertSecondaryAnalysisRun({
    applicationId: input.applicationId,
    analysisJobId: input.analysisJobId,
    externalRunId: input.runId,
    status: input.status,
    errorMessage: input.errorMessage,
    runSummary: buildSecondaryRunSummary(input.run),
    rawResults: input.results.map((result) => ({
      id: result.id,
      promptId: result.promptId,
      generatedText: result.generatedText,
      status: result.status,
      errorMessage: result.errorMessage,
    })),
  });

  const existingFields = (await listSecondaryAnalysisFieldValues(
    runRecord.id,
  )) as StoredSecondaryFieldValue[];
  const completedTexts = input.results
    .filter((result) => result.status === "completed" && result.generatedText)
    .map((result) => result.generatedText);

  if (completedTexts.length === 0) {
    const editableFields =
      existingFields.length === 0
        ? []
        : SECONDARY_FIELD_DEFINITIONS.map((definition) => {
            const stored = existingFields.find((field) => field.no === definition.no);

            return buildEditableSecondaryField(definition, {
              sourceValue: stored?.sourceValue ?? "",
              editedValue: stored?.editedValue ?? "",
              effectiveValue: stored?.effectiveValue ?? "",
              hasOverride: stored?.hasOverride ?? false,
              isMissing: stored?.isMissing ?? true,
              isEdited: stored?.isEdited ?? false,
              savedAt: stored?.savedAt?.toISOString() ?? null,
            });
          });

    return {
      runRecord,
      editableFields,
    };
  }

  const sourceValuesByNo = parseSecondaryFieldSourceValues(completedTexts);
  const editableFields = buildEditableFieldsFromSource({
    sourceValuesByNo,
    storedFields: existingFields,
  });

  const storedFields = (await upsertSecondaryAnalysisFieldValues({
    applicationId: input.applicationId,
    secondaryRunId: runRecord.id,
    fields: editableFields,
  })) as StoredSecondaryFieldValue[];

  return {
    runRecord,
    editableFields: editableFields.map((field) => {
      const savedField = storedFields.find((item) => item.no === field.no);

      return {
        ...field,
        savedAt: savedField?.savedAt?.toISOString() ?? field.savedAt,
      };
    }),
  };
}

function buildEditableSecondarySnapshot(input: {
  runId: string | null;
  status: EditableSecondaryAnalysisSnapshot["status"];
  errorMessage: string | null;
  fields: EditableSecondaryField[];
  run: EditableSecondaryAnalysisSnapshot["run"];
}) {
  const missingCount = input.fields.filter((field) => field.isMissing).length;
  const savedAt =
    input.fields
      .map((field) => field.savedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  return {
    runId: input.runId,
    status: input.status,
    errorMessage: input.errorMessage,
    fields: input.fields,
    run: input.run,
    missingCount,
    savedAt,
  } satisfies EditableSecondaryAnalysisSnapshot;
}

export async function getSecondaryAnalysisSnapshot(input: {
  applicationId: string;
  runId?: string | null;
}): Promise<SecondaryAnalysisSnapshot> {
  const latestJob = await getLatestAnalysisJob(input.applicationId);

  if (!latestJob?.externalJobId) {
    return {
      runId: null,
      status: "idle",
      errorMessage: null,
      fields: [],
      run: null,
    };
  }

  const targetRunRecord = input.runId
    ? await findSecondaryAnalysisRunByExternalRunId({
        applicationId: input.applicationId,
        externalRunId: input.runId,
      })
    : await getLatestSecondaryAnalysisRun(input.applicationId);
  const targetRun = isPlaceholderSecondaryRun(targetRunRecord)
    ? null
    : targetRunRecord;

  if (targetRun && !["pending", "processing", "retrying"].includes(targetRun.status)) {
    await syncSecondaryApplicationState({
      applicationId: input.applicationId,
      status: targetRun.status as SecondaryAnalysisSnapshot["status"],
      errorMessage: targetRun.errorMessage,
    });

    const storedFields = (await listSecondaryAnalysisFieldValues(
      targetRun.id,
    )) as StoredSecondaryFieldValue[];
    if (storedFields.length > 0) {
      return {
        runId: targetRun.externalRunId,
        status: targetRun.status as SecondaryAnalysisSnapshot["status"],
        errorMessage: targetRun.errorMessage,
        fields: storedFields
          .filter((field) => (field.effectiveValue ?? "").trim().length > 0)
          .map((field) => ({
            no: field.no,
            column: field.columnName,
            label: field.label,
            value: field.effectiveValue ?? "",
          })),
        run: (targetRun.runSummary as SecondaryAnalysisSnapshot["run"] | null) ?? null,
      };
    }
  }

  if (!input.runId && !targetRun) {
    return {
      runId: null,
      status: "idle",
      errorMessage: null,
      fields: [],
      run: null,
    };
  }

  const secondary = await getSecondaryAnalysisResult({
    externalJobId: latestJob.externalJobId,
    runId: input.runId ?? targetRun?.externalRunId ?? null,
  });
  const persisted = await persistSecondaryAnalysisSnapshot({
    applicationId: input.applicationId,
    analysisJobId: latestJob.id,
    runId: secondary.runId ?? input.runId ?? targetRun?.externalRunId ?? "latest",
    status: secondary.status,
    errorMessage: secondary.errorMessage,
    run: secondary.run,
    results: secondary.results,
  });

  await syncSecondaryApplicationState({
    applicationId: input.applicationId,
    status: secondary.status,
    errorMessage: secondary.errorMessage,
  });

  return {
    runId: secondary.runId,
    status: secondary.status,
    errorMessage: secondary.errorMessage,
    fields: persisted.editableFields
      .filter((field) => field.effectiveValue.trim().length > 0)
      .map((field) => ({
        no: field.no,
        column: field.column,
        label: field.label,
        value: field.effectiveValue,
      })),
    run: secondary.run,
  };
}

export async function getEditableSecondaryAnalysisSnapshot(input: {
  applicationId: string;
  runId?: string | null;
}): Promise<EditableSecondaryAnalysisSnapshot> {
  const latestJob = await getLatestAnalysisJob(input.applicationId);

  if (!latestJob?.externalJobId) {
    return buildEditableSecondarySnapshot({
      runId: null,
      status: "idle",
      errorMessage: null,
      fields: [],
      run: null,
    });
  }

  const targetRunRecord = input.runId
    ? await findSecondaryAnalysisRunByExternalRunId({
        applicationId: input.applicationId,
        externalRunId: input.runId,
      })
    : await getLatestSecondaryAnalysisRun(input.applicationId);
  const targetRun = isPlaceholderSecondaryRun(targetRunRecord)
    ? null
    : targetRunRecord;

  if (targetRun && !["pending", "processing", "retrying"].includes(targetRun.status)) {
    await syncSecondaryApplicationState({
      applicationId: input.applicationId,
      status: targetRun.status as EditableSecondaryAnalysisSnapshot["status"],
      errorMessage: targetRun.errorMessage,
    });

    const storedFields = (await listSecondaryAnalysisFieldValues(
      targetRun.id,
    )) as StoredSecondaryFieldValue[];
    if (storedFields.length > 0) {
      const editableFields = SECONDARY_FIELD_DEFINITIONS.map((definition) => {
        const stored = storedFields.find((field) => field.no === definition.no);

        return buildEditableSecondaryField(definition, {
          sourceValue: stored?.sourceValue ?? "",
          editedValue: stored?.editedValue ?? "",
          effectiveValue: stored?.effectiveValue ?? "",
          hasOverride: stored?.hasOverride ?? false,
          isMissing: stored?.isMissing ?? true,
          isEdited: stored?.isEdited ?? false,
          savedAt: stored?.savedAt?.toISOString() ?? null,
        });
      });

      return buildEditableSecondarySnapshot({
        runId: targetRun.externalRunId,
        status: targetRun.status as EditableSecondaryAnalysisSnapshot["status"],
        errorMessage: targetRun.errorMessage,
        fields: editableFields,
        run: (targetRun.runSummary as EditableSecondaryAnalysisSnapshot["run"] | null) ?? null,
      });
    }
  }

  if (!input.runId && !targetRun) {
    return buildEditableSecondarySnapshot({
      runId: null,
      status: "idle",
      errorMessage: null,
      fields: [],
      run: null,
    });
  }

  const secondary = await getSecondaryAnalysisResult({
    externalJobId: latestJob.externalJobId,
    runId: input.runId ?? targetRun?.externalRunId ?? null,
  });
  const persisted = await persistSecondaryAnalysisSnapshot({
    applicationId: input.applicationId,
    analysisJobId: latestJob.id,
    runId: secondary.runId ?? input.runId ?? targetRun?.externalRunId ?? "latest",
    status: secondary.status,
    errorMessage: secondary.errorMessage,
    run: secondary.run,
    results: secondary.results,
  });

  await syncSecondaryApplicationState({
    applicationId: input.applicationId,
    status: secondary.status,
    errorMessage: secondary.errorMessage,
  });

  return buildEditableSecondarySnapshot({
    runId: secondary.runId,
    status: secondary.status,
    errorMessage: secondary.errorMessage,
    fields: persisted.editableFields,
    run: secondary.run,
  });
}

export async function saveEditableSecondaryAnalysisFields(input: {
  applicationId: string;
  runId: string;
  fields: Record<string, unknown>;
}) {
  const runRecord = await findSecondaryAnalysisRunByExternalRunId({
    applicationId: input.applicationId,
    externalRunId: input.runId,
  });

  if (!runRecord) {
    throw new ApplicationServiceError(
      "The secondary analysis run could not be found.",
      404,
      "SECONDARY_ANALYSIS_RUN_NOT_FOUND",
    );
  }

  const existingFields = (await listSecondaryAnalysisFieldValues(
    runRecord.id,
  )) as StoredSecondaryFieldValue[];
  const existingByNo = new Map(existingFields.map((field) => [field.no, field]));
  const editableByNo = new Map<number, { value: string; hasOverride: boolean }>();

  for (const [key, rawValue] of Object.entries(input.fields)) {
    const numericNo = Number.parseInt(key, 10);
    const byNo = Number.isFinite(numericNo) ? getSecondaryFieldDefinition(numericNo) : null;
    const byFieldKey = SECONDARY_FIELD_DEFINITIONS.find(
      (definition) => definition.fieldKey === key,
    );
    const definition = byNo ?? byFieldKey;

    if (!definition) {
      throw new ApplicationServiceError(
        `Unsupported secondary field: ${key}`,
        400,
        "SECONDARY_ANALYSIS_FIELD_UNSUPPORTED",
      );
    }

    if (
      rawValue &&
      typeof rawValue === "object" &&
      !Array.isArray(rawValue) &&
      ("value" in rawValue || "hasOverride" in rawValue)
    ) {
      const typedValue = rawValue as {
        value?: unknown;
        hasOverride?: unknown;
      };
      const value =
        typeof typedValue.value === "string"
          ? typedValue.value.trim()
          : String(typedValue.value ?? "").trim();
      const hasOverride = Boolean(typedValue.hasOverride);

      editableByNo.set(definition.no, {
        value,
        hasOverride,
      });
      continue;
    }

    editableByNo.set(definition.no, {
      value: typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim(),
      hasOverride: true,
    });
  }

  const savedAt = new Date().toISOString();
  const nextFields = SECONDARY_FIELD_DEFINITIONS.map((definition) => {
    const existing = existingByNo.get(definition.no);
    const sourceValue = existing?.sourceValue ?? "";
    const nextOverride = editableByNo.get(definition.no);
    const editedValue = nextOverride
      ? nextOverride.value
      : existing?.editedValue ?? "";
    const hasOverride = nextOverride
      ? nextOverride.hasOverride
      : existing?.hasOverride ?? false;
    const effectiveValue = hasOverride ? editedValue : sourceValue;

    return buildEditableSecondaryField(definition, {
      sourceValue,
      editedValue,
      effectiveValue,
      hasOverride,
      isMissing: effectiveValue.trim().length === 0,
      isEdited: hasOverride && editedValue.trim() !== sourceValue.trim(),
      savedAt,
    });
  });

  await upsertSecondaryAnalysisFieldValues({
    applicationId: input.applicationId,
    secondaryRunId: runRecord.id,
    fields: nextFields,
  });

  await createEvent(input.applicationId, "SECONDARY_ANALYSIS_FIELDS_SAVED", {
    runId: input.runId,
    editedFieldNos: [...editableByNo.keys()],
  });

  return buildEditableSecondarySnapshot({
    runId: input.runId,
    status: runRecord.status as EditableSecondaryAnalysisSnapshot["status"],
    errorMessage: runRecord.errorMessage,
    fields: nextFields,
    run: (runRecord.runSummary as EditableSecondaryAnalysisSnapshot["run"] | null) ?? null,
  });
}

export async function addMaterialRecord(input: {
  applicationId: string;
  category: MaterialCategory;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectKey: string;
}) {
  await requireApplicationStage({
    applicationId: input.applicationId,
    allowedStatuses: ["MATERIALS_IN_PROGRESS"],
    message:
      "Supporting materials can only be uploaded after the detailed analysis is complete.",
    code: "MATERIALS_STAGE_NOT_READY",
  });

  const material = await createMaterial(input);

  return material;
}

export async function removeMaterialRecord(
  applicationId: string,
  fileId: string,
) {
  await requireApplicationStage({
    applicationId,
    allowedStatuses: ["MATERIALS_IN_PROGRESS"],
    message:
      "Supporting materials can only be edited while the materials stage is active.",
    code: "MATERIALS_STAGE_NOT_EDITABLE",
  });

  const material = await softDeleteMaterial(fileId, applicationId);

  if (material) {
    await createEvent(applicationId, "MATERIAL_DELETED", { fileId });
  }

  return material;
}

export async function saveProductInnovationDescription(input: {
  applicationId: string;
  description: string;
}) {
  await requireApplicationStage({
    applicationId: input.applicationId,
    allowedStatuses: ["MATERIALS_IN_PROGRESS"],
    message:
      "Product description can only be edited while the materials stage is active.",
    code: "MATERIALS_STAGE_NOT_EDITABLE",
  });

  await updateApplication(input.applicationId, {
    productInnovationDescription: input.description,
  });
}

export async function getMaterialsByCategory(applicationId: string) {
  await requireApplicationStage({
    applicationId,
    allowedStatuses: ["MATERIALS_IN_PROGRESS", "SUBMITTED"],
    message:
      "Supporting materials are only available after the detailed analysis review is complete.",
    code: "MATERIALS_STAGE_NOT_READY",
  });

  const materials = await listMaterials(applicationId);
  const safeMaterials = materials.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    fileType: item.fileType,
    fileSize: item.fileSize,
    uploadedAt: item.uploadedAt.toISOString(),
    category: item.category,
  }));

  return {
    identity: safeMaterials.filter((item) => item.category === "IDENTITY"),
    employment: safeMaterials.filter((item) => item.category === "EMPLOYMENT"),
    education: safeMaterials.filter((item) => item.category === "EDUCATION"),
    honor: safeMaterials.filter((item) => item.category === "HONOR"),
    patent: safeMaterials.filter((item) => item.category === "PATENT"),
    project: safeMaterials.filter((item) => item.category === "PROJECT"),
    paper: safeMaterials.filter((item) => item.category === "PAPER"),
    book: safeMaterials.filter((item) => item.category === "BOOK"),
    conference: safeMaterials.filter((item) => item.category === "CONFERENCE"),
    product: safeMaterials.filter((item) => item.category === "PRODUCT"),
  };
}

export async function submitApplication(applicationId: string) {
  const application = await getApplicationById(applicationId);

  if (!application) {
    return null;
  }

  if (application.applicationStatus === "SUBMITTED") {
    return application;
  }

  await requireApplicationStage({
    applicationId,
    allowedStatuses: ["MATERIALS_IN_PROGRESS"],
    message:
      "The application can only be submitted after entering the materials stage.",
    code: "SUBMISSION_STAGE_NOT_READY",
  });

  const materials = await listMaterials(applicationId);
  const hasIdentity = materials.some((item) => item.category === "IDENTITY");
  const hasDoctoralEducation = materials.some(
    (item) => item.category === "EDUCATION",
  );
  const hasLatestEmployment = materials.some(
    (item) => item.category === "EMPLOYMENT",
  );

  if (!hasIdentity || !hasDoctoralEducation || !hasLatestEmployment) {
    throw new ApplicationServiceError(
      "Final submission requires at least one file in Identity Documents, Education Documents (doctoral), and Employment Documents.",
      409,
      "MATERIALS_MINIMUM_REQUIREMENTS_NOT_MET",
    );
  }

  const updated = await updateApplication(applicationId, {
    applicationStatus: "SUBMITTED",
    currentStep: "materials",
    submittedAt: new Date(),
  });

  return updated;
}

export async function enterMaterialsStage(applicationId: string) {
  await requireApplicationStage({
    applicationId,
    allowedStatuses: ["SECONDARY_REVIEW"],
    message:
      "You can continue to supporting materials only after the detailed analysis is complete.",
    code: "MATERIALS_ENTRY_NOT_READY",
  });

  const updated = await updateApplication(applicationId, {
    applicationStatus: "MATERIALS_IN_PROGRESS",
    currentStep: "materials",
  });

  await createEvent(applicationId, "MATERIALS_STAGE_ENTERED", null);

  return updated;
}

export async function validateSessionAccess(input: {
  applicationId: string;
  invitationId: string;
}) {
  const invitation = await findInvitationById(input.invitationId);
  const application = await getApplicationById(input.applicationId);

  if (!invitation || !application) {
    return null;
  }

  if (
    application.invitationId !== invitation.id ||
    application.id !== input.applicationId
  ) {
    return null;
  }

  return application;
}
