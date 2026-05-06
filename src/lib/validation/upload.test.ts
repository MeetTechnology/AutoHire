import { describe, expect, it } from "vitest";

import {
  MAX_ARCHIVE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
  MAX_PRODUCT_MATERIAL_BYTES,
} from "@/features/upload/constants";
import { validateUpload } from "@/lib/validation/upload";

describe("validateUpload", () => {
  it("accepts a valid pdf file", () => {
    expect(validateUpload("resume.pdf", MAX_FILE_SIZE_BYTES)).toEqual({
      valid: true,
    });
  });

  it("rejects image types when category is omitted (resume path)", () => {
    expect(validateUpload("photo.png", 1024)).toEqual({
      valid: false,
      reason: "UNSUPPORTED_FILE_TYPE",
    });
  });

  it("accepts any extension for original non-product material categories within size cap", () => {
    expect(
      validateUpload("paper-scan.jpg", MAX_FILE_SIZE_BYTES, {
        category: "PAPER",
      }),
    ).toEqual({ valid: true });
    expect(
      validateUpload("book-video.mov", 1024, { category: "BOOK" }),
    ).toEqual({ valid: true });
  });

  it("accepts supplement categories when the file matches the shared allowlist", () => {
    expect(
      validateUpload("supplement.pdf", MAX_FILE_SIZE_BYTES, {
        category: "PROJECT",
      }),
    ).toEqual({ valid: true });
    expect(
      validateUpload("records.zip", MAX_ARCHIVE_SIZE_BYTES, {
        category: "HONOR",
      }),
    ).toEqual({ valid: true });
  });

  it("rejects supplement categories when the extension is outside the shared allowlist", () => {
    expect(
      validateUpload("supplement.mov", MAX_FILE_SIZE_BYTES, {
        category: "PROJECT",
      }),
    ).toEqual({
      valid: false,
      reason: "UNSUPPORTED_FILE_TYPE",
    });
  });

  it("rejects files above standard cap for original non-product material categories", () => {
    expect(
      validateUpload("paper-scan.jpg", MAX_FILE_SIZE_BYTES + 1, {
        category: "PAPER",
      }),
    ).toEqual({
      valid: false,
      reason: "FILE_TOO_LARGE",
    });
  });

  it("rejects supplement category files above the archive and standard caps", () => {
    expect(
      validateUpload("records.zip", MAX_ARCHIVE_SIZE_BYTES + 1, {
        category: "PATENT",
      }),
    ).toEqual({
      valid: false,
      reason: "ARCHIVE_TOO_LARGE",
    });

    expect(
      validateUpload("statement.pdf", MAX_FILE_SIZE_BYTES + 1, {
        category: "EMPLOYMENT",
      }),
    ).toEqual({
      valid: false,
      reason: "FILE_TOO_LARGE",
    });
  });

  it("rejects unsupported file types on resume path", () => {
    expect(validateUpload("resume.exe", 1024)).toEqual({
      valid: false,
      reason: "UNSUPPORTED_FILE_TYPE",
    });
  });

  it("rejects archives above the archive limit", () => {
    expect(validateUpload("materials.zip", MAX_ARCHIVE_SIZE_BYTES + 1)).toEqual(
      {
        valid: false,
        reason: "ARCHIVE_TOO_LARGE",
      },
    );
  });

  it("accepts product category files up to 300MB regardless of extension", () => {
    expect(
      validateUpload("demo.bin", MAX_PRODUCT_MATERIAL_BYTES, {
        category: "PRODUCT",
      }),
    ).toEqual({ valid: true });
  });

  it("rejects product files above 300MB", () => {
    expect(
      validateUpload("large.bin", MAX_PRODUCT_MATERIAL_BYTES + 1, {
        category: "PRODUCT",
      }),
    ).toEqual({
      valid: false,
      reason: "FILE_TOO_LARGE",
    });
  });
});
