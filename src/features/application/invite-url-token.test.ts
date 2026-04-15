import { describe, expect, it } from "vitest";

import {
  readInviteTokenFromSearchParams,
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
  it("resolves t, token, and empty key", () => {
    expect(resolveInviteTokenFromNextSearchParams({ t: "a" })).toBe("a");
    expect(resolveInviteTokenFromNextSearchParams({ token: "b" })).toBe("b");
    expect(resolveInviteTokenFromNextSearchParams({ "": "c" })).toBe("c");
  });
});
