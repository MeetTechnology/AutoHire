// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SupplementWorkspace } from "@/features/material-supplement/components/supplement-workspace";
import type {
  SupplementCategory,
  SupplementCategorySnapshot,
  SupplementSnapshot,
} from "@/features/material-supplement/types";

beforeAll(() => {
  class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [];

    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  }

  globalThis.IntersectionObserver = TestIntersectionObserver;
});

afterEach(() => {
  cleanup();
});

function categorySnapshot(
  input: Partial<SupplementCategorySnapshot> & {
    category: SupplementCategory;
    label: string;
  },
): SupplementCategorySnapshot {
  return {
    category: input.category,
    label: input.label,
    status: input.status ?? "NOT_STARTED",
    isReviewing: input.isReviewing ?? false,
    latestCategoryReviewId: input.latestCategoryReviewId ?? null,
    latestReviewedAt: input.latestReviewedAt ?? null,
    aiMessage: input.aiMessage ?? null,
    pendingRequestCount: input.pendingRequestCount ?? 0,
    requests: input.requests ?? [],
    draftFiles: input.draftFiles ?? [],
    waitingReviewFiles: input.waitingReviewFiles ?? [],
  };
}

function snapshot(input: Partial<SupplementSnapshot> = {}): SupplementSnapshot {
  return {
    applicationId: input.applicationId ?? "app_123",
    summary: {
      materialSupplementStatus: "SUPPLEMENT_REQUIRED",
      latestReviewRunId: "run_1",
      latestReviewedAt: "2026-05-05T10:03:00.000Z",
      pendingRequestCount: 1,
      satisfiedRequestCount: 1,
      remainingReviewRounds: 2,
      ...input.summary,
    },
    categories: input.categories ?? [
      categorySnapshot({
        category: "EDUCATION",
        label: "Education Documents",
        status: "PARTIALLY_SATISFIED",
        pendingRequestCount: 1,
        aiMessage: "Please provide a clearer education proof.",
        requests: [
          {
            id: "req_pending",
            title: "Clear degree certificate",
            reason: "The uploaded degree certificate is blurry.",
            suggestedMaterials: ["Degree certificate"],
            aiMessage: "Upload a readable certificate.",
            status: "PENDING",
            isSatisfied: false,
            updatedAt: "2026-05-05T10:03:00.000Z",
          },
          {
            id: "req_satisfied",
            title: "Satisfied transcript request",
            reason: "This should be hidden on the main workspace.",
            suggestedMaterials: ["Transcript"],
            aiMessage: "Already satisfied.",
            status: "SATISFIED",
            isSatisfied: true,
            updatedAt: "2026-05-05T10:04:00.000Z",
          },
        ],
      }),
    ],
  };
}

describe("SupplementWorkspace", () => {
  it("renders the six supported supplement categories and summary meta", () => {
    render(
      <SupplementWorkspace
        snapshot={snapshot()}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    for (const label of [
      "Identity Documents",
      "Education Documents",
      "Employment Documents",
      "Project Documents",
      "Patent Documents",
      "Honor Documents",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    for (const unsupportedLabel of [
      "Product Documents",
      "Paper Documents",
      "Book Documents",
      "Conference Documents",
    ]) {
      expect(screen.queryByText(unsupportedLabel)).not.toBeInTheDocument();
    }

    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
    expect(screen.getByText("Rounds left")).toBeInTheDocument();
    expect(screen.getByText("Active categories")).toBeInTheDocument();
    expect(screen.getByText("Latest review")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByText("Supplement materials are needed."),
    ).toBeInTheDocument();
  });

  it("hides satisfied requests on the main workspace", () => {
    render(
      <SupplementWorkspace
        snapshot={snapshot()}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Clear degree certificate")).toBeInTheDocument();
    expect(
      screen.queryByText("Satisfied transcript request"),
    ).not.toBeInTheDocument();
  });

  it("shows the empty category message when no pending requests are visible", async () => {
    const user = userEvent.setup();

    render(
      <SupplementWorkspace
        snapshot={snapshot({
          summary: {
            materialSupplementStatus: "NO_SUPPLEMENT_REQUIRED",
            latestReviewRunId: "run_1",
            latestReviewedAt: "2026-05-05T10:03:00.000Z",
            pendingRequestCount: 0,
            satisfiedRequestCount: 0,
            remainingReviewRounds: 2,
          },
          categories: [],
        })}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No supplement materials are needed."),
    ).toBeInTheDocument();

    const identitySectionToggle = screen.getByRole("button", {
      name: /Identity Documents/i,
    });
    await user.click(identitySectionToggle);

    const identityRegion = identitySectionToggle.closest("section");
    expect(identityRegion).not.toBeNull();
    expect(
      within(identityRegion as HTMLElement).getByText(
        "No open requests in this category.",
      ),
    ).toBeInTheDocument();
  });
});
