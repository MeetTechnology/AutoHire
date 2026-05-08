"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Trash2, Upload } from "lucide-react";

import {
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import {
  confirmSupplementFileUpload,
  confirmSupplementUploadBatch,
  createSupplementUploadBatch,
  createSupplementUploadIntent,
  deleteSupplementDraftFile,
  uploadSupplementBinary,
} from "@/features/material-supplement/client";
import { SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH } from "@/features/material-supplement/constants";
import {
  canSubmitSupplementFiles,
  formatSupplementFileSize,
  getSupplementDraftBatchId,
  selectSupplementFiles,
  type SupplementRejectedFile,
} from "@/features/material-supplement/file-validation";
import type {
  SupplementCategory,
  SupplementFileSummary,
} from "@/features/material-supplement/types";
import { cn } from "@/lib/utils";

type SupplementFilePickerProps = {
  applicationId: string;
  category: SupplementCategory;
  categoryLabel: string;
  draftFiles: SupplementFileSummary[];
  isReviewing: boolean;
  remainingReviewRounds: number;
  formatDate: (value: string | null) => string;
  onRefresh: () => Promise<void> | void;
};

type PickerStatus = "idle" | "uploading" | "deleting" | "confirming";

function toFileType(file: File) {
  return file.type || "application/octet-stream";
}

function toSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "The supplement file action could not be completed.";
}

function getRejectedSummary(rejectedFiles: SupplementRejectedFile[]) {
  if (rejectedFiles.length === 0) {
    return null;
  }

  const byReason = rejectedFiles.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});

  const parts = Object.entries(byReason).map(([reason, count]) => {
    switch (reason) {
      case "DUPLICATE":
        return `${count} duplicate file${count === 1 ? "" : "s"} skipped`;
      case "COUNT_EXCEEDED":
        return `${count} file${count === 1 ? "" : "s"} over the 10-file limit skipped`;
      case "UNSUPPORTED_FILE_TYPE":
        return `${count} unsupported file type${count === 1 ? "" : "s"} skipped`;
      case "ARCHIVE_TOO_LARGE":
        return `${count} archive${count === 1 ? "" : "s"} over 100 MB skipped`;
      default:
        return `${count} file${count === 1 ? "" : "s"} over 20 MB skipped`;
    }
  });

  return parts.join("; ");
}

export function SupplementFilePicker({
  applicationId,
  category,
  categoryLabel,
  draftFiles,
  isReviewing,
  remainingReviewRounds,
  formatDate,
  onRefresh,
}: SupplementFilePickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBusy = status !== "idle";
  const draftBatchId = getSupplementDraftBatchId(draftFiles);
  const activeBatchId = batchId ?? (draftBatchId ?? null);
  const isDraftBatchAmbiguous = draftBatchId === undefined;
  const selectionDisabled =
    isBusy ||
    isReviewing ||
    remainingReviewRounds <= 0 ||
    isDraftBatchAmbiguous ||
    localFiles.length + draftFiles.length >=
      SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH;
  const submitEnabled =
    !isDraftBatchAmbiguous &&
    canSubmitSupplementFiles({
      isReviewing,
      remainingReviewRounds,
      isBusy,
      localFileCount: localFiles.length,
      draftFileCount: draftFiles.length,
    });

  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleSelect(files: FileList | null) {
    if (!files || selectionDisabled) {
      resetFileInput();
      return;
    }

    const result = selectSupplementFiles({
      category,
      existingFiles: draftFiles,
      currentFiles: localFiles,
      nextFiles: Array.from(files),
    });
    const rejectedSummary = getRejectedSummary(result.rejectedFiles);

    setLocalFiles(result.acceptedFiles);
    setError(null);
    setMessage(rejectedSummary);
    resetFileInput();
  }

  function handleRemoveLocal(fileIndex: number) {
    setLocalFiles((files) => files.filter((_, index) => index !== fileIndex));
    setError(null);
  }

  async function handleDeleteDraft(fileId: string) {
    if (isBusy || isReviewing) {
      return;
    }

    setStatus("deleting");
    setError(null);
    setMessage(null);

    try {
      await deleteSupplementDraftFile(applicationId, fileId);
      await onRefresh();
    } catch (nextError) {
      setError(toSafeErrorMessage(nextError));
    } finally {
      setStatus("idle");
    }
  }

  async function ensureBatchId() {
    if (activeBatchId) {
      return activeBatchId;
    }

    const batch = await createSupplementUploadBatch(applicationId, {
      category,
    });
    setBatchId(batch.uploadBatchId);
    return batch.uploadBatchId;
  }

  async function handleSubmit() {
    if (!submitEnabled) {
      return;
    }

    setStatus(localFiles.length > 0 ? "uploading" : "confirming");
    setError(null);
    setMessage(null);

    try {
      const nextBatchId = await ensureBatchId();

      for (const file of localFiles) {
        const intent = await createSupplementUploadIntent(applicationId, {
          uploadBatchId: nextBatchId,
          category,
          fileName: file.name,
          fileType: toFileType(file),
          fileSize: file.size,
        });
        await uploadSupplementBinary(intent, file);
        await confirmSupplementFileUpload(applicationId, {
          uploadBatchId: nextBatchId,
          category,
          fileName: file.name,
          fileType: toFileType(file),
          fileSize: file.size,
          objectKey: intent.objectKey,
        });
      }

      setStatus("confirming");
      await confirmSupplementUploadBatch(applicationId, nextBatchId, {
        category,
      });
      setLocalFiles([]);
      setBatchId(null);
      await onRefresh();
      setMessage(`${categoryLabel} files were submitted for AI review.`);
    } catch (nextError) {
      setError(toSafeErrorMessage(nextError));
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--border)] bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[color:var(--primary)]">
            Supplement upload
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--foreground-soft)]">
            Add up to {SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH} files for this
            category, then submit them for a category-only review.
          </p>
        </div>
        <label
          className={cn(
            getButtonClassName("secondary"),
            "w-full cursor-pointer sm:w-auto",
            selectionDisabled && "pointer-events-none opacity-55",
          )}
        >
          <FileUp className="h-4 w-4" aria-hidden />
          Choose files
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            disabled={selectionDisabled}
            onChange={(event) => handleSelect(event.target.files)}
          />
        </label>
      </div>

      {isReviewing ? (
        <StatusBanner
          tone="loading"
          title="Uploads are locked"
          description="This category is reviewing the latest supplement input."
          className="shadow-none"
        />
      ) : null}

      {remainingReviewRounds <= 0 ? (
        <StatusBanner
          tone="neutral"
          title="Review round limit reached"
          description="No additional supplement batches can be submitted for this application."
          className="shadow-none"
        />
      ) : null}

      {isDraftBatchAmbiguous ? (
        <StatusBanner
          tone="danger"
          title="Draft files need cleanup"
          description="This category has draft files across multiple batches. Delete the stale drafts before submitting a new review batch."
          className="shadow-none"
        />
      ) : null}

      {message ? (
        <StatusBanner
          tone="neutral"
          title="Supplement upload notice"
          description={message}
          className="shadow-none"
        />
      ) : null}

      {error ? (
        <StatusBanner
          tone="danger"
          title="Supplement upload failed"
          description={error}
          className="shadow-none"
        />
      ) : null}

      <div className="space-y-2">
        {localFiles.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="flex flex-col gap-2 rounded-lg bg-[color:var(--muted)]/35 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words font-medium text-[color:var(--primary)]">
                {file.name}
              </p>
              <p className="text-xs text-[color:var(--foreground-soft)]">
                Ready to upload - {formatSupplementFileSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)] disabled:opacity-55"
              disabled={isBusy || isReviewing}
              onClick={() => handleRemoveLocal(index)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove
            </button>
          </div>
        ))}

        {draftFiles.map((file) => (
          <div
            key={file.id}
            className="flex flex-col gap-2 rounded-lg bg-[color:var(--muted)]/35 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words font-medium text-[color:var(--primary)]">
                {file.fileName}
              </p>
              <p className="text-xs text-[color:var(--foreground-soft)]">
                Draft - {formatSupplementFileSize(file.fileSize)} -{" "}
                {formatDate(file.uploadedAt)}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--accent)] disabled:opacity-55"
              disabled={isBusy || isReviewing}
              onClick={() => {
                void handleDeleteDraft(file.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </button>
          </div>
        ))}

        {localFiles.length === 0 && draftFiles.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[color:var(--border)] px-3 py-3 text-xs tracking-[0.12em] text-[color:var(--foreground-soft)] uppercase">
            No supplement files selected
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-[color:var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-xs text-[color:var(--foreground-soft)]">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {localFiles.length + draftFiles.length}/
          {SUPPLEMENT_UPLOAD_MAX_FILES_PER_BATCH} files in this batch
        </p>
        <button
          type="button"
          className={cn(getButtonClassName("primary"), "w-full sm:w-auto")}
          disabled={!submitEnabled}
          onClick={() => {
            void handleSubmit();
          }}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {status === "uploading"
            ? "Uploading"
            : status === "confirming"
              ? "Submitting"
              : "Submit for review"}
        </button>
      </div>
    </div>
  );
}
