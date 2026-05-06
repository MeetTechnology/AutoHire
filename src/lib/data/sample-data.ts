import { hashInviteToken } from "@/lib/auth/token";

export const SAMPLE_TOKENS = {
  init: "sample-init-token",
  progress: "sample-progress-token",
  extraction: "sample-extraction-token",
  extractionReview: "sample-extraction-review-token",
  submitted: "sample-submitted-token",
  supplementReviewing: "sample-supplement-reviewing-token",
  supplementRequired: "sample-supplement-required-token",
  supplementSatisfied: "sample-supplement-satisfied-token",
  secondary: "sample-secondary-token",
} as const;

export type SampleSubmittedApplicationDefinition = {
  applicationId: string;
  invitationId: string;
  expertId: string;
  email: string;
  token: string;
  fullName: string;
  contactEmail: string;
  workEmail: string;
  phoneNumber: string;
  employer: string;
  degree: string;
  resumeFileId: string;
  resumeFileName: string;
  analysisJobId: string;
  analysisResultId: string;
  externalJobId: string;
};

export const SAMPLE_SUBMITTED_APPLICATIONS = [
  {
    applicationId: "app_submitted",
    invitationId: "invitation_submitted",
    expertId: "expert_submitted",
    email: "submitted@example.com",
    token: SAMPLE_TOKENS.submitted,
    fullName: "Submitted Expert",
    contactEmail: "submitted.expert@example.com",
    workEmail: "submitted.expert@university.edu",
    phoneNumber: "+1 555 010 3000",
    employer: "Example University",
    degree: "博士",
    resumeFileId: "resume_submitted",
    resumeFileName: "candidate-submitted.pdf",
    analysisJobId: "job_submitted",
    analysisResultId: "result_submitted",
    externalJobId: "mock:eligible:submitted",
  },
  {
    applicationId: "app_supplement_reviewing",
    invitationId: "invitation_supplement_reviewing",
    expertId: "expert_supplement_reviewing",
    email: "supplement-reviewing@example.com",
    token: SAMPLE_TOKENS.supplementReviewing,
    fullName: "Supplement Reviewing Expert",
    contactEmail: "supplement.reviewing@example.com",
    workEmail: "supplement.reviewing@university.edu",
    phoneNumber: "+1 555 010 3100",
    employer: "Reviewing University",
    degree: "博士",
    resumeFileId: "resume_supplement_reviewing",
    resumeFileName: "candidate-supplement-reviewing.pdf",
    analysisJobId: "job_supplement_reviewing",
    analysisResultId: "result_supplement_reviewing",
    externalJobId: "mock:eligible:supplement-reviewing",
  },
  {
    applicationId: "app_supplement_required",
    invitationId: "invitation_supplement_required",
    expertId: "expert_supplement_required",
    email: "supplement-required@example.com",
    token: SAMPLE_TOKENS.supplementRequired,
    fullName: "Supplement Required Expert",
    contactEmail: "supplement.required@example.com",
    workEmail: "supplement.required@institute.edu",
    phoneNumber: "+1 555 010 3200",
    employer: "Required Institute",
    degree: "博士",
    resumeFileId: "resume_supplement_required",
    resumeFileName: "candidate-supplement-required.pdf",
    analysisJobId: "job_supplement_required",
    analysisResultId: "result_supplement_required",
    externalJobId: "mock:eligible:supplement-required",
  },
  {
    applicationId: "app_supplement_satisfied",
    invitationId: "invitation_supplement_satisfied",
    expertId: "expert_supplement_satisfied",
    email: "supplement-satisfied@example.com",
    token: SAMPLE_TOKENS.supplementSatisfied,
    fullName: "Supplement Satisfied Expert",
    contactEmail: "supplement.satisfied@example.com",
    workEmail: "supplement.satisfied@academy.edu",
    phoneNumber: "+1 555 010 3300",
    employer: "Satisfied Academy",
    degree: "博士",
    resumeFileId: "resume_supplement_satisfied",
    resumeFileName: "candidate-supplement-satisfied.pdf",
    analysisJobId: "job_supplement_satisfied",
    analysisResultId: "result_supplement_satisfied",
    externalJobId: "mock:eligible:supplement-satisfied",
  },
] as const satisfies readonly SampleSubmittedApplicationDefinition[];

export type SampleSubmittedApplicationRecord = {
  application: {
    id: string;
    expertId: string;
    invitationId: string;
    applicationStatus: "SUBMITTED";
    currentStep: "materials";
    eligibilityResult: "ELIGIBLE";
    latestAnalysisJobId: string;
    firstAccessedAt: Date;
    lastAccessedAt: Date;
    introConfirmedAt: Date;
    resumeUploadStartedAt: Date;
    resumeUploadedAt: Date;
    analysisStartedAt: Date;
    analysisCompletedAt: Date;
    materialsEnteredAt: Date;
    submittedAt: Date;
    screeningPassportFullName: string;
    screeningContactEmail: string;
    screeningWorkEmail: string;
    screeningPhoneNumber: string;
    productInnovationDescription: null;
    createdAt: Date;
    updatedAt: Date;
  };
  resumeFile: {
    id: string;
    applicationId: string;
    fileName: string;
    objectKey: string;
    fileType: "application/pdf";
    fileSize: number;
    versionNo: number;
    uploadedAt: Date;
  };
  analysisJob: {
    id: string;
    applicationId: string;
    resumeFileId: string;
    externalJobId: string;
    jobType: "INITIAL";
    jobStatus: "COMPLETED";
    stageText: string;
    errorMessage: null;
    startedAt: Date;
    finishedAt: Date;
  };
  analysisResult: {
    id: string;
    applicationId: string;
    analysisJobId: string;
    analysisRound: number;
    eligibilityResult: "ELIGIBLE";
    reasonText: string;
    displaySummary: string;
    extractedFields: Record<string, string>;
    missingFields: [];
    createdAt: Date;
  };
  material: {
    id: string;
    applicationId: string;
    category: "IDENTITY";
    fileName: string;
    objectKey: string;
    fileType: "application/pdf";
    fileSize: number;
    uploadedAt: Date;
    isDeleted: false;
    deletedAt: null;
  };
};

export function getSampleSubmittedApplicationRecords(
  now: Date = new Date(),
): SampleSubmittedApplicationRecord[] {
  return SAMPLE_SUBMITTED_APPLICATIONS.map((sample) => ({
    application: {
      id: sample.applicationId,
      expertId: sample.expertId,
      invitationId: sample.invitationId,
      applicationStatus: "SUBMITTED",
      currentStep: "materials",
      eligibilityResult: "ELIGIBLE",
      latestAnalysisJobId: sample.analysisJobId,
      firstAccessedAt: now,
      lastAccessedAt: now,
      introConfirmedAt: now,
      resumeUploadStartedAt: now,
      resumeUploadedAt: now,
      analysisStartedAt: now,
      analysisCompletedAt: now,
      materialsEnteredAt: now,
      submittedAt: now,
      screeningPassportFullName: sample.fullName,
      screeningContactEmail: sample.contactEmail,
      screeningWorkEmail: sample.workEmail,
      screeningPhoneNumber: sample.phoneNumber,
      productInnovationDescription: null,
      createdAt: now,
      updatedAt: now,
    },
    resumeFile: {
      id: sample.resumeFileId,
      applicationId: sample.applicationId,
      fileName: sample.resumeFileName,
      objectKey: `applications/${sample.applicationId}/resume/${sample.resumeFileName}`,
      fileType: "application/pdf",
      fileSize: 2048,
      versionNo: 1,
      uploadedAt: now,
    },
    analysisJob: {
      id: sample.analysisJobId,
      applicationId: sample.applicationId,
      resumeFileId: sample.resumeFileId,
      externalJobId: sample.externalJobId,
      jobType: "INITIAL",
      jobStatus: "COMPLETED",
      stageText: "CV review completed",
      errorMessage: null,
      startedAt: now,
      finishedAt: now,
    },
    analysisResult: {
      id: sample.analysisResultId,
      applicationId: sample.applicationId,
      analysisJobId: sample.analysisJobId,
      analysisRound: 1,
      eligibilityResult: "ELIGIBLE",
      reasonText: "The profile meets the basic application requirements.",
      displaySummary:
        "Your profile meets the basic application requirements for this talent program. Please proceed to the next step to provide the required documents.",
      extractedFields: {
        "*姓名": sample.fullName,
        "最高学位": "Doctorate",
        "就职单位中文": sample.employer,
      },
      missingFields: [],
      createdAt: now,
    },
    material: {
      id: `mat_${sample.applicationId}_identity`,
      applicationId: sample.applicationId,
      category: "IDENTITY",
      fileName: "passport.pdf",
      objectKey: `applications/${sample.applicationId}/materials/IDENTITY/passport.pdf`,
      fileType: "application/pdf",
      fileSize: 1000,
      uploadedAt: now,
      isDeleted: false,
      deletedAt: null,
    },
  }));
}

export function getSampleInvitationSeeds() {
  const now = new Date();
  const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

  return [
    {
      id: "invitation_init",
      expertId: "expert_init",
      email: "init@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.init),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_progress",
      expertId: "expert_progress",
      email: "progress@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.progress),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_extraction",
      expertId: "expert_extraction",
      email: "extraction@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.extraction),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_extraction_review",
      expertId: "expert_extraction_review",
      email: "extraction-review@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.extractionReview),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_submitted",
      expertId: "expert_submitted",
      email: "submitted@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.submitted),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_supplement_reviewing",
      expertId: "expert_supplement_reviewing",
      email: "supplement-reviewing@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.supplementReviewing),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_supplement_required",
      expertId: "expert_supplement_required",
      email: "supplement-required@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.supplementRequired),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_supplement_satisfied",
      expertId: "expert_supplement_satisfied",
      email: "supplement-satisfied@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.supplementSatisfied),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "invitation_secondary",
      expertId: "expert_secondary",
      email: "secondary@example.com",
      tokenHash: hashInviteToken(SAMPLE_TOKENS.secondary),
      tokenStatus: "ACTIVE" as const,
      expiredAt: future,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
