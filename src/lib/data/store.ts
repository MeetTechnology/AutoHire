import type { MissingField } from "@/features/analysis/types";
import type {
  AnalysisJobStatus,
  ApplicationSnapshot,
  ApplicationStatus,
  EligibilityResult,
  MaterialCategory,
} from "@/features/application/types";
import { getRuntimeMode } from "@/lib/env";
import { getSampleInvitationSeeds } from "@/lib/data/sample-data";
import type { Prisma } from "@prisma/client";

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
  submittedAt: Date | null;
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
};

type EventRecord = {
  id: string;
  applicationId: string;
  eventType: string;
  eventPayload: Record<string, unknown> | null;
  createdAt: Date;
};

type PersistedStore = {
  invitations: InvitationRecord[];
  applications: ApplicationRecord[];
  resumeFiles: ResumeFileRecord[];
  analysisJobs: AnalysisJobRecord[];
  analysisResults: AnalysisResultRecord[];
  supplementalFields: SupplementalFieldRecord[];
  materials: MaterialRecord[];
  events: EventRecord[];
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
        id: "app_progress",
        expertId: "expert_progress",
        invitationId: "invitation_progress",
        applicationStatus: "INFO_REQUIRED",
        currentStep: "supplemental_fields",
        eligibilityResult: "INSUFFICIENT_INFO",
        latestAnalysisJobId: "job_progress",
        submittedAt: null,
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
        submittedAt: now,
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
    ],
    analysisJobs: [
      {
        id: "job_progress",
        applicationId: "app_progress",
        externalJobId: "mock:insufficient_info:progress",
        jobType: "INITIAL",
        jobStatus: "COMPLETED",
        stageText: "已完成简历分析",
        errorMessage: null,
        startedAt: now,
        finishedAt: now,
      },
      {
        id: "job_submitted",
        applicationId: "app_submitted",
        externalJobId: "mock:eligible:submitted",
        jobType: "INITIAL",
        jobStatus: "COMPLETED",
        stageText: "已完成简历分析",
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
        reasonText: "缺少最高学历与当前工作单位信息。",
        displaySummary: "当前无法完成资格判断，缺少关键信息。",
        extractedFields: { name: "Progress Expert" },
        missingFields: [
          {
            fieldKey: "highest_degree",
            label: "最高学历",
            type: "select",
            required: true,
            options: ["本科", "硕士", "博士", "其他"],
            helpText: "请填写已获得的最高学历",
          },
          {
            fieldKey: "current_employer",
            label: "当前工作单位",
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
        reasonText: "符合基本申报条件。",
        displaySummary: "您已通过初步资格判断，请继续上传证明材料。",
        extractedFields: { name: "Submitted Expert" },
        missingFields: [],
        createdAt: now,
      },
    ],
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
      },
    ],
    events: [],
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
      getMemoryStore()
        .applications.filter(
          (item) =>
            item.invitationId === invitationId &&
            item.applicationStatus !== "CLOSED",
        )
        .sort(byDateDesc)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.application.findFirst({
    where: {
      invitationId,
      applicationStatus: {
        not: "CLOSED",
      },
    },
    orderBy: { updatedAt: "desc" },
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
      submittedAt: null,
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
    submittedAt?: Date | null;
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
      ...input,
    };

    getMemoryStore().materials.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.applicationMaterial.create({ data: input });
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
    return material;
  }

  const prisma = await getPrisma();
  return prisma.applicationMaterial.update({
    where: { id: fileId },
    data: { isDeleted: true },
  });
}

export async function createEvent(
  applicationId: string,
  eventType: string,
  eventPayload: Record<string, unknown> | null,
) {
  if (getRuntimeMode() === "memory") {
    const event: EventRecord = {
      id: createId("event"),
      applicationId,
      eventType,
      eventPayload,
      createdAt: new Date(),
    };

    getMemoryStore().events.push(event);
    return event;
  }

  const prisma = await getPrisma();
  return prisma.applicationEventLog.create({
    data: {
      applicationId,
      eventType,
      eventPayload: eventPayload as Prisma.InputJsonValue,
    },
  });
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
          missingFields: latestResult.missingFields,
          extractedFields: latestResult.extractedFields,
        }
      : null,
    uploadedMaterialsSummary: {
      identity: materials.filter((item) => item.category === "IDENTITY").length,
      employment: materials.filter((item) => item.category === "EMPLOYMENT")
        .length,
      education: materials.filter((item) => item.category === "EDUCATION")
        .length,
      honor: materials.filter((item) => item.category === "HONOR").length,
      patent: materials.filter((item) => item.category === "PATENT").length,
      project: materials.filter((item) => item.category === "PROJECT").length,
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

  return {
    applicationId: application.id,
    expertId: application.expertId,
    invitationId: application.invitationId,
    applicationStatus: application.applicationStatus,
    currentStep: application.currentStep,
    eligibilityResult: application.eligibilityResult,
    latestAnalysisJobId: application.latestAnalysisJobId,
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
          missingFields:
            (latestResult.missingFields as MissingField[] | null) ?? [],
          extractedFields:
            (latestResult.extractedFields as Record<string, unknown> | null) ??
            {},
        }
      : null,
    uploadedMaterialsSummary: {
      identity: materials.filter((item) => item.category === "IDENTITY").length,
      employment: materials.filter((item) => item.category === "EMPLOYMENT")
        .length,
      education: materials.filter((item) => item.category === "EDUCATION")
        .length,
      honor: materials.filter((item) => item.category === "HONOR").length,
      patent: materials.filter((item) => item.category === "PATENT").length,
      project: materials.filter((item) => item.category === "PROJECT").length,
    },
    submittedAt: application.submittedAt?.toISOString() ?? null,
  };
}
