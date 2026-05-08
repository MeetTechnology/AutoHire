"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  fetchSupplementSnapshot,
} from "@/features/material-supplement/client";
import { SupplementWorkspace } from "@/features/material-supplement/components/supplement-workspace";
import type { SupplementSnapshot } from "@/features/material-supplement/types";
import { trackPageView } from "@/lib/tracking/client";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";
import { cn } from "@/lib/utils";

function toSafeSupplementError(error: unknown) {
  if (error instanceof MaterialSupplementClientError) {
    if (error.status === 401 || error.status === 403) {
      return "Your supplement session is no longer valid. Return to the application entry or refresh after restoring access.";
    }

    if (error.code === "APPLICATION_NOT_SUBMITTED") {
      return "This application has not been submitted yet, so supplement requests are not available.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "The supplement workspace could not be loaded. Please refresh later.";
}

export default function SupplementPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [supplementSnapshot, setSupplementSnapshot] =
    useState<SupplementSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const hasTrackedPageView = useRef(false);

  usePageDurationTracking({
    pageName: "apply_supplement",
    stepName: "supplement",
    applicationId:
      snapshot?.applicationStatus === "SUBMITTED"
        ? snapshot.applicationId
        : null,
  });

  const loadSupplementSnapshot = useCallback(
    async (applicationId: string, options?: { refreshing?: boolean }) => {
      const refreshing = options?.refreshing ?? false;

      try {
        if (refreshing) {
          setIsRefreshing(true);
        }

        if (refreshing) {
          setRefreshError(null);
        } else {
          setError(null);
        }

        const nextSnapshot = await fetchSupplementSnapshot(applicationId);
        setSupplementSnapshot(nextSnapshot);
        setError(null);
        setRefreshError(null);
      } catch (nextError) {
        if (refreshing) {
          setRefreshError(toSafeSupplementError(nextError));
        } else {
          setSupplementSnapshot(null);
          setError(toSafeSupplementError(nextError));
        }
      } finally {
        if (refreshing) {
          setIsRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (nextSnapshot.applicationStatus !== "SUBMITTED") {
          router.replace(resolveRouteFromStatus(nextSnapshot.applicationStatus));
          return;
        }

        setSnapshot(nextSnapshot);
        await loadSupplementSnapshot(nextSnapshot.applicationId);
      } catch (nextError) {
        if (active) {
          setError(toSafeSupplementError(nextError));
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
  }, [loadSupplementSnapshot, router]);

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
      pageName: "apply_supplement",
      stepName: "supplement",
      applicationId: snapshot.applicationId,
    });
  }, [snapshot]);

  const flowStepLinks = buildApplyFlowStepLinks(
    snapshot?.applicationStatus ?? "SUBMITTED",
  );

  return (
    <PageFrame>
      <PageShell
        title="Supplement Materials"
        description="Review AI material requests and track category-level supplement status after submission."
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
              title="Loading supplement workspace"
              description="Restoring your submitted application and latest AI review snapshot."
            />
          ) : null}

          {!isLoading && error ? (
            <StatusBanner
              tone="danger"
              title="Supplement workspace could not be loaded"
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
                      void loadSupplementSnapshot(snapshot.applicationId, {
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

          {!isLoading && !error && supplementSnapshot ? (
            <>
              {refreshError ? (
                <StatusBanner
                  tone="danger"
                  title="Supplement status could not be refreshed"
                  description={refreshError}
                />
              ) : null}
              <SupplementWorkspace
                snapshot={supplementSnapshot}
                isRefreshing={isRefreshing}
                onRefresh={() =>
                  loadSupplementSnapshot(supplementSnapshot.applicationId, {
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
