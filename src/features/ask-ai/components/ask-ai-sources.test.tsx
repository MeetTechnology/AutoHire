// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AskAiSources } from "@/features/ask-ai/components/ask-ai-sources";
import type { AskAiMessage } from "@/features/ask-ai/lib/types";

afterEach(() => {
  cleanup();
});

describe("AskAiSources", () => {
  it("renders preview buttons instead of downloadable links", async () => {
    const onPreviewSource = vi.fn();
    const message: AskAiMessage = {
      id: "assistant_test",
      role: "assistant",
      parts: [
        {
          type: "data-ask-ai-source",
          id: "source_test",
          data: {
            sourceId: "source_test",
            title: "A03",
            previewToken: "token_test",
          },
        },
      ],
    };

    render(
      <AskAiSources message={message} onPreviewSource={onPreviewSource} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "1 source" }));
    await userEvent.click(screen.getByRole("button", { name: /A03/ }));

    expect(onPreviewSource).toHaveBeenCalledWith("token_test", "A03");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
