"use client";

import { Clock3 } from "lucide-react";

import { DisclosureSection, StatusBanner } from "@/components/ui/page-shell";
import type { SupplementCategorySnapshot } from "@/features/material-supplement/types";
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
  switch (category.status) {
    case "REVIEWING":
      return {
        title: "This category is still updating.",
        description: "Refresh shortly for the latest result.",
        tone: "neutral",
      };
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
            <span
              className={cn(
                category.status === "SATISFIED" ||
                  category.status === "NO_SUPPLEMENT_REQUIRED"
                  ? "font-semibold text-emerald-950"
                  : undefined,
              )}
            >
              {category.status.replaceAll("_", " ").toLowerCase()}
            </span>
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
                : category.status === "SATISFIED" ||
                    category.status === "NO_SUPPLEMENT_REQUIRED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
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
        <div className="flex flex-col gap-3">
          {visibleRequests.map((request) => (
            <SupplementRequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : null}

      <SupplementFilePicker
        applicationId={applicationId}
        category={category.category}
        categoryLabel={category.label}
        draftFiles={category.draftFiles}
        waitingReviewFiles={category.waitingReviewFiles}
        isReviewing={category.isReviewing || category.status === "REVIEWING"}
        remainingReviewRounds={category.remainingReviewRounds}
        formatDate={formatDate}
        onRefresh={onRefresh}
      />
    </DisclosureSection>
  );
}
