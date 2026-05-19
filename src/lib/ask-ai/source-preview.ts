import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { getEnv } from "@/lib/env";

const PREVIEW_TOKEN_VERSION = "v1";
const PREVIEW_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_MARKDOWN_BYTES = 512 * 1024;
const OSS_MARKDOWN_URL_PATTERN =
  /https:\/\/[^\s)\]]+\.oss-cn-beijing\.aliyuncs\.com\/[^\s)\]]+?\.md(?:\?[^\s)\]]*)?/g;
const MARKDOWN_LINK_PATTERN =
  /\[([^\]]+)]\((https:\/\/[^\s)]+\.oss-cn-beijing\.aliyuncs\.com\/[^\s)]+?\.md(?:\?[^\s)]*)?)\)/g;
const SYNTHETIC_FOOTNOTES_HEADING = /^#{1,6}\s*(footnotes|脚注)\s*$/i;
const TABLE_SOURCE_EXTENSIONS = new Set([".csv", ".tsv", ".xls", ".xlsx"]);

export class SourcePreviewError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SourcePreviewError";
  }
}

type PreviewPayload = {
  url: string;
  title: string;
  exp: number;
};

export type SanitizedMarkdownResult = {
  markdown: string;
  replacements: Array<{
    originalUrl: string;
    previewToken: string;
    title: string;
  }>;
};

function extractHrefFromFootnoteDefinitionBody(body: string): string | null {
  const t = body.trim();
  if (!t) {
    return null;
  }

  if (!t.startsWith("[")) {
    if (isMissingSourceUrl(t)) {
      return t;
    }
    if (/^https?:\/\//i.test(t)) {
      return t;
    }
    return null;
  }

  const href = extractMarkdownStyleLinkHref(t);
  if (href !== null) {
    return href;
  }

  if (isMissingSourceUrl(t)) {
    return t;
  }

  return null;
}

/** Parses `[label](href)` or `[label]（href）` (full-width parens). */
function extractMarkdownStyleLinkHref(text: string): string | null {
  const asciiSep = text.indexOf("](");
  const fwSep = text.indexOf("]\uFF08");

  let sep = -1;
  let closing: string | null = null;

  if (asciiSep >= 0 && (fwSep < 0 || asciiSep <= fwSep)) {
    sep = asciiSep;
    closing = ")";
  } else if (fwSep >= 0) {
    sep = fwSep;
    closing = "\uFF09";
  }

  if (sep < 0 || !closing) {
    return null;
  }

  const rest = text.slice(sep + 2).trimEnd();
  if (!rest.endsWith(closing)) {
    return null;
  }

  return rest.slice(0, -closing.length);
}

function stripUnsupportedFootnoteDefinitionLines(markdown: string): {
  text: string;
  removedFootnoteIds: Set<string>;
} {
  const removedFootnoteIds = new Set<string>();
  const lines = markdown.split(/\r?\n/);
  const kept: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine && SYNTHETIC_FOOTNOTES_HEADING.test(trimmedLine)) {
      continue;
    }

    const match = line.match(/^\[\^([^\]]+)]\s*[:\uFF1A]\s*(.*)$/);
    if (!match) {
      kept.push(line);
      continue;
    }

    const footnoteId = match[1];
    const href = extractHrefFromFootnoteDefinitionBody(match[2]);

    if (href === null) {
      kept.push(line);
      continue;
    }

    const cleanHref = stripTrailingPunctuation(href);

    if (isMissingSourceUrl(cleanHref) || isTableSourceUrl(cleanHref)) {
      removedFootnoteIds.add(footnoteId);
      continue;
    }

    kept.push(line);
  }

  return {
    text: kept.join("\n"),
    removedFootnoteIds,
  };
}

export function sanitizeAskAiMarkdown(markdown: string) {
  const replacements = new Map<string, string>();
  const { text: markdownWithoutUnsupportedFootnotes, removedFootnoteIds } =
    stripUnsupportedFootnoteDefinitionLines(markdown);
  const markdownWithoutUnsupportedReferences = removeFootnoteReferences(
    markdownWithoutUnsupportedFootnotes,
    removedFootnoteIds,
  );

  const markdownWithPreviewLinks = markdownWithoutUnsupportedReferences.replace(
    MARKDOWN_LINK_PATTERN,
    (match, title: string, url: string) => {
      const cleanUrl = stripTrailingPunctuation(url);

      if (!isAllowedMarkdownSourceUrl(cleanUrl)) {
        return match;
      }

      const token = createSourcePreviewToken({
        url: cleanUrl,
        title,
      });
      replacements.set(cleanUrl, token);

      return `[${title}](${toPreviewHref(token)}${url.slice(cleanUrl.length)})`;
    },
  );

  const nextMarkdown = markdownWithPreviewLinks.replace(
    OSS_MARKDOWN_URL_PATTERN,
    (url) => {
      const cleanUrl = stripTrailingPunctuation(url);

      if (!isAllowedMarkdownSourceUrl(cleanUrl)) {
        return url;
      }

      const token =
        replacements.get(cleanUrl) ??
        createSourcePreviewToken({
          url: cleanUrl,
          title: inferTitleFromSourceUrl(cleanUrl),
        });
      replacements.set(cleanUrl, token);

      return `${toPreviewHref(token)}${url.slice(cleanUrl.length)}`;
    },
  );

  return {
    markdown: nextMarkdown,
    replacements: Array.from(replacements, ([originalUrl, previewToken]) => ({
      originalUrl,
      previewToken,
      title: inferTitleFromSourceUrl(originalUrl),
    })),
  } satisfies SanitizedMarkdownResult;
}

export function createSourcePreviewToken({
  url,
  title,
  expiresAt = Date.now() + PREVIEW_TOKEN_TTL_MS,
}: {
  url: string;
  title: string;
  expiresAt?: number;
}) {
  assertAllowedMarkdownSourceUrl(url);

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getPreviewKey(), iv);
  const payload: PreviewPayload = {
    url,
    title: title.trim() || inferTitleFromSourceUrl(url),
    exp: expiresAt,
  };
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREVIEW_TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function parseSourcePreviewToken(token: string) {
  const [version, ivValue, tagValue, encryptedValue] = token.split(".");

  if (
    version !== PREVIEW_TOKEN_VERSION ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new SourcePreviewError(
      "The source preview token is invalid.",
      "ask_ai_source_preview_invalid_token",
    );
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getPreviewKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString("utf8")) as PreviewPayload;

    if (!payload.url || !payload.title || !payload.exp) {
      throw new Error("Incomplete payload");
    }

    if (payload.exp < Date.now()) {
      throw new SourcePreviewError(
        "The source preview token has expired.",
        "ask_ai_source_preview_expired",
      );
    }

    assertAllowedMarkdownSourceUrl(payload.url);

    return payload;
  } catch (error) {
    if (error instanceof SourcePreviewError) {
      throw error;
    }

    throw new SourcePreviewError(
      "The source preview token is invalid.",
      "ask_ai_source_preview_invalid_token",
    );
  }
}

export async function fetchSourcePreviewMarkdown(
  url: string,
  signal?: AbortSignal,
) {
  assertAllowedMarkdownSourceUrl(url);

  const response = await fetch(url, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new SourcePreviewError(
      "The source preview could not be loaded.",
      "ask_ai_source_preview_fetch_failed",
      502,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (
    contentType &&
    !/text\/|markdown|octet-stream|application\/x-ndjson/i.test(contentType)
  ) {
    throw new SourcePreviewError(
      "The source preview content type is not supported.",
      "ask_ai_source_preview_unsupported_content_type",
      415,
    );
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MARKDOWN_BYTES) {
    throw new SourcePreviewError(
      "The source preview is too large.",
      "ask_ai_source_preview_too_large",
      413,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    received += value.byteLength;
    if (received > MAX_MARKDOWN_BYTES) {
      throw new SourcePreviewError(
        "The source preview is too large.",
        "ask_ai_source_preview_too_large",
        413,
      );
    }

    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

export function createPreviewSourceFromUrl(
  url: string | null | undefined,
  title: string,
) {
  if (!url || !isAllowedMarkdownSourceUrl(url)) {
    return null;
  }

  return {
    previewToken: createSourcePreviewToken({ url, title }),
  };
}

export function isPreviewHref(href: string | undefined | null) {
  return Boolean(href?.startsWith("#ask-ai-preview:"));
}

export function getPreviewTokenFromHref(href: string) {
  return href.replace(/^#ask-ai-preview:/, "");
}

export function toPreviewHref(token: string) {
  return `#ask-ai-preview:${token}`;
}

export function isAllowedMarkdownSourceUrl(url: string) {
  try {
    assertAllowedMarkdownSourceUrl(url);
    return true;
  } catch {
    return false;
  }
}

function assertAllowedMarkdownSourceUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new SourcePreviewError(
      "The source preview URL is invalid.",
      "ask_ai_source_preview_invalid_url",
    );
  }

  if (parsed.protocol !== "https:") {
    throw new SourcePreviewError(
      "The source preview URL must use HTTPS.",
      "ask_ai_source_preview_invalid_protocol",
      403,
    );
  }

  if (!getAllowedHosts().has(parsed.hostname)) {
    throw new SourcePreviewError(
      "The source preview host is not allowed.",
      "ask_ai_source_preview_host_not_allowed",
      403,
    );
  }

  if (!parsed.pathname.toLowerCase().endsWith(".md")) {
    throw new SourcePreviewError(
      "Only Markdown source previews are supported.",
      "ask_ai_source_preview_unsupported_file",
      403,
    );
  }
}

function getAllowedHosts() {
  return new Set(
    getEnv()
      .ASK_AI_SOURCE_PREVIEW_ALLOWED_HOSTS.split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getPreviewKey() {
  return createHash("sha256").update(getEnv().INVITE_TOKEN_SECRET).digest();
}

function inferTitleFromSourceUrl(url: string) {
  const pathname = new URL(url).pathname;
  const lastSegment = decodeURIComponent(pathname.split("/").at(-1) ?? "");
  return lastSegment.replace(/\.md$/i, "") || "Source preview";
}

function stripTrailingPunctuation(url: string) {
  return url.replace(/[.,;:]+$/g, "");
}

function isTableSourceUrl(url: string) {
  try {
    const parsed = new URL(stripTrailingPunctuation(url));
    const pathname = parsed.pathname.toLowerCase();

    return Array.from(TABLE_SOURCE_EXTENSIONS).some((extension) =>
      pathname.endsWith(extension),
    );
  } catch {
    return false;
  }
}

function isMissingSourceUrl(url: string) {
  const normalized = stripTrailingPunctuation(url)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  return new Set([
    "",
    "无url",
    "无 URL".toLowerCase(),
    "无链接",
    "无",
    "none",
    "null",
    "n/a",
    "na",
    "-",
  ]).has(normalized);
}

function removeFootnoteReferences(markdown: string, footnoteIds: Set<string>) {
  if (footnoteIds.size === 0) {
    return markdown;
  }

  let nextMarkdown = markdown;

  for (const footnoteId of footnoteIds) {
    nextMarkdown = nextMarkdown.replaceAll(`[^${footnoteId}]`, "");
  }

  return nextMarkdown.replace(/\n{3,}/g, "\n\n");
}
