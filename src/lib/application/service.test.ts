import { beforeEach, describe, expect, it } from "vitest";

import {
  ApplicationServiceError,
  enterMaterialsStage,
  filterSecondaryFieldsForPromptProgress,
  getApplicationFeedbackSnapshot,
  getEditableSecondaryAnalysisSnapshot,
  getMaterialsByCategory,
  getSnapshot,
  saveApplicationFeedbackDraft,
  saveEditableSecondaryAnalysisFields,
  shouldShowFullSecondaryFieldSet,
  startSecondaryAnalysis,
  submitApplicationFeedback,
  submitApplication,
  submitSupplementalFields,
} from "@/lib/application/service";
import { updateApplication } from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("secondary analysis editable service flow", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("blocks starting the secondary analysis more than once", async () => {
    await startSecondaryAnalysis("app_secondary");

    await expect(startSecondaryAnalysis("app_secondary")).rejects.toMatchObject({
      status: 409,
      code: "SECONDARY_ANALYSIS_ALREADY_STARTED",
    } satisfies Partial<ApplicationServiceError>);
  });

  it("keeps the detailed analysis idle before the first run starts", async () => {
    const initialSnapshot = await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
    });

    expect(initialSnapshot).toMatchObject({
      runId: null,
      status: "idle",
      fields: [],
    });

    const started = await startSecondaryAnalysis("app_secondary");
    expect(started.runId).toBeTruthy();
  });

  it("moves an eligible application into detailed analysis and syncs review status", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    const afterStart = await getSnapshot("app_secondary");

    expect(afterStart?.applicationStatus).toBe("SECONDARY_ANALYZING");

    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    const afterSync = await getSnapshot("app_secondary");
    expect(afterSync?.applicationStatus).toBe("SECONDARY_REVIEW");
  });

  it("persists editable overrides and keeps explicit empty values", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    const initialSnapshot = await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    expect(initialSnapshot.runId).toBeTruthy();
    expect(initialSnapshot.fields.length).toBeGreaterThan(0);

    const savedSnapshot = await saveEditableSecondaryAnalysisFields({
      applicationId: "app_secondary",
      runId: started.runId ?? "",
      fields: {
        secondary_field_01: {
          value: "Edited Expert Name",
          hasOverride: true,
        },
        secondary_field_15: {
          value: "",
          hasOverride: true,
        },
      },
    });

    const nameField = savedSnapshot.fields.find((field) => field.no === 1);
    const degreeField = savedSnapshot.fields.find((field) => field.no === 15);

    expect(nameField).toMatchObject({
      effectiveValue: "Edited Expert Name",
      hasOverride: true,
      isEdited: true,
      isMissing: false,
    });
    expect(degreeField).toMatchObject({
      effectiveValue: "",
      hasOverride: true,
      isEdited: true,
      isMissing: true,
    });

    const reloadedSnapshot = await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });
    const reloadedDegreeField = reloadedSnapshot.fields.find(
      (field) => field.no === 15,
    );

    expect(reloadedDegreeField).toMatchObject({
      effectiveValue: "",
      hasOverride: true,
      isMissing: true,
    });
  });

  it("allows entering materials after the initial CV review is eligible", async () => {
    const entered = await enterMaterialsStage("app_secondary");
    expect(entered?.applicationStatus).toBe("MATERIALS_IN_PROGRESS");
  });

  it("blocks entering materials when contact fields are still missing", async () => {
    await updateApplication("app_secondary", {
      screeningPassportFullName: null,
      screeningContactEmail: null,
      screeningWorkEmail: null,
      screeningPhoneNumber: null,
    });

    await expect(enterMaterialsStage("app_secondary")).rejects.toMatchObject({
      status: 409,
      code: "SCREENING_CONTACT_FIELDS_REQUIRED",
    } satisfies Partial<ApplicationServiceError>);
  });

  it("allows entering materials when optional contact fields are missing", async () => {
    await updateApplication("app_secondary", {
      screeningWorkEmail: null,
      screeningPhoneNumber: null,
    });

    const entered = await enterMaterialsStage("app_secondary");
    expect(entered?.applicationStatus).toBe("MATERIALS_IN_PROGRESS");
  });

  it("still allows entering materials from completed legacy detailed review", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });

    const entered = await enterMaterialsStage("app_secondary");
    expect(entered?.applicationStatus).toBe("MATERIALS_IN_PROGRESS");
  });

  it("blocks materials and submission before the materials stage starts", async () => {
    await expect(getMaterialsByCategory("app_secondary")).rejects.toMatchObject({
      status: 409,
      code: "MATERIALS_STAGE_NOT_READY",
    } satisfies Partial<ApplicationServiceError>);

    await expect(submitApplication("app_secondary")).rejects.toMatchObject({
      status: 409,
      code: "SUBMISSION_STAGE_NOT_READY",
    } satisfies Partial<ApplicationServiceError>);
  });

  it("blocks supplemental reanalysis after the initial CV review is eligible", async () => {
    await expect(
      submitSupplementalFields({
        applicationId: "app_secondary",
        fields: {
          highest_degree: "Doctorate",
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "SUPPLEMENTAL_FIELDS_NOT_REQUIRED",
    } satisfies Partial<ApplicationServiceError>);
  });

  it("keeps the existing reanalysis path for insufficient-info submissions", async () => {
    const result = await submitSupplementalFields({
      applicationId: "app_progress",
      fields: {
        highest_degree: "Doctorate",
        current_employer: "Example University",
      },
    });

    expect(result.applicationStatus).toBe("REANALYZING");
    expect(result.id).toBeTruthy();

    const snapshot = await getSnapshot("app_progress");
    expect(snapshot?.applicationStatus).toBe("REANALYZING");
  });

  it("saves contact-only completion without starting reanalysis", async () => {
    await updateApplication("app_secondary", {
      applicationStatus: "INFO_REQUIRED",
      screeningPassportFullName: null,
      screeningContactEmail: null,
      screeningWorkEmail: null,
      screeningPhoneNumber: null,
    });

    const result = await submitSupplementalFields({
      applicationId: "app_secondary",
      fields: {
        name: "  Contact Expert  ",
        personal_email: "  Contact.Expert@Example.COM  ",
        work_email: "  Contact.Expert@University.EDU  ",
      },
    });

    expect(result).toEqual({
      id: null,
      applicationStatus: "ELIGIBLE",
    });

    const snapshot = await getSnapshot("app_secondary");
    expect(snapshot?.applicationStatus).toBe("ELIGIBLE");
    expect(snapshot?.screeningPassportFullName).toBe("Contact Expert");
    expect(snapshot?.screeningContactEmail).toBe("contact.expert@example.com");
    expect(snapshot?.screeningWorkEmail).toBe("contact.expert@university.edu");
    expect(snapshot?.screeningPhoneNumber).toBeNull();
    expect(snapshot?.latestResult?.extractedFields.name).toBe("Contact Expert");
    expect(snapshot?.latestResult?.extractedFields.personal_email).toBe(
      "contact.expert@example.com",
    );
    expect(snapshot?.latestResult?.extractedFields.work_email).toBe(
      "contact.expert@university.edu",
    );
    expect(snapshot?.latestResult?.extractedFields.phone_number).toBeUndefined();
  });

  it("returns all ten material buckets after entering the materials stage", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });
    await enterMaterialsStage("app_secondary");

    const materials = await getMaterialsByCategory("app_secondary");

    expect(Object.keys(materials).sort()).toEqual([
      "book",
      "conference",
      "education",
      "employment",
      "honor",
      "identity",
      "paper",
      "patent",
      "product",
      "project",
    ]);
  });

  it("requires identity, doctoral education, and employment evidence before submission", async () => {
    const started = await startSecondaryAnalysis("app_secondary");
    await getEditableSecondaryAnalysisSnapshot({
      applicationId: "app_secondary",
      runId: started.runId,
    });
    await enterMaterialsStage("app_secondary");

    await expect(submitApplication("app_secondary")).rejects.toMatchObject({
      status: 409,
      code: "MATERIALS_MINIMUM_REQUIREMENTS_NOT_MET",
    } satisfies Partial<ApplicationServiceError>);
  });
});

describe("secondary analysis prompt-progress field visibility", () => {
  const fields = [
    { fieldKey: "secondary_field_01", sourceValue: "Jane Doe" },
    { fieldKey: "secondary_field_15", sourceValue: "" },
    { fieldKey: "secondary_field_22", sourceValue: "Senior researcher" },
  ];

  it("keeps only produced fields while prompt progress is incomplete", () => {
    const run = {
      id: "run-1",
      status: "processing" as const,
      totalPrompts: 9,
      completedPrompts: 4,
      failedPromptIds: [],
      errorMessage: null,
    };

    expect(shouldShowFullSecondaryFieldSet(run)).toBe(false);
    expect(filterSecondaryFieldsForPromptProgress(fields, run)).toEqual([
      { fieldKey: "secondary_field_01", sourceValue: "Jane Doe" },
      { fieldKey: "secondary_field_22", sourceValue: "Senior researcher" },
    ]);
  });

  it("keeps no fields while incomplete prompt progress has no produced values", () => {
    const run = {
      id: "run-1",
      status: "processing" as const,
      totalPrompts: 9,
      completedPrompts: 0,
      failedPromptIds: [],
      errorMessage: null,
    };

    expect(
      filterSecondaryFieldsForPromptProgress(
        fields.map((field) => ({ ...field, sourceValue: "" })),
        run,
      ),
    ).toEqual([]);
  });

  it("keeps missing fields once all prompts complete", () => {
    const run = {
      id: "run-1",
      status: "completed" as const,
      totalPrompts: 9,
      completedPrompts: 9,
      failedPromptIds: [],
      errorMessage: null,
    };

    expect(shouldShowFullSecondaryFieldSet(run)).toBe(true);
    expect(filterSecondaryFieldsForPromptProgress(fields, run)).toEqual(fields);
  });

  it("preserves the full field set when prompt totals are unavailable", () => {
    const run = {
      id: "run-1",
      status: "processing" as const,
      totalPrompts: null,
      completedPrompts: null,
      failedPromptIds: [],
      errorMessage: null,
    };

    expect(shouldShowFullSecondaryFieldSet(run)).toBe(true);
    expect(filterSecondaryFieldsForPromptProgress(fields, run)).toEqual(fields);
  });
});

describe("submission feedback service flow", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns the default empty draft snapshot before feedback is saved", async () => {
    await expect(getApplicationFeedbackSnapshot("app_secondary")).rejects.toMatchObject({
      code: "FEEDBACK_NOT_AVAILABLE",
    } satisfies Partial<ApplicationServiceError>);

    const snapshot = await getApplicationFeedbackSnapshot("app_submitted");
    expect(snapshot).toEqual({
      status: "DRAFT",
      rating: null,
      comment: "",
      draftSavedAt: null,
      submittedAt: null,
    });
  });

  it("saves and overwrites feedback drafts while keeping the flow submitted", async () => {
    const firstDraft = await saveApplicationFeedbackDraft({
      applicationId: "app_submitted",
      rating: 4,
      comment: " Clear steps overall. ",
      context: {
        currentUrl: "https://example.com/apply/submission-complete",
        pageTitle: "Submission complete",
        flowName: "submission flow",
        surface: "completion_page",
      },
    });

    expect(firstDraft).toMatchObject({
      status: "DRAFT",
      rating: 4,
      comment: "Clear steps overall.",
    });

    const secondDraft = await saveApplicationFeedbackDraft({
      applicationId: "app_submitted",
      comment: "The consultant CTA was helpful.",
    });

    expect(secondDraft).toMatchObject({
      status: "DRAFT",
      rating: 4,
      comment: "The consultant CTA was helpful.",
    });

    const application = await getSnapshot("app_submitted");
    expect(application?.applicationStatus).toBe("SUBMITTED");
  });

  it("submits feedback and blocks future edits", async () => {
    const submitted = await submitApplicationFeedback({
      applicationId: "app_submitted",
      comment: "Excellent end-to-end flow.",
      context: {
        currentUrl: "https://example.com/apply/submission-complete",
        pageTitle: "Submission complete",
        flowName: "submission flow",
        flowStep: "feedback",
      },
    });

    expect(submitted).toMatchObject({
      status: "SUBMITTED",
      rating: null,
      comment: "Excellent end-to-end flow.",
    });
    expect(submitted.submittedAt).toBeTruthy();

    await expect(
      saveApplicationFeedbackDraft({
        applicationId: "app_submitted",
        rating: 3,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "FEEDBACK_ALREADY_SUBMITTED",
    } satisfies Partial<ApplicationServiceError>);
  });

  it("validates rating bounds and comment length", async () => {
    await expect(
      submitApplicationFeedback({
        applicationId: "app_submitted",
        rating: 0,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "FEEDBACK_RATING_INVALID",
    } satisfies Partial<ApplicationServiceError>);

    await expect(
      saveApplicationFeedbackDraft({
        applicationId: "app_submitted",
        comment: "a".repeat(2001),
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "FEEDBACK_COMMENT_TOO_LONG",
    } satisfies Partial<ApplicationServiceError>);

    await expect(
      submitApplicationFeedback({
        applicationId: "app_submitted",
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "FEEDBACK_EMPTY_SUBMISSION",
    } satisfies Partial<ApplicationServiceError>);
  });
});
