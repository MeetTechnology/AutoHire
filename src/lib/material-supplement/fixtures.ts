import type {
  MaterialCategoryReviewStatus,
  MaterialReviewRunStatus,
  SupplementCategory,
  SupplementRequestStatus,
  SupplementUploadBatchStatus,
} from "@/features/material-supplement/types";

type MaterialReviewTriggerType =
  | "INITIAL_SUBMISSION"
  | "SUPPLEMENT_UPLOAD"
  | "MANUAL_RETRY";

export type MaterialSupplementSampleScenario =
  | "reviewing"
  | "required"
  | "satisfied";

export type MaterialReviewRunFixture = {
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

export type MaterialCategoryReviewFixture = {
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

export type SupplementRequestFixture = {
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

export type SupplementUploadBatchFixture = {
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

export type SupplementFileFixture = {
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

export type MaterialSupplementScenarioFixtures = {
  scenario: MaterialSupplementSampleScenario;
  applicationId: string;
  materialReviewRuns: MaterialReviewRunFixture[];
  materialCategoryReviews: MaterialCategoryReviewFixture[];
  supplementRequests: SupplementRequestFixture[];
  supplementUploadBatches: SupplementUploadBatchFixture[];
  supplementFiles: SupplementFileFixture[];
};

export type MaterialSupplementSampleFixtures = {
  scenarios: Record<
    MaterialSupplementSampleScenario,
    MaterialSupplementScenarioFixtures
  >;
  materialReviewRuns: MaterialReviewRunFixture[];
  materialCategoryReviews: MaterialCategoryReviewFixture[];
  supplementRequests: SupplementRequestFixture[];
  supplementUploadBatches: SupplementUploadBatchFixture[];
  supplementFiles: SupplementFileFixture[];
};

export const MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS = {
  reviewing: "app_supplement_reviewing",
  required: "app_supplement_required",
  satisfied: "app_supplement_satisfied",
} as const;

function buildReviewingScenario(now: Date): MaterialSupplementScenarioFixtures {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const ninetyMinutesAgo = new Date(now.getTime() - 90 * 60 * 1000);
  const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  return {
    scenario: "reviewing",
    applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
    materialReviewRuns: [
      {
        id: "mr_run_reviewing_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
        runNo: 1,
        status: "COMPLETED",
        triggerType: "INITIAL_SUBMISSION",
        triggeredCategory: null,
        externalRunId: "mock-material-review-reviewing-initial",
        errorMessage: null,
        startedAt: twoHoursAgo,
        finishedAt: ninetyMinutesAgo,
        createdAt: twoHoursAgo,
        updatedAt: ninetyMinutesAgo,
      },
      {
        id: "mr_run_reviewing_identity_retry",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
        runNo: 2,
        status: "PROCESSING",
        triggerType: "SUPPLEMENT_UPLOAD",
        triggeredCategory: "IDENTITY",
        externalRunId: "mock-material-review-reviewing-identity",
        errorMessage: null,
        startedAt: thirtyMinutesAgo,
        finishedAt: null,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    materialCategoryReviews: [
      {
        id: "mcr_reviewing_identity_initial",
        reviewRunId: "mr_run_reviewing_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
        category: "IDENTITY",
        roundNo: 1,
        status: "COMPLETED",
        aiMessage: "Please provide a clearer proof-of-identity document.",
        resultPayload: { supplementRequired: true, requests: 1 },
        isLatest: false,
        startedAt: twoHoursAgo,
        finishedAt: ninetyMinutesAgo,
        createdAt: twoHoursAgo,
        updatedAt: ninetyMinutesAgo,
      },
      {
        id: "mcr_reviewing_identity_retry",
        reviewRunId: "mr_run_reviewing_identity_retry",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
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
    ],
    supplementRequests: [
      {
        id: "supp_req_reviewing_identity_history",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
        category: "IDENTITY",
        reviewRunId: "mr_run_reviewing_initial",
        categoryReviewId: "mcr_reviewing_identity_initial",
        title: "Upload a full passport scan",
        reason: "The previous upload did not show all identification details.",
        suggestedMaterials: ["Passport", "National ID card"],
        aiMessage: "A full document scan is required for identity verification.",
        status: "SATISFIED",
        isLatest: false,
        isSatisfied: true,
        satisfiedAt: fortyMinutesAgo,
        createdAt: ninetyMinutesAgo,
        updatedAt: fortyMinutesAgo,
      },
    ],
    supplementUploadBatches: [
      {
        id: "supp_batch_reviewing_identity_reviewing",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
        category: "IDENTITY",
        status: "REVIEWING",
        fileCount: 1,
        reviewRunId: "mr_run_reviewing_identity_retry",
        confirmedAt: thirtyMinutesAgo,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    supplementFiles: [
      {
        id: "supp_file_reviewing_identity_reviewing",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.reviewing,
        category: "IDENTITY",
        supplementRequestId: null,
        uploadBatchId: "supp_batch_reviewing_identity_reviewing",
        reviewRunId: "mr_run_reviewing_identity_retry",
        fileName: "passport-fullscan.pdf",
        objectKey:
          "applications/app_supplement_reviewing/supplements/IDENTITY/passport-fullscan.pdf",
        fileType: "application/pdf",
        fileSize: 4096,
        isDeleted: false,
        deletedAt: null,
        uploadedAt: thirtyMinutesAgo,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
  };
}

function buildRequiredScenario(now: Date): MaterialSupplementScenarioFixtures {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fiftyMinutesAgo = new Date(now.getTime() - 50 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  return {
    scenario: "required",
    applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
    materialReviewRuns: [
      {
        id: "mr_run_required_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        runNo: 1,
        status: "COMPLETED",
        triggerType: "INITIAL_SUBMISSION",
        triggeredCategory: null,
        externalRunId: "mock-material-review-required-initial",
        errorMessage: null,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: "mr_run_required_identity_resolved",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        runNo: 2,
        status: "COMPLETED",
        triggerType: "SUPPLEMENT_UPLOAD",
        triggeredCategory: "IDENTITY",
        externalRunId: "mock-material-review-required-identity-resolved",
        errorMessage: null,
        startedAt: fiftyMinutesAgo,
        finishedAt: thirtyMinutesAgo,
        createdAt: fiftyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    materialCategoryReviews: [
      {
        id: "mcr_required_employment_initial",
        reviewRunId: "mr_run_required_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
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
        id: "mcr_required_identity_initial",
        reviewRunId: "mr_run_required_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "IDENTITY",
        roundNo: 1,
        status: "COMPLETED",
        aiMessage: "A previously requested identity supplement has been resolved.",
        resultPayload: { supplementRequired: true, requests: 1 },
        isLatest: false,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: "mcr_required_identity_resolved",
        reviewRunId: "mr_run_required_identity_resolved",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "IDENTITY",
        roundNo: 2,
        status: "COMPLETED",
        aiMessage: "The re-uploaded identity document now satisfies the request.",
        resultPayload: { supplementRequired: false, requests: 1 },
        isLatest: true,
        startedAt: fiftyMinutesAgo,
        finishedAt: thirtyMinutesAgo,
        createdAt: fiftyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    supplementRequests: [
      {
        id: "supp_req_required_identity_history",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "IDENTITY",
        reviewRunId: "mr_run_required_initial",
        categoryReviewId: "mcr_required_identity_initial",
        title: "Upload a clearer passport scan",
        reason: "The initial passport scan was cropped.",
        suggestedMaterials: ["Passport"],
        aiMessage: "A clearer identity document is required.",
        status: "SATISFIED",
        isLatest: false,
        isSatisfied: true,
        satisfiedAt: thirtyMinutesAgo,
        createdAt: oneHourAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        id: "supp_req_required_identity_latest",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "IDENTITY",
        reviewRunId: "mr_run_required_identity_resolved",
        categoryReviewId: "mcr_required_identity_resolved",
        title: "Upload a clearer passport scan",
        reason: "The initial passport scan was cropped.",
        suggestedMaterials: ["Passport"],
        aiMessage: "The identity document has already been accepted after re-upload.",
        status: "SATISFIED",
        isLatest: true,
        isSatisfied: true,
        satisfiedAt: thirtyMinutesAgo,
        createdAt: fiftyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
      {
        id: "supp_req_required_employment_latest",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "EMPLOYMENT",
        reviewRunId: "mr_run_required_initial",
        categoryReviewId: "mcr_required_employment_initial",
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
    ],
    supplementUploadBatches: [
      {
        id: "supp_batch_required_employment_draft",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "EMPLOYMENT",
        status: "DRAFT",
        fileCount: 1,
        reviewRunId: null,
        confirmedAt: null,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
    supplementFiles: [
      {
        id: "supp_file_required_employment_draft",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.required,
        category: "EMPLOYMENT",
        supplementRequestId: "supp_req_required_employment_latest",
        uploadBatchId: "supp_batch_required_employment_draft",
        reviewRunId: null,
        fileName: "employment-proof.pdf",
        objectKey:
          "applications/app_supplement_required/supplements/EMPLOYMENT/employment-proof.pdf",
        fileType: "application/pdf",
        fileSize: 2048,
        isDeleted: false,
        deletedAt: null,
        uploadedAt: thirtyMinutesAgo,
        createdAt: thirtyMinutesAgo,
        updatedAt: thirtyMinutesAgo,
      },
    ],
  };
}

function buildSatisfiedScenario(now: Date): MaterialSupplementScenarioFixtures {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);

  return {
    scenario: "satisfied",
    applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
    materialReviewRuns: [
      {
        id: "mr_run_satisfied_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
        runNo: 1,
        status: "COMPLETED",
        triggerType: "INITIAL_SUBMISSION",
        triggeredCategory: null,
        externalRunId: "mock-material-review-satisfied-initial",
        errorMessage: null,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
    ],
    materialCategoryReviews: [
      {
        id: "mcr_satisfied_honor_initial",
        reviewRunId: "mr_run_satisfied_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
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
      {
        id: "mcr_satisfied_employment_initial",
        reviewRunId: "mr_run_satisfied_initial",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
        category: "EMPLOYMENT",
        roundNo: 1,
        status: "COMPLETED",
        aiMessage: "The uploaded employment proof has satisfied the request.",
        resultPayload: { supplementRequired: true, requests: 1 },
        isLatest: false,
        startedAt: twoHoursAgo,
        finishedAt: oneHourAgo,
        createdAt: twoHoursAgo,
        updatedAt: oneHourAgo,
      },
    ],
    supplementRequests: [
      {
        id: "supp_req_satisfied_honor_latest",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
        category: "HONOR",
        reviewRunId: "mr_run_satisfied_initial",
        categoryReviewId: "mcr_satisfied_honor_initial",
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
      {
        id: "supp_req_satisfied_employment_history",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
        category: "EMPLOYMENT",
        reviewRunId: "mr_run_satisfied_initial",
        categoryReviewId: "mcr_satisfied_employment_initial",
        title: "Upload recent employment proof",
        reason: "The current employer evidence is missing.",
        suggestedMaterials: ["Employment certificate", "Current contract"],
        aiMessage: "The uploaded evidence has already been accepted.",
        status: "SATISFIED",
        isLatest: false,
        isSatisfied: true,
        satisfiedAt: fortyMinutesAgo,
        createdAt: oneHourAgo,
        updatedAt: fortyMinutesAgo,
      },
    ],
    supplementUploadBatches: [
      {
        id: "supp_batch_satisfied_employment_completed",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
        category: "EMPLOYMENT",
        status: "COMPLETED",
        fileCount: 1,
        reviewRunId: "mr_run_satisfied_initial",
        confirmedAt: oneHourAgo,
        createdAt: oneHourAgo,
        updatedAt: fortyMinutesAgo,
      },
    ],
    supplementFiles: [
      {
        id: "supp_file_satisfied_employment_completed",
        applicationId: MATERIAL_SUPPLEMENT_SAMPLE_APPLICATION_IDS.satisfied,
        category: "EMPLOYMENT",
        supplementRequestId: "supp_req_satisfied_employment_history",
        uploadBatchId: "supp_batch_satisfied_employment_completed",
        reviewRunId: "mr_run_satisfied_initial",
        fileName: "employment-proof-final.pdf",
        objectKey:
          "applications/app_supplement_satisfied/supplements/EMPLOYMENT/employment-proof-final.pdf",
        fileType: "application/pdf",
        fileSize: 3072,
        isDeleted: false,
        deletedAt: null,
        uploadedAt: oneHourAgo,
        createdAt: oneHourAgo,
        updatedAt: fortyMinutesAgo,
      },
    ],
  };
}

export function getMaterialSupplementSampleFixtures(
  now: Date = new Date(),
): MaterialSupplementSampleFixtures {
  const scenarios = {
    reviewing: buildReviewingScenario(now),
    required: buildRequiredScenario(now),
    satisfied: buildSatisfiedScenario(now),
  } satisfies Record<
    MaterialSupplementSampleScenario,
    MaterialSupplementScenarioFixtures
  >;

  return {
    scenarios,
    materialReviewRuns: Object.values(scenarios).flatMap(
      (scenario) => scenario.materialReviewRuns,
    ),
    materialCategoryReviews: Object.values(scenarios).flatMap(
      (scenario) => scenario.materialCategoryReviews,
    ),
    supplementRequests: Object.values(scenarios).flatMap(
      (scenario) => scenario.supplementRequests,
    ),
    supplementUploadBatches: Object.values(scenarios).flatMap(
      (scenario) => scenario.supplementUploadBatches,
    ),
    supplementFiles: Object.values(scenarios).flatMap(
      (scenario) => scenario.supplementFiles,
    ),
  };
}
