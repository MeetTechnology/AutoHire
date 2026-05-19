// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SourcePreviewDialog } from "@/features/ask-ai/components/source-preview-dialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SourcePreviewDialog", () => {
  it("loads and renders markdown preview content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          title: "A03",
          markdown: "## Preview\n\nSource body",
        }),
      ),
    );

    render(
      <SourcePreviewDialog
        preview={{ token: "token_test", title: "A03" }}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading source preview",
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Preview" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Source body")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/ask-ai/source-preview",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "token_test" }),
      }),
    );
  });

  it("renders safely when closed", () => {
    render(<SourcePreviewDialog preview={null} onOpenChange={vi.fn()} />);

    expect(screen.queryByText("Source preview")).not.toBeInTheDocument();
  });
});
