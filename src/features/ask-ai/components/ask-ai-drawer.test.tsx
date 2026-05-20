// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const chatMock = vi.hoisted(() => ({
  setMessages: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    id: "chat_component_test",
    messages: [],
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    setMessages: chatMock.setMessages,
    status: "ready",
    error: null,
  }),
}));

import {
  AskAiDrawer,
  AskAiProgressStatus,
} from "@/features/ask-ai/components/ask-ai-drawer";

Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  chatMock.setMessages.mockReset();
});

describe("AskAiProgressStatus", () => {
  it("shows the current progress label without the old Thinking copy", () => {
    render(
      <AskAiProgressStatus
        progress={{
          stage: "retrieving",
          label: "正在检索知识库",
          source: "aliyun",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Reviewing relevant guidance",
    );
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("renders history and close controls without the old visible header", () => {
    render(<AskAiDrawer open onOpenChange={vi.fn()} pageName="apply" />);

    expect(screen.queryByText("Application Guidance")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "历史记录" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("restores a selected history question and answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [
            {
              id: "history_1",
              userMessageId: "user_history_1",
              assistantMessageId: "assistant_history_1",
              question: "What documents should I prepare?",
              answer: "Prepare identity and employment materials.",
              createdAt: new Date().toISOString(),
              sources: [
                {
                  sourceId: "source_history_1",
                  title: "Application Flow",
                  previewToken: "preview_history_1",
                },
              ],
            },
          ],
        }),
      ),
    );

    render(<AskAiDrawer open onOpenChange={vi.fn()} pageName="apply" />);

    await userEvent.click(screen.getByRole("button", { name: "历史记录" }));
    await userEvent.click(
      await screen.findByRole("button", {
        name: /What documents should I prepare/,
      }),
    );

    expect(chatMock.setMessages).toHaveBeenCalledWith([
      {
        id: "user_history_1",
        role: "user",
        parts: [{ type: "text", text: "What documents should I prepare?" }],
      },
      {
        id: "assistant_history_1",
        role: "assistant",
        parts: [
          {
            type: "data-ask-ai-source",
            id: "source_history_1",
            data: {
              sourceId: "source_history_1",
              title: "Application Flow",
              previewToken: "preview_history_1",
            },
          },
          {
            type: "text",
            text: "Prepare identity and employment materials.",
          },
        ],
      },
    ]);
  });
});
