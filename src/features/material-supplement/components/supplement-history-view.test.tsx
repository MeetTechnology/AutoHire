// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SupplementHistoryResponse } from "@/features/material-supplement/client";
import { SupplementHistoryView } from "@/features/material-supplement/components/supplement-history-view";

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

function historyResponse(
  input: Partial<SupplementHistoryResponse> = {},
): SupplementHistoryResponse {
  return {
    applicationId: "app_123",
    filters: {
      category: null,
      runNo: null,
      ...input.filters,
    },
    items: input.items ?? [
      {
        reviewRunId: "run_2",
        runNo: 2,
        category: "EDUCATION",
        categoryReviewId: "cat_review_2",
        status: "COMPLETED",
        isLatest: true,
        reviewedAt: "2026-05-06T10:03:00.000Z",
        aiMessage: "The latest education supplement was accepted.",
        files: [
          {
            id: "file_1",
            uploadBatchId: "batch_1",
            fileName: "degree-clear.pdf",
            fileType: "application/pdf",
            fileSize: 1024,
            uploadedAt: "2026-05-06T10:01:00.000Z",
          },
        ],
        requests: [
          {
            id: "req_1",
            title: "Clear degree certificate",
            reason: "The clearer document satisfies the request.",
            aiMessage: "Request satisfied.",
            status: "SATISFIED",
            isSatisfied: true,
          },
        ],
      },
      {
        reviewRunId: "run_1",
        runNo: 1,
        category: "PATENT",
        categoryReviewId: "cat_review_1",
        status: "COMPLETED",
        isLatest: false,
        reviewedAt: "2026-05-05T10:03:00.000Z",
        aiMessage: "Patent ownership proof is incomplete.",
        files: [],
        requests: [
          {
            id: "req_2",
            title: "Patent ownership proof",
            reason: "Ownership proof is missing.",
            aiMessage: "Upload ownership proof.",
            status: "PENDING",
            isSatisfied: false,
          },
        ],
      },
    ],
    ...input,
  };
}

describe("SupplementHistoryView", () => {
  it("renders history records with files, AI messages, and satisfied requests", () => {
    render(
      <SupplementHistoryView
        history={historyResponse()}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByText("Run 2 - Education Documents")).toBeInTheDocument();
    expect(screen.getByText("degree-clear.pdf")).toBeInTheDocument();
    expect(
      screen.getByText("The latest education supplement was accepted."),
    ).toBeInTheDocument();
    expect(screen.getByText("Clear degree certificate")).toBeInTheDocument();
    expect(screen.getByText("Request satisfied.")).toBeInTheDocument();
    expect(screen.getByText("satisfied")).toBeInTheDocument();
    expect(screen.getByText("Run 1 - Patent Documents")).toBeInTheDocument();
  });

  it("builds category and run filter links from the current selection", () => {
    render(
      <SupplementHistoryView
        history={historyResponse()}
        isRefreshing={false}
        selectedCategory="EDUCATION"
        selectedRunNo={2}
        onRefresh={vi.fn()}
      />,
    );

    const allLinks = screen.getAllByRole("link", { name: "All" });

    expect(allLinks[0]).toHaveAttribute(
      "href",
      "/apply/supplement/history?runNo=2",
    );
    expect(allLinks[1]).toHaveAttribute(
      "href",
      "/apply/supplement/history?category=EDUCATION",
    );
    expect(
      screen.getByRole("link", { name: "Patent Documents" }),
    ).toHaveAttribute("href", "/apply/supplement/history?category=PATENT&runNo=2");
    expect(screen.getByRole("link", { name: "Run 1" })).toHaveAttribute(
      "href",
      "/apply/supplement/history?category=EDUCATION&runNo=1",
    );
  });

  it("shows the unfiltered empty state", () => {
    render(
      <SupplementHistoryView
        history={historyResponse({ items: [] })}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No supplement history is available yet."),
    ).toBeInTheDocument();
  });

  it("shows the filtered empty state and clear-filter link", () => {
    render(
      <SupplementHistoryView
        history={historyResponse({ items: [] })}
        isRefreshing={false}
        selectedCategory="EDUCATION"
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No history records match the current filters."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all history" })).toHaveAttribute(
      "href",
      "/apply/supplement/history",
    );
  });

  it("refreshes history and disables refresh while refreshing", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const { rerender } = render(
      <SupplementHistoryView
        history={historyResponse()}
        isRefreshing={false}
        onRefresh={onRefresh}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(
      <SupplementHistoryView
        history={historyResponse()}
        isRefreshing={true}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByRole("button", { name: /Refresh/i })).toBeDisabled();
    expect(screen.getByText("Refreshing supplement history")).toBeInTheDocument();
  });
});
