import { describe, expect, it, vi, afterEach } from "vitest";

import {
  createSourcePreviewToken,
  fetchSourcePreviewMarkdown,
  parseSourcePreviewToken,
  sanitizeAskAiMarkdown,
  SourcePreviewError,
} from "@/lib/ask-ai/source-preview";
import { resetEnvForTests } from "@/lib/env";

const originalEnv = { ...process.env };
const allowedUrl =
  "https://dashscope-file-datacenter-prod-01.oss-cn-beijing.aliyuncs.com/189/106/file.md?Expires=1779353502&OSSAccessKeyId=test&Signature=secret";

afterEach(() => {
  process.env = { ...originalEnv };
  resetEnvForTests();
  vi.restoreAllMocks();
});

describe("source preview tokens", () => {
  it("creates and parses an encrypted preview token", () => {
    process.env = {
      ...originalEnv,
      INVITE_TOKEN_SECRET: "test-secret",
    };
    resetEnvForTests();

    const token = createSourcePreviewToken({
      url: allowedUrl,
      title: "A03",
      expiresAt: Date.now() + 60_000,
    });

    expect(token).not.toContain(allowedUrl);
    expect(parseSourcePreviewToken(token)).toMatchObject({
      url: allowedUrl,
      title: "A03",
    });
  });

  it("rejects expired or tampered tokens", () => {
    const expired = createSourcePreviewToken({
      url: allowedUrl,
      title: "A03",
      expiresAt: Date.now() - 1,
    });

    expect(() => parseSourcePreviewToken(expired)).toThrow(SourcePreviewError);
    expect(() => parseSourcePreviewToken(`${expired}x`)).toThrow(
      SourcePreviewError,
    );
  });
});

describe("sanitizeAskAiMarkdown", () => {
  it("replaces whitelisted OSS markdown links without keeping the raw URL", () => {
    const result = sanitizeAskAiMarkdown(
      `[^1]: [A03_不同类型简历处理流程](${allowedUrl})`,
    );

    expect(result.markdown).toContain("#ask-ai-preview:");
    expect(result.markdown).not.toContain("dashscope-file-datacenter");
    expect(result.replacements).toHaveLength(1);
    expect(
      parseSourcePreviewToken(result.replacements[0].previewToken),
    ).toMatchObject({
      title: "A03_不同类型简历处理流程",
    });
  });

  it("does not replace non-whitelisted URLs", () => {
    const otherUrl = "https://example.com/file.md?Signature=secret";
    const result = sanitizeAskAiMarkdown(`[Other](${otherUrl})`);

    expect(result.markdown).toContain(otherUrl);
    expect(result.replacements).toHaveLength(0);
  });

  it("removes table source footnotes and their inline references", () => {
    const tableUrl =
      "https://dashscope-file-datacenter-prod-01.oss-cn-beijing.aliyuncs.com/189/106/sheet.xlsx?Expires=1779353502&Signature=secret";
    const result = sanitizeAskAiMarkdown(
      [
        "涉及特殊地区等情况需组长确认[^1][^6]。",
        "",
        `[^1]: [A03_不同类型简历处理流程](${allowedUrl})`,
        `[^6]: [专家分类表](${tableUrl})`,
      ].join("\n"),
    );

    expect(result.markdown).toContain("[^1]");
    expect(result.markdown).not.toContain("[^6]");
    expect(result.markdown).not.toContain("专家分类表");
    expect(result.markdown).not.toContain("sheet.xlsx");
  });

  it("removes missing-url footnotes and their inline references", () => {
    const result = sanitizeAskAiMarkdown(
      [
        "涉及院士身份、多职位、特殊地区等情况需组长确认[^1][^6]。",
        "",
        "[^1]: [专家资格与分类规则总表](无URL)",
        "[^2]: [专家资格与分类规则总表](无URL)",
        "[^3]: [专家资格与分类规则总表](无URL)",
        "[^4]: [专家资格与分类规则总表](无URL)",
        "[^5]: [专家资格与分类规则总表](无URL)",
        "[^6]: [专家资格与分类规则总表](无URL)",
      ].join("\n"),
    );

    expect(result.markdown).toContain("需组长确认。");
    expect(result.markdown).not.toContain("[^1]");
    expect(result.markdown).not.toContain("[^6]");
    expect(result.markdown).not.toContain("Footnotes");
    expect(result.markdown).not.toContain("无URL");
    expect(result.markdown).not.toContain("专家资格与分类规则总表");
    expect(result.replacements).toHaveLength(0);
  });

  it("removes footnotes when the model uses full-width parentheses or a Footnotes heading", () => {
    const result = sanitizeAskAiMarkdown(
      [
        "### 三、建议下一步",
        "提供专家具体背景信息（职位、来源国、当前机构），以便进行初步分类判断。涉及院士身份、多职位、特殊地区等情况需组长确认[^1][^6]。",
        "",
        "### Footnotes",
        "[^1]: [专家资格与分类规则总表]（无URL）",
        "[^6]: [专家资格与分类规则总表](无URL)",
      ].join("\n"),
    );

    expect(result.markdown).toContain("需组长确认。");
    expect(result.markdown).not.toContain("[^1]");
    expect(result.markdown).not.toContain("Footnotes");
    expect(result.markdown).not.toContain("专家资格与分类规则总表");
  });
});

describe("fetchSourcePreviewMarkdown", () => {
  it("loads whitelisted markdown through the server proxy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const body = new TextEncoder().encode("# Preview");

        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "text/markdown",
            "content-length": String(body.byteLength),
          },
        });
      }),
    );

    await expect(fetchSourcePreviewMarkdown(allowedUrl)).resolves.toBe(
      "# Preview",
    );
  });

  it("rejects non-HTTPS source URLs", async () => {
    await expect(
      fetchSourcePreviewMarkdown("http://example.com/file.md"),
    ).rejects.toThrow(SourcePreviewError);
  });
});
