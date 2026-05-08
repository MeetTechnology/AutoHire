"use client";

import { ArrowRight, RefreshCw } from "lucide-react";

import {
  SectionCard,
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import { SUPPLEMENT_PAGE_PATH } from "@/features/material-supplement/constants";
import type {
  MaterialSupplementStatus,
  SupplementSummary,
} from "@/features/material-supplement/types";
import { cn } from "@/lib/utils";

type SupplementSummaryCardProps = {
  summary: SupplementSummary | null;
  isLoading: boolean;
  isStartingInitialReview: boolean;
  isAwaitingInitialReviewResult: boolean;
  error: string | null;
  initialReviewError: string | null;
  onRefresh: () => void;
};

type StatusCopy = {
  title: string;
  description: string;
  tone: "neutral" | "loading" | "success" | "danger";
};

const STATUS_COPY: Record<MaterialSupplementStatus, StatusCopy> = {
  NOT_STARTED: {
    title: "Material review has not started yet.",
    description: "We are preparing your first AI material review.",
    tone: "neutral",
  },
  REVIEWING: {
    title: "AI material review is in progress.",
    description:
      "You can open the supplement page now and check back as the review updates.",
    tone: "loading",
  },
  SUPPLEMENT_REQUIRED: {
    title: "Supplement materials are required.",
    description:
      "Review the pending requests and upload the requested supporting files.",
    tone: "danger",
  },
  PARTIALLY_SATISFIED: {
    title: "Some supplement requests are still pending.",
    description:
      "A few requests are satisfied, but more material is still needed.",
    tone: "neutral",
  },
  SATISFIED: {
    title: "Supplement requests are satisfied.",
    description:
      "Your submitted supplement materials have satisfied the current requests.",
    tone: "success",
  },
  NO_SUPPLEMENT_REQUIRED: {
    title: "No supplement materials are required at this time.",
    description:
      "The current AI material review did not find any additional file requests.",
    tone: "success",
  },
};

function formatReviewTime(value: string | null) {
  if (!value) {
    return "Not reviewed yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not reviewed yet";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusCopy(summary: SupplementSummary | null): StatusCopy {
  if (!summary) {
    return {
      title: "Preparing AI material review",
      description: "Loading the latest material review status.",
      tone: "loading",
    };
  }

  return STATUS_COPY[summary.materialSupplementStatus];
}

export function SupplementSummaryCard({
  summary,
  isLoading,
  isStartingInitialReview,
  isAwaitingInitialReviewResult,
  error,
  initialReviewError,
  onRefresh,
}: SupplementSummaryCardProps) {
  const copy = getStatusCopy(summary);
  const isBusy = isLoading || isStartingInitialReview;
  const shouldShowInitialReviewProgress =
    isStartingInitialReview || isAwaitingInitialReviewResult;
  const metaItems = [
    {
      label: "Pending",
      value: String(summary?.pendingRequestCount ?? 0),
    },
    {
      label: "Satisfied",
      value: String(summary?.satisfiedRequestCount ?? 0),
    },
    {
      label: "Rounds left",
      value: String(summary?.remainingReviewRounds ?? 0),
    },
    {
      label: "Latest review",
      value: formatReviewTime(summary?.latestReviewedAt ?? null),
    },
  ];

  return (
    <SectionCard
      title="AI material review"
      description="Check whether any supplement materials are needed after submission."
      action={
        <button
          type="button"
          className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
          onClick={onRefresh}
          disabled={isBusy}
        >
          <RefreshCw
            className={cn("h-4 w-4", isBusy && "animate-spin")}
            aria-hidden
          />
          Refresh status
        </button>
      }
      className="mx-auto max-w-[48rem] border-[color:var(--border)] bg-white shadow-none"
    >
      <div className="flex flex-col gap-4">
        {error ? (
          <StatusBanner
            tone="danger"
            title="Material review status could not be loaded"
            description={error}
          />
        ) : (
          <StatusBanner
            tone={
              isBusy || isAwaitingInitialReviewResult ? "loading" : copy.tone
            }
            title={
              shouldShowInitialReviewProgress
                ? "Starting AI material review"
                : copy.title
            }
            description={
              shouldShowInitialReviewProgress
                ? "The first review is being created. You can refresh this status shortly."
                : copy.description
            }
          />
        )}

        {initialReviewError ? (
          <StatusBanner
            tone="danger"
            title="The material review could not be started"
            description={initialReviewError}
          />
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {metaItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 px-3 py-3"
            >
              <p className="text-xs font-semibold text-[color:var(--foreground-soft)]">
                {item.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--primary)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
            Open the supplement workspace to review AI requests and upload
            files when needed.
          </p>
          <a
            href={SUPPLEMENT_PAGE_PATH}
            className={cn(getButtonClassName("primary"), "w-full sm:w-auto")}
          >
            View supplement requests
            <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </SectionCard>
  );
}
