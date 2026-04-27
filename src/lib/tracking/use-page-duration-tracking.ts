"use client";

import { useEffect, useRef } from "react";

import { trackPageDuration } from "@/lib/tracking/client";
import type { TrackingPageName, TrackingStepName } from "@/lib/tracking/types";

const MIN_DURATION_MS = 1000;

const DURATION_EVENT_BY_PAGE: Record<TrackingPageName, string> = {
  apply_entry: "intro_page_duration_recorded",
  apply_resume: "resume_page_duration_recorded",
  apply_result: "analysis_result_duration_recorded",
  apply_materials: "materials_page_duration_recorded",
  apply_submission_complete: "submission_complete_duration_recorded",
};

export function shouldTrackPageDuration(durationMs: number) {
  return durationMs >= MIN_DURATION_MS;
}

export function getPageDurationEventType(pageName: TrackingPageName) {
  return DURATION_EVENT_BY_PAGE[pageName];
}

export function usePageDurationTracking(input: {
  pageName: TrackingPageName;
  stepName: TrackingStepName;
  applicationId?: string | null;
}) {
  const { pageName, stepName, applicationId } = input;
  const startedAtRef = useRef<number | null>(null);
  const flushedRef = useRef(false);
  const latestRef = useRef(input);

  useEffect(() => {
    latestRef.current = { pageName, stepName, applicationId };
  }, [applicationId, pageName, stepName]);

  useEffect(() => {
    if (!applicationId) {
      return;
    }

    startedAtRef.current = Date.now();
    flushedRef.current = false;

    function flush() {
      const startedAt = startedAtRef.current;
      const latest = latestRef.current;

      if (!startedAt || flushedRef.current || !latest.applicationId) {
        return;
      }

      const durationMs = Date.now() - startedAt;
      if (!shouldTrackPageDuration(durationMs)) {
        return;
      }

      flushedRef.current = true;
      trackPageDuration({
        eventType: getPageDurationEventType(latest.pageName),
        pageName: latest.pageName,
        stepName: latest.stepName,
        applicationId: latest.applicationId,
        durationMs,
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flush();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [applicationId]);
}
