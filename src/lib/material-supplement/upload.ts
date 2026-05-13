import { randomUUID } from "node:crypto";

import { SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH } from "@/features/material-supplement/constants";
import type {
  SupplementCategory,
  SupplementUploadBatchStatus,
} from "@/features/material-supplement/types";
import {
  attachSupplementFilesToReviewRun,
  claimSupplementUploadBatchReview,
  createSupplementFile,
  createSupplementUploadBatch,
  findActiveSupplementFileDuplicate,
  getSupplementFileById,
  getSupplementUploadBatchById,
  listSupplementFiles,
  reserveSupplementUploadBatchFileSlot,
  softDeleteSupplementFile,
  updateMaterialCategoryReview,
  updateMaterialReviewRun,
} from "@/lib/data/store";
import { createCategoryMaterialReview } from "@/lib/material-review/client";
import { MaterialReviewClientError } from "@/lib/material-review/types";
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
  category: unknown;
  supplementRequestId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  requestOrigin: string;
};

type ConfirmSupplementFileUploadInput = {
  applicationId: string;
  uploadBatchId: string;
  category: unknown;
  supplementRequestId?: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  objectKey: string;
};

type ConfirmSupplementUploadBatchInput = {
  applicationId: string;
  uploadBatchId: string;
  category: unknown;
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

function toConfirmedFileResult(file: {
  id: string;
  uploadBatchId: string;
  category: SupplementCategory;
  supplementRequestId: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: Date;
}) {
  return {
    file: {
      id: file.id,
      uploadBatchId: file.uploadBatchId,
      category: file.category,
      supplementRequestId: file.supplementRequestId,
      fileName: file.fileName,
      fileType: file.fileType,
      fileSize: file.fileSize,
      uploadedAt: file.uploadedAt.toISOString(),
      status: "DRAFT" as const,
    },
  };
}

function toBatchConfirmResult(input: {
  batch: {
    id: string;
    applicationId: string;
    category: SupplementCategory;
    fileCount: number;
    reviewRunId: string | null;
  };
  reviewRunId?: string;
}) {
  const reviewRunId = input.reviewRunId ?? input.batch.reviewRunId;

  if (!reviewRunId) {
    throw new MaterialSupplementServiceError({
      message: "The supplement upload batch has no review run.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_TRIGGER_FAILED,
    });
  }

  return {
    uploadBatchId: input.batch.id,
    applicationId: input.batch.applicationId,
    category: input.batch.category,
    fileCount: input.batch.fileCount,
    reviewRunId,
    status: "REVIEWING" as const,
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

function getSupplementObjectKeyPrefix(input: {
  applicationId: string;
  uploadBatchId: string;
  category: SupplementCategory;
}) {
  return `applications/${input.applicationId}/supplements/${input.category}/${input.uploadBatchId}/`;
}

function assertSupplementObjectKeyScope(input: {
  applicationId: string;
  uploadBatchId: string;
  category: SupplementCategory;
  objectKey: string;
}) {
  const expectedPrefix = getSupplementObjectKeyPrefix(input);

  if (!input.objectKey.startsWith(expectedPrefix)) {
    throw new MaterialSupplementServiceError({
      message:
        "The supplement file object key is outside the expected upload scope.",
      status: 400,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_CONFIRM_FAILED,
      details: {
        expectedPrefix,
      },
    });
  }
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
    category,
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
    category,
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

export async function confirmSupplementFileUpload(
  input: ConfirmSupplementFileUploadInput,
) {
  const category = assertSupportedSupplementCategory(input.category);

  await assertCategoryNotReviewing({
    applicationId: input.applicationId,
    category,
  });
  await assertReviewRoundLimit({
    applicationId: input.applicationId,
    category,
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
      message: "Supplement files can only be confirmed for a draft batch.",
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

  assertSupplementObjectKeyScope({
    applicationId: input.applicationId,
    uploadBatchId: input.uploadBatchId,
    category,
    objectKey: input.objectKey,
  });

  try {
    const file = await createSupplementFile({
      applicationId: input.applicationId,
      category,
      supplementRequestId: input.supplementRequestId,
      uploadBatchId: input.uploadBatchId,
      fileName: input.fileName,
      fileType: input.fileType,
      fileSize: input.fileSize,
      objectKey: input.objectKey,
    });

    return toConfirmedFileResult({
      ...file,
      category: file.category as SupplementCategory,
    });
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to confirm the supplement file upload.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_CONFIRM_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export async function deleteSupplementDraftFile(input: {
  applicationId: string;
  fileId: string;
}) {
  const file = await getSupplementFileById(input.fileId);

  if (!file || file.applicationId !== input.applicationId || file.isDeleted) {
    throw new MaterialSupplementServiceError({
      message: "The supplement file could not be found.",
      status: 404,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_NOT_FOUND,
      details: {
        fileId: input.fileId,
      },
    });
  }

  const batch = await getSupplementUploadBatchById(file.uploadBatchId);

  if (!batch || batch.applicationId !== input.applicationId) {
    throw new MaterialSupplementServiceError({
      message: "The supplement file could not be found.",
      status: 404,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_NOT_FOUND,
      details: {
        fileId: input.fileId,
      },
    });
  }

  if (batch.status !== "DRAFT") {
    throw new MaterialSupplementServiceError({
      message: "Only draft supplement files can be deleted.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_NOT_DRAFT,
      details: {
        fileId: input.fileId,
        uploadBatchId: batch.id,
        status: batch.status,
      },
    });
  }

  await assertCategoryNotReviewing({
    applicationId: input.applicationId,
    category: file.category as SupplementCategory,
  });

  try {
    const deleted = await softDeleteSupplementFile(input.fileId);

    if (!deleted) {
      throw new MaterialSupplementServiceError({
        message: "The supplement file could not be found.",
        status: 404,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_NOT_FOUND,
        details: {
          fileId: input.fileId,
        },
      });
    }

    return {
      deleted: true as const,
      fileId: deleted.id,
      uploadBatchId: deleted.uploadBatchId,
    };
  } catch (error) {
    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to delete the supplement file.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_DELETE_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}

export async function confirmSupplementUploadBatch(
  input: ConfirmSupplementUploadBatchInput,
) {
  const category = assertSupportedSupplementCategory(input.category);
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

  if (batch.status === "REVIEWING" && batch.reviewRunId) {
    return toBatchConfirmResult({ batch });
  }

  if (
    batch.status !== "DRAFT" &&
    !(batch.status === "CONFIRMED" && batch.reviewRunId)
  ) {
    throw new MaterialSupplementServiceError({
      message: "Only draft supplement upload batches can be confirmed.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT,
      details: {
        uploadBatchId: input.uploadBatchId,
        status: batch.status,
      },
    });
  }

  if (batch.status === "DRAFT") {
    await assertCategoryNotReviewing({
      applicationId: input.applicationId,
      category,
    });
    await assertReviewRoundLimit({
      applicationId: input.applicationId,
      category,
    });
  }

  const activeFiles = await listSupplementFiles(input.applicationId, {
    uploadBatchId: input.uploadBatchId,
  });

  if (activeFiles.length === 0) {
    throw new MaterialSupplementServiceError({
      message: "The supplement upload batch has no files to review.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_EMPTY,
      details: {
        uploadBatchId: input.uploadBatchId,
      },
    });
  }

  if (activeFiles.length > SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH) {
    throw new MaterialSupplementServiceError({
      message: "You can upload up to 10 files for one category at a time.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_COUNT_EXCEEDED,
      details: {
        maxFiles: SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH,
        receivedFiles: activeFiles.length,
      },
    });
  }

  const claim = await claimSupplementUploadBatchReview({
    applicationId: input.applicationId,
    category,
    uploadBatchId: input.uploadBatchId,
    maxFiles: SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH,
  });

  if (claim.status === "ALREADY_STARTED") {
    return toBatchConfirmResult({
      batch: {
        ...claim.batch,
        category: claim.batch.category as SupplementCategory,
        fileCount: claim.fileCount,
      },
      reviewRunId: claim.reviewRun.id,
    });
  }

  if (claim.status === "NOT_FOUND") {
    throw new MaterialSupplementServiceError({
      message: "The supplement upload batch could not be found.",
      status: 404,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_FOUND,
      details: {
        uploadBatchId: input.uploadBatchId,
      },
    });
  }

  if (claim.status === "NOT_DRAFT") {
    throw new MaterialSupplementServiceError({
      message: "Only draft supplement upload batches can be confirmed.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_NOT_DRAFT,
      details: {
        uploadBatchId: input.uploadBatchId,
        status: claim.batch.status,
      },
    });
  }

  if (claim.status === "EMPTY") {
    throw new MaterialSupplementServiceError({
      message: "The supplement upload batch has no files to review.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_UPLOAD_BATCH_EMPTY,
      details: {
        uploadBatchId: input.uploadBatchId,
      },
    });
  }

  if (claim.status === "COUNT_EXCEEDED") {
    throw new MaterialSupplementServiceError({
      message: "You can upload up to 10 files for one category at a time.",
      status: 409,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_FILE_COUNT_EXCEEDED,
      details: {
        maxFiles: SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH,
        receivedFiles: claim.fileCount,
      },
    });
  }

  try {
    const externalReview = await createCategoryMaterialReview({
      applicationId: input.applicationId,
      category,
    });
    const updatedRun = await updateMaterialReviewRun(claim.reviewRun.id, {
      status: "PROCESSING",
      externalRunId: externalReview.externalRunId,
      startedAt: externalReview.startedAt
        ? new Date(externalReview.startedAt)
        : new Date(),
      finishedAt: null,
      errorMessage: null,
    });

    if (!updatedRun) {
      throw new MaterialSupplementServiceError({
        message: "Failed to update the supplement review run.",
        status: 500,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_TRIGGER_FAILED,
      });
    }

    const attached = await attachSupplementFilesToReviewRun(
      input.uploadBatchId,
      updatedRun.id,
    );

    return toBatchConfirmResult({
      batch: {
        ...attached.batch,
        category: attached.batch.category as SupplementCategory,
        fileCount: claim.fileCount,
      },
      reviewRunId: updatedRun.id,
    });
  } catch (error) {
    await updateMaterialReviewRun(claim.reviewRun.id, {
      status: "FAILED",
      externalRunId: null,
      errorMessage: error instanceof Error ? error.message : null,
      finishedAt: new Date(),
    });
    await updateMaterialCategoryReview(claim.categoryReview.id, {
      status: "FAILED",
      finishedAt: new Date(),
      aiMessage:
        "The supplement review could not be started. Please try again.",
    });

    if (error instanceof MaterialSupplementServiceError) {
      throw error;
    }

    if (error instanceof MaterialReviewClientError) {
      throw new MaterialSupplementServiceError({
        message: "The material review backend is currently unavailable.",
        status: 503,
        code: SUPPLEMENT_EXPERT_ERROR_CODES.MATERIAL_REVIEW_BACKEND_UNAVAILABLE,
        details: {
          failureCode: error.failureCode,
        },
      });
    }

    throw new MaterialSupplementServiceError({
      message: "Failed to trigger the supplement category review.",
      status: 500,
      code: SUPPLEMENT_EXPERT_ERROR_CODES.SUPPLEMENT_REVIEW_TRIGGER_FAILED,
      details: error instanceof Error ? { cause: error.message } : undefined,
    });
  }
}
