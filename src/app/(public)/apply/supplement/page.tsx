"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
import { SupplementAccessError } from "@/features/material-supplement/components/supplement-access-error";
import { SupplementWorkspace } from "@/features/material-supplement/components/supplement-workspace";
import { loadSupplementSnapshotWithSync } from "@/features/material-supplement/sync";
import type { SupplementSnapshot } from "@/features/material-supplement/types";
import { trackPageView } from "@/lib/tracking/client";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";

export default function SupplementPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [supplementSnapshot, setSupplementSnapshot] =
    useState<SupplementSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accessError, setAccessError] =
    useState<SupplementAccessErrorState | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const supplementSnapshotRef = useRef<SupplementSnapshot | null>(null);
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
          setAccessError(null);
        }

        const nextSnapshot = await loadSupplementSnapshotWithSync({
          applicationId,
          currentSnapshot: refreshing ? supplementSnapshotRef.current : null,
        });
        supplementSnapshotRef.current = nextSnapshot;
        setSupplementSnapshot(nextSnapshot);
        setAccessError(null);
        setRefreshError(null);
      } catch (nextError) {
        const nextAccessError = classifySupplementAccessError(nextError);

        if (refreshing) {
          if (isBlockingSupplementAccessError(nextError)) {
            supplementSnapshotRef.current = null;
            setSupplementSnapshot(null);
            setAccessError(nextAccessError);
            setRefreshError(null);
          } else {
            setRefreshError(nextAccessError.description);
          }
        } else {
          supplementSnapshotRef.current = null;
          setSupplementSnapshot(null);
          setAccessError(nextAccessError);
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
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
        await loadSupplementSnapshot(nextSnapshot.applicationId);
      } catch (nextError) {
        if (active) {
          setSnapshot(null);
          supplementSnapshotRef.current = null;
          setSupplementSnapshot(null);
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
                      loadSupplementSnapshot(snapshot.applicationId, {
                        refreshing: true,
                      })
                  : undefined
              }
            />
          ) : null}

          {!isLoading && !accessError && supplementSnapshot ? (
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
