"use client";

import { Clock3 } from "lucide-react";

import { DisclosureSection, StatusBanner } from "@/components/ui/page-shell";
import type {
  SupplementCategorySnapshot,
  SupplementFileSummary,
} from "@/features/material-supplement/types";
import { cn } from "@/lib/utils";

import { SupplementRequestCard } from "./supplement-request-card";
import { SupplementFilePicker } from "./supplement-file-picker";

type SupplementCategorySectionProps = {
  applicationId: string;
  category: SupplementCategorySnapshot;
  formatDate: (value: string | null) => string;
  onRefresh: () => Promise<void> | void;
};

type StatusCopy = {
  title: string;
  description: string;
  tone: "neutral" | "loading" | "success" | "danger";
};

function getCategoryStatusCopy(
  category: SupplementCategorySnapshot,
): StatusCopy {
  if (category.isReviewing || category.status === "REVIEWING") {
    return {
      title: "Category review is in progress.",
      description: "Uploads are locked until the review finishes.",
      tone: "loading",
    };
  }

  switch (category.status) {
    case "NOT_STARTED":
      return {
        title: "This category has not been reviewed yet.",
        description: "It will update after review.",
        tone: "neutral",
      };
    case "SUPPLEMENT_REQUIRED":
      return {
        title: "Files are needed.",
        description: "Review the open requests below.",
        tone: "danger",
      };
    case "PARTIALLY_SATISFIED":
      return {
        title: "Some requests are still open.",
        description: "Completed requests are in history.",
        tone: "neutral",
      };
    case "SATISFIED":
      return {
        title: "Current requests are satisfied.",
        description: "No open requests remain.",
        tone: "success",
      };
    case "NO_SUPPLEMENT_REQUIRED":
      return {
        title: "No supplement materials are required.",
        description: "No files are needed for this category.",
        tone: "success",
      };
    case "REVIEW_FAILED":
      return {
        title: "Category review could not be completed.",
        description: "Refresh later.",
        tone: "danger",
      };
    default:
      return {
        title: "Category status is unavailable.",
        description: "Refresh to load the latest category review.",
        tone: "neutral",
      };
  }
}

function FileList({
  title,
  files,
  formatDate,
}: {
  title: string;
  files: SupplementFileSummary[];
  formatDate: (value: string | null) => string;
}) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white p-3">
      <p className="text-xs font-semibold text-[color:var(--primary)]">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex flex-col gap-1 rounded-lg bg-[color:var(--muted)]/35 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0 font-medium break-words text-[color:var(--primary)]">
              {file.fileName}
            </span>
            <span className="shrink-0 text-xs text-[color:var(--foreground-soft)]">
              {formatDate(file.uploadedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SupplementCategorySection({
  applicationId,
  category,
  formatDate,
  onRefresh,
}: SupplementCategorySectionProps) {
  const statusCopy = getCategoryStatusCopy(category);
  const visibleRequests = category.requests.filter(
    (request) => !request.isSatisfied && request.status !== "SATISFIED",
  );
  const shouldShowStatusBanner =
    category.isReviewing ||
    category.status === "SUPPLEMENT_REQUIRED" ||
    category.status === "PARTIALLY_SATISFIED" ||
    category.status === "REVIEW_FAILED";

  return (
    <DisclosureSection
      title={category.label}
      defaultOpen={
        category.status === "SUPPLEMENT_REQUIRED" ||
        category.status === "PARTIALLY_SATISFIED" ||
        category.isReviewing
      }
      summary={
        <div className="flex flex-col gap-1">
          {category.pendingRequestCount > 0 ? (
            <span>
              {category.pendingRequestCount} open request
              {category.pendingRequestCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span>{category.status.replaceAll("_", " ").toLowerCase()}</span>
          )}
          {category.latestReviewedAt ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              Latest review {formatDate(category.latestReviewedAt)}
            </span>
          ) : null}
        </div>
      }
      meta={
        <span
          className={cn(
            "hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex",
            category.isReviewing
              ? "border-sky-200 bg-sky-50 text-sky-950"
              : category.status === "SUPPLEMENT_REQUIRED"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-[color:var(--border)] bg-white text-[color:var(--foreground-soft)]",
          )}
        >
          {category.status.replaceAll("_", " ").toLowerCase()}
        </span>
      }
      contentClassName="space-y-4"
    >
      {shouldShowStatusBanner ? (
        <StatusBanner
          tone={statusCopy.tone}
          title={statusCopy.title}
          description={statusCopy.description}
          className="shadow-none"
        />
      ) : null}

      {visibleRequests.length > 0 ? (
        <div className="space-y-3">
          {visibleRequests.map((request) => (
            <SupplementRequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-4 py-4 text-sm leading-6 text-[color:var(--foreground-soft)]">
          No open requests in this category.
        </div>
      )}

      <div className="grid gap-3">
        <FileList
          title="Waiting review files"
          files={category.waitingReviewFiles}
          formatDate={formatDate}
        />
      </div>

      <SupplementFilePicker
        applicationId={applicationId}
        category={category.category}
        categoryLabel={category.label}
        draftFiles={category.draftFiles}
        isReviewing={category.isReviewing || category.status === "REVIEWING"}
        remainingReviewRounds={category.remainingReviewRounds}
        formatDate={formatDate}
        onRefresh={onRefresh}
      />
    </DisclosureSection>
  );
}
