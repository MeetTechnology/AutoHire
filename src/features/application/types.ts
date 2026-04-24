import type { MissingField } from "@/features/analysis/types";
import type { SecondaryVisibleField } from "@/features/analysis/secondary";
import type { EditableSecondaryField } from "@/features/analysis/types";

export type ApplicationStatus =
  | "INIT"
  | "INTRO_VIEWED"
  | "CV_UPLOADED"
  | "CV_ANALYZING"
  | "INFO_REQUIRED"
  | "REANALYZING"
  | "INELIGIBLE"
  | "ELIGIBLE"
  | "SECONDARY_ANALYZING"
  | "SECONDARY_REVIEW"
  | "SECONDARY_FAILED"
  | "MATERIALS_IN_PROGRESS"
  | "SUBMITTED"
  | "CLOSED";

export type AnalysisJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type SecondaryAnalysisStatus =
  | "idle"
  | "pending"
  | "processing"
  | "retrying"
  | "completed"
  | "completed_partial"
  | "failed";

export type EligibilityResult =
  | "UNKNOWN"
  | "INSUFFICIENT_INFO"
  | "ELIGIBLE"
  | "INELIGIBLE";

export type MaterialCategory =
  | "IDENTITY"
  | "EMPLOYMENT"
  | "EDUCATION"
  | "HONOR"
  | "PATENT"
  | "PROJECT"
  | "PAPER"
  | "BOOK"
  | "CONFERENCE"
  | "PRODUCT";

export type MaterialSummary = Record<Lowercase<MaterialCategory>, number>;

export type ApplicationFeedbackStatus = "DRAFT" | "SUBMITTED";

export type FeedbackDeviceType = "desktop" | "tablet" | "mobile" | "unknown";

export type ApplicationFeedbackContext = {
  currentUrl?: string | null;
  pageTitle?: string | null;
  flowName?: string | null;
  flowStep?: string | null;
  browserInfo?: string | null;
  deviceType?: FeedbackDeviceType | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  isLoggedIn?: boolean | null;
  userId?: string | null;
  surface?: string | null;
};

export type UploadedFileSummary = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  category?: MaterialCategory;
};

export type SecondaryAnalysisRunSummary = {
  id: string | null;
  status: SecondaryAnalysisStatus | null;
  totalPrompts: number | null;
  completedPrompts: number | null;
  failedPromptIds: string[];
  errorMessage: string | null;
};

export type SecondaryAnalysisSnapshot = {
  runId: string | null;
  status: SecondaryAnalysisStatus;
  errorMessage: string | null;
  fields: SecondaryVisibleField[];
  run: SecondaryAnalysisRunSummary | null;
};

export type EditableSecondaryAnalysisSnapshot = {
  runId: string | null;
  status: SecondaryAnalysisStatus;
  errorMessage: string | null;
  fields: EditableSecondaryField[];
  run: SecondaryAnalysisRunSummary | null;
  missingCount: number;
  savedAt: string | null;
};

export type ApplicationSnapshot = {
  applicationId: string;
  expertId: string;
  invitationId: string;
  applicationStatus: ApplicationStatus;
  currentStep: string | null;
  eligibilityResult: EligibilityResult;
  latestAnalysisJobId: string | null;
  screeningPassportFullName: string | null;
  screeningContactEmail: string | null;
  screeningWorkEmail: string | null;
  screeningPhoneNumber: string | null;
  resumeAnalysisStatus: AnalysisJobStatus | null;
  latestResumeFile: UploadedFileSummary | null;
  latestResult: {
    displaySummary: string | null;
    reasonText: string | null;
    missingFields: MissingField[];
    extractedFields: Record<string, unknown>;
  } | null;
  uploadedMaterialsSummary: MaterialSummary;
  productInnovationDescription: string | null;
  submittedAt: string | null;
};

export type ApplicationFeedbackSnapshot = {
  status: ApplicationFeedbackStatus;
  rating: number | null;
  comment: string;
  draftSavedAt: string | null;
  submittedAt: string | null;
};
