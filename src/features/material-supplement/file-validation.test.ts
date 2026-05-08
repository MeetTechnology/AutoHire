import { describe, expect, it } from "vitest";

import {
  canSubmitSupplementFiles,
  formatSupplementFileSize,
  getSupplementDraftBatchId,
  getSupplementFileDedupKey,
  selectSupplementFiles,
  type SupplementFileLike,
} from "@/features/material-supplement/file-validation";
import type { SupplementFileSummary } from "@/features/material-supplement/types";

function file(name: string, size: number, type = "application/pdf") {
  return {
    name,
    size,
    type,
  } satisfies SupplementFileLike;
}

function draftFile(input: {
  id: string;
  uploadBatchId: string;
  fileName: string;
  fileSize: number;
}): SupplementFileSummary {
  return {
    id: input.id,
    uploadBatchId: input.uploadBatchId,
    fileName: input.fileName,
    fileType: "application/pdf",
    fileSize: input.fileSize,
    uploadedAt: "2026-05-05T10:03:00.000Z",
  };
}

describe("material supplement file validation", () => {
  it("builds dedup keys from file name and size", () => {
    expect(
      getSupplementFileDedupKey({
        fileName: " Proof.PDF ",
        fileSize: 123,
      }),
    ).toBe("proof.pdf::123");
  });

  it("deduplicates selected files against current and draft files", () => {
    const result = selectSupplementFiles({
      category: "EDUCATION",
      existingFiles: [{ fileName: "degree.pdf", fileSize: 100 }],
      currentFiles: [file("passport.pdf", 200)],
      nextFiles: [
        file("degree.pdf", 100),
        file("passport.pdf", 200),
        file("employment.pdf", 300),
      ],
    });

    expect(result.acceptedFiles.map((item) => item.name)).toEqual([
      "passport.pdf",
      "employment.pdf",
    ]);
    expect(result.rejectedFiles.map((item) => item.reason)).toEqual([
      "DUPLICATE",
      "DUPLICATE",
    ]);
  });

  it("rejects files past the per-batch maximum", () => {
    const result = selectSupplementFiles({
      category: "EDUCATION",
      existingFiles: Array.from({ length: 9 }, (_, index) => ({
        fileName: `draft-${index}.pdf`,
        fileSize: index + 1,
      })),
      nextFiles: [file("one.pdf", 100), file("two.pdf", 200)],
    });

    expect(result.acceptedFiles.map((item) => item.name)).toEqual(["one.pdf"]);
    expect(result.rejectedFiles).toHaveLength(1);
    expect(result.rejectedFiles[0]?.reason).toBe("COUNT_EXCEEDED");
  });

  it("uses existing upload validation for type and size", () => {
    const result = selectSupplementFiles({
      category: "EDUCATION",
      nextFiles: [
        file("notes.exe", 100),
        file("large.pdf", 21 * 1024 * 1024),
        file("large.zip", 101 * 1024 * 1024),
      ],
    });

    expect(result.acceptedFiles).toEqual([]);
    expect(result.rejectedFiles.map((item) => item.reason)).toEqual([
      "UNSUPPORTED_FILE_TYPE",
      "FILE_TOO_LARGE",
      "ARCHIVE_TOO_LARGE",
    ]);
  });

  it("detects whether draft files belong to one batch", () => {
    expect(getSupplementDraftBatchId([])).toBeNull();
    expect(
      getSupplementDraftBatchId([
        draftFile({
          id: "file_1",
          uploadBatchId: "batch_1",
          fileName: "one.pdf",
          fileSize: 1,
        }),
      ]),
    ).toBe("batch_1");
    expect(
      getSupplementDraftBatchId([
        draftFile({
          id: "file_1",
          uploadBatchId: "batch_1",
          fileName: "one.pdf",
          fileSize: 1,
        }),
        draftFile({
          id: "file_2",
          uploadBatchId: "batch_2",
          fileName: "two.pdf",
          fileSize: 2,
        }),
      ]),
    ).toBeUndefined();
  });

  it("derives submit availability", () => {
    expect(
      canSubmitSupplementFiles({
        isReviewing: false,
        remainingReviewRounds: 1,
        isBusy: false,
        localFileCount: 1,
        draftFileCount: 0,
      }),
    ).toBe(true);
    expect(
      canSubmitSupplementFiles({
        isReviewing: true,
        remainingReviewRounds: 1,
        isBusy: false,
        localFileCount: 1,
        draftFileCount: 0,
      }),
    ).toBe(false);
    expect(
      canSubmitSupplementFiles({
        isReviewing: false,
        remainingReviewRounds: 0,
        isBusy: false,
        localFileCount: 1,
        draftFileCount: 0,
      }),
    ).toBe(false);
    expect(
      canSubmitSupplementFiles({
        isReviewing: false,
        remainingReviewRounds: 1,
        isBusy: false,
        localFileCount: 0,
        draftFileCount: 0,
      }),
    ).toBe(false);
  });

  it("formats file sizes for display", () => {
    expect(formatSupplementFileSize(512)).toBe("1 KB");
    expect(formatSupplementFileSize(1536)).toBe("2 KB");
    expect(formatSupplementFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });
});
