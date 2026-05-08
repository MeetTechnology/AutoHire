import { describe, expect, it } from "vitest";

import { ApplicationClientError } from "@/features/application/client";
import { MaterialSupplementClientError } from "@/features/material-supplement/client";

import { classifySupplementAccessError } from "./access-error";

describe("classifySupplementAccessError", () => {
  it("maps supplement unauthorized errors", () => {
    expect(
      classifySupplementAccessError(
        new MaterialSupplementClientError({
          status: 401,
          code: "UNAUTHORIZED",
          message: "Session expired.",
        }),
      ).kind,
    ).toBe("unauthorized");
  });

  it("maps supplement forbidden errors", () => {
    expect(
      classifySupplementAccessError(
        new MaterialSupplementClientError({
          status: 403,
          code: "FORBIDDEN",
          message: "Access denied.",
        }),
      ).kind,
    ).toBe("forbidden");
  });

  it("maps supplement application not found errors", () => {
    expect(
      classifySupplementAccessError(
        new MaterialSupplementClientError({
          status: 404,
          code: "APPLICATION_NOT_FOUND",
          message: "Missing application.",
        }),
      ).kind,
    ).toBe("notFound");
  });

  it("maps supplement not submitted errors", () => {
    expect(
      classifySupplementAccessError(
        new MaterialSupplementClientError({
          status: 409,
          code: "APPLICATION_NOT_SUBMITTED",
          message: "Not submitted.",
        }),
      ).kind,
    ).toBe("notSubmitted");
  });

  it("maps application session errors to unauthorized", () => {
    for (const code of ["SESSION_REQUIRED", "INVALID_TOKEN", "EXPIRED_TOKEN"]) {
      expect(
        classifySupplementAccessError(
          new ApplicationClientError({
            status: code === "EXPIRED_TOKEN" ? 410 : 401,
            code,
            message: "Session failed.",
          }),
        ).kind,
      ).toBe("unauthorized");
    }
  });

  it("uses safe generic copy for unknown errors", () => {
    const state = classifySupplementAccessError(
      new MaterialSupplementClientError({
        status: 500,
        code: "SUPPLEMENT_SNAPSHOT_LOAD_FAILED",
        message: "Failed for application app_001 and file file_001.",
        details: {
          applicationId: "app_001",
          requestId: "req_001",
          fileId: "file_001",
        },
      }),
    );

    expect(state.kind).toBe("loadFailed");
    expect(state.description).not.toContain("app_001");
    expect(state.description).not.toContain("req_001");
    expect(state.description).not.toContain("file_001");
  });
});
