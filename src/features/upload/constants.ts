export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".zip",
  ".rar",
  ".7z",
] as const;

/**
 * Material supplement uploads may be analyzed with Gemini multimodal models.
 * Extensions follow MIME categories documented for the Gemini developer API
 * (same multimodal inputs apply across current model variants; there is no
 * separate published MIME table specifically for “Gemini 3.x Pro”).
 *
 * - Images including HEIC/HEIF: https://ai.google.dev/gemini-api/docs/image-understanding
 * - PDF, JSON, text, images, video (MIME → typical extensions):
 *   https://ai.google.dev/gemini-api/docs/file-input-methods
 * - Files API examples include audio such as MP3:
 *   https://ai.google.dev/gemini-api/docs/files
 *
 * `text/javascript` from the URL-input docs is intentionally omitted here.
 */
export const ALLOWED_SUPPLEMENT_EXTENSIONS = [
  ...ALLOWED_DOCUMENT_EXTENSIONS,
  ".3gp",
  ".avi",
  ".bmp",
  ".csv",
  ".css",
  ".flv",
  ".heic",
  ".heif",
  ".htm",
  ".html",
  ".jpeg",
  ".jpg",
  ".json",
  ".mov",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpg",
  ".png",
  ".rtf",
  ".txt",
  ".webm",
  ".webp",
  ".wmv",
  ".xml",
] as const;

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_ARCHIVE_SIZE_BYTES = 100 * 1024 * 1024;

/** Product category materials: larger single-file cap (no extension restriction in validateUpload). */
export const MAX_PRODUCT_MATERIAL_BYTES = 300 * 1024 * 1024;
