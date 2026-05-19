// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AskAiProgressStatus } from "@/features/ask-ai/components/ask-ai-drawer";

afterEach(() => {
  cleanup();
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
});
