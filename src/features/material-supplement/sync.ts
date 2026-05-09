import {
  fetchSupplementSnapshot,
  syncSupplementReviewRun,
} from "@/features/material-supplement/client";
import type { SupplementSnapshot } from "@/features/material-supplement/types";

type FetchSupplementSnapshot = (
  applicationId: string,
) => Promise<SupplementSnapshot>;

type SyncSupplementReviewRun = (
  applicationId: string,
  reviewRunId: string,
) => Promise<unknown>;

type LoadSupplementSnapshotInput = {
  applicationId: string;
  currentSnapshot?: SupplementSnapshot | null;
  fetchSnapshot?: FetchSupplementSnapshot;
  syncReviewRun?: SyncSupplementReviewRun;
};

function getReviewingRunId(snapshot: SupplementSnapshot | null | undefined) {
  if (
    snapshot?.summary.materialSupplementStatus === "REVIEWING" &&
    snapshot.summary.latestReviewRunId
  ) {
    return snapshot.summary.latestReviewRunId;
  }

  return null;
}

export async function loadSupplementSnapshotWithSync({
  applicationId,
  currentSnapshot,
  fetchSnapshot = fetchSupplementSnapshot,
  syncReviewRun = syncSupplementReviewRun,
}: LoadSupplementSnapshotInput) {
  const currentReviewRunId = getReviewingRunId(currentSnapshot);

  if (currentReviewRunId) {
    await syncReviewRun(applicationId, currentReviewRunId);
    return fetchSnapshot(applicationId);
  }

  const nextSnapshot = await fetchSnapshot(applicationId);
  const nextReviewRunId = getReviewingRunId(nextSnapshot);

  if (!nextReviewRunId) {
    return nextSnapshot;
  }

  try {
    await syncReviewRun(applicationId, nextReviewRunId);
  } catch {
    return nextSnapshot;
  }

  return fetchSnapshot(applicationId);
}
