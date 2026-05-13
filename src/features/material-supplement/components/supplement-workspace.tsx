"use client";

import { ArrowLeft, History, RefreshCw } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { SectionCard, getButtonClassName } from "@/components/ui/page-shell";
import {
  SUPPLEMENT_CATEGORIES,
  SUPPLEMENT_HISTORY_PAGE_PATH,
} from "@/features/material-supplement/constants";
import type {
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

export function SupplementWorkspace({
  snapshot,
  isRefreshing,
  onRefresh,
}: SupplementWorkspaceProps) {
  const shouldReduceMotion = useReducedMotion();
  const categories = normalizeSupplementCategories(snapshot);

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
        title="Supplement submissions"
        description="By evidence category—expand each section to address open requests and submit files."
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
        <div className="flex flex-col gap-4">
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
