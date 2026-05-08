"use client";

import { Clock3, History } from "lucide-react";

import {
  DisclosureSection,
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import { SUPPLEMENT_HISTORY_PAGE_PATH } from "@/features/material-supplement/constants";
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
  remainingReviewRounds: number;
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
      description:
        "This category is locked while AI reviews the latest supplement input.",
      tone: "loading",
    };
  }

  switch (category.status) {
    case "NOT_STARTED":
      return {
        title: "This category has not been reviewed yet.",
        description: "It will update after the material review is available.",
        tone: "neutral",
      };
    case "SUPPLEMENT_REQUIRED":
      return {
        title: "Supplement materials are needed.",
        description: "Review the open requests for this category.",
        tone: "danger",
      };
    case "PARTIALLY_SATISFIED":
      return {
        title: "Some requests are still pending.",
        description: "Satisfied requests are hidden here and remain in history.",
        tone: "neutral",
      };
    case "SATISFIED":
      return {
        title: "Current requests are satisfied.",
        description:
          "There are no visible pending requests. You can view completed items in history.",
        tone: "success",
      };
    case "NO_SUPPLEMENT_REQUIRED":
      return {
        title: "No supplement materials are required.",
        description: "The current review did not request files in this category.",
        tone: "success",
      };
    case "REVIEW_FAILED":
      return {
        title: "Category review could not be completed.",
        description: "Refresh later or return to the submission summary.",
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
            <span className="min-w-0 break-words font-medium text-[color:var(--primary)]">
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
  remainingReviewRounds,
  formatDate,
  onRefresh,
}: SupplementCategorySectionProps) {
  const statusCopy = getCategoryStatusCopy(category);
  const visibleRequests = category.requests.filter(
    (request) => !request.isSatisfied && request.status !== "SATISFIED",
  );
  const historyHref = `${SUPPLEMENT_HISTORY_PAGE_PATH}?category=${category.category}`;

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
          <span>
            {category.pendingRequestCount} pending request
            {category.pendingRequestCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            Latest review {formatDate(category.latestReviewedAt)}
          </span>
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
      <StatusBanner
        tone={statusCopy.tone}
        title={statusCopy.title}
        description={statusCopy.description}
        className="shadow-none"
      />

      {category.aiMessage ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-white p-4">
          <p className="text-xs font-semibold text-[color:var(--primary)]">
            Latest AI message
          </p>
          <p className="mt-2 text-sm leading-6 break-words text-[color:var(--foreground-soft)]">
            {category.aiMessage}
          </p>
        </div>
      ) : null}

      {visibleRequests.length > 0 ? (
        <div className="space-y-3">
          {visibleRequests.map((request) => (
            <SupplementRequestCard
              key={request.id}
              request={request}
              formatDate={formatDate}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-4 py-4 text-sm leading-6 text-[color:var(--foreground-soft)]">
          No visible pending requests in this category. Satisfied and historical
          requests remain available in history.
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
        remainingReviewRounds={remainingReviewRounds}
        formatDate={formatDate}
        onRefresh={onRefresh}
      />

      <div className="flex flex-col gap-2 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm leading-6 text-[color:var(--foreground-soft)]">
          Review past requests and completed supplement files for this category.
        </span>
        <a
          href={historyHref}
          className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
        >
          <History className="h-4 w-4" aria-hidden />
          View history
        </a>
      </div>
    </DisclosureSection>
  );
}
