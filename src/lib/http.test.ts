import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { isClientHttps } from "@/lib/http";

describe("isClientHttps", () => {
  it("returns true when x-forwarded-proto is https", () => {
    const request = new NextRequest("http://127.0.0.1/api", {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(isClientHttps(request)).toBe(true);
  });

  it("returns false when x-forwarded-proto is http", () => {
    const request = new NextRequest("http://192.168.1.1/api", {
      headers: { "x-forwarded-proto": "http" },
    });
    expect(isClientHttps(request)).toBe(false);
  });

  it("uses the URL protocol when forwarded proto is absent", () => {
    const httpsRequest = new NextRequest("https://example.com/api");
    expect(isClientHttps(httpsRequest)).toBe(true);

    const httpRequest = new NextRequest("http://192.168.3.43/api");
    expect(isClientHttps(httpRequest)).toBe(false);
  });

  it("uses the first value when x-forwarded-proto is a list", () => {
    const request = new NextRequest("http://internal/api", {
      headers: { "x-forwarded-proto": "https, http" },
    });
    expect(isClientHttps(request)).toBe(true);
  });
});
