/** Piecewise-linear progress (0–PRE_COMPLETE_CAP) per OpenSpec resume-analysis-progress. */

export const MS_SEGMENT_1_END = 12_000;
export const MS_SEGMENT_2_END = 32_000;
export const MS_SEGMENT_3_END = 60_000;
export const MS_LONG_WAIT = 60_000;

export const PRE_COMPLETE_CAP = 0.92;

const RATIO_AT_12S = 0.28;
const RATIO_AT_32S = 0.78;

/** Generic wait lines (initial / re-analysis)—no staged eligibility narration. */
export const PRIMARY_STAGE_MESSAGES = [
  "Reviewing your CV. This page will update when there is an outcome.",
  "Your CV submission is still in progress. You can keep this page open.",
] as const;

/** Generic wait lines when a secondary analysis segment is running. */
export const SECONDARY_STAGE_MESSAGES = [
  "Preparing an additional review. This page will update when it is ready.",
  "The additional review is still in progress.",
] as const;

export const LONG_WAIT_PRIMARY_SUFFIX =
  " Still processing—thank you for your patience.";

const PRIMARY_BAND_MS = [0, 45_000] as const;

const SECONDARY_BAND_MS = [0, 30_000] as const;

export function getDisplayedProgressRatio(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);

  if (t <= MS_SEGMENT_1_END) {
    return (t / MS_SEGMENT_1_END) * RATIO_AT_12S;
  }

  if (t <= MS_SEGMENT_2_END) {
    const span = MS_SEGMENT_2_END - MS_SEGMENT_1_END;
    const frac = (t - MS_SEGMENT_1_END) / span;
    return RATIO_AT_12S + frac * (RATIO_AT_32S - RATIO_AT_12S);
  }

  if (t <= MS_SEGMENT_3_END) {
    const span = MS_SEGMENT_3_END - MS_SEGMENT_2_END;
    const frac = (t - MS_SEGMENT_2_END) / span;
    return RATIO_AT_32S + frac * (PRE_COMPLETE_CAP - RATIO_AT_32S);
  }

  return PRE_COMPLETE_CAP;
}

export function getPrimaryStageMessageIndex(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);

  for (let i = PRIMARY_BAND_MS.length - 1; i >= 0; i -= 1) {
    if (t >= PRIMARY_BAND_MS[i]!) {
      return Math.min(i, PRIMARY_STAGE_MESSAGES.length - 1);
    }
  }

  return 0;
}

export function getSecondaryStageMessageIndex(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);

  for (let i = SECONDARY_BAND_MS.length - 1; i >= 0; i -= 1) {
    if (t >= SECONDARY_BAND_MS[i]!) {
      return Math.min(i, SECONDARY_STAGE_MESSAGES.length - 1);
    }
  }

  return 0;
}

export function getPrimaryStageMessage(elapsedMs: number): string {
  const base =
    PRIMARY_STAGE_MESSAGES[getPrimaryStageMessageIndex(elapsedMs)] ??
    PRIMARY_STAGE_MESSAGES[PRIMARY_STAGE_MESSAGES.length - 1];

  if (elapsedMs > MS_LONG_WAIT) {
    return `${base}${LONG_WAIT_PRIMARY_SUFFIX}`;
  }

  return base;
}

export function getSecondaryStageMessage(elapsedMs: number): string {
  const base =
    SECONDARY_STAGE_MESSAGES[getSecondaryStageMessageIndex(elapsedMs)] ??
    SECONDARY_STAGE_MESSAGES[SECONDARY_STAGE_MESSAGES.length - 1];

  if (elapsedMs > MS_LONG_WAIT) {
    return `${base}${LONG_WAIT_PRIMARY_SUFFIX}`;
  }

  return base;
}

/** Remove assessor delimiter patterns from API-sourced text shown in the UI. */
export function sanitizeProgressDisplayText(text: string): string {
  return text
    .replace(/\[\[\[/g, "")
    .replace(/\]\]\]/g, "")
    .replace(/\{\{\{/g, "")
    .replace(/\}\}\}/g, "")
    .replace(/!!!/g, "")
    .trim();
}

export function shouldShowApiProgressSecondary(
  jobStatus: string | undefined,
  progressMessage: string,
): boolean {
  const normalizedJob = jobStatus?.trim().toUpperCase();

  if (normalizedJob === "QUEUED") {
    return true;
  }

  const m = progressMessage.toLowerCase();

  if (/\bqueued\b/.test(m) || /\bqueue\b/.test(m) || /\bsync/.test(m)) {
    return true;
  }

  return false;
}
