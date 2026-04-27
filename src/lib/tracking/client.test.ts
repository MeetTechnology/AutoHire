import { afterEach, describe, expect, it, vi } from "vitest";

import { trackPageDuration } from "@/lib/tracking/client";

const originalFetch = globalThis.fetch;
const originalNavigator = globalThis.navigator;

function setNavigator(value: Navigator | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
}

describe("trackPageDuration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    setNavigator(originalNavigator);
  });

  it("skips sub-second durations", () => {
    const sendBeacon = vi.fn();
    const fetchMock = vi.fn();
    setNavigator({ sendBeacon } as unknown as Navigator);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    trackPageDuration({
      eventType: "resume_page_duration_recorded",
      pageName: "apply_resume",
      stepName: "resume_upload",
      applicationId: "app_intro",
      durationMs: 999,
    });

    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses sendBeacon for pagehide-safe duration tracking", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    setNavigator({ sendBeacon } as unknown as Navigator);

    trackPageDuration({
      eventType: "analysis_result_duration_recorded",
      pageName: "apply_result",
      stepName: "analysis_result",
      applicationId: "app_submitted",
      durationMs: 1200,
    });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0];
    expect(url).toBe("/api/track");
    expect(JSON.parse(await (blob as Blob).text())).toMatchObject({
      event_type: "analysis_result_duration_recorded",
      page_name: "apply_result",
      step_name: "analysis_result",
      action_name: "page_duration",
      event_status: "SUCCESS",
      application_id: "app_submitted",
      duration_ms: 1200,
    });
  });

  it("falls back to fetch keepalive when sendBeacon is unavailable", () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    setNavigator(undefined);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    trackPageDuration({
      eventType: "materials_page_duration_recorded",
      pageName: "apply_materials",
      stepName: "materials",
      applicationId: "app_submitted",
      durationMs: 2500,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/track",
      expect.objectContaining({
        keepalive: true,
        method: "POST",
      }),
    );
  });
});
