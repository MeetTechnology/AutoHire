// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Response } from "@/components/ai-elements/response";

afterEach(() => {
  cleanup();
});

describe("Response", () => {
  it("opens source previews from sanitized footnote links", async () => {
    const onPreviewSource = vi.fn();

    render(
      <Response onPreviewSource={onPreviewSource}>
        {"See [A03](#ask-ai-preview:token_test)."}
      </Response>,
    );

    await userEvent.click(screen.getByRole("link", { name: "A03" }));

    expect(onPreviewSource).toHaveBeenCalledWith("token_test", "A03");
    expect(
      screen.queryByText("dashscope-file-datacenter"),
    ).not.toBeInTheDocument();
  });

  it("does not render raw OSS markdown links as clickable anchors", () => {
    render(
      <Response>
        {
          "[A03](https://dashscope-file-datacenter-prod-01.oss-cn-beijing.aliyuncs.com/file.md?Signature=secret)"
        }
      </Response>,
    );

    expect(screen.queryByRole("link", { name: "A03" })).not.toBeInTheDocument();
  });

  it("keeps footnote hash navigation inside the markdown container", async () => {
    const scrollIntoView = vi.fn();
    window.location.hash = "";
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(<Response>{"[Back](#user-content-fnref-1-)"}</Response>);

    await userEvent.click(screen.getByRole("link", { name: "Back" }));

    expect(window.location.hash).toBe("");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("renders adjacent footnote references with brackets", () => {
    const { container } = render(
      <Response>
        {
          "Special cases require confirmation[^1][^6].\n\n[^1]: First\n[^6]: Sixth"
        }
      </Response>,
    );

    expect(container.textContent).toContain("[1][2]");
    expect(container.textContent).not.toContain("confirmation12");
  });

  it("does not render missing-url placeholders as clickable anchors", () => {
    render(<Response>{"[专家资格与分类规则总表](无URL)"}</Response>);

    expect(
      screen.queryByRole("link", { name: "专家资格与分类规则总表" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("专家资格与分类规则总表")).toBeInTheDocument();
  });
});
