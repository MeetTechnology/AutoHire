"use client";

import { ArrowLeft, History, RefreshCw } from "lucide-react";

import {
  SectionCard,
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import {
  SUPPLEMENT_CATEGORIES,
  SUPPLEMENT_HISTORY_PAGE_PATH,
} from "@/features/material-supplement/constants";
import type {
  MaterialSupplementStatus,
  SupplementCategorySnapshot,
  SupplementSnapshot,
} from "@/features/material-supplement/types";
import { cn } from "@/lib/utils";

import { SupplementCategorySection } from "./supplement-category-section";

type SupplementWorkspaceProps = {
  snapshot: SupplementSnapshot;
  isRefreshing: boolean;
  onRefresh: () => Promise<void> | void;
};

type StatusCopy = {
  title: string;
  description: string;
  tone: "neutral" | "loading" | "success" | "danger";
};

const EMPTY_CATEGORY_BASE: Omit<
  SupplementCategorySnapshot,
  "category" | "label"
> = {
  status: "NOT_STARTED",
  isReviewing: false,
  latestCategoryReviewId: null,
  latestReviewedAt: null,
  aiMessage: null,
  pendingRequestCount: 0,
  requests: [],
  draftFiles: [],
  waitingReviewFiles: [],
};

const STATUS_COPY: Record<MaterialSupplementStatus, StatusCopy> = {
  NOT_STARTED: {
    title: "Material review has not started yet.",
    description: "The supplement workspace will update after AI review starts.",
    tone: "neutral",
  },
  REVIEWING: {
    title: "AI material review is in progress.",
    description: "You can refresh this page to check for updated requests.",
    tone: "loading",
  },
  SUPPLEMENT_REQUIRED: {
    title: "Supplement materials are required.",
    description: "Review each category and prepare the requested files.",
    tone: "danger",
  },
  PARTIALLY_SATISFIED: {
    title: "Some supplement requests are still pending.",
    description: "Satisfied requests are hidden here and remain in history.",
    tone: "neutral",
  },
  SATISFIED: {
    title: "Current supplement requests are satisfied.",
    description: "No visible pending requests remain in the main workspace.",
    tone: "success",
  },
  NO_SUPPLEMENT_REQUIRED: {
    title: "No supplement materials are required at this time.",
    description: "The current review did not request additional files.",
    tone: "success",
  },
};

export function formatSupplementDate(value: string | null) {
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

export function normalizeSupplementCategories(
  snapshot: SupplementSnapshot,
): SupplementCategorySnapshot[] {
  const byCategory = new Map(
    snapshot.categories.map((category) => [category.category, category]),
  );

  return SUPPLEMENT_CATEGORIES.map(({ key, label }) => ({
    ...EMPTY_CATEGORY_BASE,
    ...byCategory.get(key),
    category: key,
    label,
  }));
}

function getSupplementStatusCopy(status: MaterialSupplementStatus): StatusCopy {
  return STATUS_COPY[status];
}

export function SupplementWorkspace({
  snapshot,
  isRefreshing,
  onRefresh,
}: SupplementWorkspaceProps) {
  const statusCopy = getSupplementStatusCopy(
    snapshot.summary.materialSupplementStatus,
  );
  const categories = normalizeSupplementCategories(snapshot);
  const metaItems = [
    {
      label: "Pending",
      value: String(snapshot.summary.pendingRequestCount),
    },
    {
      label: "Satisfied",
      value: String(snapshot.summary.satisfiedRequestCount),
    },
    {
      label: "Rounds left",
      value: String(snapshot.summary.remainingReviewRounds),
    },
    {
      label: "Latest review",
      value: formatSupplementDate(snapshot.summary.latestReviewedAt),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SectionCard
        title="Supplement workspace"
        description="Review the latest AI material requests by category."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/apply/submission-complete"
              className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </a>
            <a
              href={SUPPLEMENT_HISTORY_PAGE_PATH}
              className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
            >
              <History className="h-4 w-4" aria-hidden />
              View history
            </a>
            <button
              type="button"
              className={cn(getButtonClassName("primary"), "w-full sm:w-auto")}
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                aria-hidden
              />
              Refresh
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <StatusBanner
            tone={isRefreshing ? "loading" : statusCopy.tone}
            title={isRefreshing ? "Refreshing supplement status" : statusCopy.title}
            description={
              isRefreshing
                ? "Loading the latest AI material review snapshot."
                : statusCopy.description
            }
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {metaItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 px-3 py-3"
              >
                <p className="text-xs font-semibold text-[color:var(--foreground-soft)]">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold break-words text-[color:var(--primary)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {snapshot.summary.satisfiedRequestCount > 0 ? (
            <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
              Satisfied requests are hidden from this workspace and remain
              available on the history page.
            </p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title="Review categories"
        description="Only the six supported supplement categories are shown here."
      >
        <div className="space-y-3">
          {categories.map((category) => (
            <SupplementCategorySection
              key={category.category}
              applicationId={snapshot.applicationId}
              category={category}
              remainingReviewRounds={snapshot.summary.remainingReviewRounds}
              formatDate={formatSupplementDate}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
