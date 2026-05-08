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

import { PageFrame, PageShell, StatusBanner } from "@/components/ui/page-shell";
import { fetchSession } from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  buildApplyFlowStepLinks,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";
import {
  classifySupplementAccessError,
  isBlockingSupplementAccessError,
  type SupplementAccessErrorState,
} from "@/features/material-supplement/access-error";
import {
  fetchSupplementHistory,
  type SupplementHistoryFilters,
  type SupplementHistoryResponse,
} from "@/features/material-supplement/client";
import { SupplementAccessError } from "@/features/material-supplement/components/supplement-access-error";
import { SupplementHistoryView } from "@/features/material-supplement/components/supplement-history-view";
import { isSupplementCategory } from "@/features/material-supplement/constants";
import type { SupplementCategory } from "@/features/material-supplement/types";
import { trackPageView } from "@/lib/tracking/client";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";

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
  const [history, setHistory] = useState<SupplementHistoryResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessError, setAccessError] =
    useState<SupplementAccessErrorState | null>(null);
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
          setAccessError(null);
        }

        const nextHistory = await fetchSupplementHistory(
          applicationId,
          parsedFilters.filters,
        );
        if (!isCurrentRequest()) {
          return;
        }
        setHistory(nextHistory);
        setAccessError(null);
        setRefreshError(null);
      } catch (nextError) {
        if (!isCurrentRequest()) {
          return;
        }

        const nextAccessError = classifySupplementAccessError(nextError);

        if (refreshing) {
          if (isBlockingSupplementAccessError(nextError)) {
            setHistory(null);
            setAccessError(nextAccessError);
            setRefreshError(null);
          } else {
            setRefreshError(nextAccessError.description);
          }
        } else {
          setHistory(null);
          setAccessError(nextAccessError);
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
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
        await loadSupplementHistory(nextSnapshot.applicationId);
      } catch (nextError) {
        if (active) {
          setSnapshot(null);
          setHistory(null);
          setAccessError(classifySupplementAccessError(nextError));
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

          {!isLoading && accessError ? (
            <SupplementAccessError
              error={accessError}
              isRefreshing={isRefreshing}
              continueHref={
                snapshot
                  ? resolveRouteFromStatus(snapshot.applicationStatus)
                  : "/apply"
              }
              onRefresh={
                snapshot?.applicationId
                  ? () =>
                      loadSupplementHistory(snapshot.applicationId, {
                        refreshing: true,
                      })
                  : undefined
              }
            />
          ) : null}

          {!isLoading && !accessError && history ? (
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
