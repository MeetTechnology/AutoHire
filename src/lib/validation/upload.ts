import type { MaterialCategory } from "@/features/application/types";
import { isSupplementCategory } from "@/features/material-supplement/constants";
import type { SupplementCategory } from "@/features/material-supplement/types";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_ARCHIVE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  MAX_PRODUCT_MATERIAL_BYTES,
} from "@/features/upload/constants";

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();

  return ALLOWED_DOCUMENT_EXTENSIONS.some((extension) =>
    lower.endsWith(extension),
  );
}

function isArchive(fileName: string) {
  return [".zip", ".rar", ".7z"].some((extension) =>
    fileName.toLowerCase().endsWith(extension),
  );
}

export function validateUpload(
  fileName: string,
  fileSize: number,
  options?: { category?: MaterialCategory | SupplementCategory },
) {
  if (options?.category === "PRODUCT") {
    if (fileSize > MAX_PRODUCT_MATERIAL_BYTES) {
      return { valid: false, reason: "FILE_TOO_LARGE" as const };
    }

    return { valid: true as const };
  }

  if (options?.category && isSupplementCategory(options.category)) {
    if (!hasAllowedExtension(fileName)) {
      return { valid: false, reason: "UNSUPPORTED_FILE_TYPE" as const };
    }

    if (isArchive(fileName) && fileSize > MAX_ARCHIVE_SIZE_BYTES) {
      return { valid: false, reason: "ARCHIVE_TOO_LARGE" as const };
    }

    if (!isArchive(fileName) && fileSize > MAX_FILE_SIZE_BYTES) {
      return { valid: false, reason: "FILE_TOO_LARGE" as const };
    }

    return { valid: true as const };
  }

  if (options?.category) {
    if (isArchive(fileName) && fileSize > MAX_ARCHIVE_SIZE_BYTES) {
      return { valid: false, reason: "ARCHIVE_TOO_LARGE" as const };
    }

    if (!isArchive(fileName) && fileSize > MAX_FILE_SIZE_BYTES) {
      return { valid: false, reason: "FILE_TOO_LARGE" as const };
    }

    return { valid: true as const };
  }

  if (!hasAllowedExtension(fileName)) {
    return { valid: false, reason: "UNSUPPORTED_FILE_TYPE" as const };
  }

  if (isArchive(fileName) && fileSize > MAX_ARCHIVE_SIZE_BYTES) {
    return { valid: false, reason: "ARCHIVE_TOO_LARGE" as const };
  }

  if (!isArchive(fileName) && fileSize > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: "FILE_TOO_LARGE" as const };
  }

  return { valid: true as const };
}
