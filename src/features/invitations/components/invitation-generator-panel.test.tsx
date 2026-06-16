// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvitationGeneratorPanel } from "@/features/invitations/components/invitation-generator-panel";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("InvitationGeneratorPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows a clear error when generation returns an empty response body", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 500,
      }),
    );
    const user = userEvent.setup();
    render(<InvitationGeneratorPanel />);

    await user.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Invitation generation failed (HTTP 500).",
      );
    });
    expect(toast.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Unexpected end of JSON input"),
    );
  });
});
