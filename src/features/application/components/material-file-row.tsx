"use client";

import { motion } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import type { MaterialFileItem } from "@/features/application/hooks/use-material-upload";

type MaterialFileRowProps = {
  record: MaterialFileItem;
  isReadOnly?: boolean;
  uploadProgress?: number | null;
  errorMessage?: string | null;
  onDelete?: (fileId: string) => void;
};

export function MaterialFileRow({
  record,
  isReadOnly = false,
  uploadProgress = null,
  errorMessage = null,
  onDelete,
}: MaterialFileRowProps) {
  const isPending = Boolean(record.pending);
  const showProgress =
    isPending && typeof uploadProgress === "number" && uploadProgress > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isPending ? 0.85 : 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "rounded-xl border bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]",
        errorMessage
          ? "border-destructive/40"
          : "border-[color:var(--border)]",
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate" title={record.fileName}>
            {record.fileName}
          </span>
          {isPending ? (
            <Badge variant="secondary" className="shrink-0 gap-1">
              <Spinner data-icon="inline-start" />
              Uploading
            </Badge>
          ) : errorMessage ? (
            <Badge variant="destructive" className="shrink-0">
              Failed
            </Badge>
          ) : !isReadOnly && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(record.id)}
              className="shrink-0 text-xs font-medium text-[color:var(--accent)] transition hover:text-[#14532d]"
            >
              Delete
            </button>
          ) : null}
        </div>
        {showProgress ? (
          <Progress value={uploadProgress} className="gap-0">
            <span className="sr-only">Upload progress</span>
          </Progress>
        ) : null}
        {errorMessage ? (
          <p className="text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </div>
    </motion.div>
  );
}
