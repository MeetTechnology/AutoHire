import { readInviteTokenFromSearchParams } from "@/features/application/invite-url-token";
import type {
  ApplicationSnapshot,
  EditableSecondaryAnalysisSnapshot,
  MaterialCategory,
  SecondaryAnalysisSnapshot,
} from "@/features/application/types";
import {
  buildTrackedRequestHeaders,
  trackUploadStage,
} from "@/lib/tracking/client";

type UploadIntent = {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  objectKey: string;
};

export type MaterialsResponse = Record<
  Lowercase<MaterialCategory>,
  Array<{ id: string; fileName: string; fileType?: string }>
>;

function buildFetchOptions(init?: RequestInit) {
  return {
    ...init,
    headers: buildTrackedRequestHeaders(init?.headers),
  } satisfies RequestInit;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error.error ?? "Request failed.");
  }

  return response.json() as Promise<T>;
}

export async function fetchSession(explicitToken?: string | null) {
  const fromUrl =
    typeof window !== "undefined"
      ? readInviteTokenFromSearchParams(
          new URLSearchParams(window.location.search),
        )
      : null;

  const merged =
    (fromUrl && fromUrl.length > 0 ? fromUrl : null) ??
    (explicitToken?.trim() ? explicitToken.trim() : null);

  const url = merged
    ? `/api/expert-session?token=${encodeURIComponent(merged)}`
    : "/api/expert-session";
  const response = await fetch(url, {
    ...buildFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  });

  return parseResponse<ApplicationSnapshot>(response);
}

export async function postIntroConfirm(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/intro/confirm`,
    buildFetchOptions({
      method: "POST",
      credentials: "include",
    }),
  );

  return parseResponse<{
    applicationStatus: string;
    currentStep: string | null;
  }>(response);
}

export async function createResumeUploadIntent(
  applicationId: string,
  file: File,
  uploadId: string,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/resume/upload-intent`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    }),
  );

  return parseResponse<UploadIntent>(response);
}

export async function confirmResumeUpload(
  applicationId: string,
  file: File,
  objectKey: string,
  uploadId: string,
  screening?: { passportFullName: string; email: string },
) {
  const response = await fetch(
    `/api/applications/${applicationId}/resume`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        uploadId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        objectKey,
        ...(screening
          ? {
              screeningPassportFullName: screening.passportFullName,
              screeningContactEmail: screening.email,
            }
          : {}),
      }),
    }),
  );

  return parseResponse<{ analysisJobId: string; applicationStatus: string }>(
    response,
  );
}

export async function uploadBinary(
  intent: UploadIntent,
  file: File,
  tracking: {
    applicationId: string;
    uploadId: string;
    kind: "resume" | "material";
    category?: MaterialCategory | null;
  },
) {
  await trackUploadStage({
    eventType:
      tracking.kind === "resume"
        ? "resume_upload_started"
        : "material_upload_started",
    applicationId: tracking.applicationId,
    pageName: tracking.kind === "resume" ? "apply_resume" : "apply_materials",
    stepName: tracking.kind === "resume" ? "resume_upload" : "materials",
    uploadId: tracking.uploadId,
    kind: tracking.kind,
    category: tracking.category ?? null,
    file,
    objectKey: intent.objectKey,
    eventStatus: "SUCCESS",
  });

  try {
    const response = await fetch(intent.uploadUrl, {
      method: intent.method,
      headers: intent.headers,
      body: file,
    });

    if (!response.ok && response.status !== 204) {
      await trackUploadStage({
        eventType:
          tracking.kind === "resume"
            ? "resume_upload_failed"
            : "material_upload_failed",
        applicationId: tracking.applicationId,
        pageName:
          tracking.kind === "resume" ? "apply_resume" : "apply_materials",
        stepName: tracking.kind === "resume" ? "resume_upload" : "materials",
        uploadId: tracking.uploadId,
        kind: tracking.kind,
        category: tracking.category ?? null,
        file,
        failureStage: "put",
        objectKey: intent.objectKey,
        eventStatus: "FAIL",
        errorCode: "oss_put_failed",
      });
      throw new Error("File upload failed.");
    }
  } catch (error) {
    if (!(error instanceof Error && error.message === "File upload failed.")) {
      await trackUploadStage({
        eventType:
          tracking.kind === "resume"
            ? "resume_upload_failed"
            : "material_upload_failed",
        applicationId: tracking.applicationId,
        pageName:
          tracking.kind === "resume" ? "apply_resume" : "apply_materials",
        stepName: tracking.kind === "resume" ? "resume_upload" : "materials",
        uploadId: tracking.uploadId,
        kind: tracking.kind,
        category: tracking.category ?? null,
        file,
        failureStage: "put",
        objectKey: intent.objectKey,
        eventStatus: "FAIL",
        errorCode: "oss_put_failed",
        errorMessage:
          error instanceof Error ? error.message : "File upload failed.",
      });
    }
    throw error;
  }
}

export async function fetchAnalysisStatus(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/analysis-status`,
    buildFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseResponse<{
    jobStatus: string;
    stageText: string;
    progressMessage: string;
    errorMessage?: string | null;
  }>(response);
}

export async function fetchAnalysisResult(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/analysis-result`,
    buildFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseResponse<{
    eligibilityResult: string;
    displaySummary: string | null;
    reasonText: string | null;
    extractedFields: Record<string, unknown>;
    missingFields: Array<{
      fieldKey: string;
      sourceItemName: string;
      label: string;
      type: "text" | "textarea" | "number" | "date" | "select" | "radio";
      required: boolean;
      helpText?: string;
      options?: string[];
      defaultValue?: string;
      selectOtherDetails?: {
        triggerOption: string;
        detailFieldKey: string;
        detailLabel: string;
        detailPlaceholder?: string;
      };
    }>;
    applicationStatus: string;
    resumeAnalysisStatus: string | null;
  }>(response);
}

export async function submitSupplementalFields(
  applicationId: string,
  fields: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/supplemental-fields`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ fields }),
    }),
  );

  return parseResponse<{ analysisJobId: string; applicationStatus: string }>(
    response,
  );
}

export async function triggerSecondaryAnalysis(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/secondary-analysis`,
    buildFetchOptions({
      method: "POST",
      credentials: "include",
    }),
  );

  return parseResponse<{
    applicationId: string;
    runId: string | null;
    status: SecondaryAnalysisSnapshot["status"];
  }>(response);
}

export async function fetchSecondaryAnalysisResult(
  applicationId: string,
  runId?: string | null,
) {
  const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
  const response = await fetch(
    `/api/applications/${applicationId}/secondary-analysis/result${query}`,
    buildFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseResponse<SecondaryAnalysisSnapshot & { applicationId: string }>(
    response,
  );
}

export async function fetchEditableSecondaryAnalysis(
  applicationId: string,
  runId?: string | null,
) {
  const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
  const response = await fetch(
    `/api/applications/${applicationId}/secondary-analysis/editable${query}`,
    buildFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseResponse<
    EditableSecondaryAnalysisSnapshot & { applicationId: string }
  >(response);
}

export async function saveEditableSecondaryAnalysis(
  applicationId: string,
  input: {
    runId: string;
    fields: Record<
      string,
      | string
      | {
          value: string;
          hasOverride: boolean;
        }
    >;
  },
) {
  const response = await fetch(
    `/api/applications/${applicationId}/secondary-analysis/save`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(input),
    }),
  );

  return parseResponse<
    EditableSecondaryAnalysisSnapshot & { applicationId: string }
  >(response);
}

export async function fetchMaterials(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials`,
    buildFetchOptions({
      credentials: "include",
      cache: "no-store",
    }),
  );

  return parseResponse<MaterialsResponse>(response);
}

export async function createMaterialUploadIntent(
  applicationId: string,
  category: MaterialCategory,
  file: File,
  uploadId: string,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials/upload-intent`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        uploadId,
        category,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    }),
  );

  return parseResponse<UploadIntent>(response);
}

export async function confirmMaterialUpload(
  applicationId: string,
  category: MaterialCategory,
  file: File,
  objectKey: string,
  uploadId: string,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        uploadId,
        category,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        objectKey,
      }),
    }),
  );

  return parseResponse<MaterialsResponse>(response);
}

export async function enterMaterialsStage(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials/enter`,
    buildFetchOptions({
      method: "POST",
      credentials: "include",
    }),
  );

  return parseResponse<{
    applicationId: string;
    applicationStatus: string;
    currentStep: string | null;
    nextRoute: string;
  }>(response);
}

export async function deleteMaterial(applicationId: string, fileId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials/${fileId}`,
    buildFetchOptions({
      method: "DELETE",
      credentials: "include",
    }),
  );

  return parseResponse<MaterialsResponse>(response);
}

export async function saveProductInnovationDescription(
  applicationId: string,
  description: string,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials/product-description`,
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ description }),
    }),
  );

  return parseResponse<{ productInnovationDescription: string }>(response);
}

export async function submitApplicationRequest(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/submit`,
    buildFetchOptions({
      method: "POST",
      credentials: "include",
    }),
  );

  return parseResponse<{ applicationStatus: string; message: string }>(
    response,
  );
}
