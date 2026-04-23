import { describe, expect, it } from "vitest";

import {
  materialConfirmSchema,
  resumeConfirmSchema,
  resumeScreeningIdentityOnlySchema,
} from "@/features/application/schemas";

describe("resumeConfirmSchema", () => {
  const baseFile = {
    uploadId: "upload_resume_test",
    fileName: "cv.pdf",
    fileType: "application/pdf",
    fileSize: 1200,
    objectKey: "applications/app_intro/resume/cv.pdf",
  };

  it("accepts file confirmation without CV review identity fields", () => {
    const parsed = resumeConfirmSchema.safeParse(baseFile);

    expect(parsed.success).toBe(true);
  });

  it("accepts optional trimmed passport name, phone number, and normalizes emails", () => {
    const parsed = resumeConfirmSchema.safeParse({
      ...baseFile,
      screeningPassportFullName: "  Wei Zhang  ",
      screeningContactEmail: "  Wei@Zhang.COM ",
      screeningWorkEmail: "  Wei.Zhang@University.EDU ",
      screeningPhoneNumber: "  +1 555 010 8888  ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.screeningPassportFullName).toBe("Wei Zhang");
      expect(parsed.data.screeningContactEmail).toBe("wei@zhang.com");
      expect(parsed.data.screeningWorkEmail).toBe("wei.zhang@university.edu");
      expect(parsed.data.screeningPhoneNumber).toBe("+1 555 010 8888");
    }
  });

  it("rejects whitespace-only passport name when provided", () => {
    const parsed = resumeConfirmSchema.safeParse({
      ...baseFile,
      screeningPassportFullName: "   ",
      screeningContactEmail: "a@b.co",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid email when provided", () => {
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
        screeningWorkEmail: "work@example.edu",
        screeningPhoneNumber: "+1 555 010 7777",
      }).success,
    ).toBe(true);
  });
});

describe("materialConfirmSchema", () => {
  it("does not require CV review identity fields", () => {
    const parsed = materialConfirmSchema.safeParse({
      uploadId: "upload_material_test",
      fileName: "id.pdf",
      fileType: "application/pdf",
      fileSize: 900,
      objectKey: "applications/app/materials/IDENTITY/id.pdf",
      category: "IDENTITY",
    });

    expect(parsed.success).toBe(true);
  });
});
