"use client";

import type { ReactNode } from "react";
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  ListFilter,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

function formatRecordCount(count: number) {
  return `${count} history record${count === 1 ? "" : "s"}`;
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
  return query
    ? `${SUPPLEMENT_HISTORY_PAGE_PATH}?${query}`
    : SUPPLEMENT_HISTORY_PAGE_PATH;
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

function getActiveFilterLabel(input: {
  selectedCategory?: SupplementCategory;
  selectedRunNo?: number;
}) {
  const filters: string[] = [];

  if (input.selectedCategory) {
    filters.push(toSupplementCategoryLabel(input.selectedCategory));
  }

  if (input.selectedRunNo !== undefined) {
    filters.push(`Run ${input.selectedRunNo}`);
  }

  return filters.length > 0 ? filters.join(" / ") : "All records";
}

function getRequestBadgeVariant(input: {
  isSatisfied: boolean;
  status: string;
}): "success" | "secondary" | "outline" {
  if (input.isSatisfied) {
    return "success";
  }

  if (input.status === "HISTORY_ONLY") {
    return "outline";
  }

  return "secondary";
}

function RequestStatusBadge({
  isSatisfied,
  status,
}: {
  isSatisfied: boolean;
  status: string;
}) {
  const Icon = isSatisfied
    ? CheckCircle2
    : status === "HISTORY_ONLY"
      ? Archive
      : CircleDot;

  return (
    <Badge
      variant={getRequestBadgeVariant({ isSatisfied, status })}
      className="min-h-7 gap-1.5 text-left whitespace-normal capitalize"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {formatStatus(status)}
    </Badge>
  );
}

function ReviewStatusBadge({
  status,
  isLatest,
}: {
  status: string;
  isLatest?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-start gap-1.5 sm:justify-end">
      <Badge variant={status === "COMPLETED" ? "success" : "secondary"}>
        {formatStatus(status)}
      </Badge>
      {isLatest ? <Badge variant="outline">latest</Badge> : null}
    </div>
  );
}

function FilterLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none",
        isActive
          ? "border-[color:var(--primary)] bg-white text-[color:var(--primary)] shadow-sm"
          : "border-transparent bg-transparent text-[color:var(--foreground-soft)] hover:bg-white hover:text-[color:var(--primary)]",
      )}
    >
      {children}
    </a>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <ListFilter
          className="size-3.5 text-[color:var(--foreground-soft)]"
          aria-hidden
        />
        <p className="text-xs font-semibold text-[color:var(--primary)]">
          {label}
        </p>
      </div>
      <div className="flex max-w-full gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function FileList({ files }: { files: SupplementFileSummary[] }) {
  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]">
        No files attached.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex min-w-0 flex-col gap-1 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="min-w-0 text-sm leading-5 font-semibold break-words text-[color:var(--primary)]">
            <FileText
              className="mr-1.5 inline size-3.5 align-[-2px] text-[color:var(--foreground-soft)]"
              aria-hidden
            />
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
      <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground-soft)]">
        No requests recorded.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {item.requests.map((request) => (
        <RequestItem key={request.id} request={request} />
      ))}
    </div>
  );
}

function RequestItem({
  request,
}: {
  request: SupplementHistoryItem["requests"][number];
}) {
  const requestMessage = request.reason ?? request.aiMessage;

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm leading-5 font-semibold break-words text-[color:var(--primary)]">
            {request.title}
          </p>
          {requestMessage ? (
            <div className="mt-1 max-w-none break-words">
              <MarkdownProse markdown={requestMessage} />
            </div>
          ) : null}
        </div>
        <div className="shrink-0">
          <RequestStatusBadge
            isSatisfied={request.isSatisfied}
            status={request.status}
          />
        </div>
      </div>
    </div>
  );
}

function HistoryRecord({ item }: { item: SupplementHistoryItem }) {
  const categoryLabel = toSupplementCategoryLabel(item.category);
  const reviewedAt = formatSupplementDate(item.reviewedAt);

  return (
    <DisclosureSection
      title={`Run ${item.runNo} - ${categoryLabel}`}
      defaultOpen={item.isLatest}
      summary={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-sm">
            <Clock3 className="size-3.5" aria-hidden />
            Reviewed {reviewedAt}
          </span>
          <span className="text-sm">
            {item.files.length} file{item.files.length === 1 ? "" : "s"} ·{" "}
            {item.requests.length} request
            {item.requests.length === 1 ? "" : "s"}
          </span>
        </div>
      }
      meta={<ReviewStatusBadge status={item.status} isLatest={item.isLatest} />}
      contentClassName="flex flex-col gap-4"
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Run", String(item.runNo)],
          ["Category", categoryLabel],
          ["Status", formatStatus(item.status)],
          ["Reviewed", reviewedAt],
        ].map(([label, value]) => (
          <div
            key={`${item.category}-${item.reviewRunId}-${label}`}
            className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5"
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

      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-semibold text-[color:var(--primary)]">
            Requests
          </p>
          <RequestList item={item} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--primary)]">
            <FileText className="size-4" aria-hidden />
            Files
          </p>
          <FileList files={item.files} />
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
  const activeFilterLabel = getActiveFilterLabel({
    selectedCategory,
    selectedRunNo,
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <SectionCard
        title="Supplement review history"
        description="Historical AI checks, request outcomes, and files from submitted supplement reviews."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={SUPPLEMENT_PAGE_PATH}
              className={cn(
                getButtonClassName("secondary"),
                "w-full sm:w-auto",
              )}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to supplement materials
            </a>
            <button
              type="button"
              className={cn(getButtonClassName("primary"), "w-full sm:w-auto")}
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-live="polite"
            >
              <RefreshCw
                className={cn("size-4", isRefreshing && "animate-spin")}
                aria-hidden
              />
              {isRefreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              "grid gap-3 rounded-xl border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]",
              isRefreshing
                ? "border-sky-200 bg-sky-50 text-[color:var(--primary)]"
                : "border-[color:var(--border)] bg-[color:var(--background-elevated)]",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[color:var(--primary)]">
                {isRefreshing
                  ? "Refreshing supplement history"
                  : `${formatRecordCount(history.items.length)} loaded`}
              </p>
              <p className="mt-1 text-sm leading-6 break-words text-[color:var(--foreground-soft)]">
                Showing {activeFilterLabel}. Satisfied requests remain visible
                here for audit review.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2 sm:justify-end">
              <Badge variant={hasActiveFilters ? "default" : "secondary"}>
                {activeFilterLabel}
              </Badge>
              {isRefreshing ? <Badge variant="outline">syncing</Badge> : null}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FilterGroup label="Category">
              <FilterLink
                href={buildHistoryHref({ runNo: selectedRunNo })}
                isActive={!selectedCategory}
              >
                All
              </FilterLink>
              {SUPPLEMENT_CATEGORIES.map((category) => (
                <FilterLink
                  key={category.key}
                  href={buildHistoryHref({
                    category: category.key,
                    runNo: selectedRunNo,
                  })}
                  isActive={selectedCategory === category.key}
                >
                  {category.label}
                </FilterLink>
              ))}
            </FilterGroup>

            <FilterGroup label="Review run">
              <FilterLink
                href={buildHistoryHref({ category: selectedCategory })}
                isActive={selectedRunNo === undefined}
              >
                All
              </FilterLink>
              {runOptions.map((runNo) => (
                <FilterLink
                  key={runNo}
                  href={buildHistoryHref({
                    category: selectedCategory,
                    runNo,
                  })}
                  isActive={selectedRunNo === runNo}
                >
                  Run {runNo}
                </FilterLink>
              ))}
            </FilterGroup>
          </div>
        </div>
      </SectionCard>

      {history.items.length > 0 ? (
        <SectionCard title="History records">
          <div className="flex flex-col gap-3">
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
              ? "Clear filters to view every recorded supplement review."
              : "History appears after AI material review runs are recorded."
          }
        >
          {hasActiveFilters ? (
            <a
              href={SUPPLEMENT_HISTORY_PAGE_PATH}
              className={cn(
                getButtonClassName("secondary"),
                "mt-3 w-full sm:w-auto",
              )}
            >
              View all history
            </a>
          ) : null}
        </StatusBanner>
      )}
    </div>
  );
}

export function SupplementHistoryLoadingPlaceholder() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4" aria-hidden>
      <SectionCard title="Supplement review history">
        <div className="flex animate-pulse flex-col gap-4">
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-3">
            <div className="h-4 w-48 rounded bg-slate-200" />
            <div className="mt-3 h-3 w-full max-w-xl rounded bg-slate-100" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/45 p-3"
              >
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-3 flex gap-2 overflow-hidden">
                  {[0, 1, 2].map((segment) => (
                    <div
                      key={segment}
                      className="h-10 w-24 shrink-0 rounded-lg bg-white"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
      <SectionCard title="History records">
        <div className="flex animate-pulse flex-col gap-3">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4"
            >
              <div className="h-4 w-56 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-full max-w-lg rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
