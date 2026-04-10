export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".zip",
  ".rar",
  ".7z",
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_ARCHIVE_SIZE_BYTES = 100 * 1024 * 1024;
