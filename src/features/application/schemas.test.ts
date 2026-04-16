import { describe, expect, it } from "vitest";

import {
  materialConfirmSchema,
  resumeConfirmSchema,
  resumeScreeningIdentityOnlySchema,
} from "@/features/application/schemas";

describe("resumeConfirmSchema", () => {
  const baseFile = {
    fileName: "cv.pdf",
    fileType: "application/pdf",
    fileSize: 1200,
    objectKey: "applications/app_intro/resume/cv.pdf",
  };

  it("accepts trimmed passport name and normalizes email", () => {
    const parsed = resumeConfirmSchema.safeParse({
      ...baseFile,
      screeningPassportFullName: "  Wei Zhang  ",
      screeningContactEmail: "  Wei@Zhang.COM ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.screeningPassportFullName).toBe("Wei Zhang");
      expect(parsed.data.screeningContactEmail).toBe("wei@zhang.com");
    }
  });

  it("rejects whitespace-only passport name", () => {
    const parsed = resumeConfirmSchema.safeParse({
      ...baseFile,
      screeningPassportFullName: "   ",
      screeningContactEmail: "a@b.co",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const parsed = resumeConfirmSchema.safeParse({
      ...baseFile,
      screeningPassportFullName: "Jane Doe",
      screeningContactEmail: "not-an-email",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("resumeScreeningIdentityOnlySchema", () => {
  it("mirrors identity rules without file fields", () => {
    expect(
      resumeScreeningIdentityOnlySchema.safeParse({
        screeningPassportFullName: "X",
        screeningContactEmail: "x@example.com",
      }).success,
    ).toBe(true);
  });
});

describe("materialConfirmSchema", () => {
  it("does not require screening identity fields", () => {
    const parsed = materialConfirmSchema.safeParse({
      fileName: "id.pdf",
      fileType: "application/pdf",
      fileSize: 900,
      objectKey: "applications/app/materials/IDENTITY/id.pdf",
      category: "IDENTITY",
    });

    expect(parsed.success).toBe(true);
  });
});
