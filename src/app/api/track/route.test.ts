import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { POST as trackPost } from "@/app/api/track/route";
import {
  getApplicationById,
  listApplicationEvents,
  listFileUploadAttempts,
  listInviteAccessLogs,
} from "@/lib/data/store";

function resetMemoryStore() {
  (
    globalThis as typeof globalThis & {
      __autohireStore?: unknown;
    }
  ).__autohireStore = undefined;
}

describe("POST /api/track", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("writes application events, upload attempts, and milestone fields", async () => {
    const response = await trackPost(
      new NextRequest("http://localhost/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-autohire-session-id": "sess_track",
          "x-autohire-request-id": "req_track",
          "x-forwarded-for": "192.0.2.12",
          referer: "http://localhost/apply/materials",
        },
        body: JSON.stringify({
          event_type: "materials_page_viewed",
          event_time: "2026-04-20T15:30:45.123Z",
          page_name: "apply_materials",
          step_name: "materials",
          action_name: "page_view",
          event_status: "SUCCESS",
          session_id: "sess_track",
          request_id: "req_track",
          application_id: "app_submitted",
          upload: {
            upload_id: "upload_track_material",
            kind: "material",
            category: "IDENTITY",
            file_name: "passport.pdf",
            file_ext: "pdf",
            file_size: 1024,
            object_key: "applications/app_submitted/materials/IDENTITY/passport.pdf",
          },
        }),
        duplex: "half",
      }),
    );

    expect(response.status).toBe(200);

    const events = await listApplicationEvents("app_submitted");
    expect(
      events.some(
        (item) =>
          item.eventType === "materials_page_viewed" &&
          item.ipAddress === "192.0.2.12",
      ),
    ).toBe(true);

    const uploads = await listFileUploadAttempts("app_submitted");
    expect(
      uploads.some((item) => item.uploadId === "upload_track_material"),
    ).toBe(true);

    const application = await getApplicationById("app_submitted");
    expect(application?.materialsEnteredAt).not.toBeNull();
  });

  it("writes invalid token traffic without requiring an application", async () => {
    const response = await trackPost(
      new NextRequest("http://localhost/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.99",
          referer: "http://localhost/apply?t=bad-token",
        },
        body: JSON.stringify({
          event_type: "invite_link_invalid",
          event_time: "2026-04-20T15:30:45.123Z",
          page_name: "apply_entry",
          step_name: "invite_access",
          action_name: "page_view",
          event_status: "FAIL",
          session_id: "sess_invalid_track",
          request_id: "req_invalid_track",
          token: "bad-token",
          landing_path: "/apply",
        }),
        duplex: "half",
      }),
    );

    expect(response.status).toBe(200);

    const accessLogs = await listInviteAccessLogs();
    expect(accessLogs[0]).toMatchObject({
      accessResult: "INVALID",
      applicationId: null,
      invitationId: null,
      sessionId: "sess_invalid_track",
      ipAddress: "203.0.113.99",
    });
  });
});
