import {
  SUPPORTED_SUPPLEMENT_CATEGORIES,
  isSupplementCategory,
} from "@/features/material-supplement/constants";
import type { SupplementCategory } from "@/features/material-supplement/types";
import {
  getApplicationById,
  getLatestAnalysisResult,
  getLatestResumeFile,
  getSupplementUploadBatchById,
  listMaterials,
  listSupplementFiles,
} from "@/lib/data/store";
import { createDownloadIntent } from "@/lib/upload/service";

export const MATERIAL_REVIEW_CONTEXT_DEFAULT_DOWNLOAD_TTL_SECONDS = 900;
export const MATERIAL_REVIEW_CONTEXT_MIN_DOWNLOAD_TTL_SECONDS = 60;
export const MATERIAL_REVIEW_CONTEXT_MAX_DOWNLOAD_TTL_SECONDS = 3600;

type ReviewContextFileSource = "INITIAL_SUBMISSION" | "SUPPLEMENT_UPLOAD";

type ReviewContextFile = {
  id: string;
  source: ReviewContextFileSource;
  category: SupplementCategory;
  fileName: string;
  objectKey: string;
  contentType: string | null;
  sizeBytes: number;
  uploadedAt: string;
  downloadUrl: string;
};

type ReviewContextResume = {
  file: Omit<ReviewContextFile, "source" | "category">;
  extractedData: Record<string, unknown>;
  analysisResult: {
    id: string;
    analysisRound: number;
    eligibilityResult: string;
    reasonText: string | null;
    displaySummary: string | null;
    missingFields: unknown[];
    createdAt: string;
  } | null;
};

export type MaterialReviewApplicationContext = {
  applicationId: string;
  expert: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  resume: ReviewContextResume | null;
  materials: Record<SupplementCategory, ReviewContextFile[]>;
  generatedAt: string;
};

export type BuildMaterialReviewApplicationContextInput = {
  applicationId: string;
  category?: SupplementCategory;
  includeResume?: boolean;
  downloadUrlTtlSeconds?: number;
};

function createEmptyMaterials(): Record<
  SupplementCategory,
  ReviewContextFile[]
> {
  return SUPPORTED_SUPPLEMENT_CATEGORIES.reduce(
    (accumulator, category) => {
      accumulator[category] = [];
      return accumulator;
    },
    {} as Record<SupplementCategory, ReviewContextFile[]>,
  );
}

function toIsoString(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function toReviewContextFile(input: {
  id: string;
  source: ReviewContextFileSource;
  category: SupplementCategory;
  fileName: string;
  objectKey: string;
  fileType?: string | null;
  fileSize: number;
  uploadedAt: Date | string;
  downloadUrlTtlSeconds: number;
}): Promise<ReviewContextFile> {
  const downloadIntent = await createDownloadIntent({
    objectKey: input.objectKey,
    expiresInSeconds: input.downloadUrlTtlSeconds,
  });

  return {
    id: input.id,
    source: input.source,
    category: input.category,
    fileName: input.fileName,
    objectKey: input.objectKey,
    contentType: input.fileType ?? null,
    sizeBytes: input.fileSize,
    uploadedAt: toIsoString(input.uploadedAt),
    downloadUrl: downloadIntent.downloadUrl,
  };
}

export function parseMaterialReviewContextQuery(searchParams: URLSearchParams) {
  const rawCategory = searchParams.get("category");
  const rawIncludeResume = searchParams.get("includeResume");
  const rawDownloadTtl = searchParams.get("downloadUrlTtlSeconds");

  if (rawCategory !== null && !isSupplementCategory(rawCategory)) {
    return {
      ok: false as const,
      message: "Unsupported material review context category.",
    };
  }

  let downloadUrlTtlSeconds =
    MATERIAL_REVIEW_CONTEXT_DEFAULT_DOWNLOAD_TTL_SECONDS;

  if (rawDownloadTtl !== null) {
    const parsed = Number(rawDownloadTtl);

    if (
      !Number.isInteger(parsed) ||
      parsed < MATERIAL_REVIEW_CONTEXT_MIN_DOWNLOAD_TTL_SECONDS ||
      parsed > MATERIAL_REVIEW_CONTEXT_MAX_DOWNLOAD_TTL_SECONDS
    ) {
      return {
        ok: false as const,
        message: "downloadUrlTtlSeconds must be an integer from 60 to 3600.",
      };
    }

    downloadUrlTtlSeconds = parsed;
  }

  return {
    ok: true as const,
    value: {
      category: rawCategory ?? undefined,
      includeResume: rawIncludeResume !== "false",
      downloadUrlTtlSeconds,
    },
  };
}

export async function buildMaterialReviewApplicationContext(
  input: BuildMaterialReviewApplicationContextInput,
): Promise<MaterialReviewApplicationContext | null> {
  const application = await getApplicationById(input.applicationId);

  if (!application) {
    return null;
  }

  const downloadUrlTtlSeconds =
    input.downloadUrlTtlSeconds ??
    MATERIAL_REVIEW_CONTEXT_DEFAULT_DOWNLOAD_TTL_SECONDS;
  const [
    latestResume,
    latestAnalysisResult,
    initialMaterials,
    supplementFiles,
  ] = await Promise.all([
    input.includeResume === false
      ? Promise.resolve(null)
      : getLatestResumeFile(input.applicationId),
    input.includeResume === false
      ? Promise.resolve(null)
      : getLatestAnalysisResult(input.applicationId),
    listMaterials(input.applicationId),
    listSupplementFiles(input.applicationId, {
      ...(input.category ? { category: input.category } : {}),
    }),
  ]);

  const materials = createEmptyMaterials();
  const allowedCategories = input.category
    ? [input.category]
    : SUPPORTED_SUPPLEMENT_CATEGORIES;

  for (const item of initialMaterials) {
    if (
      !isSupplementCategory(item.category) ||
      !allowedCategories.includes(item.category)
    ) {
      continue;
    }

    materials[item.category].push(
      await toReviewContextFile({
        id: item.id,
        source: "INITIAL_SUBMISSION",
        category: item.category,
        fileName: item.fileName,
        objectKey: item.objectKey,
        fileType: item.fileType,
        fileSize: item.fileSize,
        uploadedAt: item.uploadedAt,
        downloadUrlTtlSeconds,
      }),
    );
  }

  for (const item of supplementFiles) {
    if (!allowedCategories.includes(item.category)) {
      continue;
    }

    const batch = await getSupplementUploadBatchById(item.uploadBatchId);

    if (
      !batch ||
      !["CONFIRMED", "REVIEWING", "COMPLETED"].includes(batch.status)
    ) {
      continue;
    }

    materials[item.category].push(
      await toReviewContextFile({
        id: item.id,
        source: "SUPPLEMENT_UPLOAD",
        category: item.category,
        fileName: item.fileName,
        objectKey: item.objectKey,
        fileType: item.fileType,
        fileSize: item.fileSize,
        uploadedAt: item.uploadedAt,
        downloadUrlTtlSeconds,
      }),
    );
  }

  for (const category of SUPPORTED_SUPPLEMENT_CATEGORIES) {
    materials[category].sort((left, right) =>
      left.uploadedAt.localeCompare(right.uploadedAt),
    );
  }

  const extractedData = toObject(latestAnalysisResult?.extractedFields);
  const missingFields = Array.isArray(latestAnalysisResult?.missingFields)
    ? latestAnalysisResult.missingFields
    : [];
  const resume =
    latestResume === null
      ? null
      : {
          file: {
            id: latestResume.id,
            fileName: latestResume.fileName,
            objectKey: latestResume.objectKey,
            contentType: latestResume.fileType,
            sizeBytes: latestResume.fileSize,
            uploadedAt: toIsoString(latestResume.uploadedAt),
            downloadUrl: (
              await createDownloadIntent({
                objectKey: latestResume.objectKey,
                expiresInSeconds: downloadUrlTtlSeconds,
              })
            ).downloadUrl,
          },
          extractedData,
          analysisResult: latestAnalysisResult
            ? {
                id: latestAnalysisResult.id,
                analysisRound: latestAnalysisResult.analysisRound,
                eligibilityResult: latestAnalysisResult.eligibilityResult,
                reasonText: latestAnalysisResult.reasonText,
                displaySummary: latestAnalysisResult.displaySummary,
                missingFields,
                createdAt: toIsoString(latestAnalysisResult.createdAt),
              }
            : null,
        };

  return {
    applicationId: input.applicationId,
    expert: {
      name: application.screeningPassportFullName,
      email:
        application.screeningContactEmail ?? application.screeningWorkEmail,
      phone: application.screeningPhoneNumber,
    },
    resume,
    materials,
    generatedAt: new Date().toISOString(),
  };
}
