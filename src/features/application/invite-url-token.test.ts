import { describe, expect, it } from "vitest";

import {
  readInviteTokenFromSearchParams,
  removeInviteTokenFromUrl,
  resolveInviteTokenFromNextSearchParams,
} from "@/features/application/invite-url-token";

describe("readInviteTokenFromSearchParams", () => {
  it("reads t", () => {
    expect(
      readInviteTokenFromSearchParams(new URLSearchParams("t=abc+def")),
    ).toBe("abc def");
  });

  it("reads token", () => {
    expect(
      readInviteTokenFromSearchParams(new URLSearchParams("token=xyz")),
    ).toBe("xyz");
  });

  it("reads uppercase T", () => {
    expect(readInviteTokenFromSearchParams(new URLSearchParams("T=abc"))).toBe(
      "abc",
    );
  });

  it("reads empty-name param from ?=value", () => {
    expect(readInviteTokenFromSearchParams(new URLSearchParams("=abcdef"))).toBe(
      "abcdef",
    );
  });

  it("prefers t over token", () => {
    expect(
      readInviteTokenFromSearchParams(new URLSearchParams("t=a&token=b")),
    ).toBe("a");
  });

  it("returns null for whitespace", () => {
    expect(readInviteTokenFromSearchParams(new URLSearchParams("t=  "))).toBe(
      null,
    );
  });
});

describe("resolveInviteTokenFromNextSearchParams", () => {
  it("resolves t, T, token, and empty key", () => {
    expect(resolveInviteTokenFromNextSearchParams({ t: "a" })).toBe("a");
    expect(resolveInviteTokenFromNextSearchParams({ T: "upper" })).toBe(
      "upper",
    );
    expect(resolveInviteTokenFromNextSearchParams({ token: "b" })).toBe("b");
    expect(resolveInviteTokenFromNextSearchParams({ "": "c" })).toBe("c");
  });
});

describe("removeInviteTokenFromUrl", () => {
  it("removes invite token aliases while preserving other params and hash", () => {
    expect(
      removeInviteTokenFromUrl(
        "http://localhost:3001/apply?T=abc&utm_source=test#intro",
      ),
    ).toBe("/apply?utm_source=test#intro");
  });

  it("removes empty-name invite token params", () => {
    expect(removeInviteTokenFromUrl("http://localhost:3001/apply?=abc")).toBe(
      "/apply",
    );
  });
});
