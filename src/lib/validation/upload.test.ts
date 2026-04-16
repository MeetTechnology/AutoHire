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

  it("accepts any extension for non-product material categories within size cap", () => {
    expect(
      validateUpload("passport.jpg", MAX_FILE_SIZE_BYTES, {
        category: "IDENTITY",
      }),
    ).toEqual({ valid: true });
    expect(
      validateUpload("clip.mov", 1024, { category: "EDUCATION" }),
    ).toEqual({ valid: true });
  });

  it("rejects files above standard cap for non-product material categories", () => {
    expect(
      validateUpload("passport.jpg", MAX_FILE_SIZE_BYTES + 1, {
        category: "IDENTITY",
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
