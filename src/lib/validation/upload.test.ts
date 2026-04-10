import { describe, expect, it } from "vitest";

import {
  MAX_ARCHIVE_SIZE_BYTES,
  MAX_FILE_SIZE_BYTES,
} from "@/features/upload/constants";
import { validateUpload } from "@/lib/validation/upload";

describe("validateUpload", () => {
  it("accepts a valid pdf file", () => {
    expect(validateUpload("resume.pdf", MAX_FILE_SIZE_BYTES)).toEqual({
      valid: true,
    });
  });

  it("rejects unsupported file types", () => {
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
});
