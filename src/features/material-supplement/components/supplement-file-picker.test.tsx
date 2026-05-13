// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as supplementClient from "@/features/material-supplement/client";
import { SupplementFilePicker } from "@/features/material-supplement/components/supplement-file-picker";
import type { SupplementFileSummary } from "@/features/material-supplement/types";

vi.mock("@/features/material-supplement/client", () => ({
  createSupplementUploadBatch: vi.fn(),
  createSupplementUploadIntent: vi.fn(),
  uploadSupplementBinary: vi.fn(),
  confirmSupplementFileUpload: vi.fn(),
  confirmSupplementUploadBatch: vi.fn(),
  deleteSupplementDraftFile: vi.fn(),
}));

const formatDate = (value: string | null) => value ?? "Not reviewed yet";

function file(name: string, size: number, type = "application/pdf") {
  return new File(["x".repeat(Math.max(1, size))], name, { type });
}

function draftFile(input: {
  id?: string;
  uploadBatchId?: string;
  fileName?: string;
  fileSize?: number;
} = {}): SupplementFileSummary {
  return {
    id: input.id ?? "file_1",
    uploadBatchId: input.uploadBatchId ?? "batch_1",
    fileName: input.fileName ?? "draft.pdf",
    fileType: "application/pdf",
    fileSize: input.fileSize ?? 1024,
    uploadedAt: "2026-05-05T10:03:00.000Z",
  };
}

function renderPicker(
  props: Partial<React.ComponentProps<typeof SupplementFilePicker>> = {},
) {
  const onRefresh = props.onRefresh ?? vi.fn();

  render(
    <SupplementFilePicker
      applicationId="app_123"
      category="EDUCATION"
      categoryLabel="Education Documents"
      draftFiles={[]}
      waitingReviewFiles={[]}
      isReviewing={false}
      remainingReviewRounds={2}
      formatDate={formatDate}
      onRefresh={onRefresh}
      {...props}
    />,
  );

  return { onRefresh };
}

describe("SupplementFilePicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supplementClient.createSupplementUploadBatch).mockResolvedValue({
      uploadBatchId: "batch_123",
      applicationId: "app_123",
      category: "EDUCATION",
      status: "DRAFT",
      fileCount: 0,
      createdAt: "2026-05-05T10:03:00.000Z",
    });
    vi.mocked(supplementClient.createSupplementUploadIntent).mockResolvedValue({
      uploadId: "upload_123",
      uploadUrl: "https://upload.example.test",
      method: "PUT",
      headers: {},
      objectKey: "objects/degree.pdf",
      deduped: false,
    });
    vi.mocked(supplementClient.uploadSupplementBinary).mockResolvedValue();
    vi.mocked(supplementClient.confirmSupplementFileUpload).mockResolvedValue({
      file: {
        id: "file_uploaded",
        uploadBatchId: "batch_123",
        category: "EDUCATION",
        supplementRequestId: null,
        fileName: "degree.pdf",
        fileType: "application/pdf",
        fileSize: 1024,
        uploadedAt: "2026-05-05T10:03:00.000Z",
        status: "DRAFT",
      },
    });
    vi.mocked(supplementClient.confirmSupplementUploadBatch).mockResolvedValue({
      uploadBatchId: "batch_123",
      applicationId: "app_123",
      category: "EDUCATION",
      fileCount: 1,
      reviewRunId: "run_123",
      status: "REVIEWING",
    });
    vi.mocked(supplementClient.deleteSupplementDraftFile).mockResolvedValue({
      deleted: true,
      fileId: "file_1",
      uploadBatchId: "batch_1",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows selected files in the pending upload list", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.upload(
      screen.getByLabelText("Upload supplement files"),
      file("degree.pdf", 1024),
    );

    expect(screen.getByText("degree.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Ready to upload · 1 KB/i)).toBeInTheDocument();
  });

  it("deduplicates selected files by file name and size and shows a notice", async () => {
    const user = userEvent.setup();
    renderPicker({
      draftFiles: [
        draftFile({
          fileName: "degree.pdf",
          fileSize: 1024,
        }),
      ],
    });

    await user.upload(screen.getByLabelText("Upload supplement files"), [
      file("degree.pdf", 1024),
      file("passport.pdf", 2048),
    ]);

    expect(screen.getByText("passport.pdf")).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate file skipped/i)).toBeInTheDocument();
    expect(screen.getAllByText("degree.pdf")).toHaveLength(1);
  });

  it("skips files over the 10-file batch limit and shows a limit notice", async () => {
    const user = userEvent.setup();
    renderPicker({
      draftFiles: Array.from({ length: 9 }, (_, index) =>
        draftFile({
          id: `draft_${index}`,
          fileName: `draft-${index}.pdf`,
          fileSize: index + 1,
        }),
      ),
    });

    await user.upload(screen.getByLabelText("Upload supplement files"), [
      file("one.pdf", 1024),
      file("two.pdf", 2048),
    ]);

    expect(screen.getByText("one.pdf")).toBeInTheDocument();
    expect(screen.queryByText("two.pdf")).not.toBeInTheDocument();
    expect(
      screen.getByText(/1 file over the 10-file limit skipped/i),
    ).toBeInTheDocument();
  });

  it("locks selection, deletion, and submission while the category is reviewing", () => {
    renderPicker({
      isReviewing: true,
      draftFiles: [draftFile()],
    });

    expect(screen.getByLabelText("Upload supplement files")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Delete/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /Submit for review/i }),
    ).toBeDisabled();
  });

  it("submits selected files for only the current category and refreshes", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    renderPicker({ onRefresh });

    await user.upload(
      screen.getByLabelText("Upload supplement files"),
      file("degree.pdf", 1024),
    );
    await user.click(screen.getByRole("button", { name: /Submit for review/i }));

    await waitFor(() => {
      expect(supplementClient.confirmSupplementUploadBatch).toHaveBeenCalled();
    });

    expect(supplementClient.createSupplementUploadBatch).toHaveBeenCalledWith(
      "app_123",
      { category: "EDUCATION" },
    );
    expect(supplementClient.createSupplementUploadIntent).toHaveBeenCalledWith(
      "app_123",
      expect.objectContaining({
        uploadBatchId: "batch_123",
        category: "EDUCATION",
        fileName: "degree.pdf",
      }),
    );
    expect(supplementClient.confirmSupplementFileUpload).toHaveBeenCalledWith(
      "app_123",
      expect.objectContaining({
        uploadBatchId: "batch_123",
        category: "EDUCATION",
        fileName: "degree.pdf",
        objectKey: "objects/degree.pdf",
      }),
    );
    expect(supplementClient.confirmSupplementUploadBatch).toHaveBeenCalledWith(
      "app_123",
      "batch_123",
      { category: "EDUCATION" },
    );
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        "Education Documents files were submitted for AI review.",
      ),
    ).toBeInTheDocument();
  });
});
