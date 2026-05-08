import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApplicationClientError,
  fetchSession,
} from "@/features/application/client";

describe("application client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws a typed client error for expert session failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error:
            "No valid session was found. Please reopen the invitation link.",
          code: "SESSION_REQUIRED",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSession()).rejects.toMatchObject({
      name: "ApplicationClientError",
      status: 401,
      code: "SESSION_REQUIRED",
      message: "No valid session was found. Please reopen the invitation link.",
    } satisfies Partial<ApplicationClientError>);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/expert-session",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
      }),
    );
  });

  it("supports structured application error payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "APPLICATION_NOT_FOUND",
            message: "The application record could not be found.",
            details: {
              applicationId: "app_missing",
            },
          },
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSession()).rejects.toMatchObject({
      name: "ApplicationClientError",
      status: 404,
      code: "APPLICATION_NOT_FOUND",
      message: "The application record could not be found.",
      details: {
        applicationId: "app_missing",
      },
    } satisfies Partial<ApplicationClientError>);
  });
});
