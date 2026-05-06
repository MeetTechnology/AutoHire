export type SupplementCategory =
  | "IDENTITY"
  | "EDUCATION"
  | "EMPLOYMENT"
  | "PROJECT"
  | "PATENT"
  | "HONOR";

export type MaterialReviewRunStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type MaterialCategoryReviewStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type SupplementRequestStatus =
  | "PENDING"
  | "UPLOADED_WAITING_REVIEW"
  | "REVIEWING"
  | "SATISFIED"
  | "HISTORY_ONLY";

export type SupplementUploadBatchStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "REVIEWING"
  | "COMPLETED"
  | "CANCELLED";

export type MaterialSupplementStatus =
  | "NOT_STARTED"
  | "REVIEWING"
  | "SUPPLEMENT_REQUIRED"
  | "NO_SUPPLEMENT_REQUIRED"
  | "PARTIALLY_SATISFIED"
  | "SATISFIED";

export type SupplementCategoryDisplayStatus =
  | "NOT_STARTED"
  | "REVIEWING"
  | "SUPPLEMENT_REQUIRED"
  | "NO_SUPPLEMENT_REQUIRED"
  | "PARTIALLY_SATISFIED"
  | "SATISFIED"
  | "REVIEW_FAILED";

export type SupplementFileSummary = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
};

export type SupplementRequestSummary = {
  id: string;
  title: string;
  reason: string | null;
  suggestedMaterials: string[] | string | null;
  aiMessage: string | null;
  status: SupplementRequestStatus;
  isSatisfied: boolean;
  updatedAt: string;
};

export type SupplementSummary = {
  applicationId: string;
  materialSupplementStatus: MaterialSupplementStatus;
  latestReviewRunId: string | null;
  latestReviewedAt: string | null;
  pendingRequestCount: number;
  satisfiedRequestCount: number;
  remainingReviewRounds: number;
  supportedCategories: SupplementCategory[];
};

export type SupplementCategorySnapshot = {
  category: SupplementCategory;
  label: string;
  status: SupplementCategoryDisplayStatus;
  isReviewing: boolean;
  latestCategoryReviewId: string | null;
  latestReviewedAt: string | null;
  aiMessage: string | null;
  pendingRequestCount: number;
  requests: SupplementRequestSummary[];
  draftFiles: SupplementFileSummary[];
  waitingReviewFiles: SupplementFileSummary[];
};

export type SupplementSnapshot = {
  applicationId: string;
  summary: Omit<SupplementSummary, "applicationId" | "supportedCategories">;
  categories: SupplementCategorySnapshot[];
};

export type SupplementHistoryItem = {
  reviewRunId: string;
  runNo: number;
  category: SupplementCategory;
  categoryReviewId: string;
  status: MaterialCategoryReviewStatus;
  isLatest: boolean;
  reviewedAt: string | null;
  aiMessage: string | null;
  files: SupplementFileSummary[];
  requests: Array<
    Omit<SupplementRequestSummary, "suggestedMaterials" | "updatedAt"> & {
      updatedAt?: string;
    }
  >;
};
