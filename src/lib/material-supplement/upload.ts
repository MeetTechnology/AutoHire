import { randomUUID } from "node:crypto";

import { SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH } from "@/features/material-supplement/constants";
import type {
  SupplementCategory,
  SupplementUploadBatchStatus,
} from "@/features/material-supplement/types";
import {
  createSupplementUploadBatch,
  findActiveSupplementFileDuplicate,
  getSupplementUploadBatchById,
  reserveSupplementUploadBatchFileSlot,
} from "@/lib/data/store";
import {
  MaterialSupplementServiceError,
  SUPPLEMENT_EXPERT_ERROR_CODES,
} from "@/lib/material-supplement/errors";
import {
  assertCategoryNotReviewing,
  assertReviewRoundLimit,
  assertSupportedSupplementCategory,
} from "@/lib/material-supplement/service";
import { createUploadIntent } from "@/lib/upload/service";
import { validateUpload } from "@/lib/validation/upload";

type SupplementUploadBatchResult = {
  uploadBatchId: string;
  applicationId: string;
  category: SupplementCategory;
  status: SupplementUploadBatchStatus;
  fileCount: number;
  createdAt: string;
};

type CreateSupplementUploadIntentInput = {
  applicationId: string;
  uploadBatchId: string;
  category: SupplementCategory;
  supplementRequestId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  requestOrigin: string;
};

function toUploadBatchResult(batch: {
  id: string;
  applicationId: string;
  category: SupplementCategory;
  status: SupplementUploadBatchStatus;
  fileCount: number;
  createdAt: Date;
}): SupplementUploadBatchResult {
  return {
    uploadBatchId: batch.id,
    applicationId: batch.applicationId,
    category: batch.category,
    status: batch.status,
    fileCount: batch.fileCount,
    createdAt: batch.createdAt.toISOString(),
  };
}

function createSupplementObjectKey(input: {
  applicationId: string;
  uploadBatchId: string;
  category: SupplementCategory;
  fileName: string;
  uploadId: string;
}) {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();

  return `applications/${input.applicationId}/supplements/${input.category}/${input.uploadBatchId}/${input.uploadId}-${timestamp}-${safeName}`;
}

function toFileSizeErrorReason(reason: string) {
  return reason === "UNSUPPORTED_FILE_TYPE"
    ? SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_TYPE_UNSUPPORTED
    : SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_SIZE_EXCEEDED;
}

export async function createSupplementUploadBatchIntent(input: {
  applicationId: string;
  category: unknown;
}) {
  const category = assertSupportedSupplementCategory(input.category);

  await assertCategoryNotReviewing({
    applicationId: input.applicationId,
    category,
  });
  await assertReviewRoundLimit({
    applicationId: input.applicationId,
  });

  try {
    const batch = await createSupplementUploadBatch({
      applicationId: input.applicationId,
      category,
    });

    return toUploadBatchResult(batch);
  } catch (error) {
    throw new MaterialSupplementServiceError({
      message: "Failed to create the supplement upload batch.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_CREATE_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export async function createSupplementUploadIntent(
  input: CreateSupplementUploadIntentInput,
) {
  const category = assertSupportedSupplementCategory(input.category);

  await assertCategoryNotReviewing({
    applicationId: input.applicationId,
    category,
  });
  await assertReviewRoundLimit({
    applicationId: input.applicationId,
  });

  const batch = await getSupplementUploadBatchById(input.uploadBatchId);

  if (
    !batch ||
    batch.applicationId !== input.applicationId ||
    batch.category !== category
  ) {
    throw new MaterialSupplementServiceError({
      message: "The supplement upload batch could not be found.",
      status: 404,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND,
      details: {
        uploadBatchId: input.uploadBatchId,
      },
    });
  }

  if (batch.status !== "DRAFT") {
    throw new MaterialSupplementServiceError({
      message: "Supplement files can only be uploaded to a draft batch.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT,
      details: {
        uploadBatchId: input.uploadBatchId,
        status: batch.status,
      },
    });
  }

  const validation = validateUpload(input.fileName, input.fileSize, {
    category,
  });

  if (!validation.valid) {
    throw new MaterialSupplementServiceError({
      message: "The file does not meet the supplement upload requirements.",
      status: 400,
      code: toFileSizeErrorReason(validation.reason),
      details: {
        reason: validation.reason,
      },
    });
  }

  const duplicate = await findActiveSupplementFileDuplicate(
    input.applicationId,
    category,
    input.fileName,
    input.fileSize,
  );

  if (duplicate) {
    throw new MaterialSupplementServiceError({
      message: "A supplement file with the same name and size already exists.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_DUPLICATE,
      details: {
        fileId: duplicate.id,
        fileName: input.fileName,
        fileSize: input.fileSize,
      },
    });
  }

  const uploadId = `supplement_upload_${randomUUID().replaceAll("-", "")}`;
  const objectKey = createSupplementObjectKey({
    applicationId: input.applicationId,
    uploadBatchId: input.uploadBatchId,
    category,
    fileName: input.fileName,
    uploadId,
  });

  try {
    const reservation = await reserveSupplementUploadBatchFileSlot({
      applicationId: input.applicationId,
      category,
      uploadBatchId: input.uploadBatchId,
      maxFiles: SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH,
    });

    if (reservation.status === "NOT_FOUND") {
      throw new MaterialSupplementServiceError({
        message: "The supplement upload batch could not be found.",
        status: 404,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND,
        details: {
          uploadBatchId: input.uploadBatchId,
        },
      });
    }

    if (reservation.status === "NOT_DRAFT") {
      throw new MaterialSupplementServiceError({
        message: "Supplement files can only be uploaded to a draft batch.",
        status: 409,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT,
        details: {
          uploadBatchId: input.uploadBatchId,
          status: reservation.batch.status,
        },
      });
    }

    if (reservation.status === "COUNT_EXCEEDED") {
      throw new MaterialSupplementServiceError({
        message: "You can upload up to 10 files for one category at a time.",
        status: 409,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_COUNT_EXCEEDED,
        details: {
          maxFiles: SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH,
          currentFiles: reservation.batch.fileCount,
        },
      });
    }

    const intent = await createUploadIntent({
      fileType: input.fileType,
      objectKey,
      requestOrigin: input.requestOrigin,
    });

    return {
      uploadId,
      ...intent,
      deduped: false,
    };
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Unable to create the supplement upload intent.",
      status: 502,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_INTENT_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}
