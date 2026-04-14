import { beforeEach, describe, expect, it } from "vitest";

import {
  ApplicationServiceError,
  enterMaterialsStage,
  getEditableSecondaryAnalysisSnapshot,
  getMaterialsByCategory,
  getSnapshot,
  saveEditableSecondaryAnalysisFields,
  startSecondaryAnalysis,
  submitApplication,
} from "@/lib/application/service";

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

  it("only allows entering materials after detailed analysis review is ready", async () => {
    await expect(enterMaterialsStage("app_secondary")).rejects.toMatchObject({
      status: 409,
      code: "MATERIALS_ENTRY_NOT_READY",
    } satisfies Partial<ApplicationServiceError>);

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

  it("returns all nine material buckets after entering the materials stage", async () => {
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
