import type { MissingField } from "@/features/analysis/types";

export type ApplicationStatus =
  | "INIT"
  | "INTRO_VIEWED"
  | "CV_UPLOADED"
  | "CV_ANALYZING"
  | "INFO_REQUIRED"
  | "REANALYZING"
  | "INELIGIBLE"
  | "ELIGIBLE"
  | "MATERIALS_IN_PROGRESS"
  | "SUBMITTED"
  | "CLOSED";

export type AnalysisJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

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
  | "PROJECT";

export type MaterialSummary = Record<Lowercase<MaterialCategory>, number>;

export type UploadedFileSummary = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  category?: MaterialCategory;
};

export type ApplicationSnapshot = {
  applicationId: string;
  expertId: string;
  invitationId: string;
  applicationStatus: ApplicationStatus;
  currentStep: string | null;
  eligibilityResult: EligibilityResult;
  latestAnalysisJobId: string | null;
  resumeAnalysisStatus: AnalysisJobStatus | null;
  latestResumeFile: UploadedFileSummary | null;
  latestResult: {
    displaySummary: string | null;
    reasonText: string | null;
    missingFields: MissingField[];
    extractedFields: Record<string, unknown>;
  } | null;
  uploadedMaterialsSummary: MaterialSummary;
  submittedAt: string | null;
};
