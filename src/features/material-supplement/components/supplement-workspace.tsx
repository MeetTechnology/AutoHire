"use client";

import { ArrowLeft, History, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import {
  MetaStrip,
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
  remainingReviewRounds: 0,
  pendingRequestCount: 0,
  requests: [],
  draftFiles: [],
  waitingReviewFiles: [],
};

const STATUS_COPY: Record<MaterialSupplementStatus, StatusCopy> = {
  NOT_STARTED: {
    title: "Material review has not started.",
    description: "Refresh after the AI review starts.",
    tone: "neutral",
  },
  REVIEWING: {
    title: "AI review is in progress.",
    description: "Refresh to check for updates.",
    tone: "loading",
  },
  SUPPLEMENT_REQUIRED: {
    title: "Supplement materials are needed.",
    description: "Open the marked categories and submit the requested files.",
    tone: "danger",
  },
  PARTIALLY_SATISFIED: {
    title: "Some requests are still open.",
    description: "Only open requests are shown here.",
    tone: "neutral",
  },
  SATISFIED: {
    title: "All current requests are satisfied.",
    description: "Completed items remain in history.",
    tone: "success",
  },
  NO_SUPPLEMENT_REQUIRED: {
    title: "No supplement materials are needed.",
    description: "The current review did not request more files.",
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
  const shouldReduceMotion = useReducedMotion();
  const statusCopy = getSupplementStatusCopy(
    snapshot.summary.materialSupplementStatus,
  );
  const categories = normalizeSupplementCategories(snapshot);
  const categoriesWithWork = categories.filter(
    (category) =>
      category.pendingRequestCount > 0 ||
      category.isReviewing ||
      category.draftFiles.length > 0 ||
      category.waitingReviewFiles.length > 0,
  ).length;
  const metaItems = [
    {
      label: "Pending",
      value: String(snapshot.summary.pendingRequestCount),
    },
    {
      label: "Rounds left",
      value: String(snapshot.summary.remainingReviewRounds),
    },
    {
      label: "Active categories",
      value: String(categoriesWithWork),
    },
    {
      label: "Latest review",
      value: formatSupplementDate(snapshot.summary.latestReviewedAt),
    },
  ];

  return (
    <motion.div
      className="mx-auto max-w-5xl space-y-4"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <SectionCard
        title="AI supplement review"
        description="Open a category when it has pending requests or files waiting for review."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/apply/submission-complete"
              className={cn(
                getButtonClassName("secondary"),
                "w-full sm:w-auto",
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </a>
            <a
              href={SUPPLEMENT_HISTORY_PAGE_PATH}
              className={cn(
                getButtonClassName("secondary"),
                "w-full sm:w-auto",
              )}
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
            title={isRefreshing ? "Refreshing status" : statusCopy.title}
            description={
              isRefreshing
                ? "Loading the latest review snapshot."
                : statusCopy.description
            }
          />

          <MetaStrip items={metaItems} />

          <motion.div
            className="space-y-3"
            initial={shouldReduceMotion ? false : "hidden"}
            animate="shown"
            variants={{
              hidden: {},
              shown: {
                transition: {
                  staggerChildren: 0.035,
                  delayChildren: 0.04,
                },
              },
            }}
          >
            {categories.map((category) => (
              <motion.div
                key={category.category}
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  shown: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <SupplementCategorySection
                  applicationId={snapshot.applicationId}
                  category={category}
                  formatDate={formatSupplementDate}
                  onRefresh={onRefresh}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </SectionCard>
    </motion.div>
  );
}
