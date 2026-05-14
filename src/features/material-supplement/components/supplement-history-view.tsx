"use client";

import { ArrowLeft, CheckCircle2, Clock3, FileText, RefreshCw } from "lucide-react";

import { MarkdownProse } from "@/components/ui/markdown-prose";
import {
  DisclosureSection,
  SectionCard,
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import type { SupplementHistoryResponse } from "@/features/material-supplement/client";
import {
  SUPPLEMENT_CATEGORIES,
  SUPPLEMENT_HISTORY_PAGE_PATH,
  SUPPLEMENT_PAGE_PATH,
  toSupplementCategoryLabel,
} from "@/features/material-supplement/constants";
import type {
  SupplementCategory,
  SupplementFileSummary,
  SupplementHistoryItem,
} from "@/features/material-supplement/types";
import { cn } from "@/lib/utils";

import { formatSupplementDate } from "./supplement-workspace";

type SupplementHistoryViewProps = {
  history: SupplementHistoryResponse;
  isRefreshing: boolean;
  selectedCategory?: SupplementCategory;
  selectedRunNo?: number;
  onRefresh: () => Promise<void> | void;
};

function formatStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function buildHistoryHref(filters?: {
  category?: SupplementCategory;
  runNo?: number;
}) {
  const params = new URLSearchParams();

  if (filters?.category) {
    params.set("category", filters.category);
  }

  if (filters?.runNo !== undefined) {
    params.set("runNo", String(filters.runNo));
  }

  const query = params.toString();
  return query ? `${SUPPLEMENT_HISTORY_PAGE_PATH}?${query}` : SUPPLEMENT_HISTORY_PAGE_PATH;
}

function getRunOptions(items: SupplementHistoryItem[], selectedRunNo?: number) {
  const runNumbers = new Set<number>();

  for (const item of items) {
    if (item.runNo > 0) {
      runNumbers.add(item.runNo);
    }
  }

  if (selectedRunNo !== undefined) {
    runNumbers.add(selectedRunNo);
  }

  return Array.from(runNumbers).sort((left, right) => right - left);
}

function FileList({ files }: { files: SupplementFileSummary[] }) {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-3 py-3 text-sm text-[color:var(--foreground-soft)]">
        No files were attached to this review record.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex flex-col gap-1 rounded-xl border border-[color:var(--border)] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="min-w-0 break-words text-sm font-semibold text-[color:var(--primary)]">
            {file.fileName}
          </span>
          <span className="shrink-0 text-xs text-[color:var(--foreground-soft)]">
            {formatSupplementDate(file.uploadedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RequestList({ item }: { item: SupplementHistoryItem }) {
  if (item.requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-3 py-3 text-sm text-[color:var(--foreground-soft)]">
        No supplement requests were recorded for this category review.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {item.requests.map((request) => (
        <div
          key={request.id}
          className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-[color:var(--primary)]">
                {request.title}
              </p>
              {request.reason ? (
                <MarkdownProse
                  markdown={request.reason}
                  className="mt-1 break-words text-[color:var(--foreground-soft)]"
                />
              ) : null}
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                request.isSatisfied
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--foreground-soft)]",
              )}
            >
              {request.isSatisfied ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              ) : null}
              {formatStatus(request.status)}
            </span>
          </div>
          {request.aiMessage ? (
            <p className="mt-2 text-sm leading-6 break-words text-[color:var(--foreground-soft)]">
              {request.aiMessage}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HistoryRecord({ item }: { item: SupplementHistoryItem }) {
  const categoryLabel = toSupplementCategoryLabel(item.category);

  return (
    <DisclosureSection
      title={`Run ${item.runNo} - ${categoryLabel}`}
      defaultOpen={item.isLatest}
      summary={
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            Reviewed {formatSupplementDate(item.reviewedAt)}
          </span>
          <span>
            {item.files.length} file{item.files.length === 1 ? "" : "s"} ·{" "}
            {item.requests.length} request{item.requests.length === 1 ? "" : "s"}
          </span>
        </div>
      }
      meta={
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <span className="rounded-full border border-[color:var(--border)] bg-white px-2.5 py-1 text-xs font-semibold text-[color:var(--foreground-soft)]">
            {formatStatus(item.status)}
          </span>
          {item.isLatest ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-950">
              latest
            </span>
          ) : null}
        </div>
      }
      contentClassName="space-y-4"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Run", String(item.runNo)],
          ["Category", categoryLabel],
          ["Status", formatStatus(item.status)],
          ["Reviewed", formatSupplementDate(item.reviewedAt)],
        ].map(([label, value]) => (
          <div
            key={`${item.category}-${item.reviewRunId}-${label}`}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3"
          >
            <p className="text-xs font-semibold text-[color:var(--foreground-soft)]">
              {label}
            </p>
            <p className="mt-1 text-sm font-semibold break-words text-[color:var(--primary)]">
              {value}
            </p>
          </div>
        ))}
      </div>

      {item.aiMessage ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-white p-4">
          <p className="text-xs font-semibold text-[color:var(--primary)]">
            AI message
          </p>
          <p className="mt-2 text-sm leading-6 break-words text-[color:var(--foreground-soft)]">
            {item.aiMessage}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--primary)]">
            <FileText className="h-4 w-4" aria-hidden />
            Files
          </p>
          <FileList files={item.files} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[color:var(--primary)]">
            Requests
          </p>
          <RequestList item={item} />
        </div>
      </div>
    </DisclosureSection>
  );
}

export function SupplementHistoryView({
  history,
  isRefreshing,
  selectedCategory,
  selectedRunNo,
  onRefresh,
}: SupplementHistoryViewProps) {
  const hasActiveFilters =
    selectedCategory !== undefined || selectedRunNo !== undefined;
  const runOptions = getRunOptions(history.items, selectedRunNo);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <SectionCard
        title="Supplement review history"
        description="Review historical AI material results, satisfied requests, and uploaded supplement files."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={SUPPLEMENT_PAGE_PATH}
              className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to supplement materials
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
            tone={isRefreshing ? "loading" : "neutral"}
            title={
              isRefreshing
                ? "Refreshing supplement history"
                : `${history.items.length} history record${
                    history.items.length === 1 ? "" : "s"
                  } loaded`
            }
            description="Satisfied requests and prior AI reasons remain visible here even when hidden from the main workspace."
            className="shadow-none"
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border)] bg-white p-3">
              <p className="text-xs font-semibold text-[color:var(--primary)]">
                Category
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={buildHistoryHref({ runNo: selectedRunNo })}
                  className={cn(
                    getButtonClassName(selectedCategory ? "ghost" : "secondary"),
                    "min-h-9 rounded-lg px-3 py-1.5 text-xs",
                  )}
                >
                  All
                </a>
                {SUPPLEMENT_CATEGORIES.map((category) => (
                  <a
                    key={category.key}
                    href={buildHistoryHref({
                      category: category.key,
                      runNo: selectedRunNo,
                    })}
                    className={cn(
                      getButtonClassName(
                        selectedCategory === category.key ? "secondary" : "ghost",
                      ),
                      "min-h-9 rounded-lg px-3 py-1.5 text-xs",
                    )}
                  >
                    {category.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--border)] bg-white p-3">
              <p className="text-xs font-semibold text-[color:var(--primary)]">
                Review run
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a
                  href={buildHistoryHref({ category: selectedCategory })}
                  className={cn(
                    getButtonClassName(selectedRunNo ? "ghost" : "secondary"),
                    "min-h-9 rounded-lg px-3 py-1.5 text-xs",
                  )}
                >
                  All
                </a>
                {runOptions.map((runNo) => (
                  <a
                    key={runNo}
                    href={buildHistoryHref({
                      category: selectedCategory,
                      runNo,
                    })}
                    className={cn(
                      getButtonClassName(
                        selectedRunNo === runNo ? "secondary" : "ghost",
                      ),
                      "min-h-9 rounded-lg px-3 py-1.5 text-xs",
                    )}
                  >
                    Run {runNo}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {history.items.length > 0 ? (
        <SectionCard
          title="History records"
          description="Records are shown in the order returned by the history API."
        >
          <div className="space-y-3">
            {history.items.map((item) => (
              <HistoryRecord
                key={`${item.reviewRunId}-${item.categoryReviewId}`}
                item={item}
              />
            ))}
          </div>
        </SectionCard>
      ) : (
        <StatusBanner
          tone="neutral"
          title={
            hasActiveFilters
              ? "No history records match the current filters."
              : "No supplement history is available yet."
          }
          description={
            hasActiveFilters
              ? "Clear filters to review all available supplement history records."
              : "Historical AI material review results will appear here after review runs are recorded."
          }
        >
          {hasActiveFilters ? (
            <a
              href={SUPPLEMENT_HISTORY_PAGE_PATH}
              className={cn(getButtonClassName("secondary"), "mt-3 w-full sm:w-auto")}
            >
              View all history
            </a>
          ) : null}
        </StatusBanner>
      )}
    </div>
  );
}
