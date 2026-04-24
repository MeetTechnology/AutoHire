import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST as analyzeResumePost } from "@/app/api/applications/[applicationId]/resume/analyze/route";
import {
  DELETE as resumeDelete,
  POST as resumePost,
} from "@/app/api/applications/[applicationId]/resume/route";
import { createSessionToken, getSessionCookieName } from "@/lib/auth/session";
import {
  buildApplicationSnapshot,
  listApplicationEvents,
  listFileUploadAttempts,
} from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

function buildAuthorizedRequest(url: string, init?: RequestInit) {
  const token = createSessionToken({
    applicationId: "app_intro",
    invitationId: "invitation_init",
    expertId: "expert_init",
  });

  const headers = new Headers(init?.headers);
  headers.set("cookie", `${getSessionCookieName()}=${token}`);

  return new NextRequest(url, {
    method: init?.method,
    headers,
    body: init?.body,
    duplex: init?.body ? ("half" as const) : undefined,
  });
}

describe("POST /api/applications/[applicationId]/resume", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("stores uploaded CV before analysis starts", async () => {
    const response = await resumePost(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_intro/resume",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: "upload_resume_missing_identity",
            fileName: "cv.pdf",
            fileType: "application/pdf",
            fileSize: 1500,
            objectKey: "applications/app_intro/resume/cv.pdf",
          }),
        },
      ),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(200);

    const snapshot = await buildApplicationSnapshot("app_intro");
    expect(snapshot?.screeningPassportFullName).toBeNull();
    expect(snapshot?.screeningContactEmail).toBeNull();
    expect(snapshot?.screeningWorkEmail).toBeNull();
    expect(snapshot?.screeningPhoneNumber).toBeNull();
    expect(snapshot?.applicationStatus).toBe("CV_UPLOADED");
    expect(snapshot?.latestResumeFile?.fileName).toBe("cv.pdf");
  });

  it("persists CV review identity on confirm", async () => {
    const response = await resumePost(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_intro/resume",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId: "upload_resume_success",
            fileName: "cv.pdf",
            fileType: "application/pdf",
            fileSize: 1500,
            objectKey: "applications/app_intro/resume/cv.pdf",
            screeningPassportFullName: "  Passport User  ",
            screeningContactEmail: "  Passport.User@Example.COM ",
            screeningWorkEmail: "  Passport.User@University.EDU ",
            screeningPhoneNumber: "  +1 555 010 9999  ",
          }),
        },
      ),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(200);

    const snapshot = await buildApplicationSnapshot("app_intro");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.screeningPassportFullName).toBe("Passport User");
    expect(snapshot?.screeningContactEmail).toBe("passport.user@example.com");
    expect(snapshot?.screeningWorkEmail).toBe("passport.user@university.edu");
    expect(snapshot?.screeningPhoneNumber).toBe("+1 555 010 9999");
    expect(snapshot?.applicationStatus).toBe("CV_UPLOADED");

    const events = await listApplicationEvents("app_intro");
    expect(
      events.some((event) => event.eventType === "resume_upload_confirmed"),
    ).toBe(true);
    expect(events.some((event) => event.eventType === "analysis_started")).toBe(
      false,
    );

    const uploads = await listFileUploadAttempts("app_intro");
    const resumeUpload = uploads.find(
      (item) => item.uploadId === "upload_resume_success",
    );
    expect(resumeUpload).toMatchObject({
      uploadId: "upload_resume_success",
      kind: "RESUME",
      fileName: "cv.pdf",
    });
  });

  it("starts CV review after explicit analyze action", async () => {
    await resumePost(
      buildAuthorizedRequest("http://localhost/api/applications/app_intro/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: "upload_resume_for_analysis",
          fileName: "candidate.pdf",
          fileType: "application/pdf",
          fileSize: 1800,
          objectKey: "applications/app_intro/resume/candidate.pdf",
        }),
      }),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    const response = await analyzeResumePost(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_intro/resume/analyze",
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(200);

    const snapshot = await buildApplicationSnapshot("app_intro");
    expect(snapshot?.applicationStatus).toBe("CV_ANALYZING");

    const events = await listApplicationEvents("app_intro");
    expect(events.some((event) => event.eventType === "analysis_started")).toBe(
      true,
    );
  });

  it("rejects analyze action when no CV has been uploaded", async () => {
    const response = await analyzeResumePost(
      buildAuthorizedRequest(
        "http://localhost/api/applications/app_intro/resume/analyze",
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload).toMatchObject({
      code: "ANALYSIS_START_NOT_ALLOWED",
    });
  });

  it("deletes uploaded CV before analysis starts", async () => {
    await resumePost(
      buildAuthorizedRequest("http://localhost/api/applications/app_intro/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: "upload_resume_delete",
          fileName: "candidate-delete.pdf",
          fileType: "application/pdf",
          fileSize: 2000,
          objectKey: "applications/app_intro/resume/candidate-delete.pdf",
        }),
      }),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    const response = await resumeDelete(
      buildAuthorizedRequest("http://localhost/api/applications/app_intro/resume", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ applicationId: "app_intro" }) },
    );

    expect(response.status).toBe(200);

    const snapshot = await buildApplicationSnapshot("app_intro");
    expect(snapshot?.applicationStatus).toBe("INTRO_VIEWED");
    expect(snapshot?.latestResumeFile).toBeNull();
  });
});
