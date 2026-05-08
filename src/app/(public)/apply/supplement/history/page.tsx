"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  PageFrame,
  PageShell,
  StatusBanner,
  getButtonClassName,
} from "@/components/ui/page-shell";
import { fetchSession } from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  buildApplyFlowStepLinks,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";
import {
  MaterialSupplementClientError,
  fetchSupplementHistory,
  type SupplementHistoryFilters,
  type SupplementHistoryResponse,
} from "@/features/material-supplement/client";
import { SupplementHistoryView } from "@/features/material-supplement/components/supplement-history-view";
import { isSupplementCategory } from "@/features/material-supplement/constants";
import type { SupplementCategory } from "@/features/material-supplement/types";
import { trackPageView } from "@/lib/tracking/client";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";
import { cn } from "@/lib/utils";

function toSafeSupplementHistoryError(error: unknown) {
  if (error instanceof MaterialSupplementClientError) {
    if (error.status === 401 || error.status === 403) {
      return "Your supplement session is no longer valid. Return to the application entry or refresh after restoring access.";
    }

    if (error.code === "APPLICATION_NOT_SUBMITTED") {
      return "This application has not been submitted yet, so supplement history is not available.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The supplement history could not be loaded. Please refresh later.";
}

function parseRunNo(value: string | null) {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function parseHistoryFilters(searchParams: URLSearchParams) {
  const category = searchParams.get("category");
  const runNo = parseRunNo(searchParams.get("runNo"));
  const filters: SupplementHistoryFilters = {};
  let selectedCategory: SupplementCategory | undefined;

  if (isSupplementCategory(category)) {
    filters.category = category;
    selectedCategory = category;
  }

  if (runNo !== undefined) {
    filters.runNo = runNo;
  }

  return {
    filters,
    selectedCategory,
    selectedRunNo: runNo,
  };
}

function SupplementHistoryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [history, setHistory] = useState<SupplementHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const hasTrackedPageView = useRef(false);
  const historyRequestIdRef = useRef(0);

  const parsedFilters = useMemo(
    () => parseHistoryFilters(searchParams),
    [searchParams],
  );

  usePageDurationTracking({
    pageName: "apply_supplement_history",
    stepName: "supplement_history",
    applicationId:
      snapshot?.applicationStatus === "SUBMITTED"
        ? snapshot.applicationId
        : null,
  });

  const loadSupplementHistory = useCallback(
    async (applicationId: string, options?: { refreshing?: boolean }) => {
      const refreshing = options?.refreshing ?? false;
      const requestId = historyRequestIdRef.current + 1;
      historyRequestIdRef.current = requestId;

      function isCurrentRequest() {
        return historyRequestIdRef.current === requestId;
      }

      try {
        if (refreshing) {
          setIsRefreshing(true);
          setRefreshError(null);
        } else {
          setError(null);
        }

        const nextHistory = await fetchSupplementHistory(
          applicationId,
          parsedFilters.filters,
        );
        if (!isCurrentRequest()) {
          return;
        }
        setHistory(nextHistory);
        setError(null);
        setRefreshError(null);
      } catch (nextError) {
        if (!isCurrentRequest()) {
          return;
        }

        if (refreshing) {
          setRefreshError(toSafeSupplementHistoryError(nextError));
        } else {
          setHistory(null);
          setError(toSafeSupplementHistoryError(nextError));
        }
      } finally {
        if (refreshing && isCurrentRequest()) {
          setIsRefreshing(false);
        }
      }
    },
    [parsedFilters.filters],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setIsLoading(true);
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (nextSnapshot.applicationStatus !== "SUBMITTED") {
          router.replace(resolveRouteFromStatus(nextSnapshot.applicationStatus));
          return;
        }

        setSnapshot(nextSnapshot);
        await loadSupplementHistory(nextSnapshot.applicationId);
      } catch (nextError) {
        if (active) {
          setHistory(null);
          setError(toSafeSupplementHistoryError(nextError));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadSupplementHistory, router]);

  useEffect(() => {
    if (
      !snapshot ||
      snapshot.applicationStatus !== "SUBMITTED" ||
      hasTrackedPageView.current
    ) {
      return;
    }

    hasTrackedPageView.current = true;
    void trackPageView({
      pageName: "apply_supplement_history",
      stepName: "supplement_history",
      applicationId: snapshot.applicationId,
    });
  }, [snapshot]);

  const flowStepLinks = buildApplyFlowStepLinks(
    snapshot?.applicationStatus ?? "SUBMITTED",
  );

  return (
    <PageFrame>
      <PageShell
        title="Supplement Review History"
        description="Review prior AI material checks, uploaded supplement files, and satisfied requests after submission."
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={3}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={3}
      >
        <div className="mx-auto max-w-5xl space-y-4">
          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Loading supplement history"
              description="Restoring your submitted application and historical AI review records."
            />
          ) : null}

          {!isLoading && error ? (
            <StatusBanner
              tone="danger"
              title="Supplement history could not be loaded"
              description={error}
            >
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {snapshot?.applicationId ? (
                  <button
                    type="button"
                    className={cn(
                      getButtonClassName("secondary"),
                      "w-full sm:w-auto",
                    )}
                    onClick={() => {
                      void loadSupplementHistory(snapshot.applicationId, {
                        refreshing: true,
                      });
                    }}
                    disabled={isRefreshing}
                  >
                    Refresh
                  </button>
                ) : null}
                <a
                  href="/apply"
                  className={cn(getButtonClassName("secondary"), "w-full sm:w-auto")}
                >
                  Back to application entry
                </a>
              </div>
            </StatusBanner>
          ) : null}

          {!isLoading && !error && history ? (
            <>
              {refreshError ? (
                <StatusBanner
                  tone="danger"
                  title="Supplement history could not be refreshed"
                  description={refreshError}
                />
              ) : null}
              <SupplementHistoryView
                history={history}
                isRefreshing={isRefreshing}
                selectedCategory={parsedFilters.selectedCategory}
                selectedRunNo={parsedFilters.selectedRunNo}
                onRefresh={() =>
                  loadSupplementHistory(history.applicationId, {
                    refreshing: true,
                  })
                }
              />
            </>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}

export default function SupplementHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-slate-600">
          Loading supplement history...
        </div>
      }
    >
      <SupplementHistoryPageContent />
    </Suspense>
  );
}
