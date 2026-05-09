import { describe, expect, it, vi } from "vitest";

import type { SupplementSnapshot } from "@/features/material-supplement/types";

import { loadSupplementSnapshotWithSync } from "./sync";

function buildSnapshot(
  overrides?: Partial<SupplementSnapshot["summary"]>,
): SupplementSnapshot {
  return {
    applicationId: "app_001",
    summary: {
      materialSupplementStatus: "SUPPLEMENT_REQUIRED",
      latestReviewRunId: "run_001",
      latestReviewedAt: "2026-05-05T09:30:00.000Z",
      pendingRequestCount: 1,
      satisfiedRequestCount: 0,
      remainingReviewRounds: 2,
      ...overrides,
    },
    categories: [],
  };
}

describe("loadSupplementSnapshotWithSync", () => {
  it("syncs the current reviewing run before refreshing the snapshot", async () => {
    const currentSnapshot = buildSnapshot({
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: "run_reviewing",
    });
    const refreshedSnapshot = buildSnapshot({
      materialSupplementStatus: "SUPPLEMENT_REQUIRED",
      latestReviewRunId: "run_reviewing",
    });
    const syncReviewRun = vi.fn().mockResolvedValue({
      reviewRunId: "run_reviewing",
      status: "COMPLETED",
      synced: true,
      updatedCategories: ["EDUCATION"],
    });
    const fetchSnapshot = vi.fn().mockResolvedValue(refreshedSnapshot);

    await expect(
      loadSupplementSnapshotWithSync({
        applicationId: "app_001",
        currentSnapshot,
        fetchSnapshot,
        syncReviewRun,
      }),
    ).resolves.toBe(refreshedSnapshot);

    expect(syncReviewRun).toHaveBeenCalledWith("app_001", "run_reviewing");
    expect(fetchSnapshot).toHaveBeenCalledWith("app_001");
    expect(syncReviewRun.mock.invocationCallOrder[0]).toBeLessThan(
      fetchSnapshot.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("fetches only the snapshot when the current snapshot is not reviewing", async () => {
    const currentSnapshot = buildSnapshot({
      materialSupplementStatus: "SUPPLEMENT_REQUIRED",
      latestReviewRunId: "run_001",
    });
    const refreshedSnapshot = buildSnapshot();
    const syncReviewRun = vi.fn();
    const fetchSnapshot = vi.fn().mockResolvedValue(refreshedSnapshot);

    await expect(
      loadSupplementSnapshotWithSync({
        applicationId: "app_001",
        currentSnapshot,
        fetchSnapshot,
        syncReviewRun,
      }),
    ).resolves.toBe(refreshedSnapshot);

    expect(syncReviewRun).not.toHaveBeenCalled();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it("does not sync reviewing snapshots without a latest review run id", async () => {
    const currentSnapshot = buildSnapshot({
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: null,
    });
    const refreshedSnapshot = buildSnapshot({
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: null,
    });
    const syncReviewRun = vi.fn();
    const fetchSnapshot = vi.fn().mockResolvedValue(refreshedSnapshot);

    await expect(
      loadSupplementSnapshotWithSync({
        applicationId: "app_001",
        currentSnapshot,
        fetchSnapshot,
        syncReviewRun,
      }),
    ).resolves.toBe(refreshedSnapshot);

    expect(syncReviewRun).not.toHaveBeenCalled();
    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
  });

  it("syncs after an initial snapshot load when the fetched snapshot is reviewing", async () => {
    const reviewingSnapshot = buildSnapshot({
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: "run_initial",
    });
    const refreshedSnapshot = buildSnapshot({
      materialSupplementStatus: "NO_SUPPLEMENT_REQUIRED",
      latestReviewRunId: "run_initial",
      pendingRequestCount: 0,
    });
    const syncReviewRun = vi.fn().mockResolvedValue({
      reviewRunId: "run_initial",
      status: "COMPLETED",
      synced: false,
      updatedCategories: [],
    });
    const fetchSnapshot = vi
      .fn()
      .mockResolvedValueOnce(reviewingSnapshot)
      .mockResolvedValueOnce(refreshedSnapshot);

    await expect(
      loadSupplementSnapshotWithSync({
        applicationId: "app_001",
        fetchSnapshot,
        syncReviewRun,
      }),
    ).resolves.toBe(refreshedSnapshot);

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(syncReviewRun).toHaveBeenCalledWith("app_001", "run_initial");
    expect(fetchSnapshot.mock.invocationCallOrder[0]).toBeLessThan(
      syncReviewRun.mock.invocationCallOrder[0] ?? 0,
    );
    expect(syncReviewRun.mock.invocationCallOrder[0]).toBeLessThan(
      fetchSnapshot.mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("surfaces sync failures without fetching a replacement refresh snapshot", async () => {
    const currentSnapshot = buildSnapshot({
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: "run_reviewing",
    });
    const syncError = new Error("Sync failed.");
    const syncReviewRun = vi.fn().mockRejectedValue(syncError);
    const fetchSnapshot = vi.fn();

    await expect(
      loadSupplementSnapshotWithSync({
        applicationId: "app_001",
        currentSnapshot,
        fetchSnapshot,
        syncReviewRun,
      }),
    ).rejects.toBe(syncError);

    expect(syncReviewRun).toHaveBeenCalledWith("app_001", "run_reviewing");
    expect(fetchSnapshot).not.toHaveBeenCalled();
  });

  it("keeps the initial snapshot when post-load sync fails", async () => {
    const reviewingSnapshot = buildSnapshot({
      materialSupplementStatus: "REVIEWING",
      latestReviewRunId: "run_initial",
    });
    const syncError = new Error("Sync failed.");
    const syncReviewRun = vi.fn().mockRejectedValue(syncError);
    const fetchSnapshot = vi.fn().mockResolvedValue(reviewingSnapshot);

    await expect(
      loadSupplementSnapshotWithSync({
        applicationId: "app_001",
        fetchSnapshot,
        syncReviewRun,
      }),
    ).resolves.toBe(reviewingSnapshot);

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(syncReviewRun).toHaveBeenCalledWith("app_001", "run_initial");
  });
});
