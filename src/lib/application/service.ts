import type {
  AnalysisJobStatus,
  ApplicationStatus,
  EligibilityResult,
  MaterialCategory,
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
  getApplicationById,
  getLatestAnalysisJob,
  getLatestAnalysisResult,
  getLatestResumeFile,
  getLatestResumeVersion,
  listMaterials,
  softDeleteMaterial,
  updateAnalysisJob,
  updateApplication,
} from "@/lib/data/store";
import {
  createResumeAnalysisJob,
  getResumeAnalysisResult,
  getResumeAnalysisStatus,
  reanalyzeWithSupplementalFields,
} from "@/lib/resume-analysis/client";

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
  if (jobStatus === "completed") {
    return "COMPLETED";
  }

  if (jobStatus === "failed") {
    return "FAILED";
  }

  if (jobStatus === "processing") {
    return "PROCESSING";
  }

  return "QUEUED";
}

export async function startInitialAnalysis(input: {
  applicationId: string;
  fileName: string;
  resumeFileId: string;
}) {
  const analysis = await createResumeAnalysisJob({
    applicationId: input.applicationId,
    fileName: input.fileName,
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

  const status = await getResumeAnalysisStatus({
    externalJobId: job.externalJobId ?? "",
  });
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
      stageText: status.stageText ?? "处理中",
      progressMessage: status.progressMessage ?? "系统正在处理，请稍候。",
    };
  }

  const existingResult = await getLatestAnalysisResult(applicationId);

  if (!existingResult || existingResult.analysisJobId !== job.id) {
    const result = await getResumeAnalysisResult({
      externalJobId: job.externalJobId ?? "",
    });

    await createAnalysisResult({
      applicationId,
      analysisJobId: job.id,
      analysisRound: job.jobType === "REANALYSIS" ? 2 : 1,
      eligibilityResult: result.eligibilityResult,
      reasonText: result.reasonText ?? null,
      displaySummary: result.displaySummary ?? null,
      extractedFields: result.extractedFields ?? {},
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
    });
  }

  const snapshot = await buildApplicationSnapshot(applicationId);

  return {
    jobStatus: "COMPLETED" as const,
    stageText: "已完成分析",
    progressMessage: snapshot?.latestResult?.displaySummary ?? "分析已完成。",
  };
}

export async function submitSupplementalFields(input: {
  applicationId: string;
  fields: Record<string, unknown>;
}) {
  const latestJob = await getLatestAnalysisJob(input.applicationId);
  const latestResumeFile = await getLatestResumeFile(input.applicationId);

  await createSupplementalFieldSubmission({
    applicationId: input.applicationId,
    analysisJobId: latestJob?.id ?? null,
    fieldValues: input.fields,
  });

  const analysis = await reanalyzeWithSupplementalFields({
    applicationId: input.applicationId,
    fields: input.fields,
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
