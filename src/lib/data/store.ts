import type { MissingField } from "@/features/analysis/types";
import type { EditableSecondaryField } from "@/features/analysis/types";
import type {
  AnalysisJobStatus,
  ApplicationFeedbackContext,
  ApplicationFeedbackStatus,
  ApplicationSnapshot,
  ApplicationStatus,
  EligibilityResult,
  MaterialCategory,
  ResumeExtractionReviewStatus,
} from "@/features/application/types";
import {
  SUPPLEMENT_CATEGORY_LABELS,
  SUPPLEMENT_REVIEW_MAX_ROUNDS,
  SUPPORTED_SUPPLEMENT_CATEGORIES,
} from "@/features/material-supplement/constants";
import type {
  MaterialCategoryReviewStatus,
  MaterialReviewRunStatus,
  MaterialSupplementStatus,
  SupplementCategory,
  SupplementCategoryDisplayStatus,
  SupplementHistoryItem,
  SupplementRequestStatus,
  SupplementSnapshot,
  SupplementSummary,
  SupplementUploadBatchStatus,
} from "@/features/material-supplement/types";
import {
  mergeMissingFieldsWithScreeningContactRequirements,
  mergeStoredScreeningContactValuesIntoExtractedFields,
} from "@/lib/application/screening-contact";
import { enrichMissingFieldsWithRegistry } from "@/lib/resume-analysis/missing-field-registry";
import { getRuntimeMode } from "@/lib/env";
import { getSampleInvitationSeeds } from "@/lib/data/sample-data";
import { Prisma } from "@prisma/client";
import type {
  ApplicationFeedbackStatus as PrismaApplicationFeedbackStatus,
  AccessResult as PrismaAccessResult,
  AccessTokenStatusSnapshot as PrismaAccessTokenStatusSnapshot,
  EventStatus as PrismaEventStatus,
  MaterialCategoryReviewStatus as PrismaMaterialCategoryReviewStatus,
  MaterialCategory as PrismaMaterialCategory,
  MaterialReviewRunStatus as PrismaMaterialReviewRunStatus,
  MaterialReviewTriggerType as PrismaMaterialReviewTriggerType,
  SupplementCategory as PrismaSupplementCategory,
  SupplementRequestStatus as PrismaSupplementRequestStatus,
  SupplementUploadBatchStatus as PrismaSupplementUploadBatchStatus,
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

export type MaterialReviewTriggerType =
  | "INITIAL_SUBMISSION"
  | "SUPPLEMENT_UPLOAD"
  | "MANUAL_RETRY";

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
  screeningWorkEmail: string | null;
  screeningPhoneNumber: string | null;
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

type ResumeExtractionReviewRecord = {
  id: string;
  applicationId: string;
  analysisJobId: string;
  externalJobId: string | null;
  status: ResumeExtractionReviewStatus;
  extractedFields: Record<string, unknown>;
  rawExtractionResponse: string | null;
  errorMessage: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

type MaterialReviewRunRecord = {
  id: string;
  applicationId: string;
  runNo: number;
  status: MaterialReviewRunStatus;
  triggerType: MaterialReviewTriggerType;
  triggeredCategory: SupplementCategory | null;
  externalRunId: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MaterialCategoryReviewRecord = {
  id: string;
  reviewRunId: string;
  applicationId: string;
  category: SupplementCategory;
  roundNo: number;
  status: MaterialCategoryReviewStatus;
  aiMessage: string | null;
  resultPayload: Record<string, unknown> | null;
  isLatest: boolean;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SupplementRequestRecord = {
  id: string;
  applicationId: string;
  category: SupplementCategory;
  reviewRunId: string;
  categoryReviewId: string;
  title: string;
  reason: string | null;
  suggestedMaterials: string[] | string | null;
  aiMessage: string | null;
  status: SupplementRequestStatus;
  isLatest: boolean;
  isSatisfied: boolean;
  satisfiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SupplementUploadBatchRecord = {
  id: string;
  applicationId: string;
  category: SupplementCategory;
  status: SupplementUploadBatchStatus;
  fileCount: number;
  reviewRunId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SupplementFileRecord = {
  id: string;
  applicationId: string;
  category: SupplementCategory;
  supplementRequestId: string | null;
  uploadBatchId: string;
  reviewRunId: string | null;
  fileName: string;
  objectKey: string;
  fileType: string;
  fileSize: number;
  isDeleted: boolean;
  deletedAt: Date | null;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type FeedbackRecord = {
  id: string;
  applicationId: string;
  status: ApplicationFeedbackStatus;
  rating: number | null;
  comment: string | null;
  contextData: Prisma.JsonValue | null;
  draftSavedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type FeedbackDraftWriteResult =
  | {
      kind: "saved";
      feedback: FeedbackRecord;
    }
  | {
      kind: "already_submitted";
      feedback: FeedbackRecord;
    };

type FeedbackSubmitWriteResult =
  | {
      kind: "submitted";
      feedback: FeedbackRecord;
    }
  | {
      kind: "already_submitted";
      feedback: FeedbackRecord;
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
  extractionReviews: ResumeExtractionReviewRecord[];
  secondaryAnalysisRuns: SecondaryAnalysisRunRecord[];
  secondaryAnalysisFieldValues: SecondaryAnalysisFieldValueRecord[];
  supplementalFields: SupplementalFieldRecord[];
  materials: MaterialRecord[];
  materialReviewRuns: MaterialReviewRunRecord[];
  materialCategoryReviews: MaterialCategoryReviewRecord[];
  supplementRequests: SupplementRequestRecord[];
  supplementUploadBatches: SupplementUploadBatchRecord[];
  supplementFiles: SupplementFileRecord[];
  feedbacks: FeedbackRecord[];
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

function getLatestSupplementTimestamp(input: {
  finishedAt?: Date | null;
  startedAt?: Date | null;
  updatedAt?: Date | null;
  createdAt?: Date | null;
}) {
  return (
    input.finishedAt ??
    input.startedAt ??
    input.updatedAt ??
    input.createdAt ??
    null
  );
}

function byLatestSupplementTimestampDesc<
  T extends {
    finishedAt?: Date | null;
    startedAt?: Date | null;
    updatedAt?: Date | null;
    createdAt?: Date | null;
  },
>(left: T, right: T) {
  const leftValue = getLatestSupplementTimestamp(left)?.getTime() ?? 0;
  const rightValue = getLatestSupplementTimestamp(right)?.getTime() ?? 0;

  return rightValue - leftValue;
}

function normalizeSuggestedMaterials(
  value: string[] | string | null | undefined,
): string[] | string | null {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function isSupplementRequestPending(request: {
  status: SupplementRequestStatus;
  isSatisfied: boolean;
}) {
  return !request.isSatisfied && request.status !== "SATISFIED";
}

function isSupplementRequestSatisfied(request: {
  status: SupplementRequestStatus;
  isSatisfied: boolean;
}) {
  return request.isSatisfied || request.status === "SATISFIED";
}

function deriveMaterialSupplementStatus(input: {
  latestRun: MaterialReviewRunRecord | null;
  latestCategoryReviews: MaterialCategoryReviewRecord[];
  latestRequests: SupplementRequestRecord[];
}): MaterialSupplementStatus {
  if (!input.latestRun) {
    return "NOT_STARTED";
  }

  if (
    input.latestRun.status === "QUEUED" ||
    input.latestRun.status === "PROCESSING" ||
    input.latestCategoryReviews.some(
      (review) => review.status === "QUEUED" || review.status === "PROCESSING",
    )
  ) {
    return "REVIEWING";
  }

  const pendingCount = input.latestRequests.filter(isSupplementRequestPending).length;
  const satisfiedCount = input.latestRequests.filter(
    isSupplementRequestSatisfied,
  ).length;

  if (pendingCount > 0 && satisfiedCount > 0) {
    return "PARTIALLY_SATISFIED";
  }

  if (pendingCount > 0) {
    return "SUPPLEMENT_REQUIRED";
  }

  if (satisfiedCount > 0) {
    return "SATISFIED";
  }

  if (input.latestRun.status === "COMPLETED") {
    return "NO_SUPPLEMENT_REQUIRED";
  }

  return "NOT_STARTED";
}

function deriveSupplementCategoryDisplayStatus(input: {
  latestReview: MaterialCategoryReviewRecord | null;
  latestRequests: SupplementRequestRecord[];
}): SupplementCategoryDisplayStatus {
  if (!input.latestReview) {
    return "NOT_STARTED";
  }

  if (
    input.latestReview.status === "QUEUED" ||
    input.latestReview.status === "PROCESSING"
  ) {
    return "REVIEWING";
  }

  if (input.latestReview.status === "FAILED") {
    return "REVIEW_FAILED";
  }

  const pendingCount = input.latestRequests.filter(isSupplementRequestPending).length;
  const satisfiedCount = input.latestRequests.filter(
    isSupplementRequestSatisfied,
  ).length;

  if (pendingCount > 0 && satisfiedCount > 0) {
    return "PARTIALLY_SATISFIED";
  }

  if (pendingCount > 0) {
    return "SUPPLEMENT_REQUIRED";
  }

  if (satisfiedCount > 0) {
    return "SATISFIED";
  }

  return "NO_SUPPLEMENT_REQUIRED";
}

function buildSampleStore(): PersistedStore {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

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
        screeningWorkEmail: null,
        screeningPhoneNumber: null,
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
        screeningPassportFullName: "Progress Expert",
        screeningContactEmail: "progress.expert@example.com",
        screeningWorkEmail: "progress.expert@university.edu",
        screeningPhoneNumber: "+1 555 010 1000",
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
        screeningPassportFullName: "Submitted Expert",
        screeningContactEmail: "submitted.expert@example.com",
        screeningWorkEmail: "submitted.expert@university.edu",
        screeningPhoneNumber: "+1 555 010 3000",
        productInnovationDescription: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "app_extraction",
        expertId: "expert_extraction",
        invitationId: "invitation_extraction",
        applicationStatus: "CV_EXTRACTING",
        currentStep: "result",
        eligibilityResult: "UNKNOWN",
        latestAnalysisJobId: "job_extraction",
        firstAccessedAt: now,
        lastAccessedAt: now,
        introConfirmedAt: now,
        resumeUploadStartedAt: now,
        resumeUploadedAt: now,
        analysisStartedAt: now,
        analysisCompletedAt: null,
        materialsEnteredAt: null,
        submittedAt: null,
        screeningPassportFullName: null,
        screeningContactEmail: null,
        screeningWorkEmail: null,
        screeningPhoneNumber: null,
        productInnovationDescription: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "app_extraction_review",
        expertId: "expert_extraction_review",
        invitationId: "invitation_extraction_review",
        applicationStatus: "CV_EXTRACTION_REVIEW",
        currentStep: "result",
        eligibilityResult: "UNKNOWN",
        latestAnalysisJobId: "job_extraction_review",
        firstAccessedAt: now,
        lastAccessedAt: now,
        introConfirmedAt: now,
        resumeUploadStartedAt: now,
        resumeUploadedAt: now,
        analysisStartedAt: now,
        analysisCompletedAt: null,
        materialsEnteredAt: null,
        submittedAt: null,
        screeningPassportFullName: null,
        screeningContactEmail: null,
        screeningWorkEmail: null,
        screeningPhoneNumber: null,
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
        screeningPassportFullName: "Secondary Expert",
        screeningContactEmail: "secondary.expert@example.com",
        screeningWorkEmail: "secondary.expert@university.edu",
        screeningPhoneNumber: "+1 555 010 4000",
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
      {
        id: "resume_extraction",
        applicationId: "app_extraction",
        fileName: "candidate-extraction.pdf",
        objectKey: "applications/app_extraction/resume/candidate-extraction.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        versionNo: 1,
        uploadedAt: now,
      },
      {
        id: "resume_extraction_review",
        applicationId: "app_extraction_review",
        fileName: "candidate-extraction-review.pdf",
        objectKey:
          "applications/app_extraction_review/resume/candidate-extraction-review.pdf",
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
      {
        id: "job_extraction",
        applicationId: "app_extraction",
        resumeFileId: "resume_extraction",
        externalJobId: "mock-extract:eligible:sample",
        jobType: "INITIAL",
        jobStatus: "PROCESSING",
        stageText: "Extracting CV information",
        errorMessage: null,
        startedAt: now,
        finishedAt: null,
      },
      {
        id: "job_extraction_review",
        applicationId: "app_extraction_review",
        resumeFileId: "resume_extraction_review",
        externalJobId: "mock-extract:eligible:review",
        jobType: "INITIAL",
        jobStatus: "COMPLETED",
        stageText: "CV information extraction completed",
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
          "Your profile meets the basic application requirements for this talent program. Please proceed to the next step to provide the required documents.",
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
          "Your profile meets the basic application requirements for this talent program. Please proceed to the next step to provide the required documents.",
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
    extractionReviews: [
      {
        id: "extraction_processing",
        applicationId: "app_extraction",
        analysisJobId: "job_extraction",
        externalJobId: "mock-extract:eligible:sample",
        status: "PROCESSING",
        extractedFields: {},
        rawExtractionResponse: null,
        errorMessage: null,
        confirmedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "extraction_ready",
        applicationId: "app_extraction_review",
        analysisJobId: "job_extraction_review",
        externalJobId: "mock-extract:eligible:review",
        status: "READY",
        extractedFields: {
          name: "Extraction Review Expert",
          personal_email: "extraction.review@example.com",
          work_email: "extraction.review@university.edu",
          phone_number: "+1 555 010 5000",
          year_of_birth: "1988",
          doctoral_degree_status: "Obtained",
          doctoral_graduation_time: "2018",
          current_title_equivalence: "Associate Professor",
          current_country_of_employment: "United States",
          work_experience_2020_present:
            "2020-Present, United States, Example University, Associate Professor",
          research_area: "Semiconductor materials",
        },
        rawExtractionResponse: "### 1. Extracted Information",
        errorMessage: null,
        confirmedAt: null,
        createdAt: now,
        updatedAt: now,
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
    materialReviewRuns: [
      {
        id: "mr_run_initial",
        applicationId: "app_submitted",
        runNo: 1,
        status: "COMPLETED",
        triggerType: "INITIAL_SUBMISSION",
        triggeredCategory: null,
        externalRunId: "mock-material-review-initial",
        errorMessage: null,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: "mr_run_identity_retry",
        applicationId: "app_submitted",
        runNo: 2,
        status: "PROCESSING",
        triggerType: "SUPPLEMENT_UPLOAD",
        triggeredCategory: "IDENTITY",
        externalRunId: "mock-material-review-identity",
        errorMessage: null,
        startedAt: thirtyMinutesAgo,
        finishedAt: null,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    materialCategoryReviews: [
      {
        id: "mcr_identity_initial",
        reviewRunId: "mr_run_initial",
        applicationId: "app_submitted",
        category: "IDENTITY",
        roundNo: 1,
        status: "COMPLETED",
        aiMessage: "Please provide a clearer proof-of-identity document.",
        resultPayload: { supplementRequired: true, requests: 1 },
        isLatest: false,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: "mcr_identity_retry",
        reviewRunId: "mr_run_identity_retry",
        applicationId: "app_submitted",
        category: "IDENTITY",
        roundNo: 2,
        status: "PROCESSING",
        aiMessage: null,
        resultPayload: null,
        isLatest: true,
        startedAt: thirtyMinutesAgo,
        finishedAt: null,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        id: "mcr_employment_initial",
        reviewRunId: "mr_run_initial",
        applicationId: "app_submitted",
        category: "EMPLOYMENT",
        roundNo: 1,
        status: "COMPLETED",
        aiMessage: "Employment evidence is incomplete.",
        resultPayload: { supplementRequired: true, requests: 1 },
        isLatest: true,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: "mcr_honor_initial",
        reviewRunId: "mr_run_initial",
        applicationId: "app_submitted",
        category: "HONOR",
        roundNo: 1,
        status: "COMPLETED",
        aiMessage: "Honor evidence is already sufficient.",
        resultPayload: { supplementRequired: false, requests: 1 },
        isLatest: true,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
    ],
    supplementRequests: [
      {
        id: "supp_req_identity_history",
        applicationId: "app_submitted",
        category: "IDENTITY",
        reviewRunId: "mr_run_initial",
        categoryReviewId: "mcr_identity_initial",
        title: "Upload a full passport scan",
        reason: "The previous upload did not show all identification details.",
        suggestedMaterials: ["Passport", "National ID card"],
        aiMessage: "A full document scan is required for identity verification.",
        status: "SATISFIED",
        isLatest: false,
        isSatisfied: true,
        satisfiedAt: thirtyMinutesAgo,
        createdAt: oneHourAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        id: "supp_req_employment_latest",
        applicationId: "app_submitted",
        category: "EMPLOYMENT",
        reviewRunId: "mr_run_initial",
        categoryReviewId: "mcr_employment_initial",
        title: "Upload recent employment proof",
        reason: "The current employer evidence is missing.",
        suggestedMaterials: ["Employment certificate", "Current contract"],
        aiMessage: "Please upload an official document proving current employment.",
        status: "PENDING",
        isLatest: true,
        isSatisfied: false,
        satisfiedAt: null,
        createdAt: oneHourAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: "supp_req_honor_latest",
        applicationId: "app_submitted",
        category: "HONOR",
        reviewRunId: "mr_run_initial",
        categoryReviewId: "mcr_honor_initial",
        title: "Honor materials complete",
        reason: "No supplement is required for honor materials.",
        suggestedMaterials: null,
        aiMessage: "The provided honor materials already satisfy this category.",
        status: "SATISFIED",
        isLatest: true,
        isSatisfied: true,
        satisfiedAt: oneHourAgo,
        createdAt: oneHourAgo,
        updatedAt: oneHourAgo,
      },
    ],
    supplementUploadBatches: [
      {
        id: "supp_batch_employment_draft",
        applicationId: "app_submitted",
        category: "EMPLOYMENT",
        status: "DRAFT",
        fileCount: 1,
        reviewRunId: null,
        confirmedAt: null,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        id: "supp_batch_identity_reviewing",
        applicationId: "app_submitted",
        category: "IDENTITY",
        status: "REVIEWING",
        fileCount: 1,
        reviewRunId: "mr_run_identity_retry",
        confirmedAt: thirtyMinutesAgo,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    supplementFiles: [
      {
        id: "supp_file_employment_draft",
        applicationId: "app_submitted",
        category: "EMPLOYMENT",
        supplementRequestId: "supp_req_employment_latest",
        uploadBatchId: "supp_batch_employment_draft",
        reviewRunId: null,
        fileName: "employment-proof.pdf",
        objectKey:
          "applications/app_submitted/supplements/EMPLOYMENT/employment-proof.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        isDeleted: false,
        deletedAt: null,
        uploadedAt: thirtyMinutesAgo,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        id: "supp_file_identity_reviewing",
        applicationId: "app_submitted",
        category: "IDENTITY",
        supplementRequestId: null,
        uploadBatchId: "supp_batch_identity_reviewing",
        reviewRunId: "mr_run_identity_retry",
        fileName: "passport-fullscan.pdf",
        objectKey:
          "applications/app_submitted/supplements/IDENTITY/passport-fullscan.pdf",
        fileType: "application/pdf",
        fileSize: 4096,
        isDeleted: false,
        deletedAt: null,
        uploadedAt: thirtyMinutesAgo,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    feedbacks: [],
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
      screeningWorkEmail: null,
      screeningPhoneNumber: null,
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
    screeningWorkEmail?: string | null;
    screeningPhoneNumber?: string | null;
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

export async function getApplicationFeedbackByApplicationId(
  applicationId: string,
) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().feedbacks.find(
        (item) => item.applicationId === applicationId,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.applicationFeedback.findUnique({
    where: { applicationId },
  });
}

export async function upsertApplicationFeedbackDraft(input: {
  applicationId: string;
  rating?: number | null;
  comment?: string;
  contextData?: Prisma.InputJsonValue | null;
}): Promise<FeedbackDraftWriteResult> {
  const nextComment =
    typeof input.comment === "string" ? input.comment : undefined;

  if (getRuntimeMode() === "memory") {
    const now = new Date();
    const store = getMemoryStore();
    const existing = store.feedbacks.find(
      (item) => item.applicationId === input.applicationId,
    );

    if (existing) {
      if (existing.status === "SUBMITTED") {
        return { kind: "already_submitted", feedback: existing };
      }

      existing.status = "DRAFT";
      existing.rating =
        input.rating !== undefined ? input.rating : existing.rating;
      existing.comment = nextComment !== undefined ? nextComment : existing.comment;
      existing.contextData =
        input.contextData !== undefined
          ? ((input.contextData as ApplicationFeedbackContext | null) ?? null)
          : existing.contextData;
      existing.draftSavedAt = now;
      existing.updatedAt = now;
      return { kind: "saved", feedback: existing };
    }

    const record: FeedbackRecord = {
      id: createId("feedback"),
      applicationId: input.applicationId,
      status: "DRAFT",
      rating: input.rating ?? null,
      comment: nextComment ?? null,
      contextData: (input.contextData as ApplicationFeedbackContext | null) ?? null,
      draftSavedAt: now,
      submittedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    store.feedbacks.push(record);
    return { kind: "saved", feedback: record };
  }

  async function readFeedback() {
    return prisma.applicationFeedback.findUnique({
      where: { applicationId: input.applicationId },
    });
  }

  const prisma = await getPrisma();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = new Date();
    const updated = await prisma.applicationFeedback.updateMany({
      where: {
        applicationId: input.applicationId,
        status: "DRAFT" as PrismaApplicationFeedbackStatus,
      },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(nextComment !== undefined ? { comment: nextComment } : {}),
        ...(input.contextData !== undefined
          ? { contextData: input.contextData ?? Prisma.JsonNull }
          : {}),
        draftSavedAt: now,
      },
    });

    if (updated.count > 0) {
      const feedback = await readFeedback();
      if (feedback) {
        return { kind: "saved", feedback };
      }
    }

    try {
      const feedback = await prisma.applicationFeedback.create({
        data: {
          applicationId: input.applicationId,
          status: "DRAFT" as PrismaApplicationFeedbackStatus,
          rating: input.rating ?? null,
          comment: nextComment ?? null,
          ...(input.contextData !== undefined
            ? { contextData: input.contextData ?? Prisma.JsonNull }
            : {}),
          draftSavedAt: now,
        },
      });

      return { kind: "saved", feedback };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      const feedback = await readFeedback();

      if (feedback?.status === "SUBMITTED") {
        return { kind: "already_submitted", feedback };
      }

      if (feedback && attempt === 1) {
        return { kind: "saved", feedback };
      }
    }
  }

  const feedback = await prisma.applicationFeedback.findUnique({
    where: { applicationId: input.applicationId },
  });

  if (feedback?.status === "SUBMITTED") {
    return { kind: "already_submitted", feedback };
  }

  if (feedback) {
    return { kind: "saved", feedback };
  }

  throw new Error("Unable to persist feedback draft.");
}

export async function submitApplicationFeedbackRecord(input: {
  applicationId: string;
  rating?: number | null;
  comment?: string;
  contextData?: Prisma.InputJsonValue | null;
}): Promise<FeedbackSubmitWriteResult> {
  const nextComment =
    typeof input.comment === "string" ? input.comment : undefined;

  if (getRuntimeMode() === "memory") {
    const now = new Date();
    const store = getMemoryStore();
    const existing = store.feedbacks.find(
      (item) => item.applicationId === input.applicationId,
    );

    if (existing) {
      if (existing.status === "SUBMITTED") {
        return { kind: "already_submitted", feedback: existing };
      }

      existing.status = "SUBMITTED";
      existing.rating =
        input.rating !== undefined ? input.rating : existing.rating;
      existing.comment = nextComment ?? existing.comment;
      existing.contextData =
        input.contextData !== undefined
          ? ((input.contextData as ApplicationFeedbackContext | null) ?? null)
          : existing.contextData;
      existing.draftSavedAt = now;
      existing.submittedAt = now;
      existing.updatedAt = now;
      return { kind: "submitted", feedback: existing };
    }

    const record: FeedbackRecord = {
      id: createId("feedback"),
      applicationId: input.applicationId,
      status: "SUBMITTED",
      rating: input.rating ?? null,
      comment: nextComment ?? null,
      contextData: (input.contextData as ApplicationFeedbackContext | null) ?? null,
      draftSavedAt: now,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    store.feedbacks.push(record);
    return { kind: "submitted", feedback: record };
  }

  const prisma = await getPrisma();

  async function readFeedback() {
    return prisma.applicationFeedback.findUnique({
      where: { applicationId: input.applicationId },
    });
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = new Date();
    const updated = await prisma.applicationFeedback.updateMany({
      where: {
        applicationId: input.applicationId,
        status: "DRAFT" as PrismaApplicationFeedbackStatus,
      },
      data: {
        status: "SUBMITTED" as PrismaApplicationFeedbackStatus,
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(nextComment !== undefined ? { comment: nextComment } : {}),
        ...(input.contextData !== undefined
          ? { contextData: input.contextData ?? Prisma.JsonNull }
          : {}),
        draftSavedAt: now,
        submittedAt: now,
      },
    });

    if (updated.count > 0) {
      const feedback = await readFeedback();
      if (feedback) {
        return { kind: "submitted", feedback };
      }
    }

    try {
      const feedback = await prisma.applicationFeedback.create({
        data: {
          applicationId: input.applicationId,
          status: "SUBMITTED" as PrismaApplicationFeedbackStatus,
          rating: input.rating ?? null,
          comment: nextComment ?? null,
          ...(input.contextData !== undefined
            ? { contextData: input.contextData ?? Prisma.JsonNull }
            : {}),
          draftSavedAt: now,
          submittedAt: now,
        },
      });

      return { kind: "submitted", feedback };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      const feedback = await readFeedback();

      if (feedback?.status === "SUBMITTED") {
        return { kind: "already_submitted", feedback };
      }
    }
  }

  const feedback = await prisma.applicationFeedback.findUnique({
    where: { applicationId: input.applicationId },
  });

  if (feedback?.status === "SUBMITTED") {
    return { kind: "already_submitted", feedback };
  }

  throw new Error("Unable to submit feedback.");
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

export async function deleteResumeFileById(fileId: string) {
  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const index = store.resumeFiles.findIndex((item) => item.id === fileId);

    if (index < 0) {
      return null;
    }

    const [removed] = store.resumeFiles.splice(index, 1);
    return removed ?? null;
  }

  const prisma = await getPrisma();
  return prisma.resumeFile.delete({
    where: { id: fileId },
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

export async function createExtractionReview(input: {
  applicationId: string;
  analysisJobId: string;
  externalJobId: string | null;
  status: ResumeExtractionReviewStatus;
  extractedFields?: Record<string, unknown>;
  rawExtractionResponse?: string | null;
  errorMessage?: string | null;
  confirmedAt?: Date | null;
}) {
  if (getRuntimeMode() === "memory") {
    const now = new Date();
    const record: ResumeExtractionReviewRecord = {
      id: createId("extraction"),
      applicationId: input.applicationId,
      analysisJobId: input.analysisJobId,
      externalJobId: input.externalJobId,
      status: input.status,
      extractedFields: input.extractedFields ?? {},
      rawExtractionResponse: input.rawExtractionResponse ?? null,
      errorMessage: input.errorMessage ?? null,
      confirmedAt: input.confirmedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    getMemoryStore().extractionReviews.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.resumeExtractionReview.create({
    data: {
      applicationId: input.applicationId,
      analysisJobId: input.analysisJobId,
      externalJobId: input.externalJobId,
      status: input.status,
      extractedFields: (input.extractedFields ?? {}) as Prisma.InputJsonValue,
      rawExtractionResponse: input.rawExtractionResponse ?? null,
      errorMessage: input.errorMessage ?? null,
      confirmedAt: input.confirmedAt ?? null,
    },
  });
}

export async function updateExtractionReview(
  analysisJobId: string,
  data: {
    status?: ResumeExtractionReviewStatus;
    extractedFields?: Record<string, unknown>;
    rawExtractionResponse?: string | null;
    errorMessage?: string | null;
    confirmedAt?: Date | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const review = getMemoryStore().extractionReviews.find(
      (item) => item.analysisJobId === analysisJobId,
    );

    if (!review) {
      return null;
    }

    Object.assign(review, {
      ...data,
      updatedAt: new Date(),
    });
    return review;
  }

  const prisma = await getPrisma();
  return prisma.resumeExtractionReview.update({
    where: { analysisJobId },
    data: {
      ...(data.status ? { status: data.status } : {}),
      ...(data.extractedFields
        ? { extractedFields: data.extractedFields as Prisma.InputJsonValue }
        : {}),
      ...(typeof data.rawExtractionResponse !== "undefined"
        ? { rawExtractionResponse: data.rawExtractionResponse }
        : {}),
      ...(typeof data.errorMessage !== "undefined"
        ? { errorMessage: data.errorMessage }
        : {}),
      ...(typeof data.confirmedAt !== "undefined"
        ? { confirmedAt: data.confirmedAt }
        : {}),
    },
  });
}

export async function getLatestExtractionReview(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .extractionReviews.filter((item) => item.applicationId === applicationId)
        .sort(byDateDesc)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.resumeExtractionReview.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getExtractionReviewByAnalysisJobId(analysisJobId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().extractionReviews.find(
        (item) => item.analysisJobId === analysisJobId,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.resumeExtractionReview.findUnique({
    where: { analysisJobId },
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

type MaterialCategoryReviewFilters = {
  category?: SupplementCategory;
  reviewRunId?: string;
  isLatest?: boolean;
};

type SupplementRequestFilters = {
  category?: SupplementCategory;
  reviewRunId?: string;
  categoryReviewId?: string;
  isLatest?: boolean;
  status?: SupplementRequestStatus;
};

type SupplementFileFilters = {
  category?: SupplementCategory;
  uploadBatchId?: string;
  reviewRunId?: string;
  supplementRequestId?: string;
  includeDeleted?: boolean;
};

type SupplementHistoryFilters = {
  category?: SupplementCategory;
  runNo?: number;
};

type ReplaceLatestSupplementRequestsInput = {
  applicationId: string;
  category: SupplementCategory;
  reviewRunId: string;
  categoryReviewId: string;
  requests: Array<{
    title: string;
    reason?: string | null;
    suggestedMaterials?: string[] | string | null;
    aiMessage?: string | null;
    status?: SupplementRequestStatus;
    isSatisfied?: boolean;
    satisfiedAt?: Date | null;
  }>;
};

export type MaterialSupplementSummaryData = SupplementSummary & {
  latestRunStatus: MaterialReviewRunStatus | null;
  latestCategoryReviewStatuses: Partial<
    Record<SupplementCategory, MaterialCategoryReviewStatus>
  >;
};

function toSupplementFileSummary(file: SupplementFileRecord) {
  return {
    id: file.id,
    fileName: file.fileName,
    fileType: file.fileType,
    fileSize: file.fileSize,
    uploadedAt: file.uploadedAt.toISOString(),
  };
}

function toSupplementRequestSummary(request: SupplementRequestRecord) {
  return {
    id: request.id,
    title: request.title,
    reason: request.reason,
    suggestedMaterials: request.suggestedMaterials,
    aiMessage: request.aiMessage,
    status: request.status,
    isSatisfied: request.isSatisfied,
    updatedAt: request.updatedAt.toISOString(),
  };
}

function matchesMaterialCategoryReviewFilters(
  item: MaterialCategoryReviewRecord,
  filters?: MaterialCategoryReviewFilters,
) {
  if (!filters) {
    return true;
  }

  return (
    (filters.category === undefined || item.category === filters.category) &&
    (filters.reviewRunId === undefined || item.reviewRunId === filters.reviewRunId) &&
    (filters.isLatest === undefined || item.isLatest === filters.isLatest)
  );
}

function matchesSupplementRequestFilters(
  item: SupplementRequestRecord,
  filters?: SupplementRequestFilters,
) {
  if (!filters) {
    return true;
  }

  return (
    (filters.category === undefined || item.category === filters.category) &&
    (filters.reviewRunId === undefined || item.reviewRunId === filters.reviewRunId) &&
    (filters.categoryReviewId === undefined ||
      item.categoryReviewId === filters.categoryReviewId) &&
    (filters.isLatest === undefined || item.isLatest === filters.isLatest) &&
    (filters.status === undefined || item.status === filters.status)
  );
}

function matchesSupplementFileFilters(
  item: SupplementFileRecord,
  filters?: SupplementFileFilters,
) {
  if (!filters) {
    return !item.isDeleted;
  }

  return (
    (filters.category === undefined || item.category === filters.category) &&
    (filters.uploadBatchId === undefined ||
      item.uploadBatchId === filters.uploadBatchId) &&
    (filters.reviewRunId === undefined || item.reviewRunId === filters.reviewRunId) &&
    (filters.supplementRequestId === undefined ||
      item.supplementRequestId === filters.supplementRequestId) &&
    (filters.includeDeleted === true || !item.isDeleted)
  );
}

function toHistoricalSupplementRequestStatus(
  request: Pick<SupplementRequestRecord, "isSatisfied" | "status">,
) {
  if (request.isSatisfied || request.status === "SATISFIED") {
    return request.status;
  }

  return "HISTORY_ONLY" satisfies SupplementRequestStatus;
}

function validateSupplementFileBatchOwnership(input: {
  applicationId: string;
  category: SupplementCategory;
  batch: Pick<SupplementUploadBatchRecord, "applicationId" | "category">;
}) {
  if (input.batch.applicationId !== input.applicationId) {
    throw new Error("Supplement upload batch does not belong to the application.");
  }

  if (input.batch.category !== input.category) {
    throw new Error("Supplement upload batch category does not match the file category.");
  }
}

function validateSupplementRequestOwnership(input: {
  applicationId: string;
  category: SupplementCategory;
  request: Pick<
    SupplementRequestRecord,
    "applicationId" | "category" | "id"
  > | null;
}) {
  if (!input.request) {
    return;
  }

  if (input.request.applicationId !== input.applicationId) {
    throw new Error("Supplement request does not belong to the application.");
  }

  if (input.request.category !== input.category) {
    throw new Error(
      "Supplement request category does not match the uploaded file category.",
    );
  }
}

function validateBatchAndReviewRunCompatibility(input: {
  batch: Pick<SupplementUploadBatchRecord, "applicationId" | "category">;
  reviewRun: Pick<
    MaterialReviewRunRecord,
    "applicationId" | "triggeredCategory"
  >;
}) {
  if (input.batch.applicationId !== input.reviewRun.applicationId) {
    throw new Error(
      "Supplement upload batch and material review run must belong to the same application.",
    );
  }

  if (
    input.reviewRun.triggeredCategory !== null &&
    input.reviewRun.triggeredCategory !== input.batch.category
  ) {
    throw new Error(
      "Material review run category does not match the supplement upload batch category.",
    );
  }
}

export async function getLatestMaterialReviewRun(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore()
        .materialReviewRuns.filter((item) => item.applicationId === applicationId)
        .sort((left, right) => right.runNo - left.runNo)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.materialReviewRun.findFirst({
    where: { applicationId },
    orderBy: { runNo: "desc" },
  });
}

export async function getMaterialReviewRunById(reviewRunId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().materialReviewRuns.find((item) => item.id === reviewRunId) ??
      null
    );
  }

  const prisma = await getPrisma();
  return prisma.materialReviewRun.findUnique({ where: { id: reviewRunId } });
}

export async function getMaterialReviewRunByApplicationAndRunNo(
  applicationId: string,
  runNo: number,
) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().materialReviewRuns.find(
        (item) => item.applicationId === applicationId && item.runNo === runNo,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.materialReviewRun.findUnique({
    where: { applicationId_runNo: { applicationId, runNo } },
  });
}

export async function listMaterialReviewRuns(applicationId: string) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().materialReviewRuns
      .filter((item) => item.applicationId === applicationId)
      .sort((left, right) => right.runNo - left.runNo);
  }

  const prisma = await getPrisma();
  return prisma.materialReviewRun.findMany({
    where: { applicationId },
    orderBy: { runNo: "desc" },
  });
}

export async function createMaterialReviewRun(input: {
  applicationId: string;
  runNo: number;
  status?: MaterialReviewRunStatus;
  triggerType: MaterialReviewTriggerType;
  triggeredCategory?: SupplementCategory | null;
  externalRunId?: string | null;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}) {
  if (getRuntimeMode() === "memory") {
    const existing = getMemoryStore().materialReviewRuns.find(
      (item) =>
        item.applicationId === input.applicationId && item.runNo === input.runNo,
    );

    if (existing) {
      return existing;
    }

    const now = new Date();
    const record: MaterialReviewRunRecord = {
      id: createId("material_review_run"),
      applicationId: input.applicationId,
      runNo: input.runNo,
      status: input.status ?? "QUEUED",
      triggerType: input.triggerType,
      triggeredCategory: input.triggeredCategory ?? null,
      externalRunId: input.externalRunId ?? null,
      errorMessage: input.errorMessage ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    getMemoryStore().materialReviewRuns.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.materialReviewRun.upsert({
    where: {
      applicationId_runNo: {
        applicationId: input.applicationId,
        runNo: input.runNo,
      },
    },
    update: {},
    create: {
      applicationId: input.applicationId,
      runNo: input.runNo,
      status: (input.status ?? "QUEUED") as PrismaMaterialReviewRunStatus,
      triggerType: input.triggerType as PrismaMaterialReviewTriggerType,
      triggeredCategory: (input.triggeredCategory ?? null) as PrismaSupplementCategory | null,
      externalRunId: input.externalRunId ?? null,
      errorMessage: input.errorMessage ?? null,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
    },
  });
}

export async function updateMaterialReviewRun(
  reviewRunId: string,
  data: {
    status?: MaterialReviewRunStatus;
    triggerType?: MaterialReviewTriggerType;
    triggeredCategory?: SupplementCategory | null;
    externalRunId?: string | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const reviewRun = getMemoryStore().materialReviewRuns.find(
      (item) => item.id === reviewRunId,
    );

    if (!reviewRun) {
      return null;
    }

    Object.assign(reviewRun, data, { updatedAt: new Date() });
    return reviewRun;
  }

  const prisma = await getPrisma();
  return prisma.materialReviewRun.update({
    where: { id: reviewRunId },
    data: {
      ...(data.status === undefined
        ? {}
        : { status: data.status as PrismaMaterialReviewRunStatus }),
      ...(data.triggerType === undefined
        ? {}
        : { triggerType: data.triggerType as PrismaMaterialReviewTriggerType }),
      ...(data.triggeredCategory === undefined
        ? {}
        : {
            triggeredCategory:
              data.triggeredCategory as PrismaSupplementCategory | null,
          }),
      ...(data.externalRunId === undefined
        ? {}
        : { externalRunId: data.externalRunId }),
      ...(data.errorMessage === undefined
        ? {}
        : { errorMessage: data.errorMessage }),
      ...(data.startedAt === undefined ? {} : { startedAt: data.startedAt }),
      ...(data.finishedAt === undefined ? {} : { finishedAt: data.finishedAt }),
    },
  });
}

export async function getLatestMaterialCategoryReview(
  applicationId: string,
  category: SupplementCategory,
) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().materialCategoryReviews.find(
        (item) =>
          item.applicationId === applicationId &&
          item.category === category &&
          item.isLatest,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.materialCategoryReview.findFirst({
    where: { applicationId, category: category as PrismaSupplementCategory, isLatest: true },
  });
}

export async function listMaterialCategoryReviews(
  applicationId: string,
  filters?: MaterialCategoryReviewFilters,
) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().materialCategoryReviews
      .filter(
        (item) =>
          item.applicationId === applicationId &&
          matchesMaterialCategoryReviewFilters(item, filters),
      )
      .sort((left, right) => {
        if (left.roundNo !== right.roundNo) {
          return right.roundNo - left.roundNo;
        }

        return byLatestSupplementTimestampDesc(left, right);
      });
  }

  const prisma = await getPrisma();
  return prisma.materialCategoryReview.findMany({
    where: {
      applicationId,
      ...(filters?.category === undefined
        ? {}
        : { category: filters.category as PrismaSupplementCategory }),
      ...(filters?.reviewRunId === undefined
        ? {}
        : { reviewRunId: filters.reviewRunId }),
      ...(filters?.isLatest === undefined ? {} : { isLatest: filters.isLatest }),
    },
    orderBy: [{ roundNo: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createMaterialCategoryReview(input: {
  reviewRunId: string;
  applicationId: string;
  category: SupplementCategory;
  roundNo: number;
  status?: MaterialCategoryReviewStatus;
  aiMessage?: string | null;
  resultPayload?: Record<string, unknown> | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}) {
  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const now = new Date();

    for (const existing of store.materialCategoryReviews) {
      if (
        existing.applicationId === input.applicationId &&
        existing.category === input.category &&
        existing.isLatest
      ) {
        existing.isLatest = false;
        existing.updatedAt = now;
      }
    }

    const record: MaterialCategoryReviewRecord = {
      id: createId("material_category_review"),
      reviewRunId: input.reviewRunId,
      applicationId: input.applicationId,
      category: input.category,
      roundNo: input.roundNo,
      status: input.status ?? "QUEUED",
      aiMessage: input.aiMessage ?? null,
      resultPayload: input.resultPayload ?? null,
      isLatest: true,
      startedAt: input.startedAt ?? null,
      finishedAt: input.finishedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    store.materialCategoryReviews.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.$transaction(async (tx) => {
    await tx.materialCategoryReview.updateMany({
      where: {
        applicationId: input.applicationId,
        category: input.category as PrismaSupplementCategory,
        isLatest: true,
      },
      data: { isLatest: false },
    });

    return tx.materialCategoryReview.create({
      data: {
        reviewRunId: input.reviewRunId,
        applicationId: input.applicationId,
        category: input.category as PrismaSupplementCategory,
        roundNo: input.roundNo,
        status: (input.status ?? "QUEUED") as PrismaMaterialCategoryReviewStatus,
        aiMessage: input.aiMessage ?? null,
        resultPayload: (input.resultPayload ?? null) as Prisma.InputJsonValue | Prisma.JsonNull,
        isLatest: true,
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
      },
    });
  });
}

export async function updateMaterialCategoryReview(
  reviewId: string,
  data: {
    status?: MaterialCategoryReviewStatus;
    aiMessage?: string | null;
    resultPayload?: Record<string, unknown> | null;
    isLatest?: boolean;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const review = getMemoryStore().materialCategoryReviews.find(
      (item) => item.id === reviewId,
    );

    if (!review) {
      return null;
    }

    Object.assign(review, data, { updatedAt: new Date() });
    return review;
  }

  const prisma = await getPrisma();
  return prisma.materialCategoryReview.update({
    where: { id: reviewId },
    data: {
      ...(data.status === undefined
        ? {}
        : { status: data.status as PrismaMaterialCategoryReviewStatus }),
      ...(data.aiMessage === undefined ? {} : { aiMessage: data.aiMessage }),
      ...(data.resultPayload === undefined
        ? {}
        : {
            resultPayload:
              data.resultPayload === null
                ? Prisma.JsonNull
                : (data.resultPayload as Prisma.InputJsonValue),
          }),
      ...(data.isLatest === undefined ? {} : { isLatest: data.isLatest }),
      ...(data.startedAt === undefined ? {} : { startedAt: data.startedAt }),
      ...(data.finishedAt === undefined ? {} : { finishedAt: data.finishedAt }),
    },
  });
}

export async function listLatestSupplementRequests(
  applicationId: string,
  category?: SupplementCategory,
) {
  return listSupplementRequests(applicationId, {
    category,
    isLatest: true,
  });
}

export async function listSupplementRequests(
  applicationId: string,
  filters?: SupplementRequestFilters,
) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().supplementRequests
      .filter(
        (item) =>
          item.applicationId === applicationId &&
          matchesSupplementRequestFilters(item, filters),
      )
      .sort(byLatestSupplementTimestampDesc);
  }

  const prisma = await getPrisma();
  return prisma.supplementRequest.findMany({
    where: {
      applicationId,
      ...(filters?.category === undefined
        ? {}
        : { category: filters.category as PrismaSupplementCategory }),
      ...(filters?.reviewRunId === undefined
        ? {}
        : { reviewRunId: filters.reviewRunId }),
      ...(filters?.categoryReviewId === undefined
        ? {}
        : { categoryReviewId: filters.categoryReviewId }),
      ...(filters?.isLatest === undefined ? {} : { isLatest: filters.isLatest }),
      ...(filters?.status === undefined
        ? {}
        : { status: filters.status as PrismaSupplementRequestStatus }),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createSupplementRequest(input: {
  applicationId: string;
  category: SupplementCategory;
  reviewRunId: string;
  categoryReviewId: string;
  title: string;
  reason?: string | null;
  suggestedMaterials?: string[] | string | null;
  aiMessage?: string | null;
  status?: SupplementRequestStatus;
  isLatest?: boolean;
  isSatisfied?: boolean;
  satisfiedAt?: Date | null;
}) {
  const normalizedSuggestedMaterials = normalizeSuggestedMaterials(
    input.suggestedMaterials,
  );
  const derivedIsSatisfied =
    input.isSatisfied ?? (input.status === "SATISFIED" ? true : false);
  const satisfiedAt =
    derivedIsSatisfied ? input.satisfiedAt ?? new Date() : input.satisfiedAt ?? null;
  const shouldBeLatest = input.isLatest ?? true;

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const now = new Date();

    if (shouldBeLatest) {
      for (const existing of store.supplementRequests) {
        if (
          existing.applicationId === input.applicationId &&
          existing.category === input.category &&
          existing.isLatest
        ) {
          existing.isLatest = false;
          existing.status = toHistoricalSupplementRequestStatus(existing);
          existing.updatedAt = now;
        }
      }
    }

    const record: SupplementRequestRecord = {
      id: createId("supplement_request"),
      applicationId: input.applicationId,
      category: input.category,
      reviewRunId: input.reviewRunId,
      categoryReviewId: input.categoryReviewId,
      title: input.title,
      reason: input.reason ?? null,
      suggestedMaterials: normalizedSuggestedMaterials,
      aiMessage: input.aiMessage ?? null,
      status: input.status ?? "PENDING",
      isLatest: shouldBeLatest,
      isSatisfied: derivedIsSatisfied,
      satisfiedAt,
      createdAt: now,
      updatedAt: now,
    };

    store.supplementRequests.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.$transaction(async (tx) => {
    if (shouldBeLatest) {
      const currentLatest = await tx.supplementRequest.findMany({
        where: {
          applicationId: input.applicationId,
          category: input.category as PrismaSupplementCategory,
          isLatest: true,
        },
      });

      await Promise.all(
        currentLatest.map((request) =>
          tx.supplementRequest.update({
            where: { id: request.id },
            data: {
              isLatest: false,
              status: toHistoricalSupplementRequestStatus({
                isSatisfied: request.isSatisfied,
                status: request.status as SupplementRequestStatus,
              }) as PrismaSupplementRequestStatus,
            },
          }),
        ),
      );
    }

    return tx.supplementRequest.create({
      data: {
        applicationId: input.applicationId,
        category: input.category as PrismaSupplementCategory,
        reviewRunId: input.reviewRunId,
        categoryReviewId: input.categoryReviewId,
        title: input.title,
        reason: input.reason ?? null,
        suggestedMaterials:
          normalizedSuggestedMaterials === null
            ? Prisma.JsonNull
            : (normalizedSuggestedMaterials as Prisma.InputJsonValue),
        aiMessage: input.aiMessage ?? null,
        status: (input.status ?? "PENDING") as PrismaSupplementRequestStatus,
        isLatest: shouldBeLatest,
        isSatisfied: derivedIsSatisfied,
        satisfiedAt,
      },
    });
  });
}

export async function replaceLatestSupplementRequestsForCategory(
  input: ReplaceLatestSupplementRequestsInput,
) {
  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const now = new Date();

    for (const existing of store.supplementRequests) {
      if (
        existing.applicationId === input.applicationId &&
        existing.category === input.category &&
        existing.isLatest
      ) {
        existing.isLatest = false;
        existing.status = toHistoricalSupplementRequestStatus(existing);
        existing.updatedAt = now;
      }
    }

    const created = input.requests.map((request) => {
      const isSatisfied =
        request.isSatisfied ?? (request.status === "SATISFIED" ? true : false);
      const record: SupplementRequestRecord = {
        id: createId("supplement_request"),
        applicationId: input.applicationId,
        category: input.category,
        reviewRunId: input.reviewRunId,
        categoryReviewId: input.categoryReviewId,
        title: request.title,
        reason: request.reason ?? null,
        suggestedMaterials: normalizeSuggestedMaterials(request.suggestedMaterials),
        aiMessage: request.aiMessage ?? null,
        status: request.status ?? "PENDING",
        isLatest: true,
        isSatisfied,
        satisfiedAt: isSatisfied ? request.satisfiedAt ?? now : request.satisfiedAt ?? null,
        createdAt: now,
        updatedAt: now,
      };

      store.supplementRequests.push(record);
      return record;
    });

    return created;
  }

  const prisma = await getPrisma();
  return prisma.$transaction(async (tx) => {
    const currentLatest = await tx.supplementRequest.findMany({
      where: {
        applicationId: input.applicationId,
        category: input.category as PrismaSupplementCategory,
        isLatest: true,
      },
    });

    if (currentLatest.length > 0) {
      await Promise.all(
        currentLatest.map((request) =>
          tx.supplementRequest.update({
            where: { id: request.id },
            data: {
              isLatest: false,
              status: toHistoricalSupplementRequestStatus({
                isSatisfied: request.isSatisfied,
                status: request.status as SupplementRequestStatus,
              }) as PrismaSupplementRequestStatus,
            },
          }),
        ),
      );
    }

    const created: Awaited<ReturnType<typeof tx.supplementRequest.create>>[] = [];
    for (const request of input.requests) {
      const isSatisfied =
        request.isSatisfied ?? (request.status === "SATISFIED" ? true : false);

      created.push(
        await tx.supplementRequest.create({
          data: {
            applicationId: input.applicationId,
            category: input.category as PrismaSupplementCategory,
            reviewRunId: input.reviewRunId,
            categoryReviewId: input.categoryReviewId,
            title: request.title,
            reason: request.reason ?? null,
            suggestedMaterials:
              normalizeSuggestedMaterials(request.suggestedMaterials) === null
                ? Prisma.JsonNull
                : (normalizeSuggestedMaterials(
                    request.suggestedMaterials,
                  ) as Prisma.InputJsonValue),
            aiMessage: request.aiMessage ?? null,
            status: (request.status ?? "PENDING") as PrismaSupplementRequestStatus,
            isLatest: true,
            isSatisfied,
            satisfiedAt: isSatisfied
              ? request.satisfiedAt ?? new Date()
              : request.satisfiedAt ?? null,
          },
        }),
      );
    }

    return created;
  });
}

export async function updateSupplementRequest(
  requestId: string,
  data: {
    title?: string;
    reason?: string | null;
    suggestedMaterials?: string[] | string | null;
    aiMessage?: string | null;
    status?: SupplementRequestStatus;
    isLatest?: boolean;
    isSatisfied?: boolean;
    satisfiedAt?: Date | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const request = getMemoryStore().supplementRequests.find(
      (item) => item.id === requestId,
    );

    if (!request) {
      return null;
    }

    Object.assign(request, {
      ...(data.title === undefined ? {} : { title: data.title }),
      ...(data.reason === undefined ? {} : { reason: data.reason }),
      ...(data.suggestedMaterials === undefined
        ? {}
        : {
            suggestedMaterials: normalizeSuggestedMaterials(data.suggestedMaterials),
          }),
      ...(data.aiMessage === undefined ? {} : { aiMessage: data.aiMessage }),
      ...(data.status === undefined ? {} : { status: data.status }),
      ...(data.isLatest === undefined ? {} : { isLatest: data.isLatest }),
      ...(data.isSatisfied === undefined ? {} : { isSatisfied: data.isSatisfied }),
      ...(data.satisfiedAt === undefined ? {} : { satisfiedAt: data.satisfiedAt }),
      updatedAt: new Date(),
    });

    return request;
  }

  const prisma = await getPrisma();
  return prisma.supplementRequest.update({
    where: { id: requestId },
    data: {
      ...(data.title === undefined ? {} : { title: data.title }),
      ...(data.reason === undefined ? {} : { reason: data.reason }),
      ...(data.suggestedMaterials === undefined
        ? {}
        : {
            suggestedMaterials:
              normalizeSuggestedMaterials(data.suggestedMaterials) === null
                ? Prisma.JsonNull
                : (normalizeSuggestedMaterials(
                    data.suggestedMaterials,
                  ) as Prisma.InputJsonValue),
          }),
      ...(data.aiMessage === undefined ? {} : { aiMessage: data.aiMessage }),
      ...(data.status === undefined
        ? {}
        : { status: data.status as PrismaSupplementRequestStatus }),
      ...(data.isLatest === undefined ? {} : { isLatest: data.isLatest }),
      ...(data.isSatisfied === undefined ? {} : { isSatisfied: data.isSatisfied }),
      ...(data.satisfiedAt === undefined ? {} : { satisfiedAt: data.satisfiedAt }),
    },
  });
}

export async function createSupplementUploadBatch(input: {
  applicationId: string;
  category: SupplementCategory;
  status?: SupplementUploadBatchStatus;
  fileCount?: number;
  reviewRunId?: string | null;
  confirmedAt?: Date | null;
}) {
  if (getRuntimeMode() === "memory") {
    const now = new Date();
    const record: SupplementUploadBatchRecord = {
      id: createId("supplement_upload_batch"),
      applicationId: input.applicationId,
      category: input.category,
      status: input.status ?? "DRAFT",
      fileCount: input.fileCount ?? 0,
      reviewRunId: input.reviewRunId ?? null,
      confirmedAt: input.confirmedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };

    getMemoryStore().supplementUploadBatches.push(record);
    return record;
  }

  const prisma = await getPrisma();
  return prisma.supplementUploadBatch.create({
    data: {
      applicationId: input.applicationId,
      category: input.category as PrismaSupplementCategory,
      status: (input.status ?? "DRAFT") as PrismaSupplementUploadBatchStatus,
      fileCount: input.fileCount ?? 0,
      reviewRunId: input.reviewRunId ?? null,
      confirmedAt: input.confirmedAt ?? null,
    },
  });
}

export async function getSupplementUploadBatchById(batchId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().supplementUploadBatches.find((item) => item.id === batchId) ??
      null
    );
  }

  const prisma = await getPrisma();
  return prisma.supplementUploadBatch.findUnique({ where: { id: batchId } });
}

export async function getLatestDraftSupplementUploadBatch(
  applicationId: string,
  category: SupplementCategory,
) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().supplementUploadBatches
        .filter(
          (item) =>
            item.applicationId === applicationId &&
            item.category === category &&
            item.status === "DRAFT",
        )
        .sort(byLatestSupplementTimestampDesc)[0] ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.supplementUploadBatch.findFirst({
    where: {
      applicationId,
      category: category as PrismaSupplementCategory,
      status: "DRAFT",
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateSupplementUploadBatch(
  batchId: string,
  data: {
    status?: SupplementUploadBatchStatus;
    fileCount?: number;
    reviewRunId?: string | null;
    confirmedAt?: Date | null;
  },
) {
  if (getRuntimeMode() === "memory") {
    const batch = getMemoryStore().supplementUploadBatches.find(
      (item) => item.id === batchId,
    );

    if (!batch) {
      return null;
    }

    Object.assign(batch, data, { updatedAt: new Date() });
    return batch;
  }

  const prisma = await getPrisma();
  return prisma.supplementUploadBatch.update({
    where: { id: batchId },
    data: {
      ...(data.status === undefined
        ? {}
        : { status: data.status as PrismaSupplementUploadBatchStatus }),
      ...(data.fileCount === undefined ? {} : { fileCount: data.fileCount }),
      ...(data.reviewRunId === undefined ? {} : { reviewRunId: data.reviewRunId }),
      ...(data.confirmedAt === undefined ? {} : { confirmedAt: data.confirmedAt }),
    },
  });
}

export async function listSupplementFiles(
  applicationId: string,
  filters?: SupplementFileFilters,
) {
  if (getRuntimeMode() === "memory") {
    return getMemoryStore().supplementFiles
      .filter(
        (item) =>
          item.applicationId === applicationId &&
          matchesSupplementFileFilters(item, filters),
      )
      .sort(byDateDesc);
  }

  const prisma = await getPrisma();
  return prisma.supplementFile.findMany({
    where: {
      applicationId,
      ...(filters?.category === undefined
        ? {}
        : { category: filters.category as PrismaSupplementCategory }),
      ...(filters?.uploadBatchId === undefined
        ? {}
        : { uploadBatchId: filters.uploadBatchId }),
      ...(filters?.reviewRunId === undefined
        ? {}
        : { reviewRunId: filters.reviewRunId }),
      ...(filters?.supplementRequestId === undefined
        ? {}
        : { supplementRequestId: filters.supplementRequestId }),
      ...(filters?.includeDeleted === true ? {} : { isDeleted: false }),
    },
    orderBy: { uploadedAt: "desc" },
  });
}

export async function getSupplementFileById(fileId: string) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().supplementFiles.find((item) => item.id === fileId) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.supplementFile.findUnique({ where: { id: fileId } });
}

export async function findActiveSupplementFileDuplicate(
  applicationId: string,
  category: SupplementCategory,
  fileName: string,
  fileSize: number,
) {
  if (getRuntimeMode() === "memory") {
    return (
      getMemoryStore().supplementFiles.find(
        (item) =>
          item.applicationId === applicationId &&
          item.category === category &&
          item.fileName === fileName &&
          item.fileSize === fileSize &&
          !item.isDeleted,
      ) ?? null
    );
  }

  const prisma = await getPrisma();
  return prisma.supplementFile.findFirst({
    where: {
      applicationId,
      category: category as PrismaSupplementCategory,
      fileName,
      fileSize,
      isDeleted: false,
    },
  });
}

export async function createSupplementFile(input: {
  applicationId: string;
  category: SupplementCategory;
  supplementRequestId?: string | null;
  uploadBatchId: string;
  reviewRunId?: string | null;
  fileName: string;
  objectKey: string;
  fileType: string;
  fileSize: number;
  uploadedAt?: Date;
}) {
  const uploadedAt = input.uploadedAt ?? new Date();

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const batch = store.supplementUploadBatches.find(
      (item) => item.id === input.uploadBatchId,
    );

    if (!batch) {
      throw new Error("Supplement upload batch not found.");
    }

    if (batch.status !== "DRAFT") {
      throw new Error("Supplement files can only be added to a draft batch.");
    }

    validateSupplementFileBatchOwnership({
      applicationId: input.applicationId,
      category: input.category,
      batch,
    });

    const supplementRequest =
      input.supplementRequestId === undefined || input.supplementRequestId === null
        ? null
        : (store.supplementRequests.find(
            (item) => item.id === input.supplementRequestId,
          ) ?? null);

    validateSupplementRequestOwnership({
      applicationId: input.applicationId,
      category: input.category,
      request: supplementRequest,
    });

    const duplicate = store.supplementFiles.find(
      (item) =>
        item.applicationId === input.applicationId &&
        item.category === input.category &&
        item.fileName === input.fileName &&
        item.fileSize === input.fileSize &&
        !item.isDeleted,
    );

    if (duplicate) {
      return duplicate;
    }

    const now = new Date();
    const record: SupplementFileRecord = {
      id: createId("supplement_file"),
      applicationId: input.applicationId,
      category: input.category,
      supplementRequestId: input.supplementRequestId ?? null,
      uploadBatchId: input.uploadBatchId,
      reviewRunId: input.reviewRunId ?? null,
      fileName: input.fileName,
      objectKey: input.objectKey,
      fileType: input.fileType,
      fileSize: input.fileSize,
      isDeleted: false,
      deletedAt: null,
      uploadedAt,
      createdAt: now,
      updatedAt: now,
    };

    store.supplementFiles.push(record);
    batch.fileCount = store.supplementFiles.filter(
      (item) => item.uploadBatchId === batch.id && !item.isDeleted,
    ).length;
    batch.updatedAt = now;
    return record;
  }

  const prisma = await getPrisma();
  return prisma.$transaction(async (tx) => {
    const batch = await tx.supplementUploadBatch.findUnique({
      where: { id: input.uploadBatchId },
    });

    if (!batch) {
      throw new Error("Supplement upload batch not found.");
    }

    if (batch.status !== "DRAFT") {
      throw new Error("Supplement files can only be added to a draft batch.");
    }

    validateSupplementFileBatchOwnership({
      applicationId: input.applicationId,
      category: input.category,
      batch,
    });

    const supplementRequest =
      input.supplementRequestId === undefined || input.supplementRequestId === null
        ? null
        : await tx.supplementRequest.findUnique({
            where: { id: input.supplementRequestId },
          });

    validateSupplementRequestOwnership({
      applicationId: input.applicationId,
      category: input.category,
      request: supplementRequest
        ? {
            id: supplementRequest.id,
            applicationId: supplementRequest.applicationId,
            category: supplementRequest.category as SupplementCategory,
          }
        : null,
    });

    const duplicate = await tx.supplementFile.findFirst({
      where: {
        applicationId: input.applicationId,
        category: input.category as PrismaSupplementCategory,
        fileName: input.fileName,
        fileSize: input.fileSize,
        isDeleted: false,
      },
    });

    if (duplicate) {
      return duplicate;
    }

    const created = await tx.supplementFile.create({
      data: {
        applicationId: input.applicationId,
        category: input.category as PrismaSupplementCategory,
        supplementRequestId: input.supplementRequestId ?? null,
        uploadBatchId: input.uploadBatchId,
        reviewRunId: input.reviewRunId ?? null,
        fileName: input.fileName,
        objectKey: input.objectKey,
        fileType: input.fileType,
        fileSize: input.fileSize,
        uploadedAt,
      },
    });

    const activeCount = await tx.supplementFile.count({
      where: { uploadBatchId: input.uploadBatchId, isDeleted: false },
    });

    await tx.supplementUploadBatch.update({
      where: { id: input.uploadBatchId },
      data: { fileCount: activeCount },
    });

    return created;
  });
}

export async function softDeleteSupplementFile(
  fileId: string,
  deletedAt?: Date,
) {
  const deletedAtValue = deletedAt ?? new Date();

  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const file = store.supplementFiles.find((item) => item.id === fileId);

    if (!file) {
      return null;
    }

    const batch = store.supplementUploadBatches.find(
      (item) => item.id === file.uploadBatchId,
    );

    if (!batch) {
      throw new Error("Supplement upload batch not found.");
    }

    if (batch.status !== "DRAFT") {
      throw new Error("Only draft supplement batch files can be deleted.");
    }

    file.isDeleted = true;
    file.deletedAt = deletedAtValue;
    file.updatedAt = deletedAtValue;
    batch.fileCount = store.supplementFiles.filter(
      (item) => item.uploadBatchId === batch.id && !item.isDeleted,
    ).length;
    batch.updatedAt = deletedAtValue;
    return file;
  }

  const prisma = await getPrisma();
  return prisma.$transaction(async (tx) => {
    const file = await tx.supplementFile.findUnique({
      where: { id: fileId },
      include: { uploadBatch: true },
    });

    if (!file) {
      return null;
    }

    if (file.uploadBatch.status !== "DRAFT") {
      throw new Error("Only draft supplement batch files can be deleted.");
    }

    const updated = await tx.supplementFile.update({
      where: { id: fileId },
      data: {
        isDeleted: true,
        deletedAt: deletedAtValue,
      },
    });

    const activeCount = await tx.supplementFile.count({
      where: {
        uploadBatchId: file.uploadBatchId,
        isDeleted: false,
      },
    });

    await tx.supplementUploadBatch.update({
      where: { id: file.uploadBatchId },
      data: { fileCount: activeCount },
    });

    return updated;
  });
}

export async function attachSupplementFilesToReviewRun(
  uploadBatchId: string,
  reviewRunId: string,
) {
  if (getRuntimeMode() === "memory") {
    const store = getMemoryStore();
    const batch = store.supplementUploadBatches.find(
      (item) => item.id === uploadBatchId,
    );

    if (!batch) {
      throw new Error("Supplement upload batch not found.");
    }

    const reviewRun = store.materialReviewRuns.find((item) => item.id === reviewRunId);

    if (!reviewRun) {
      throw new Error("Material review run not found.");
    }

    validateBatchAndReviewRunCompatibility({
      batch,
      reviewRun,
    });

    const now = new Date();
    const files = store.supplementFiles
      .filter((item) => item.uploadBatchId === uploadBatchId && !item.isDeleted)
      .map((item) => {
        item.reviewRunId = reviewRunId;
        item.updatedAt = now;
        return item;
      });

    batch.reviewRunId = reviewRunId;
    batch.status = "REVIEWING";
    batch.confirmedAt ??= now;
    batch.updatedAt = now;

    return { batch, files };
  }

  const prisma = await getPrisma();
  return prisma.$transaction(async (tx) => {
    const batch = await tx.supplementUploadBatch.findUnique({
      where: { id: uploadBatchId },
    });

    if (!batch) {
      throw new Error("Supplement upload batch not found.");
    }

    const reviewRun = await tx.materialReviewRun.findUnique({
      where: { id: reviewRunId },
    });

    if (!reviewRun) {
      throw new Error("Material review run not found.");
    }

    validateBatchAndReviewRunCompatibility({
      batch: {
        applicationId: batch.applicationId,
        category: batch.category as SupplementCategory,
      },
      reviewRun: {
        applicationId: reviewRun.applicationId,
        triggeredCategory:
          (reviewRun.triggeredCategory as SupplementCategory | null) ?? null,
      },
    });

    await tx.supplementFile.updateMany({
      where: { uploadBatchId, isDeleted: false },
      data: { reviewRunId },
    });

    const updatedBatch = await tx.supplementUploadBatch.update({
      where: { id: uploadBatchId },
      data: {
        reviewRunId,
        status: "REVIEWING",
        confirmedAt: batch.confirmedAt ?? new Date(),
      },
    });

    const files = await tx.supplementFile.findMany({
      where: { uploadBatchId, isDeleted: false },
      orderBy: { uploadedAt: "desc" },
    });

    return {
      batch: updatedBatch,
      files,
    };
  });
}

export async function getMaterialSupplementSummaryData(
  applicationId: string,
): Promise<MaterialSupplementSummaryData> {
  const [reviewRuns, latestCategoryReviews, latestRequests] = await Promise.all([
    listMaterialReviewRuns(applicationId),
    listMaterialCategoryReviews(applicationId, { isLatest: true }),
    listLatestSupplementRequests(applicationId),
  ]);

  const latestRun = reviewRuns[0] ?? null;
  const latestReviewedAt =
    latestCategoryReviews
      .map((item) => getLatestSupplementTimestamp(item))
      .filter((item): item is Date => item instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ??
    getLatestSupplementTimestamp(latestRun ?? {}) ??
    null;

  const latestCategoryReviewStatuses = Object.fromEntries(
    latestCategoryReviews.map((review) => [review.category, review.status]),
  ) as Partial<Record<SupplementCategory, MaterialCategoryReviewStatus>>;

  return {
    applicationId,
    materialSupplementStatus: deriveMaterialSupplementStatus({
      latestRun: latestRun as MaterialReviewRunRecord | null,
      latestCategoryReviews: latestCategoryReviews as MaterialCategoryReviewRecord[],
      latestRequests: latestRequests as SupplementRequestRecord[],
    }),
    latestReviewRunId: latestRun?.id ?? null,
    latestReviewedAt: latestReviewedAt?.toISOString() ?? null,
    pendingRequestCount: latestRequests.filter(isSupplementRequestPending).length,
    satisfiedRequestCount: latestRequests.filter(isSupplementRequestSatisfied).length,
    remainingReviewRounds: Math.max(
      0,
      SUPPLEMENT_REVIEW_MAX_ROUNDS - reviewRuns.length,
    ),
    supportedCategories: [...SUPPORTED_SUPPLEMENT_CATEGORIES],
    latestRunStatus: latestRun?.status ?? null,
    latestCategoryReviewStatuses,
  };
}

export async function getMaterialSupplementSnapshotData(
  applicationId: string,
): Promise<SupplementSnapshot> {
  const [summary, latestCategoryReviews, latestRequests, files, batches] =
    await Promise.all([
      getMaterialSupplementSummaryData(applicationId),
      listMaterialCategoryReviews(applicationId, { isLatest: true }),
      listLatestSupplementRequests(applicationId),
      listSupplementFiles(applicationId),
      (async () => {
        if (getRuntimeMode() === "memory") {
          return getMemoryStore().supplementUploadBatches
            .filter((item) => item.applicationId === applicationId)
            .sort(byLatestSupplementTimestampDesc);
        }

        const prisma = await getPrisma();
        return prisma.supplementUploadBatch.findMany({
          where: { applicationId },
          orderBy: { createdAt: "desc" },
        });
      })(),
    ]);

  const categories = SUPPORTED_SUPPLEMENT_CATEGORIES.map((category) => {
    const latestReview =
      latestCategoryReviews.find((item) => item.category === category) ?? null;
    const requests = latestRequests
      .filter((item) => item.category === category)
      .sort(byLatestSupplementTimestampDesc);
    const draftBatchIds = batches
      .filter((item) => item.category === category && item.status === "DRAFT")
      .map((item) => item.id);
    const waitingBatchIds = batches
      .filter(
        (item) =>
          item.category === category &&
          (item.status === "CONFIRMED" || item.status === "REVIEWING"),
      )
      .map((item) => item.id);
    const draftFiles = files.filter((item) => draftBatchIds.includes(item.uploadBatchId));
    const waitingReviewFiles = files.filter((item) =>
      waitingBatchIds.includes(item.uploadBatchId),
    );

    return {
      category,
      label: SUPPLEMENT_CATEGORY_LABELS[category],
      status: deriveSupplementCategoryDisplayStatus({
        latestReview: latestReview as MaterialCategoryReviewRecord | null,
        latestRequests: requests as SupplementRequestRecord[],
      }),
      isReviewing:
        latestReview?.status === "QUEUED" || latestReview?.status === "PROCESSING",
      latestCategoryReviewId: latestReview?.id ?? null,
      latestReviewedAt:
        getLatestSupplementTimestamp(
          (latestReview as MaterialCategoryReviewRecord | null) ?? {},
        )?.toISOString() ?? null,
      aiMessage: latestReview?.aiMessage ?? null,
      pendingRequestCount: requests.filter(isSupplementRequestPending).length,
      requests: requests.map((item) =>
        toSupplementRequestSummary(item as SupplementRequestRecord),
      ),
      draftFiles: draftFiles.map((item) =>
        toSupplementFileSummary(item as SupplementFileRecord),
      ),
      waitingReviewFiles: waitingReviewFiles.map((item) =>
        toSupplementFileSummary(item as SupplementFileRecord),
      ),
    };
  });

  return {
    applicationId,
    summary: {
      materialSupplementStatus: summary.materialSupplementStatus,
      latestReviewRunId: summary.latestReviewRunId,
      latestReviewedAt: summary.latestReviewedAt,
      pendingRequestCount: summary.pendingRequestCount,
      satisfiedRequestCount: summary.satisfiedRequestCount,
      remainingReviewRounds: summary.remainingReviewRounds,
    },
    categories,
  };
}

export async function getMaterialSupplementHistoryData(
  applicationId: string,
  filters?: SupplementHistoryFilters,
): Promise<{
  applicationId: string;
  filters: { category: SupplementCategory | null; runNo: number | null };
  items: SupplementHistoryItem[];
}> {
  const [categoryReviews, reviewRuns, requests, files] = await Promise.all([
    listMaterialCategoryReviews(applicationId, {
      ...(filters?.category === undefined ? {} : { category: filters.category }),
    }),
    listMaterialReviewRuns(applicationId),
    listSupplementRequests(applicationId),
    listSupplementFiles(applicationId),
  ]);

  const runNoById = new Map(reviewRuns.map((item) => [item.id, item.runNo]));

  const items = categoryReviews
    .filter((review) => {
      if (filters?.runNo === undefined) {
        return true;
      }

      return runNoById.get(review.reviewRunId) === filters.runNo;
    })
    .sort((left, right) => {
      const runNoDiff =
        (runNoById.get(right.reviewRunId) ?? 0) -
        (runNoById.get(left.reviewRunId) ?? 0);
      if (runNoDiff !== 0) {
        return runNoDiff;
      }

      return byLatestSupplementTimestampDesc(left, right);
    })
    .map((review) => ({
      reviewRunId: review.reviewRunId,
      runNo: runNoById.get(review.reviewRunId) ?? 0,
      category: review.category,
      categoryReviewId: review.id,
      status: review.status,
      isLatest: review.isLatest,
      reviewedAt:
        getLatestSupplementTimestamp(review as MaterialCategoryReviewRecord)?.toISOString() ??
        null,
      aiMessage: review.aiMessage,
      files: files
        .filter(
          (file) =>
            file.reviewRunId === review.reviewRunId && file.category === review.category,
        )
        .map((file) => toSupplementFileSummary(file as SupplementFileRecord)),
      requests: requests
        .filter((request) => request.categoryReviewId === review.id)
        .sort(byLatestSupplementTimestampDesc)
        .map((request) => {
          const summary = toSupplementRequestSummary(request as SupplementRequestRecord);
          return {
            id: summary.id,
            title: summary.title,
            reason: summary.reason,
            aiMessage: summary.aiMessage,
            status: summary.status,
            isSatisfied: summary.isSatisfied,
            updatedAt: summary.updatedAt,
          };
        }),
    }));

  return {
    applicationId,
    filters: {
      category: filters?.category ?? null,
      runNo: filters?.runNo ?? null,
    },
    items,
  };
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

function toExtractionReviewSnapshot(
  review:
    | ResumeExtractionReviewRecord
    | {
        id: string;
        analysisJobId: string;
        externalJobId: string | null;
        status: ResumeExtractionReviewStatus;
        extractedFields: unknown;
        rawExtractionResponse: string | null;
        errorMessage: string | null;
        confirmedAt: Date | null;
        updatedAt: Date;
      }
    | null,
) {
  if (!review) {
    return null;
  }

  const extractedFields =
    typeof review.extractedFields === "object" &&
    review.extractedFields !== null &&
    !Array.isArray(review.extractedFields)
      ? (review.extractedFields as Record<string, unknown>)
      : {};

  return {
    id: review.id,
    analysisJobId: review.analysisJobId,
    externalJobId: review.externalJobId ?? null,
    status: review.status,
    extractedFields,
    rawExtractionResponse: review.rawExtractionResponse ?? null,
    errorMessage: review.errorMessage ?? null,
    confirmedAt: review.confirmedAt?.toISOString() ?? null,
    updatedAt: review.updatedAt.toISOString(),
  };
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
  const latestExtractionReview =
    store.extractionReviews
      .filter((item) => item.applicationId === application.id)
      .sort(byDateDesc)[0] ?? null;
  const materials = store.materials.filter(
    (item) => item.applicationId === application.id && !item.isDeleted,
  );
  const mergedExtractedFields = latestResult
    ? mergeStoredScreeningContactValuesIntoExtractedFields(
        latestResult.extractedFields,
        application,
      )
    : null;
  const mergedMissingFields = latestResult
    ? mergeMissingFieldsWithScreeningContactRequirements(
        latestResult.missingFields,
        application.eligibilityResult,
        mergedExtractedFields ?? latestResult.extractedFields,
        application,
      )
    : [];

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
    screeningWorkEmail: application.screeningWorkEmail,
    screeningPhoneNumber: application.screeningPhoneNumber,
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
    latestExtractionReview: toExtractionReviewSnapshot(latestExtractionReview),
    latestResult: latestResult
      ? {
          displaySummary: latestResult.displaySummary,
          reasonText: latestResult.reasonText,
          missingFields: enrichMissingFieldsWithRegistry(mergedMissingFields),
          extractedFields: mergedExtractedFields ?? latestResult.extractedFields,
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
  const [
    latestResumeFile,
    latestAnalysisJob,
    latestResult,
    latestExtractionReview,
    materials,
  ] =
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
      prisma.resumeExtractionReview.findFirst({
        where: { applicationId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.applicationMaterial.findMany({
        where: { applicationId, isDeleted: false },
      }),
    ]);

  const applicationRow = application as ApplicationRecord;
  const latestResultMissingFields =
    (latestResult?.missingFields as MissingField[] | null) ?? [];
  const latestResultExtractedFields =
    (latestResult?.extractedFields as Record<string, unknown> | null) ?? {};
  const mergedExtractedFields = mergeStoredScreeningContactValuesIntoExtractedFields(
    latestResultExtractedFields,
    applicationRow,
  );
  const mergedMissingFields = mergeMissingFieldsWithScreeningContactRequirements(
    latestResultMissingFields,
    application.eligibilityResult,
    mergedExtractedFields,
    applicationRow,
  );

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
    screeningWorkEmail: applicationRow.screeningWorkEmail ?? null,
    screeningPhoneNumber: applicationRow.screeningPhoneNumber ?? null,
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
    latestExtractionReview: toExtractionReviewSnapshot(
      latestExtractionReview
        ? {
            ...latestExtractionReview,
            extractedFields: latestExtractionReview.extractedFields,
            status: latestExtractionReview.status as ResumeExtractionReviewStatus,
          }
        : null,
    ),
    latestResult: latestResult
      ? {
          displaySummary: latestResult.displaySummary,
          reasonText: latestResult.reasonText,
          missingFields: enrichMissingFieldsWithRegistry(mergedMissingFields),
          extractedFields: mergedExtractedFields,
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
