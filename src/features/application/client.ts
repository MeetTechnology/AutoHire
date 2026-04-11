import type {
  ApplicationSnapshot,
  MaterialCategory,
} from "@/features/application/types";

type UploadIntent = {
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  objectKey: string;
};

export type MaterialsResponse = Record<
  string,
  Array<{ id: string; fileName: string; fileType?: string }>
>;

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(error.error ?? "请求失败");
  }

  return response.json() as Promise<T>;
}

export async function fetchSession(token?: string | null) {
  const url = token
    ? `/api/expert-session?token=${encodeURIComponent(token)}`
    : "/api/expert-session";
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  return parseResponse<ApplicationSnapshot>(response);
}

export async function postIntroConfirm(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/intro/confirm`,
    {
      method: "POST",
      credentials: "include",
    },
  );

  return parseResponse<{
    applicationStatus: string;
    currentStep: string | null;
  }>(response);
}

export async function createResumeUploadIntent(
  applicationId: string,
  file: File,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/resume/upload-intent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    },
  );

  return parseResponse<UploadIntent>(response);
}

export async function confirmResumeUpload(
  applicationId: string,
  file: File,
  objectKey: string,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/resume/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        objectKey,
      }),
    },
  );

  return parseResponse<{ analysisJobId: string; applicationStatus: string }>(
    response,
  );
}

export async function uploadBinary(intent: UploadIntent, file: File) {
  const response = await fetch(intent.uploadUrl, {
    method: intent.method,
    headers: intent.headers,
    body: file,
  });

  if (!response.ok && response.status !== 204) {
    throw new Error("文件上传失败");
  }
}

export async function fetchAnalysisStatus(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/analysis-status`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  return parseResponse<{
    jobStatus: string;
    stageText: string;
    progressMessage: string;
  }>(response);
}

export async function fetchAnalysisResult(applicationId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/analysis-result`,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  return parseResponse<{
    eligibilityResult: string;
    displaySummary: string | null;
    reasonText: string | null;
    extractedFields: Record<string, unknown>;
    missingFields: Array<{
      fieldKey: string;
      label: string;
      type: "text" | "textarea" | "number" | "date" | "select" | "radio";
      required: boolean;
      helpText?: string;
      options?: string[];
      defaultValue?: string;
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
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ fields }),
    },
  );

  return parseResponse<{ analysisJobId: string; applicationStatus: string }>(
    response,
  );
}

export async function fetchMaterials(applicationId: string) {
  const response = await fetch(`/api/applications/${applicationId}/materials`, {
    credentials: "include",
    cache: "no-store",
  });

  return parseResponse<MaterialsResponse>(response);
}

export async function createMaterialUploadIntent(
  applicationId: string,
  category: MaterialCategory,
  file: File,
) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials/upload-intent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        category,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
      }),
    },
  );

  return parseResponse<UploadIntent>(response);
}

export async function confirmMaterialUpload(
  applicationId: string,
  category: MaterialCategory,
  file: File,
  objectKey: string,
) {
  const response = await fetch(`/api/applications/${applicationId}/materials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      category,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      objectKey,
    }),
  });

  return parseResponse<MaterialsResponse>(response);
}

export async function deleteMaterial(applicationId: string, fileId: string) {
  const response = await fetch(
    `/api/applications/${applicationId}/materials/${fileId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  return parseResponse<MaterialsResponse>(response);
}

export async function submitApplicationRequest(applicationId: string) {
  const response = await fetch(`/api/applications/${applicationId}/submit`, {
    method: "POST",
    credentials: "include",
  });

  return parseResponse<{ applicationStatus: string; message: string }>(
    response,
  );
}
