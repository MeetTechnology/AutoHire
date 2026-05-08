import { SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH } from "@/features/material-supplement/constants";
import type {
  SupplementCategory,
  SupplementFileSummary,
} from "@/features/material-supplement/types";
import { validateUpload } from "@/lib/validation/upload";

export type SupplementFileLike = {
  name: string;
  size: number;
  type?: string;
};

export type SupplementRejectedFile = {
  file: SupplementFileLike;
  reason:
    | "DUPLICATE"
    | "COUNT_EXCEEDED"
    | "UNSUPPORTED_FILE_TYPE"
    | "FILE_TOO_LARGE"
    | "ARCHIVE_TOO_LARGE";
};

export type SupplementFileSelectionResult<TFile extends SupplementFileLike> = {
  acceptedFiles: TFile[];
  rejectedFiles: SupplementRejectedFile[];
};

export function getSupplementFileDedupKey(input: {
  fileName: string;
  fileSize: number;
}) {
  return `${input.fileName.trim().toLowerCase()}::${input.fileSize}`;
}

export function getSupplementDraftBatchId(files: SupplementFileSummary[]) {
  const batchIds = Array.from(new Set(files.map((file) => file.uploadBatchId)));

  if (batchIds.length === 0) {
    return null;
  }

  return batchIds.length === 1 ? batchIds[0] : undefined;
}

export function selectSupplementFiles<TFile extends SupplementFileLike>(input: {
  category: SupplementCategory;
  existingFiles?: Array<{ fileName: string; fileSize: number }>;
  currentFiles?: TFile[];
  nextFiles: TFile[];
  maxFiles?: number;
}): SupplementFileSelectionResult<TFile> {
  const maxFiles = input.maxFiles ?? SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH;
  const acceptedFiles = [...(input.currentFiles ?? [])];
  const rejectedFiles: SupplementRejectedFile[] = [];
  const seenKeys = new Set<string>();

  for (const file of input.existingFiles ?? []) {
    seenKeys.add(
      getSupplementFileDedupKey({
        fileName: file.fileName,
        fileSize: file.fileSize,
      }),
    );
  }

  for (const file of acceptedFiles) {
    seenKeys.add(
      getSupplementFileDedupKey({
        fileName: file.name,
        fileSize: file.size,
      }),
    );
  }

  for (const file of input.nextFiles) {
    const validation = validateUpload(file.name, file.size, {
      category: input.category,
    });

    if (!validation.valid) {
      rejectedFiles.push({
        file,
        reason: validation.reason,
      });
      continue;
    }

    const key = getSupplementFileDedupKey({
      fileName: file.name,
      fileSize: file.size,
    });

    if (seenKeys.has(key)) {
      rejectedFiles.push({
        file,
        reason: "DUPLICATE",
      });
      continue;
    }

    if (acceptedFiles.length + (input.existingFiles?.length ?? 0) >= maxFiles) {
      rejectedFiles.push({
        file,
        reason: "COUNT_EXCEEDED",
      });
      continue;
    }

    seenKeys.add(key);
    acceptedFiles.push(file);
  }

  return {
    acceptedFiles,
    rejectedFiles,
  };
}

export function canSubmitSupplementFiles(input: {
  isReviewing: boolean;
  remainingReviewRounds: number;
  isBusy: boolean;
  localFileCount: number;
  draftFileCount: number;
}) {
  return (
    !input.isReviewing &&
    input.remainingReviewRounds > 0 &&
    !input.isBusy &&
    input.localFileCount + input.draftFileCount > 0
  );
}

export function formatSupplementFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}
