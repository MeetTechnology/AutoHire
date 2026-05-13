"use client";

import { useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";

import { StatusBanner, getButtonClassName } from "@/components/ui/page-shell";
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

const UPLOAD_INPUT_LABEL = "Upload supplement files";

type SupplementFilePickerProps = {
  applicationId: string;
  category: SupplementCategory;
  categoryLabel: string;
  draftFiles: SupplementFileSummary[];
  waitingReviewFiles: SupplementFileSummary[];
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

function waitingFileStatusLabel(isReviewing: boolean) {
  return isReviewing ? "Review in progress" : "Awaiting review";
}

export function SupplementFilePicker({
  applicationId,
  category,
  categoryLabel,
  draftFiles,
  waitingReviewFiles,
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
  const activeBatchId = batchId ?? draftBatchId ?? null;
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

  const hasAnyListedFile =
    waitingReviewFiles.length + draftFiles.length + localFiles.length > 0;

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

  function uploadZonePrompt() {
    if (remainingReviewRounds <= 0) {
      return "Review round limit reached";
    }

    if (isDraftBatchAmbiguous) {
      return "Resolve draft batches before uploading";
    }

    if (isReviewing) {
      return "Review in progress — uploads resume when complete";
    }

    if (hasAnyListedFile) {
      return "Click to add file(s)";
    }

    return "Click to upload file(s)";
  }

  return (
    <div className="flex flex-col gap-4">
      {remainingReviewRounds <= 0 ? (
        <StatusBanner
          tone="danger"
          title="Review round limit reached"
          description="No additional supplement batches can be submitted for this application."
          className="shadow-none border-rose-100 bg-rose-50/70 text-rose-800 [&>div>span.rounded-full]:bg-rose-300"
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

      <div className="flex flex-col gap-2">
        {waitingReviewFiles.map((file) => (
          <div
            key={file.id}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]"
          >
            <p
              className="truncate font-medium text-[color:var(--primary)]"
              title={file.fileName}
            >
              {file.fileName}
            </p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--foreground-soft)]">
              {waitingFileStatusLabel(isReviewing)} ·{" "}
              {formatSupplementFileSize(file.fileSize)} ·{" "}
              {formatDate(file.uploadedAt)}
            </p>
          </div>
        ))}

        {draftFiles.map((file) => (
          <div
            key={file.id}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium text-[color:var(--primary)]">
                {file.fileName}
              </span>
              <button
                type="button"
                disabled={isBusy || isReviewing}
                onClick={() => {
                  void handleDeleteDraft(file.id);
                }}
                className="shrink-0 text-xs font-semibold text-[color:var(--accent)] transition hover:text-[#14532d] disabled:opacity-55"
              >
                Delete
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-[color:var(--foreground-soft)]">
              Draft · {formatSupplementFileSize(file.fileSize)} ·{" "}
              {formatDate(file.uploadedAt)}
            </p>
          </div>
        ))}

        {localFiles.map((file, index) => (
          <div
            key={`${file.name}-${file.size}-${index}`}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium text-[color:var(--primary)]">
                {file.name}
              </span>
              <button
                type="button"
                disabled={isBusy || isReviewing}
                className="shrink-0 text-xs font-semibold text-[color:var(--accent)] transition hover:text-[#14532d] disabled:opacity-55"
                onClick={() => handleRemoveLocal(index)}
              >
                Remove
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-[color:var(--foreground-soft)]">
              Ready to upload · {formatSupplementFileSize(file.size)}
            </p>
          </div>
        ))}

        {!hasAnyListedFile ? (
          <p className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-3 py-3 text-xs tracking-[0.12em] text-[color:var(--foreground-soft)] uppercase">
            No supplement files uploaded yet in this batch
          </p>
        ) : null}
      </div>

      <label
        className={cn("block", selectionDisabled && "pointer-events-none")}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label={UPLOAD_INPUT_LABEL}
          className="sr-only"
          disabled={selectionDisabled}
          onChange={(event) => handleSelect(event.target.files)}
        />
        <div
          className={cn(
            "rounded-xl border border-dashed border-[color:var(--border-strong)] bg-white px-4 py-4 text-center transition",
            !selectionDisabled &&
              "hover:border-[color:var(--primary)] hover:bg-slate-50 cursor-pointer",
            selectionDisabled && "opacity-55",
          )}
        >
          <p className="text-sm font-medium text-[color:var(--primary)]">
            <span className="mr-1 font-semibold" aria-hidden>
              +
            </span>
            {uploadZonePrompt()}
          </p>
        </div>
      </label>

      {message ? (
        <StatusBanner
          tone="neutral"
          title="Notice"
          description={message}
          className="shadow-none"
        />
      ) : null}

      {error ? (
        <StatusBanner
          tone="danger"
          title="Upload failed"
          description={error}
          className="shadow-none"
        />
      ) : null}

      <div className="flex justify-center pt-1">
        <button
          type="button"
          className={cn(
            getButtonClassName("primary"),
            "min-w-[12rem] justify-center",
          )}
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
