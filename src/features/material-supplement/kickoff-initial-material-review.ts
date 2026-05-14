import {
  ensureInitialReview,
  fetchSupplementReviewRun,
  fetchSupplementSummary,
  syncSupplementReviewRun,
} from "@/features/material-supplement/client";
import type { SupplementSummary } from "@/features/material-supplement/types";

const inFlightKickoffs = new Map<string, Promise<void>>();

async function runKickoffInitialMaterialReview(applicationId: string) {
  async function syncInitialReviewResult(reviewRunId: string) {
    try {
      await syncSupplementReviewRun(applicationId, reviewRunId);
      await fetchSupplementSummary(applicationId);
    } catch {
      /* best-effort */
    }
  }

  async function guardUnsyncedNoSupplementResult(
    nextSummary: SupplementSummary,
  ) {
    if (
      nextSummary.materialSupplementStatus !== "NO_SUPPLEMENT_REQUIRED" ||
      !nextSummary.latestReviewRunId
    ) {
      return;
    }

    try {
      const reviewRun = await fetchSupplementReviewRun(
        applicationId,
        nextSummary.latestReviewRunId,
      );

      if (reviewRun.categories.length === 0) {
        await syncInitialReviewResult(nextSummary.latestReviewRunId);
      }
    } catch {
      /* best-effort */
    }
  }

  try {
    const nextSummary = await fetchSupplementSummary(applicationId);

    if (
      !nextSummary.latestReviewRunId ||
      nextSummary.materialSupplementStatus === "NOT_STARTED"
    ) {
      try {
        const initialReview = await ensureInitialReview(applicationId);
        await syncInitialReviewResult(initialReview.reviewRunId);
      } catch {
        /* ensure failed */
      }
    } else {
      await guardUnsyncedNoSupplementResult(nextSummary);
    }
  } catch {
    /* summary unavailable */
  }
}

/**
 * Ensures the first material review exists after submit. Concurrent invocations
 * for the same `applicationId` share one async run (React Strict Mode double
 * effect, rapid re-renders). After completion, a new visit may run again so
 * failures can still be retried on a later navigation.
 */
export function kickoffInitialMaterialReview(
  applicationId: string,
): Promise<void> {
  const existing = inFlightKickoffs.get(applicationId);
  if (existing) {
    return existing;
  }

  const promise = runKickoffInitialMaterialReview(applicationId).finally(() => {
    inFlightKickoffs.delete(applicationId);
  });

  inFlightKickoffs.set(applicationId, promise);
  return promise;
}
