import { parseSecondaryFieldSourceValues, parseSecondaryVisibleFields } from "@/features/analysis/secondary";
import {
  SECONDARY_FIELD_DEFINITIONS,
  buildEditableSecondaryField,
  getSecondaryFieldDefinition,
} from "@/features/analysis/secondary-fields";
import type {
  AnalysisJobStatus,
  ApplicationStatus,
  EditableSecondaryAnalysisSnapshot,
  EligibilityResult,
  MaterialCategory,
  SecondaryAnalysisSnapshot,
} from "@/features/application/types";
import type { EditableSecondaryField, MissingField } from "@/features/analysis/types";
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
  findSecondaryAnalysisRunByExternalRunId,
  findOpenApplicationByInvitationId,
  getApplicationById,
  getLatestAnalysisJob,
  getLatestAnalysisResult,
  getLatestSecondaryAnalysisRun,
  getLatestResumeFile,
  getLatestResumeVersion,
  listMaterials,
  listSecondaryAnalysisFieldValues,
  softDeleteMaterial,
  upsertSecondaryAnalysisFieldValues,
  upsertSecondaryAnalysisRun,
  updateAnalysisJob,
  updateApplication,
} from "@/lib/data/store";
import {
  createResumeAnalysisJob,
  getResumeAnalysisErrorMessage,
  getSecondaryAnalysisResult,
  getResumeAnalysisResult,
  getResumeAnalysisStatus,
  isRetryableResumeAnalysisError,
  reanalyzeWithSupplementalFields,
  syncExpertJobUpstreamMapping,
  triggerSecondaryAnalysis,
} from "@/lib/resume-analysis/client";
import {
  buildSupplementalFieldPayload,
  enrichMissingFieldWithRegistry,
} from "@/lib/resume-analysis/missing-field-registry";
import { translateVisibleFieldValue } from "@/features/analysis/display";

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

  await createEvent(applicationId, "INTRO_CONFIRMED", { nextStatus });

  return updated;
}

export async function createResumeUploadRecord(input: {
  applicationId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectKey: string;
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

  await createEvent(input.applicationId, "RESUME_CONFIRMED", {
    fileName: input.fileName,
    objectKey: input.objectKey,
    versionNo,
  });

  await updateApplication(input.applicationId, {
    applicationStatus: "CV_UPLOADED",
    currentStep: "resume",
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

  await createEvent(input.applicationId, "ANALYSIS_STARTED", {
    analysisJobId: job.id,
    externalJobId: analysis.externalJobId,
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
      progressMessage: snapshot?.latestResult?.displaySummary ?? "The analysis has completed.",
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
        progressMessage: "The upstream service is temporarily unavailable. The system will keep retrying.",
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

    await createEvent(applicationId, "ANALYSIS_FAILED", {
      analysisJobId: job.id,
      errorMessage,
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
          : (status.progressMessage ?? "The system is processing your request. Please wait."),
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
        currentStep: nextStatus === "ELIGIBLE" ? "materials" : "result",
        eligibilityResult: result.eligibilityResult,
      });

      await createEvent(applicationId, "ANALYSIS_COMPLETED", {
        analysisJobId: job.id,
        eligibilityResult: result.eligibilityResult,
        rawReasoning: result.rawReasoning ?? null,
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

      await createEvent(applicationId, "ANALYSIS_FAILED", {
        analysisJobId: job.id,
        errorMessage,
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
    progressMessage: snapshot?.latestResult?.displaySummary ?? "The analysis has completed.",
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
    ((latestResult?.missingFields as MissingField[] | null) ?? []).map(
      (field) =>
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

  await createEvent(input.applicationId, "SUPPLEMENTAL_FIELDS_SUBMITTED", {
    analysisJobId: job.id,
  });

  return job;
}

export async function startSecondaryAnalysis(applicationId: string) {
  const latestJob = await getLatestAnalysisJob(applicationId);

  if (!latestJob?.externalJobId) {
    throw new Error("No completed analysis job is available for secondary analysis.");
  }

  const secondary = await triggerSecondaryAnalysis({
    externalJobId: latestJob.externalJobId,
  });

  await createEvent(applicationId, "SECONDARY_ANALYSIS_TRIGGERED", {
    analysisJobId: latestJob.id,
    externalJobId: latestJob.externalJobId,
    runId: secondary.runId,
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
  storedFields: Array<{
    no: number;
    sourceValue: string | null;
    editedValue: string | null;
    effectiveValue: string | null;
    isMissing: boolean;
    isEdited: boolean;
    savedAt: Date;
  }>;
}) {
  const storedByNo = new Map(input.storedFields.map((field) => [field.no, field]));

  return SECONDARY_FIELD_DEFINITIONS.map((definition) => {
    const stored = storedByNo.get(definition.no);
    const rawSourceValue = input.sourceValuesByNo.get(definition.no) ?? "";
    const sourceValue = translateVisibleFieldValue(definition.no, rawSourceValue);
    const editedValue = stored?.editedValue ?? "";
    const effectiveValue = editedValue.trim().length > 0 ? editedValue : sourceValue;

    return buildEditableSecondaryField(definition, {
      sourceValue,
      editedValue,
      effectiveValue,
      isMissing: effectiveValue.trim().length === 0,
      isEdited:
        editedValue.trim().length > 0 && editedValue.trim() !== sourceValue.trim(),
      savedAt: stored?.savedAt ? stored.savedAt.toISOString() : null,
    });
  });
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

  const existingFields = await listSecondaryAnalysisFieldValues(runRecord.id);
  const sourceValuesByNo = parseSecondaryFieldSourceValues(
    input.results
      .filter((result) => result.status === "completed" && result.generatedText)
      .map((result) => result.generatedText),
  );
  const editableFields = buildEditableFieldsFromSource({
    sourceValuesByNo,
    storedFields: existingFields,
  });

  const storedFields = await upsertSecondaryAnalysisFieldValues({
    applicationId: input.applicationId,
    secondaryRunId: runRecord.id,
    fields: editableFields,
  });

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

  const targetRun = input.runId
    ? await findSecondaryAnalysisRunByExternalRunId({
        applicationId: input.applicationId,
        externalRunId: input.runId,
      })
    : await getLatestSecondaryAnalysisRun(input.applicationId);

  if (targetRun && !["pending", "processing", "retrying"].includes(targetRun.status)) {
    const storedFields = await listSecondaryAnalysisFieldValues(targetRun.id);

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

  const targetRun = input.runId
    ? await findSecondaryAnalysisRunByExternalRunId({
        applicationId: input.applicationId,
        externalRunId: input.runId,
      })
    : await getLatestSecondaryAnalysisRun(input.applicationId);

  if (targetRun && !["pending", "processing", "retrying"].includes(targetRun.status)) {
    const storedFields = await listSecondaryAnalysisFieldValues(targetRun.id);
    const editableFields = SECONDARY_FIELD_DEFINITIONS.map((definition) => {
      const stored = storedFields.find((field) => field.no === definition.no);

      return buildEditableSecondaryField(definition, {
        sourceValue: stored?.sourceValue ?? "",
        editedValue: stored?.editedValue ?? "",
        effectiveValue: stored?.effectiveValue ?? "",
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
    throw new Error("The secondary analysis run could not be found.");
  }

  const existingFields = await listSecondaryAnalysisFieldValues(runRecord.id);
  const existingByNo = new Map(existingFields.map((field) => [field.no, field]));
  const editableByNo = new Map<number, string>();

  for (const [key, rawValue] of Object.entries(input.fields)) {
    const numericNo = Number.parseInt(key, 10);
    const byNo = Number.isFinite(numericNo) ? getSecondaryFieldDefinition(numericNo) : null;
    const byFieldKey = SECONDARY_FIELD_DEFINITIONS.find(
      (definition) => definition.fieldKey === key,
    );
    const definition = byNo ?? byFieldKey;

    if (!definition) {
      throw new Error(`Unsupported secondary field: ${key}`);
    }

    editableByNo.set(
      definition.no,
      typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "").trim(),
    );
  }

  const savedAt = new Date().toISOString();
  const nextFields = SECONDARY_FIELD_DEFINITIONS.map((definition) => {
    const existing = existingByNo.get(definition.no);
    const sourceValue = existing?.sourceValue ?? "";
    const editedValue = editableByNo.has(definition.no)
      ? editableByNo.get(definition.no) ?? ""
      : existing?.editedValue ?? "";
    const effectiveValue = editedValue.trim().length > 0 ? editedValue : sourceValue;

    return buildEditableSecondaryField(definition, {
      sourceValue,
      editedValue,
      effectiveValue,
      isMissing: effectiveValue.trim().length === 0,
      isEdited:
        editedValue.trim().length > 0 && editedValue.trim() !== sourceValue.trim(),
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
  const material = await createMaterial(input);
  const application = await getApplicationById(input.applicationId);

  if (application && application.applicationStatus === "ELIGIBLE") {
    await updateApplication(input.applicationId, {
      applicationStatus: "MATERIALS_IN_PROGRESS",
      currentStep: "materials",
    });
  }

  await createEvent(input.applicationId, "MATERIAL_UPLOADED", {
    category: input.category,
    fileName: input.fileName,
  });

  return material;
}

export async function removeMaterialRecord(
  applicationId: string,
  fileId: string,
) {
  const material = await softDeleteMaterial(fileId, applicationId);

  if (material) {
    await createEvent(applicationId, "MATERIAL_DELETED", { fileId });
  }

  return material;
}

export async function getMaterialsByCategory(applicationId: string) {
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

  const updated = await updateApplication(applicationId, {
    applicationStatus: "SUBMITTED",
    currentStep: "materials",
    submittedAt: new Date(),
  });

  await createEvent(applicationId, "APPLICATION_SUBMITTED", null);

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
