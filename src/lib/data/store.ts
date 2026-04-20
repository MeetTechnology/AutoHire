import type { MissingField } from "@/features/analysis/types";
import type { EditableSecondaryField } from "@/features/analysis/types";
import type {
  AnalysisJobStatus,
  ApplicationSnapshot,
  ApplicationStatus,
  EligibilityResult,
  MaterialCategory,
} from "@/features/application/types";
import { enrichMissingFieldsWithRegistry } from "@/lib/resume-analysis/missing-field-registry";
import { getRuntimeMode } from "@/lib/env";
import { getSampleInvitationSeeds } from "@/lib/data/sample-data";
import { Prisma } from "@prisma/client";
import type {
  AccessResult as PrismaAccessResult,
  AccessTokenStatusSnapshot as PrismaAccessTokenStatusSnapshot,
  EventStatus as PrismaEventStatus,
  MaterialCategory as PrismaMaterialCategory,
  UploadFailureStage as PrismaUploadFailureStage,
  UploadKind as PrismaUploadKind,
} from "@prisma/client";

export type AccessResult =
  | "VALID"
  | "INVALID"
  | "EXPIRED"
  | "DISABLED"
  | "SESSION_RESTORE";

export type AccessTokenStatusSnapshot =
  | "UNKNOWN"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED";

export type EventStatus = "SUCCESS" | "FAIL";

export type UploadKind = "RESUME" | "MATERIAL";

export type UploadFailureStage = "INTENT" | "PUT" | "CONFIRM";

type InvitationRecord = {
  id: string;
  expertId: string;
  email: string | null;
  tokenHash: string;
  tokenStatus: "ACTIVE" | "EXPIRED" | "DISABLED";
  expiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ApplicationRecord = {
  id: string;
  expertId: string;
  invitationId: string;
  applicationStatus: ApplicationStatus;
  currentStep: string | null;
  eligibilityResult: EligibilityResult;
  latestAnalysisJobId: string | null;
  firstAccessedAt: Date | null;
  lastAccessedAt: Date | null;
  introConfirmedAt: Date | null;
  resumeUploadStartedAt: Date | null;
  resumeUploadedAt: Date | null;
  analysisStartedAt: Date | null;
  analysisCompletedAt: Date | null;
  materialsEnteredAt: Date | null;
  submittedAt: Date | null;
  screeningPassportFullName: string | null;
  screeningContactEmail: string | null;
  productInnovationDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ResumeFileRecord = {
  id: string;
  applicationId: string;
  fileName: string;
  objectKey: string;
  fileType: string;
  fileSize: number;
  versionNo: number;
  uploadedAt: Date;
};

type AnalysisJobRecord = {
  id: string;
  applicationId: string;
  resumeFileId: string | null;
  externalJobId: string | null;
  jobType: "INITIAL" | "REANALYSIS";
  jobStatus: AnalysisJobStatus;
  stageText: string | null;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

type AnalysisResultRecord = {
  id: string;
  applicationId: string;
  analysisJobId: string;
  analysisRound: number;
  eligibilityResult: EligibilityResult;
  reasonText: string | null;
  displaySummary: string | null;
  extractedFields: Record<string, unknown>;
  missingFields: MissingField[];
  createdAt: Date;
};

type SupplementalFieldRecord = {
  id: string;
  applicationId: string;
  analysisJobId: string | null;
  fieldValues: Record<string, unknown>;
  submittedAt: Date;
};

type SecondaryAnalysisRunRecord = {
  id: string;
  applicationId: string;
  analysisJobId: string | null;
  externalRunId: string;
  status: string;
  errorMessage: string | null;
  runSummary: Record<string, unknown> | null;
  rawResults: Record<string, unknown>[] | null;
  createdAt: Date;
  updatedAt: Date;
};

type SecondaryAnalysisFieldValueRecord = {
  id: string;
  applicationId: string;
  secondaryRunId: string;
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
  createdAt: Date;
  updatedAt: Date;
};

type MaterialRecord = {
  id: string;
  applicationId: string;
  category: MaterialCategory;
  fileName: string;
  objectKey: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
};

type EventRecord = {
  id: string;
  applicationId: string;
  eventType: string;
  eventTime: Date;
  pageName: string | null;
  stepName: string | null;
  actionName: string | null;
  eventStatus: EventStatus | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  sessionId: string | null;
  requestId: string | null;
  ipAddress: string | null;
  ipHash: string | null;
  userAgent: string | null;
  referer: string | null;
  eventPayload: Record<string, unknown> | null;
  createdAt: Date;
};

type InviteAccessLogRecord = {
  id: string;
  occurredAt: Date;
  invitationId: string | null;
  applicationId: string | null;
  tokenStatus: AccessTokenStatusSnapshot;
  accessResult: AccessResult;
  ipAddress: string | null;
  ipHash: string | null;
  userAgent: string | null;
  referer: string | null;
  landingPath: string | null;
  sessionId: string;
  requestId: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: Date;
};

type FileUploadAttemptRecord = {
  id: string;
  applicationId: string;
  uploadId: string | null;
  kind: UploadKind;
  category: MaterialCategory | null;
  fileName: string;
  fileExt: string | null;
  fileSize: number | null;
  intentCreatedAt: Date | null;
  uploadStartedAt: Date | null;
  uploadConfirmedAt: Date | null;
  uploadFailedAt: Date | null;
  failureCode: string | null;
  failureStage: UploadFailureStage | null;
  durationMs: number | null;
  objectKey: string | null;
  sessionId: string | null;
  requestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PersistedStore = {
  invitations: InvitationRecord[];
  applications: ApplicationRecord[];
  resumeFiles: ResumeFileRecord[];
  analysisJobs: AnalysisJobRecord[];
  analysisResults: AnalysisResultRecord[];
  secondaryAnalysisRuns: SecondaryAnalysisRunRecord[];
  secondaryAnalysisFieldValues: SecondaryAnalysisFieldValueRecord[];
  supplementalFields: SupplementalFieldRecord[];
  materials: MaterialRecord[];
  events: EventRecord[];
  accessLogs: InviteAccessLogRecord[];
  fileUploadAttempts: FileUploadAttemptRecord[];
};

declare global {
  var __autohireStore: PersistedStore | undefined;
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function byDateDesc<
  T extends { createdAt?: Date; uploadedAt?: Date; startedAt?: Date },
>(left: T, right: T) {
  const leftValue =
    left.createdAt ?? left.uploadedAt ?? left.startedAt ?? new Date(0);
  const rightValue =
    right.createdAt ?? right.uploadedAt ?? right.startedAt ?? new Date(0);

  return rightValue.getTime() - leftValue.getTime();
}

function buildSampleStore(): PersistedStore {
  const now = new Date();

  return {
    invitations: getSampleInvitationSeeds(),
    applications: [
      {
        id: "app_intro",
        expertId: "expert_init",
        invitationId: "invitation_init",
        applicationStatus: "INTRO_VIEWED",
        currentStep: "resume",
        eligibilityResult: "UNKNOWN",
        latestAnalysisJobId: null,
        firstAccessedAt: now,
        lastAccessedAt: now,
        introConfirmedAt: now,
        resumeUploadStartedAt: null,
        resumeUploadedAt: null,
        analysisStartedAt: null,
        analysisCompletedAt: null,
        materialsEnteredAt: null,
        submittedAt: null,
        screeningPassportFullName: null,
        screeningContactEmail: null,
        productInnovationDescription: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "app_progress",
        expertId: "expert_progress",
        invitationId: "invitation_progress",
        applicationStatus: "INFO_REQUIRED",
        currentStep: "supplemental_fields",
        eligibilityResult: "INSUFFICIENT_INFO",
        latestAnalysisJobId: "job_progress",
        firstAccessedAt: now,
        lastAccessedAt: now,
        introConfirmedAt: now,
        resumeUploadStartedAt: now,
        resumeUploadedAt: now,
        analysisStartedAt: now,
        analysisCompletedAt: now,
        materialsEnteredAt: null,
        submittedAt: null,
        screeningPassportFullName: null,
        screeningContactEmail: null,
        productInnovationDescription: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "app_submitted",
        expertId: "expert_submitted",
        invitationId: "invitation_submitted",
        applicationStatus: "SUBMITTED",
        currentStep: "materials",
        eligibilityResult: "ELIGIBLE",
        latestAnalysisJobId: "job_submitted",
        firstAccessedAt: now,
        lastAccessedAt: now,
        introConfirmedAt: now,
        resumeUploadStartedAt: now,
        resumeUploadedAt: now,
        analysisStartedAt: now,
        analysisCompletedAt: now,
        materialsEnteredAt: now,
        submittedAt: now,
        screeningPassportFullName: null,
        screeningContactEmail: null,
        productInnovationDescription: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "app_secondary",
        expertId: "expert_secondary",
        invitationId: "invitation_secondary",
        applicationStatus: "ELIGIBLE",
        currentStep: "result",
        eligibilityResult: "ELIGIBLE",
        latestAnalysisJobId: "job_secondary",
        firstAccessedAt: now,
        lastAccessedAt: now,
        introConfirmedAt: now,
        resumeUploadStartedAt: now,
        resumeUploadedAt: now,
        analysisStartedAt: now,
        analysisCompletedAt: now,
        materialsEnteredAt: null,
        submittedAt: null,
        screeningPassportFullName: null,
        screeningContactEmail: null,
        productInnovationDescription: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    resumeFiles: [
      {
        id: "resume_progress",
        applicationId: "app_progress",
        fileName: "candidate-progress.pdf",
        objectKey: "applications/app_progress/resume/candidate-progress.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        versionNo: 1,
        uploadedAt: now,
      },
      {
        id: "resume_submitted",
        applicationId: "app_submitted",
        fileName: "candidate-submitted.pdf",
        objectKey: "applications/app_submitted/resume/candidate-submitted.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        versionNo: 1,
        uploadedAt: now,
      },
      {
        id: "resume_secondary",
        applicationId: "app_secondary",
        fileName: "candidate-secondary.pdf",
        objectKey: "applications/app_secondary/resume/candidate-secondary.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        versionNo: 1,
        uploadedAt: now,
      },
    ],
    analysisJobs: [
      {
        id: "job_progress",
        applicationId: "app_progress",
        resumeFileId: "resume_progress",
        externalJobId: "mock:insufficient_info:progress",
        jobType: "INITIAL",
        jobStatus: "COMPLETED",
        stageText: "CV review completed",
        errorMessage: null,
        startedAt: now,
        finishedAt: now,
      },
      {
        id: "job_submitted",
        applicationId: "app_submitted",
        resumeFileId: "resume_submitted",
        externalJobId: "mock:eligible:submitted",
        jobType: "INITIAL",
        jobStatus: "COMPLETED",
        stageText: "CV review completed",
        errorMessage: null,
        startedAt: now,
        finishedAt: now,
      },
      {
        id: "job_secondary",
        applicationId: "app_secondary",
        resumeFileId: "resume_secondary",
        externalJobId: "mock:eligible:secondary",
        jobType: "INITIAL",
        jobStatus: "COMPLETED",
        stageText: "CV review completed",
        errorMessage: null,
        startedAt: now,
        finishedAt: now,
      },
    ],
    analysisResults: [
      {
        id: "result_progress",
        applicationId: "app_progress",
        analysisJobId: "job_progress",
        analysisRound: 1,
        eligibilityResult: "INSUFFICIENT_INFO",
        reasonText: "The highest degree and current employer are still missing.",
        displaySummary:
          "The system cannot make a final eligibility decision yet because key information is missing.",
        extractedFields: {
          "*姓名": "Progress Expert",
          "性别": "Female",
          "*出生日期（无则1900-01-01）": "1900-01-01",
          "最高学位": "",
          "就职单位中文": "",
          "（省/国）入选信息": "National talent program (2021)",
          "备注": "Internal field not shown to experts",
          __rawReasoning:
            "The system identified part of the background information, but key eligibility fields are still missing.",
        },
        missingFields: [
          {
            fieldKey: "highest_degree",
            sourceItemName: "最高学位",
            label: "Highest Degree",
            type: "select",
            required: true,
            options: ["本科", "硕士", "博士", "其他"],
            helpText: "Please provide the highest degree you have completed.",
          },
          {
            fieldKey: "current_employer",
            sourceItemName: "当前工作单位",
            label: "Current Employer",
            type: "text",
            required: true,
          },
        ],
        createdAt: now,
      },
      {
        id: "result_submitted",
        applicationId: "app_submitted",
        analysisJobId: "job_submitted",
        analysisRound: 1,
        eligibilityResult: "ELIGIBLE",
        reasonText: "The profile meets the basic application requirements.",
        displaySummary:
          "You passed the initial eligibility review. Please continue with the detailed analysis.",
        extractedFields: {
          "*姓名": "Submitted Expert",
          "最高学位": "Doctorate",
          "就职单位中文": "Example University",
        },
        missingFields: [],
        createdAt: now,
      },
      {
        id: "result_secondary",
        applicationId: "app_secondary",
        analysisJobId: "job_secondary",
        analysisRound: 1,
        eligibilityResult: "ELIGIBLE",
        reasonText: "The profile meets the basic application requirements.",
        displaySummary:
          "You passed the initial eligibility review. Please continue with the detailed analysis.",
        extractedFields: {
          "*姓名": "Secondary Expert",
          "最高学位": "Doctorate",
          "就职单位中文": "Example Institute",
          "研究方向": "Marine biotechnology",
        },
        missingFields: [],
        createdAt: now,
      },
    ],
    secondaryAnalysisRuns: [],
    secondaryAnalysisFieldValues: [],
    supplementalFields: [],
    materials: [
      {
        id: "mat_submitted_identity",
        applicationId: "app_submitted",
        category: "IDENTITY",
        fileName: "passport.pdf",
        objectKey: "applications/app_submitted/materials/IDENTITY/passport.pdf",
        fileType: "application/pdf",
        fileSize: 1000,
        uploadedAt: now,
        isDeleted: false,
        deletedAt: null,
      },
    ],
    events: [],
    accessLogs: [],
    fileUploadAttempts: [],
  };
}

function getMemoryStore() {
  globalThis.__autohireStore ??= buildSampleStore();

  return globalThis.__autohireStore;
}

async function getPrisma() {
  const { prisma } = await import("@/lib/db/prisma");

  return prisma;
}

export async function findInvitationByTokenHash(tokenHash: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().invitations.find(
        (item) => item.tokenHash === tokenHash,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.expertInvitation.findUnique({ where: { tokenHash } });
}

export async function findInvitationById(invitationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().invitations.find((item) => item.id === invitationId) ??
      null
    );
  }

  const prisma = await getPrisma();
  return prisma.expertInvitation.findUnique({ where: { id: invitationId } });
}

export async function findOpenApplicationByInvitationId(invitationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().applications.find(
        (item) => item.invitationId === invitationId,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.application.findUnique({
    where: { invitationId },
  });
}

export async function createApplication(input: {
  expertId: string;
  invitationId: string;
  applicationStatus?: ApplicationStatus;
  currentStep?: string | null;
}) {
  if (getRuntimeMode() === "memory") {
    const application: ApplicationRecord = {
      id: createId("app"),
      expertId: input.expertId,
      invitationId: input.invitationId,
      applicationStatus: input.applicationStatus ?? "INIT",
      currentStep: input.currentStep ?? "intro",
      eligibilityResult: "UNKNOWN",
      latestAnalysisJobId: null,
      firstAccessedAt: null,
      lastAccessedAt: null,
      introConfirmedAt: null,
      resumeUploadStartedAt: null,
      resumeUploadedAt: null,
      analysisStartedAt: null,
      analysisCompletedAt: null,
      materialsEnteredAt: null,
      submittedAt: null,
      screeningPassportFullName: null,
      screeningContactEmail: null,
      productInnovationDescription: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    getMemoryStore().applications.push(application);
    return application;
  }

  const prisma = await getPrisma();
  return prisma.application.create({
    data: {
      expertId: input.expertId,
      invitationId: input.invitationId,
      applicationStatus: input.applicationStatus ?? "INIT",
      currentStep: input.currentStep ?? "intro",
    },
  });
}

export async function getApplicationById(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().applications.find((item) => item.id === applicationId) ??
      null
    );
  }

  const prisma = await getPrisma();
  return prisma.application.findUnique({ where: { id: applicationId } });
}

export async function updateApplication(
  applicationId: string,
  data: {
    applicationStatus?: ApplicationStatus;
    currentStep?: string | null;
    eligibilityResult?: EligibilityResult;
    latestAnalysisJobId?: string | null;
    firstAccessedAt?: Date | null;
    lastAccessedAt?: Date | null;
    introConfirmedAt?: Date | null;
    resumeUploadStartedAt?: Date | null;
    resumeUploadedAt?: Date | null;
    analysisStartedAt?: Date | null;
    analysisCompletedAt?: Date | null;
    materialsEnteredAt?: Date | null;
    submittedAt?: Date | null;
    screeningPassportFullName?: string | null;
    screeningContactEmail?: string | null;
    productInnovationDescription?: string | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const application = getMemoryStore().applications.find(
      (item) => item.id === applicationId,
    );

    if (!application) {
      return null;
    }

    Object.assign(application, data, { updatedAt: new Date() });
    return application;
  }

  const prisma = await getPrisma();
  return prisma.application.update({
    where: { id: applicationId },
    data,
  });
}

export async function getLatestResumeVersion(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .resumeFiles.filter((item) => item.applicationId === applicationId)
        .sort((left, right) => right.versionNo - left.versionNo)[0]
        ?.versionNo ?? 0
    );
  }

  const prisma = await getPrisma();
  const latest = await prisma.resumeFile.findFirst({
    where: { applicationId },
    orderBy: { versionNo: "desc" },
  });

  return latest?.versionNo ?? 0;
}

export async function createResumeFile(input: {
  applicationId: string;
  fileName: string;
  objectKey: string;
  fileType: string;
  fileSize: number;
  versionNo: number;
}) {
  if (getRuntimeMode() === "memory") {
    const record: ResumeFileRecord = {
      id: createId("resume"),
      uploadedAt: new Date(),
      ...input,
    };

    getMemoryStore().resumeFiles.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.resumeFile.create({ data: input });
}

export async function createAnalysisJob(input: {
  applicationId: string;
  resumeFileId: string | null;
  externalJobId: string | null;
  jobType: "INITIAL" | "REANALYSIS";
  jobStatus: AnalysisJobStatus;
  stageText: string | null;
  errorMessage: string | null;
  finishedAt?: Date | null;
}) {
  if (getRuntimeMode() === "memory") {
    const record: AnalysisJobRecord = {
      id: createId("job"),
      startedAt: new Date(),
      finishedAt: input.finishedAt ?? null,
      ...input,
    };

    getMemoryStore().analysisJobs.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.resumeAnalysisJob.create({
    data: {
      ...input,
      finishedAt: input.finishedAt ?? null,
    },
  });
}

export async function updateAnalysisJob(
  jobId: string,
  data: {
    jobStatus?: AnalysisJobStatus;
    stageText?: string | null;
    errorMessage?: string | null;
    finishedAt?: Date | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const job = getMemoryStore().analysisJobs.find((item) => item.id === jobId);

    if (!job) {
      return null;
    }

    Object.assign(job, data);
    return job;
  }

  const prisma = await getPrisma();
  return prisma.resumeAnalysisJob.update({
    where: { id: jobId },
    data,
  });
}

export async function getLatestAnalysisJob(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .analysisJobs.filter((item) => item.applicationId === applicationId)
        .sort(byDateDesc)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.resumeAnalysisJob.findFirst({
    where: { applicationId },
    orderBy: { startedAt: "desc" },
  });
}

export async function getLatestResumeFile(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .resumeFiles.filter((item) => item.applicationId === applicationId)
        .sort((left, right) => right.versionNo - left.versionNo)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.resumeFile.findFirst({
    where: { applicationId },
    orderBy: [{ versionNo: "desc" }, { uploadedAt: "desc" }],
  });
}

export async function createAnalysisResult(input: {
  applicationId: string;
  analysisJobId: string;
  analysisRound: number;
  eligibilityResult: EligibilityResult;
  reasonText: string | null;
  displaySummary: string | null;
  extractedFields: Record<string, unknown>;
  missingFields: MissingField[];
}) {
  if (getRuntimeMode() === "memory") {
    const record: AnalysisResultRecord = {
      id: createId("result"),
      createdAt: new Date(),
      ...input,
    };

    getMemoryStore().analysisResults.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.resumeAnalysisResult.create({
    data: {
      ...input,
      extractedFields: input.extractedFields as Prisma.InputJsonValue,
      missingFields: input.missingFields as Prisma.InputJsonValue,
    },
  });
}

export async function getLatestAnalysisResult(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .analysisResults.filter((item) => item.applicationId === applicationId)
        .sort(byDateDesc)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.resumeAnalysisResult.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createSupplementalFieldSubmission(input: {
  applicationId: string;
  analysisJobId: string | null;
  fieldValues: Record<string, unknown>;
}) {
  if (getRuntimeMode() === "memory") {
    const record: SupplementalFieldRecord = {
      id: createId("supplemental"),
      submittedAt: new Date(),
      ...input,
    };

    getMemoryStore().supplementalFields.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.supplementalFieldSubmission.create({
    data: {
      ...input,
      fieldValues: input.fieldValues as Prisma.InputJsonValue,
    },
  });
}

export async function getLatestSecondaryAnalysisRun(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .secondaryAnalysisRuns.filter((item) => item.applicationId === applicationId)
        .sort(byDateDesc)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.secondaryAnalysisRun.findFirst({
    where: { applicationId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function findSecondaryAnalysisRunByExternalRunId(input: {
  applicationId: string;
  externalRunId: string;
}) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().secondaryAnalysisRuns.find(
        (item) =>
          item.applicationId === input.applicationId &&
          item.externalRunId === input.externalRunId,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.secondaryAnalysisRun.findUnique({
    where: {
      applicationId_externalRunId: {
        applicationId: input.applicationId,
        externalRunId: input.externalRunId,
      },
    },
  });
}

export async function upsertSecondaryAnalysisRun(input: {
  applicationId: string;
  analysisJobId: string | null;
  externalRunId: string;
  status: string;
  errorMessage: string | null;
  runSummary: Record<string, unknown> | null;
  rawResults: Record<string, unknown>[] | null;
}) {
  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const existing = store.secondaryAnalysisRuns.find(
      (item) =>
        item.applicationId === input.applicationId &&
        item.externalRunId === input.externalRunId,
    );

    if (existing) {
      Object.assign(existing, {
        analysisJobId: input.analysisJobId,
        status: input.status,
        errorMessage: input.errorMessage,
        runSummary: input.runSummary,
        rawResults: input.rawResults,
        updatedAt: new Date(),
      });

      return existing;
    }

    const record: SecondaryAnalysisRunRecord = {
      id: createId("secondary_run"),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };

    store.secondaryAnalysisRuns.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.secondaryAnalysisRun.upsert({
    where: {
      applicationId_externalRunId: {
        applicationId: input.applicationId,
        externalRunId: input.externalRunId,
      },
    },
    update: {
      analysisJobId: input.analysisJobId,
      status: input.status,
      errorMessage: input.errorMessage,
      runSummary: input.runSummary as Prisma.InputJsonValue | undefined,
      rawResults: input.rawResults as Prisma.InputJsonValue | undefined,
    },
    create: {
      applicationId: input.applicationId,
      analysisJobId: input.analysisJobId,
      externalRunId: input.externalRunId,
      status: input.status,
      errorMessage: input.errorMessage,
      runSummary: input.runSummary as Prisma.InputJsonValue | undefined,
      rawResults: input.rawResults as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listSecondaryAnalysisFieldValues(secondaryRunId: string) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().secondaryAnalysisFieldValues
      .filter((item) => item.secondaryRunId === secondaryRunId)
      .sort((left, right) => left.no - right.no);
  }

  const prisma = await getPrisma();
  return prisma.secondaryAnalysisFieldValue.findMany({
    where: { secondaryRunId },
    orderBy: { no: "asc" },
  });
}

export async function upsertSecondaryAnalysisFieldValues(input: {
  applicationId: string;
  secondaryRunId: string;
  fields: EditableSecondaryField[];
}) {
  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();

    for (const field of input.fields) {
      const existing = store.secondaryAnalysisFieldValues.find(
        (item) =>
          item.secondaryRunId === input.secondaryRunId && item.no === field.no,
      );

      if (existing) {
        Object.assign(existing, {
          columnName: field.column,
          label: field.label,
          sourceValue: field.sourceValue,
          editedValue: field.editedValue || null,
          effectiveValue: field.effectiveValue,
          hasOverride: field.hasOverride,
          isMissing: field.isMissing,
          isEdited: field.isEdited,
          savedAt: field.savedAt ? new Date(field.savedAt) : existing.savedAt,
          updatedAt: new Date(),
        });
        continue;
      }

      store.secondaryAnalysisFieldValues.push({
        id: createId("secondary_field"),
        applicationId: input.applicationId,
        secondaryRunId: input.secondaryRunId,
        no: field.no,
        columnName: field.column,
        label: field.label,
        sourceValue: field.sourceValue || null,
        editedValue: field.editedValue || null,
        effectiveValue: field.effectiveValue || null,
        hasOverride: field.hasOverride,
        isMissing: field.isMissing,
        isEdited: field.isEdited,
        savedAt: field.savedAt ? new Date(field.savedAt) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return listSecondaryAnalysisFieldValues(input.secondaryRunId);
  }

  const prisma = await getPrisma();
  await prisma.$transaction(
    input.fields.map((field) =>
      prisma.secondaryAnalysisFieldValue.upsert({
        where: {
          secondaryRunId_no: {
            secondaryRunId: input.secondaryRunId,
            no: field.no,
          },
        },
        update: {
          columnName: field.column,
          label: field.label,
          sourceValue: field.sourceValue || null,
          editedValue: field.editedValue || null,
          effectiveValue: field.effectiveValue || null,
          hasOverride: field.hasOverride,
          isMissing: field.isMissing,
          isEdited: field.isEdited,
          savedAt: field.savedAt ? new Date(field.savedAt) : new Date(),
        },
        create: {
          applicationId: input.applicationId,
          secondaryRunId: input.secondaryRunId,
          no: field.no,
          columnName: field.column,
          label: field.label,
          sourceValue: field.sourceValue || null,
          editedValue: field.editedValue || null,
          effectiveValue: field.effectiveValue || null,
          hasOverride: field.hasOverride,
          isMissing: field.isMissing,
          isEdited: field.isEdited,
          savedAt: field.savedAt ? new Date(field.savedAt) : new Date(),
        },
      }),
    ),
  );

  return prisma.secondaryAnalysisFieldValue.findMany({
    where: { secondaryRunId: input.secondaryRunId },
    orderBy: { no: "asc" },
  });
}

export async function listMaterials(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().materials.filter(
      (item) => item.applicationId === applicationId && !item.isDeleted,
    );
  }

  const prisma = await getPrisma();
  return prisma.applicationMaterial.findMany({
    where: {
      applicationId,
      isDeleted: false,
    },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function createMaterial(input: {
  applicationId: string;
  category: MaterialCategory;
  fileName: string;
  objectKey: string;
  fileType: string;
  fileSize: number;
}) {
  if (getRuntimeMode() === "memory") {
    const record: MaterialRecord = {
      id: createId("material"),
      uploadedAt: new Date(),
      isDeleted: false,
      deletedAt: null,
      ...input,
    };

    getMemoryStore().materials.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.applicationMaterial.create({
    data: {
      ...input,
      category: input.category as PrismaMaterialCategory,
    },
  });
}

export async function softDeleteMaterial(
  fileId: string,
  applicationId: string,
) {
  if (getRuntimeMode() === "memory") {
    const material = getMemoryStore().materials.find(
      (item) => item.id === fileId && item.applicationId === applicationId,
    );

    if (!material) {
      return null;
    }

    material.isDeleted = true;
    material.deletedAt = new Date();
    return material;
  }

  const prisma = await getPrisma();
  return prisma.applicationMaterial.update({
    where: { id: fileId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
}

export async function findApplicationEventByIdempotency(input: {
  applicationId: string;
  eventType: string;
  sessionId: string;
  requestId: string;
}) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().events.find(
        (item) =>
          item.applicationId === input.applicationId &&
          item.eventType === input.eventType &&
          item.sessionId === input.sessionId &&
          item.requestId === input.requestId,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.applicationEventLog.findFirst({
    where: {
      applicationId: input.applicationId,
      eventType: input.eventType,
      sessionId: input.sessionId,
      requestId: input.requestId,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createApplicationEventLog(input: {
  applicationId: string;
  eventType: string;
  eventTime?: Date;
  pageName?: string | null;
  stepName?: string | null;
  actionName?: string | null;
  eventStatus?: EventStatus | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  sessionId?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  eventPayload?: Record<string, unknown> | null;
}) {
  const eventTime = input.eventTime ?? new Date();

  if (getRuntimeMode() === "memory") {
    const event: EventRecord = {
      id: createId("event"),
      applicationId: input.applicationId,
      eventType: input.eventType,
      eventTime,
      pageName: input.pageName ?? null,
      stepName: input.stepName ?? null,
      actionName: input.actionName ?? null,
      eventStatus: input.eventStatus ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      durationMs: input.durationMs ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      referer: input.referer ?? null,
      eventPayload: input.eventPayload ?? null,
      createdAt: new Date(),
    };

    getMemoryStore().events.push(event);
    return event;
  }

  const prisma = await getPrisma();
  return prisma.applicationEventLog.create({
    data: {
      applicationId: input.applicationId,
      eventType: input.eventType,
      eventTime,
      pageName: input.pageName ?? null,
      stepName: input.stepName ?? null,
      actionName: input.actionName ?? null,
      eventStatus: (input.eventStatus ?? null) as PrismaEventStatus | null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      durationMs: input.durationMs ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      referer: input.referer ?? null,
      eventPayload:
        input.eventPayload === undefined
          ? undefined
          : input.eventPayload === null
            ? Prisma.JsonNull
            : (input.eventPayload as Prisma.InputJsonValue),
    },
  });
}

export async function createInviteAccessLog(input: {
  occurredAt?: Date;
  invitationId?: string | null;
  applicationId?: string | null;
  tokenStatus: AccessTokenStatusSnapshot;
  accessResult: AccessResult;
  ipAddress?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  landingPath?: string | null;
  sessionId: string;
  requestId: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
}) {
  const occurredAt = input.occurredAt ?? new Date();

  if (getRuntimeMode() === "memory") {
    const log: InviteAccessLogRecord = {
      id: createId("access"),
      occurredAt,
      invitationId: input.invitationId ?? null,
      applicationId: input.applicationId ?? null,
      tokenStatus: input.tokenStatus,
      accessResult: input.accessResult,
      ipAddress: input.ipAddress ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      referer: input.referer ?? null,
      landingPath: input.landingPath ?? null,
      sessionId: input.sessionId,
      requestId: input.requestId,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      createdAt: new Date(),
    };

    getMemoryStore().accessLogs.push(log);
    return log;
  }

  const prisma = await getPrisma();
  return prisma.inviteAccessLog.create({
    data: {
      occurredAt,
      invitationId: input.invitationId ?? null,
      applicationId: input.applicationId ?? null,
      tokenStatus: input.tokenStatus as PrismaAccessTokenStatusSnapshot,
      accessResult: input.accessResult as PrismaAccessResult,
      ipAddress: input.ipAddress ?? null,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
      referer: input.referer ?? null,
      landingPath: input.landingPath ?? null,
      sessionId: input.sessionId,
      requestId: input.requestId,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
    },
  });
}

export async function upsertFileUploadAttempt(input: {
  applicationId: string;
  uploadId: string;
  kind: UploadKind;
  category?: MaterialCategory | null;
  fileName: string;
  fileExt?: string | null;
  fileSize?: number | null;
  intentCreatedAt?: Date | null;
  uploadStartedAt?: Date | null;
  uploadConfirmedAt?: Date | null;
  uploadFailedAt?: Date | null;
  failureCode?: string | null;
  failureStage?: UploadFailureStage | null;
  durationMs?: number | null;
  objectKey?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
}) {
  const nextTimes = {
    intentCreatedAt: input.intentCreatedAt ?? null,
    uploadStartedAt: input.uploadStartedAt ?? null,
    uploadConfirmedAt: input.uploadConfirmedAt ?? null,
    uploadFailedAt: input.uploadFailedAt ?? null,
  };

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const existing = store.fileUploadAttempts.find(
      (item) => item.uploadId === input.uploadId,
    );

    if (existing) {
      Object.assign(existing, {
        applicationId: input.applicationId,
        kind: input.kind,
        category: input.category ?? existing.category,
        fileName: input.fileName,
        fileExt: input.fileExt ?? existing.fileExt,
        fileSize: input.fileSize ?? existing.fileSize,
        intentCreatedAt: nextTimes.intentCreatedAt ?? existing.intentCreatedAt,
        uploadStartedAt: nextTimes.uploadStartedAt ?? existing.uploadStartedAt,
        uploadConfirmedAt:
          nextTimes.uploadConfirmedAt ?? existing.uploadConfirmedAt,
        uploadFailedAt: nextTimes.uploadFailedAt ?? existing.uploadFailedAt,
        failureCode: input.failureCode ?? existing.failureCode,
        failureStage: input.failureStage ?? existing.failureStage,
        objectKey: input.objectKey ?? existing.objectKey,
        sessionId: input.sessionId ?? existing.sessionId,
        requestId: input.requestId ?? existing.requestId,
        durationMs:
          input.durationMs ??
          computeUploadDurationMs({
            intentCreatedAt:
              nextTimes.intentCreatedAt ?? existing.intentCreatedAt,
            uploadStartedAt:
              nextTimes.uploadStartedAt ?? existing.uploadStartedAt,
            uploadConfirmedAt:
              nextTimes.uploadConfirmedAt ?? existing.uploadConfirmedAt,
            uploadFailedAt: nextTimes.uploadFailedAt ?? existing.uploadFailedAt,
          }),
        updatedAt: new Date(),
      });

      return existing;
    }

    const record: FileUploadAttemptRecord = {
      id: createId("upload"),
      applicationId: input.applicationId,
      uploadId: input.uploadId,
      kind: input.kind,
      category: input.category ?? null,
      fileName: input.fileName,
      fileExt: input.fileExt ?? null,
      fileSize: input.fileSize ?? null,
      intentCreatedAt: nextTimes.intentCreatedAt,
      uploadStartedAt: nextTimes.uploadStartedAt,
      uploadConfirmedAt: nextTimes.uploadConfirmedAt,
      uploadFailedAt: nextTimes.uploadFailedAt,
      failureCode: input.failureCode ?? null,
      failureStage: input.failureStage ?? null,
      durationMs:
        input.durationMs ??
        computeUploadDurationMs({
          intentCreatedAt: nextTimes.intentCreatedAt,
          uploadStartedAt: nextTimes.uploadStartedAt,
          uploadConfirmedAt: nextTimes.uploadConfirmedAt,
          uploadFailedAt: nextTimes.uploadFailedAt,
        }),
      objectKey: input.objectKey ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    store.fileUploadAttempts.push(record);
    return record;
  }

  const prisma = await getPrisma();
  const existing = await prisma.fileUploadAttempt.findUnique({
    where: { uploadId: input.uploadId },
  });
  const mergedTimes = {
    intentCreatedAt: nextTimes.intentCreatedAt ?? existing?.intentCreatedAt ?? null,
    uploadStartedAt: nextTimes.uploadStartedAt ?? existing?.uploadStartedAt ?? null,
    uploadConfirmedAt:
      nextTimes.uploadConfirmedAt ?? existing?.uploadConfirmedAt ?? null,
    uploadFailedAt: nextTimes.uploadFailedAt ?? existing?.uploadFailedAt ?? null,
  };
  const durationMs =
    input.durationMs ?? computeUploadDurationMs(mergedTimes) ?? existing?.durationMs ?? null;

  return prisma.fileUploadAttempt.upsert({
    where: { uploadId: input.uploadId },
    update: {
      applicationId: input.applicationId,
      kind: input.kind as PrismaUploadKind,
      category: (input.category ?? null) as PrismaMaterialCategory | null,
      fileName: input.fileName,
      fileExt: input.fileExt ?? undefined,
      fileSize: input.fileSize ?? undefined,
      intentCreatedAt: mergedTimes.intentCreatedAt,
      uploadStartedAt: mergedTimes.uploadStartedAt,
      uploadConfirmedAt: mergedTimes.uploadConfirmedAt,
      uploadFailedAt: mergedTimes.uploadFailedAt,
      failureCode: input.failureCode ?? undefined,
      failureStage: (input.failureStage ?? null) as PrismaUploadFailureStage | null,
      durationMs,
      objectKey: input.objectKey ?? undefined,
      sessionId: input.sessionId ?? undefined,
      requestId: input.requestId ?? undefined,
    },
    create: {
      applicationId: input.applicationId,
      uploadId: input.uploadId,
      kind: input.kind as PrismaUploadKind,
      category: (input.category ?? null) as PrismaMaterialCategory | null,
      fileName: input.fileName,
      fileExt: input.fileExt ?? null,
      fileSize: input.fileSize ?? null,
      intentCreatedAt: mergedTimes.intentCreatedAt,
      uploadStartedAt: mergedTimes.uploadStartedAt,
      uploadConfirmedAt: mergedTimes.uploadConfirmedAt,
      uploadFailedAt: mergedTimes.uploadFailedAt,
      failureCode: input.failureCode ?? null,
      failureStage: (input.failureStage ?? null) as PrismaUploadFailureStage | null,
      durationMs,
      objectKey: input.objectKey ?? null,
      sessionId: input.sessionId ?? null,
      requestId: input.requestId ?? null,
    },
  });
}

export async function createEvent(
  applicationId: string,
  eventType: string,
  eventPayload: Record<string, unknown> | null,
) {
  return createApplicationEventLog({
    applicationId,
    eventType,
    eventPayload,
  });
}

function computeUploadDurationMs(input: {
  intentCreatedAt?: Date | null;
  uploadStartedAt?: Date | null;
  uploadConfirmedAt?: Date | null;
  uploadFailedAt?: Date | null;
}) {
  const start = input.uploadStartedAt ?? input.intentCreatedAt ?? null;
  const end = input.uploadConfirmedAt ?? input.uploadFailedAt ?? null;

  if (!start || !end) {
    return null;
  }

  return Math.max(0, end.getTime() - start.getTime());
}

export async function listApplicationEvents(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().events
      .filter((item) => item.applicationId === applicationId)
      .sort((left, right) => right.eventTime.getTime() - left.eventTime.getTime());
  }

  const prisma = await getPrisma();
  return prisma.applicationEventLog.findMany({
    where: { applicationId },
    orderBy: { eventTime: "desc" },
  });
}

export async function listInviteAccessLogs() {
  if (getRuntimeMode() === "memory") {
    return [...getMemoryStore().accessLogs].sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
    );
  }

  const prisma = await getPrisma();
  return prisma.inviteAccessLog.findMany({
    orderBy: { occurredAt: "desc" },
  });
}

export async function listFileUploadAttempts(applicationId?: string) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().fileUploadAttempts
      .filter((item) => !applicationId || item.applicationId === applicationId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  const prisma = await getPrisma();
  return prisma.fileUploadAttempt.findMany({
    where: applicationId ? { applicationId } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

function countMaterialsByCategory(
  materials: Array<{ category: string }>,
  category: string,
) {
  return materials.filter((item) => item.category === category).length;
}

function toSnapshotFromMemory(
  application: ApplicationRecord,
): ApplicationSnapshot {
  const store = getMemoryStore();
  const latestResumeFile =
    store.resumeFiles
      .filter((item) => item.applicationId === application.id)
      .sort(byDateDesc)[0] ?? null;
  const latestAnalysisJob =
    store.analysisJobs
      .filter((item) => item.applicationId === application.id)
      .sort(byDateDesc)[0] ?? null;
  const latestResult =
    store.analysisResults
      .filter((item) => item.applicationId === application.id)
      .sort(byDateDesc)[0] ?? null;
  const materials = store.materials.filter(
    (item) => item.applicationId === application.id && !item.isDeleted,
  );

  return {
    applicationId: application.id,
    expertId: application.expertId,
    invitationId: application.invitationId,
    applicationStatus: application.applicationStatus,
    currentStep: application.currentStep,
    eligibilityResult: application.eligibilityResult,
    latestAnalysisJobId: application.latestAnalysisJobId,
    screeningPassportFullName: application.screeningPassportFullName,
    screeningContactEmail: application.screeningContactEmail,
    productInnovationDescription:
      application.productInnovationDescription ?? null,
    resumeAnalysisStatus: latestAnalysisJob?.jobStatus ?? null,
    latestResumeFile: latestResumeFile
      ? {
          id: latestResumeFile.id,
          fileName: latestResumeFile.fileName,
          fileType: latestResumeFile.fileType,
          fileSize: latestResumeFile.fileSize,
          uploadedAt: latestResumeFile.uploadedAt.toISOString(),
        }
      : null,
    latestResult: latestResult
      ? {
          displaySummary: latestResult.displaySummary,
          reasonText: latestResult.reasonText,
          missingFields: enrichMissingFieldsWithRegistry(latestResult.missingFields),
          extractedFields: latestResult.extractedFields,
        }
      : null,
    uploadedMaterialsSummary: {
      identity: countMaterialsByCategory(materials, "IDENTITY"),
      employment: countMaterialsByCategory(materials, "EMPLOYMENT"),
      education: countMaterialsByCategory(materials, "EDUCATION"),
      honor: countMaterialsByCategory(materials, "HONOR"),
      patent: countMaterialsByCategory(materials, "PATENT"),
      project: countMaterialsByCategory(materials, "PROJECT"),
      paper: countMaterialsByCategory(materials, "PAPER"),
      book: countMaterialsByCategory(materials, "BOOK"),
      conference: countMaterialsByCategory(materials, "CONFERENCE"),
      product: countMaterialsByCategory(materials, "PRODUCT"),
    },
    submittedAt: application.submittedAt?.toISOString() ?? null,
  };
}

export async function buildApplicationSnapshot(
  applicationId: string,
): Promise<ApplicationSnapshot | null> {
  const application = await getApplicationById(applicationId);

  if (!application) {
    return null;
  }

  if (getRuntimeMode() === "memory") {
    return toSnapshotFromMemory(application as ApplicationRecord);
  }

  const prisma = await getPrisma();
  const [latestResumeFile, latestAnalysisJob, latestResult, materials] =
    await Promise.all([
      prisma.resumeFile.findFirst({
        where: { applicationId },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.resumeAnalysisJob.findFirst({
        where: { applicationId },
        orderBy: { startedAt: "desc" },
      }),
      prisma.resumeAnalysisResult.findFirst({
        where: { applicationId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.applicationMaterial.findMany({
        where: { applicationId, isDeleted: false },
      }),
    ]);

  const applicationRow = application as ApplicationRecord;

  return {
    applicationId: application.id,
    expertId: application.expertId,
    invitationId: application.invitationId,
    applicationStatus: application.applicationStatus,
    currentStep: application.currentStep,
    eligibilityResult: application.eligibilityResult,
    latestAnalysisJobId: application.latestAnalysisJobId,
    screeningPassportFullName:
      applicationRow.screeningPassportFullName ?? null,
    screeningContactEmail: applicationRow.screeningContactEmail ?? null,
    productInnovationDescription:
      applicationRow.productInnovationDescription ?? null,
    resumeAnalysisStatus: latestAnalysisJob?.jobStatus ?? null,
    latestResumeFile: latestResumeFile
      ? {
          id: latestResumeFile.id,
          fileName: latestResumeFile.fileName,
          fileType: latestResumeFile.fileType,
          fileSize: latestResumeFile.fileSize,
          uploadedAt: latestResumeFile.uploadedAt.toISOString(),
        }
      : null,
    latestResult: latestResult
      ? {
          displaySummary: latestResult.displaySummary,
          reasonText: latestResult.reasonText,
          missingFields: enrichMissingFieldsWithRegistry(
            (latestResult.missingFields as MissingField[] | null) ?? [],
          ),
          extractedFields:
            (latestResult.extractedFields as Record<string, unknown> | null) ??
            {},
        }
      : null,
    uploadedMaterialsSummary: {
      identity: countMaterialsByCategory(materials, "IDENTITY"),
      employment: countMaterialsByCategory(materials, "EMPLOYMENT"),
      education: countMaterialsByCategory(materials, "EDUCATION"),
      honor: countMaterialsByCategory(materials, "HONOR"),
      patent: countMaterialsByCategory(materials, "PATENT"),
      project: countMaterialsByCategory(materials, "PROJECT"),
      paper: countMaterialsByCategory(materials, "PAPER"),
      book: countMaterialsByCategory(materials, "BOOK"),
      conference: countMaterialsByCategory(materials, "CONFERENCE"),
      product: countMaterialsByCategory(materials, "PRODUCT"),
    },
    submittedAt: application.submittedAt?.toISOString() ?? null,
  };
}
