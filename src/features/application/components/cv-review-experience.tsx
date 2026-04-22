"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import type { MissingField } from "@/features/analysis/types";
import {
  getInitialCvReviewFieldValue,
  hasInitialCvReviewExtract,
  INITIAL_CV_REVIEW_FIELD_ROWS,
} from "@/features/analysis/initial-cv-review-extract";
import {
  ActionButton,
  MetaStrip,
  MobileSupportCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
  getInputClassName,
} from "@/components/ui/page-shell";
import {
  confirmResumeUpload,
  createResumeUploadIntent,
  fetchAnalysisResult,
  fetchAnalysisStatus,
  fetchSession,
  submitSupplementalFields,
  uploadBinary,
} from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/application/draft-storage";
import {
  getDisplayedProgressRatio,
  getPrimaryStageMessage,
  getSecondaryStageMessage,
  sanitizeProgressDisplayText,
  shouldShowApiProgressSecondary,
} from "@/features/application/analysis-progress-model";
import {
  buildApplyFlowStepLinks,
  canAccessFlowStep,
  getReachableFlowStep,
  isFlowStepReadOnly,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type { ApplicationFlowStep } from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";
import { isScreeningContactFieldKey } from "@/lib/application/screening-contact";
import { createUploadId, trackPageView } from "@/lib/tracking/client";
import { cn } from "@/lib/utils";

type SupplementalFormValues = Record<string, string>;

const ANALYZING_STATUSES = [
  "CV_ANALYZING",
  "REANALYZING",
  "SECONDARY_ANALYZING",
] as const;

function isAnalyzingApplicationStatus(
  value: string,
): value is (typeof ANALYZING_STATUSES)[number] {
  return (ANALYZING_STATUSES as readonly string[]).includes(value);
}

const RESULT_VIEW_TO_STEP = {
  review: 1,
  additional: 2,
} as const;

/**
 * Once initial CV review passes, `getReachableFlowStep` advances to step 2 because
 * Additional Information is unlocked — but `/apply/resume` is still the primary
 * surface for these statuses. `isFlowStepReadOnly(_, 1)` would then treat step 1
 * as "past", showing reference-only mode incorrectly after refresh.
 */
function isUnifiedCvReviewPrimarySurfaceStatus(
  status: ApplicationSnapshot["applicationStatus"],
): boolean {
  return (
    status === "ELIGIBLE" ||
    status === "INFO_REQUIRED" ||
    status === "SECONDARY_ANALYZING" ||
    status === "SECONDARY_REVIEW" ||
    status === "SECONDARY_FAILED"
  );
}

function getMailtoHref() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `mailto:?subject=${encodeURIComponent("Continue my GESF application")}&body=${encodeURIComponent(window.location.href)}`;
}

function normalizeDateInputYearToFourDigits(
  event: ChangeEvent<HTMLInputElement>,
) {
  const input = event.currentTarget;
  const v = input.value;

  if (!v) {
    return;
  }

  const match = /^(\d+)-(\d{2})-(\d{2})$/.exec(v);

  if (match && match[1].length > 4) {
    input.value = `${match[1].slice(0, 4)}-${match[2]}-${match[3]}`;
  }
}

function translateChoiceLabel(option: string) {
  const translations: Record<string, string> = {
    本科: "Bachelor's",
    硕士: "Master's",
    博士: "Doctorate",
    其他: "Other",
    是: "Yes",
    否: "No",
  };

  return translations[option] ?? option;
}

function renderSupplementalField(
  field: MissingField,
  register: ReturnType<typeof useForm<SupplementalFormValues>>["register"],
  watch: ReturnType<typeof useForm<SupplementalFormValues>>["watch"],
  getValues: ReturnType<typeof useForm<SupplementalFormValues>>["getValues"],
) {
  const currentValue = watch(field.fieldKey) ?? field.defaultValue ?? "";
  const isPrefilled = Boolean(field.defaultValue && currentValue);
  const needsAttention = field.required && !String(currentValue).trim();
  const inputClassName = getInputClassName(
    cn(
      isPrefilled && "bg-[color:var(--muted)]/75",
      needsAttention &&
        "border-[color:var(--accent)] ring-1 ring-[color:var(--ring)]",
    ),
  );

  return (
    <label
      key={field.fieldKey}
      className={cn(
        "block rounded-xl border p-3.5 text-sm text-slate-700",
        needsAttention
          ? "border-[color:var(--accent)] bg-white"
          : "border-[color:var(--border)] bg-[color:var(--muted)]/60",
      )}
    >
      <span className="block text-sm font-semibold text-[color:var(--primary)]">
        {field.label}
      </span>
      <div className="mt-1 flex flex-wrap gap-2">
        <span className="text-xs tracking-[0.12em] text-slate-500 uppercase">
          {field.required ? "Required field" : "Optional field"}
        </span>
        {isPrefilled ? (
          <span className="inline-flex rounded-full border border-[color:var(--border)] bg-white px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.12em] text-slate-500 uppercase">
            Suggested from CV
          </span>
        ) : null}
        {needsAttention ? (
          <span className="inline-flex rounded-full border border-[color:var(--accent)] bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-semibold tracking-[0.12em] text-[color:var(--accent)] uppercase">
            Needs input
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        {field.type === "select" ? (
          <>
            <select
              {...register(field.fieldKey, {
                required: field.required,
              })}
              className={inputClassName}
            >
              <option value="">Please select</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {translateChoiceLabel(option)}
                </option>
              ))}
            </select>
            {field.selectOtherDetails &&
            watch(field.fieldKey) === field.selectOtherDetails.triggerOption ? (
              <div className="mt-3 rounded-md border border-slate-300 bg-white p-3">
                <span className="mb-2 block text-xs font-medium text-slate-700">
                  {field.selectOtherDetails.detailLabel}
                </span>
                <input
                  type="text"
                  className={inputClassName}
                  placeholder={field.selectOtherDetails.detailPlaceholder}
                  {...register(field.selectOtherDetails.detailFieldKey, {
                    validate: (value) => {
                      const main = getValues(field.fieldKey);

                      if (main !== field.selectOtherDetails?.triggerOption) {
                        return true;
                      }

                      return (
                        (value && value.trim().length > 0) ||
                        "Please specify your degree."
                      );
                    },
                  })}
                />
              </div>
            ) : null}
          </>
        ) : field.type === "textarea" ? (
          <textarea
            {...register(field.fieldKey, {
              required: field.required,
            })}
            className={getInputClassName("min-h-32")}
          />
        ) : field.type === "radio" ? (
          <div className="flex flex-wrap gap-3">
            {field.options?.map((option) => (
              <label
                key={option}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 transition hover:border-slate-500"
              >
                <input
                  {...register(field.fieldKey, {
                    required: field.required,
                  })}
                  type="radio"
                  value={option}
                />
                <span>{translateChoiceLabel(option)}</span>
              </label>
            ))}
          </div>
        ) : field.type === "date" ? (
          (() => {
            const { onChange, ...reg } = register(field.fieldKey, {
              required: field.required,
            });

            return (
              <input
                {...reg}
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                className={inputClassName}
                onChange={(e) => {
                  normalizeDateInputYearToFourDigits(e);
                  void onChange(e);
                }}
              />
            );
          })()
        ) : (
          <input
            {...register(field.fieldKey, {
              required: field.required,
            })}
            type={field.type === "number" ? "number" : "text"}
            className={inputClassName}
          />
        )}
      </div>
      <div className="mt-2.5 space-y-1">
        {field.helpText ? (
          <span className="block text-xs leading-6 text-slate-500">
            {field.helpText}
          </span>
        ) : null}
        {needsAttention ? (
          <span className="block text-xs leading-6 text-slate-500">
            Please provide this information to complete accelerated evaluation.
          </span>
        ) : null}
      </div>
    </label>
  );
}

function AnalysisProgressPanel({
  title,
  description,
  primaryMessage,
  secondaryMessage,
  progressRatio,
  ariaValueText,
}: {
  title: string;
  description: string;
  primaryMessage: string;
  secondaryMessage?: string | null;
  progressRatio: number;
  ariaValueText: string;
}) {
  const clamped = Math.min(1, Math.max(0, progressRatio));
  const widthPercent = `${Math.round(clamped * 1000) / 10}%`;

  return (
    <SectionCard className="overflow-hidden">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--muted)]/60">
          <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-[color:var(--primary)] border-t-[color:var(--accent-soft)] motion-reduce:animate-none" />
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.02em] text-[color:var(--primary)]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
          {description}
        </p>
        <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/55 px-4 py-4">
          {/* Unmount this panel when analysis ends—no brief 100% flash before result content. */}
          <div
            className="h-2 overflow-hidden rounded-full bg-white"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped * 100)}
            aria-valuetext={ariaValueText}
          >
            <div
              className="h-full rounded-full bg-[color:var(--primary)] transition-[width] duration-150 ease-out"
              style={{ width: widthPercent }}
            />
          </div>
          <p className="mt-3 text-sm font-medium text-[color:var(--primary)]">
            {primaryMessage}
          </p>
          {secondaryMessage ? (
            <p className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]">
              {secondaryMessage}
            </p>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function getInitialBanner(
  snapshot: ApplicationSnapshot | null,
  statusText: string,
  input?: {
    isEligibleContactCompletion?: boolean;
  },
) {
  if (!snapshot) {
    return null;
  }

  if (
    snapshot.applicationStatus === "CV_ANALYZING" ||
    snapshot.applicationStatus === "REANALYZING"
  ) {
    return (
      <StatusBanner
        tone="loading"
        title="Your CV is being reviewed"
        description={statusText}
      />
    );
  }

  if (snapshot.applicationStatus === "INELIGIBLE") {
    return (
      <StatusBanner
        tone="danger"
        title="The current submission does not meet the application requirements"
        description={snapshot.latestResult?.displaySummary ?? undefined}
      >
        {snapshot.latestResult?.reasonText ? (
          <p className="text-sm leading-6 text-slate-700">
            {snapshot.latestResult.reasonText}
          </p>
        ) : null}
      </StatusBanner>
    );
  }

  if (snapshot.applicationStatus === "ELIGIBLE") {
    return (
      <StatusBanner
        tone="success"
        title="Initial CV review passed"
        description="Continue to Additional Information to upload supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_ANALYZING") {
    return (
      <StatusBanner
        tone="loading"
        title="Detailed review in progress"
        description="When this legacy review step finishes, you can continue to supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_REVIEW") {
    return (
      <StatusBanner
        tone="success"
        title="Detailed review is ready"
        description="Continue to Additional Information to upload supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_FAILED") {
    return (
      <StatusBanner
        tone="danger"
        title="The detailed review step could not be completed"
        description="Please contact the program team if you need help continuing to supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "INFO_REQUIRED") {
    return (
      <StatusBanner
        tone="neutral"
        title={
          input?.isEligibleContactCompletion
            ? "CV review passed, but a few contact details are still missing"
            : "Some required information is still missing"
        }
        description={
          input?.isEligibleContactCompletion
            ? "Please complete the missing contact fields below before continuing to supporting materials."
            : (snapshot.latestResult?.displaySummary ??
              "Please complete the fields below and run CV review again.")
        }
      />
    );
  }

  return null;
}

function InitialCvReviewExtractCard({
  latestResult,
}: {
  latestResult: NonNullable<ApplicationSnapshot["latestResult"]>;
}) {
  return (
    <SectionCard
      title="Initial CV review extract"
      description="Fields extracted from your CV for the latest initial CV review pass."
    >
      <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] bg-white">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-[color:var(--border)] bg-slate-50">
              <th
                scope="col"
                className="w-1/3 px-4 py-3 text-left text-xs font-semibold tracking-wide text-[color:var(--primary)] uppercase"
              >
                Field
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-[color:var(--primary)] uppercase"
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_CV_REVIEW_FIELD_ROWS.map((row) => {
              const value = getInitialCvReviewFieldValue(
                latestResult.extractedFields,
                row.key,
              );

              return (
                <tr
                  key={row.key}
                  className="border-b border-[color:var(--border)] last:border-b-0"
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-left align-top text-sm font-medium text-[color:var(--primary)]"
                  >
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-sm break-words whitespace-normal text-[color:var(--foreground-soft)]">
                    {value ? value : "Not provided"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function InitialCvReviewDeterminationCard({
  snapshot,
}: {
  snapshot: ApplicationSnapshot;
}) {
  const latest = snapshot.latestResult;
  const displaySummary = latest?.displaySummary ?? null;
  const reasonText = latest?.reasonText ?? null;
  const { eligibilityResult } = snapshot;

  if (eligibilityResult === "INELIGIBLE") {
    return (
      <SectionCard
        title="CV review outcome"
        description={displaySummary ?? undefined}
      >
        {reasonText ? (
          <p className="mt-2 text-sm leading-6 text-slate-700">{reasonText}</p>
        ) : null}
      </SectionCard>
    );
  }

  if (
    eligibilityResult === "INSUFFICIENT_INFO" ||
    snapshot.applicationStatus === "INFO_REQUIRED"
  ) {
    const primary =
      reasonText ??
      displaySummary ??
      "The model could not finalize eligibility. Please complete the missing fields below.";

    return (
      <SectionCard title="CV review outcome">
        <p className="text-sm leading-6 text-slate-700">{primary}</p>
      </SectionCard>
    );
  }

  if (eligibilityResult === "ELIGIBLE") {
    const primary =
      reasonText ??
      displaySummary ??
      "You meet the basic application requirements for initial CV review.";
    const secondary =
      reasonText &&
      displaySummary &&
      displaySummary.trim() !== reasonText.trim()
        ? displaySummary
        : null;

    return (
      <SectionCard title="CV review outcome" description={primary}>
        {secondary ? (
          <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
            {secondary}
          </p>
        ) : null}
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="CV review outcome"
      description={
        displaySummary ??
        "Initial CV review returned an outcome. Review the extract and any messages above."
      }
    />
  );
}

export function CvReviewExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [statusText, setStatusText] = useState(
    "Preparing your CV review outcome...",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingResume, startResumeUploadTransition] = useTransition();
  const [isSubmittingSupplemental, startSupplementalTransition] =
    useTransition();
  const [analysisSegment, setAnalysisSegment] = useState<{
    segmentKey: string;
    startedAt: number;
  } | null>(null);
  const [analysisUiTick, setAnalysisUiTick] = useState(0);
  const [analysisJobStatus, setAnalysisJobStatus] = useState<
    string | undefined
  >(undefined);
  const [supplementalDraftSavedAt, setSupplementalDraftSavedAt] = useState<
    string | null
  >(null);
  const [mailtoHref, setMailtoHref] = useState<string | undefined>(undefined);
  const hasTrackedPageView = useRef(false);
  const { register, handleSubmit, reset, watch, getValues } =
    useForm<SupplementalFormValues>();

  useEffect(() => {
    setMailtoHref(getMailtoHref());
  }, []);

  const requestedResultView = searchParams.get("view");

  const statusDrivenResultStep: ApplicationFlowStep = !snapshot
    ? 1
    : [
          "INFO_REQUIRED",
          "SECONDARY_ANALYZING",
          "SECONDARY_REVIEW",
          "SECONDARY_FAILED",
        ].includes(snapshot.applicationStatus)
      ? 2
      : 1;

  const currentResultStep: ApplicationFlowStep =
    requestedResultView &&
    requestedResultView in RESULT_VIEW_TO_STEP &&
    snapshot &&
    RESULT_VIEW_TO_STEP[
      requestedResultView as keyof typeof RESULT_VIEW_TO_STEP
    ] <= getReachableFlowStep(snapshot.applicationStatus)
      ? RESULT_VIEW_TO_STEP[
          requestedResultView as keyof typeof RESULT_VIEW_TO_STEP
        ]
      : statusDrivenResultStep;

  async function syncAnalysisProgress(applicationId: string) {
    const status = await fetchAnalysisStatus(applicationId);
    setStatusText(status.progressMessage);
    setAnalysisJobStatus(status.jobStatus);

    const refreshedSession = await fetchSession();
    setSnapshot(refreshedSession);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (!canAccessFlowStep(nextSnapshot.applicationStatus, 1)) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load the CV review outcome.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!snapshot || hasTrackedPageView.current) {
      return;
    }

    hasTrackedPageView.current = true;
    void trackPageView({
      pageName: "apply_resume",
      stepName:
        snapshot.applicationStatus === "INTRO_VIEWED" ||
        snapshot.applicationStatus === "CV_UPLOADED"
          ? "resume_upload"
          : snapshot.applicationStatus === "INFO_REQUIRED"
            ? "supplemental"
            : snapshot.applicationStatus === "SECONDARY_ANALYZING" ||
                snapshot.applicationStatus === "SECONDARY_REVIEW" ||
                snapshot.applicationStatus === "SECONDARY_FAILED"
              ? "secondary_analysis"
              : "analysis_result",
      applicationId: snapshot.applicationId,
    });
  }, [snapshot]);

  useEffect(() => {
    const status = snapshot?.applicationStatus;
    if (!status || !isAnalyzingApplicationStatus(status)) {
      setAnalysisSegment(null);
      return;
    }

    setAnalysisSegment((prev) => {
      if (prev?.segmentKey === status) {
        return prev;
      }

      return { segmentKey: status, startedAt: Date.now() };
    });
  }, [snapshot?.applicationStatus]);

  useEffect(() => {
    const status = snapshot?.applicationStatus;
    if (!status || !isAnalyzingApplicationStatus(status)) {
      return;
    }

    const id = window.setInterval(() => {
      setAnalysisUiTick((n) => n + 1);
    }, 120);

    return () => {
      window.clearInterval(id);
    };
  }, [snapshot?.applicationStatus]);

  useEffect(() => {
    if (
      !snapshot ||
      !["CV_ANALYZING", "REANALYZING", "SECONDARY_ANALYZING"].includes(
        snapshot.applicationStatus,
      )
    ) {
      return;
    }

    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const status = await fetchAnalysisStatus(snapshot.applicationId);

        if (!active) {
          return;
        }

        setStatusText(status.progressMessage);
        setAnalysisJobStatus(status.jobStatus);

        if (status.jobStatus === "FAILED") {
          const refreshedSession = await fetchSession();

          if (!active) {
            return;
          }

          setSnapshot(refreshedSession);
          setError(
            status.errorMessage ?? "CV review failed. Please try again later.",
          );
          window.clearInterval(timer);
          return;
        }

        if (status.jobStatus === "COMPLETED") {
          const refreshedSession = await fetchSession();

          if (!active) {
            return;
          }

          setSnapshot(refreshedSession);
        }
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to refresh the CV review status.",
          );
        }
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot?.applicationId) {
      return;
    }

    void fetchAnalysisResult(snapshot.applicationId)
      .then((result) => {
        setSnapshot((current) =>
          current
            ? {
                ...current,
                applicationStatus:
                  result.applicationStatus as ApplicationSnapshot["applicationStatus"],
                eligibilityResult:
                  result.eligibilityResult as ApplicationSnapshot["eligibilityResult"],
                resumeAnalysisStatus:
                  result.resumeAnalysisStatus as ApplicationSnapshot["resumeAnalysisStatus"],
                latestResult: {
                  displaySummary: result.displaySummary,
                  reasonText: result.reasonText,
                  missingFields: result.missingFields,
                  extractedFields: result.extractedFields,
                },
              }
            : current,
        );

        if (result.missingFields.length > 0) {
          const draftKey = `autohire:supplemental:${snapshot.applicationId}`;
          const storedDraft = readDraft<SupplementalFormValues>(draftKey);
          const defaults = Object.fromEntries(
            result.missingFields.flatMap((field) => {
              const rows: [string, string][] = [
                [field.fieldKey, field.defaultValue ?? ""],
              ];

              if (field.selectOtherDetails) {
                rows.push([field.selectOtherDetails.detailFieldKey, ""]);
              }

              return rows;
            }),
          );
          reset({
            ...defaults,
            ...(storedDraft?.values ?? {}),
          });
          setSupplementalDraftSavedAt(storedDraft?.savedAt ?? null);
        }
      })
      .catch(() => undefined);
  }, [reset, snapshot?.applicationId]);

  useEffect(() => {
    if (
      !snapshot?.applicationId ||
      snapshot.applicationStatus !== "INFO_REQUIRED"
    ) {
      return;
    }

    const draftKey = `autohire:supplemental:${snapshot.applicationId}`;
    const subscription = watch((values) => {
      const savedAt = writeDraft(draftKey, values as SupplementalFormValues);
      setSupplementalDraftSavedAt(savedAt);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [snapshot?.applicationId, snapshot?.applicationStatus, watch]);

  function handleResumeUpload() {
    if (
      !snapshot ||
      !selectedFile ||
      !["INTRO_VIEWED", "CV_UPLOADED"].includes(snapshot.applicationStatus)
    ) {
      return;
    }

    startResumeUploadTransition(async () => {
      try {
        setError(null);
        const uploadId = createUploadId();
        const intent = await createResumeUploadIntent(
          snapshot.applicationId,
          selectedFile,
          uploadId,
        );
        await uploadBinary(intent, selectedFile, {
          applicationId: snapshot.applicationId,
          uploadId,
          kind: "resume",
        });
        await confirmResumeUpload(
          snapshot.applicationId,
          selectedFile,
          intent.objectKey,
          uploadId,
        );
        setSnapshot((current) =>
          current
            ? {
                ...current,
                applicationStatus: "CV_ANALYZING",
                currentStep: "result",
              }
            : current,
        );
        setStatusText(
          "Your CV is being reviewed. This page will update automatically.",
        );
        await syncAnalysisProgress(snapshot.applicationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "CV upload failed.",
        );
      }
    });
  }

  function onSubmit(values: SupplementalFormValues) {
    if (
      !snapshot ||
      isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    ) {
      return;
    }

    startSupplementalTransition(async () => {
      try {
        setError(null);
        const result = await submitSupplementalFields(snapshot.applicationId, values);
        clearDraft(`autohire:supplemental:${snapshot.applicationId}`);

        if (result.applicationStatus === "REANALYZING") {
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  applicationStatus: "REANALYZING",
                }
              : current,
          );
          setStatusText(
            "The system is reanalyzing your CV with the supplemental information...",
          );
          await syncAnalysisProgress(snapshot.applicationId);
          return;
        }

        const refreshedSession = await fetchSession();
        setSnapshot(refreshedSession);
        router.push("/apply/materials");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to submit the supplemental information.",
        );
      }
    });
  }

  const hasInitialCvReviewExtractData = useMemo(
    () => hasInitialCvReviewExtract(snapshot?.latestResult?.extractedFields),
    [snapshot?.latestResult?.extractedFields],
  );
  const missingFields = useMemo(
    () => snapshot?.latestResult?.missingFields ?? [],
    [snapshot?.latestResult?.missingFields],
  );
  const missingContactFields = useMemo(
    () => missingFields.filter((field) => isScreeningContactFieldKey(field.fieldKey)),
    [missingFields],
  );
  const missingCriticalFields = useMemo(
    () =>
      missingFields.filter((field) => !isScreeningContactFieldKey(field.fieldKey)),
    [missingFields],
  );
  const hasMissingFields = missingFields.length > 0;
  const showSupplementalFields = hasMissingFields && currentResultStep === 2;
  const isEligibleContactCompletion = Boolean(
    snapshot &&
      snapshot.applicationStatus === "INFO_REQUIRED" &&
      snapshot.eligibilityResult === "ELIGIBLE" &&
      missingContactFields.length > 0 &&
      missingCriticalFields.length === 0,
  );
  const hasMixedContactAndCriticalGaps = Boolean(
    snapshot &&
      snapshot.applicationStatus === "INFO_REQUIRED" &&
      snapshot.eligibilityResult === "INSUFFICIENT_INFO" &&
      missingContactFields.length > 0 &&
      missingCriticalFields.length > 0,
  );
  const showUploadState = Boolean(
    snapshot &&
    ["INTRO_VIEWED", "CV_UPLOADED"].includes(snapshot.applicationStatus),
  );
  const isReadOnlyReview = snapshot
    ? (() => {
        const stepReadOnly = isFlowStepReadOnly(
          snapshot.applicationStatus,
          currentResultStep,
        );
        if (
          stepReadOnly &&
          currentResultStep === 1 &&
          isUnifiedCvReviewPrimarySurfaceStatus(snapshot.applicationStatus)
        ) {
          return false;
        }
        return stepReadOnly;
      })()
    : false;
  const isAnalyzingStage = Boolean(
    snapshot &&
    ["CV_ANALYZING", "REANALYZING", "SECONDARY_ANALYZING"].includes(
      snapshot.applicationStatus,
    ),
  );

  const analysisProgressView = useMemo(() => {
    if (!snapshot || !analysisSegment) {
      return null;
    }

    if (!isAnalyzingApplicationStatus(snapshot.applicationStatus)) {
      return null;
    }

    if (analysisSegment.segmentKey !== snapshot.applicationStatus) {
      return null;
    }

    void analysisUiTick;
    const elapsed = Date.now() - analysisSegment.startedAt;
    const progressRatio = getDisplayedProgressRatio(elapsed);
    const primaryMessage =
      snapshot.applicationStatus === "SECONDARY_ANALYZING"
        ? getSecondaryStageMessage(elapsed)
        : getPrimaryStageMessage(elapsed);

    const sanitizedApi = sanitizeProgressDisplayText(statusText);
    const showApiSecondary = shouldShowApiProgressSecondary(
      analysisJobStatus,
      sanitizedApi,
    );
    const secondaryMessage =
      showApiSecondary && sanitizedApi.length > 0 ? sanitizedApi : null;

    const ariaValueText = `CV review in progress; about ${Math.round(progressRatio * 100)} percent along the expected wait.`;

    return {
      progressRatio,
      primaryMessage,
      secondaryMessage,
      ariaValueText,
    };
  }, [
    snapshot,
    analysisSegment,
    statusText,
    analysisJobStatus,
    analysisUiTick,
  ]);

  useEffect(() => {
    if (!requestedResultView) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }, [requestedResultView]);
  const headerSummary = useMemo(() => {
    if (!snapshot) {
      return "This page shows your CV review status, any recognized information from your CV, and the next step you should take.";
    }

    switch (snapshot.applicationStatus) {
      case "CV_ANALYZING":
      case "REANALYZING":
        return "Your CV is still being reviewed. This page will update automatically; please keep it open.";
      case "INFO_REQUIRED":
        if (isEligibleContactCompletion) {
          return currentResultStep === 2
            ? "Your CV review already passed. Add the missing contact details below before you continue to supporting materials."
            : "Your CV review passed, but we still need a few contact details before you continue to supporting materials.";
        }

        if (hasMixedContactAndCriticalGaps) {
          return currentResultStep === 2
            ? "CV review still needs a few eligibility fields and contact details. Submit the missing items below and CV review will run again."
            : "CV review still needs a few eligibility fields and contact details. Continue to Additional Information to complete them.";
        }

        return currentResultStep === 2
          ? "CV review needs a few more fields. Submit the items below and CV review will run again."
          : "CV review needs a few more fields. Continue to Additional Information to complete them.";
      case "ELIGIBLE":
        return "Initial CV review is complete. Continue to Additional Information to upload supporting materials.";
      case "SECONDARY_ANALYZING":
        return "A legacy detailed review is running. This page will refresh automatically until it is ready.";
      case "SECONDARY_REVIEW":
        return "Continue to Additional Information to upload supporting materials.";
      case "SECONDARY_FAILED":
        return "The legacy detailed review step did not finish successfully. Please contact the program team if you need help continuing.";
      case "INELIGIBLE":
        return "This submission does not meet the published requirements. See the summary below for the reasons provided.";
      case "INTRO_VIEWED":
      case "CV_UPLOADED":
        return "Upload your latest CV and keep this page open while the review runs.";
      default:
        return "This page shows your CV review status, any recognized information from your CV, and the next step you should take.";
    }
  }, [currentResultStep, hasMixedContactAndCriticalGaps, isEligibleContactCompletion, snapshot]);
  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus),
    [snapshot?.applicationStatus],
  );
  const supplementalDraftLabel = supplementalDraftSavedAt
    ? new Date(supplementalDraftSavedAt).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Autosaving locally";
  return (
    <PageFrame>
      <PageShell
        title={
          currentResultStep === 1
            ? "Upload and track your CV Submission."
            : isEligibleContactCompletion
              ? "Complete your contact details to continue."
              : "Provide the remaining information needed to finish CV review."
        }
        description={headerSummary}
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={currentResultStep}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 1
        }
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {currentResultStep === 2 ? (
            <MobileSupportCard href={mailtoHref} />
          ) : null}

          {isReadOnlyReview ? (
            <StatusBanner
              tone="neutral"
              title="Reference-only review mode"
              description="You are viewing a previous stage. Field edits and status-changing actions are disabled."
            />
          ) : null}
          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Loading your CV review outcome"
              description="Restoring the latest CV review state and any recognized fields."
            />
          ) : null}

          {error ? (
            <StatusBanner
              tone="danger"
              title="The CV review status could not be refreshed"
              description={error}
            />
          ) : null}

          {snapshot ? (
            <>
              {showUploadState ? (
                <SectionCard
                  title="Applicant CV"
                  description="Choose one current CV file. The review starts as soon as the upload finishes."
                >
                  <div className="flex flex-col gap-5">
                    <label className="block">
                      <input
                        type="file"
                        disabled={isLoading || isUploadingResume}
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null;
                          setSelectedFile(nextFile);
                        }}
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.zip"
                      />
                      <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--muted)]/70 px-5 py-8 text-center transition hover:border-[color:var(--primary)] hover:bg-white">
                        <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                          Select file
                        </p>
                        <p className="mt-2 text-xl font-semibold text-[color:var(--primary)]">
                          Upload your latest CV
                        </p>
                        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--foreground-soft)]">
                          PDF or Word is preferred. ZIP archives are accepted
                          when the CV package needs to stay bundled. Maximum 20
                          MB per file, or up to 100 MB for ZIP.
                        </p>
                      </div>
                    </label>

                    {selectedFile ? (
                      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/55 px-4 py-3">
                        <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                          Selected file
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-[color:var(--primary)]">
                          {selectedFile.name}
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--foreground-soft)]">
                          {Math.ceil(selectedFile.size / 1024)} KB
                        </p>
                      </div>
                    ) : (
                      <input
                        value=""
                        readOnly
                        placeholder="No file selected yet"
                        className={getInputClassName(
                          "pointer-events-none bg-[color:var(--muted)]/40",
                        )}
                      />
                    )}

                    <div className="flex justify-center">
                      <ActionButton
                        onClick={handleResumeUpload}
                        disabled={
                          !selectedFile ||
                          isUploadingResume ||
                          isLoading ||
                          !snapshot
                        }
                        className="w-full sm:w-auto"
                      >
                        {isUploadingResume
                          ? "Submitting CV..."
                          : "Submit CV"}
                      </ActionButton>
                    </div>
                  </div>
                </SectionCard>
              ) : isAnalyzingStage ? (
                <AnalysisProgressPanel
                  title={
                    snapshot.applicationStatus === "SECONDARY_ANALYZING"
                      ? "Detailed review in progress"
                      : "CV submission is running"
                  }
                  description={
                    snapshot.applicationStatus === "SECONDARY_ANALYZING"
                      ? "When this step finishes, you can continue to supporting materials."
                      : "Your CV is being evaluated against the published requirements. This may take a little time."
                  }
                  progressRatio={analysisProgressView?.progressRatio ?? 0}
                  primaryMessage={
                    analysisProgressView?.primaryMessage ??
                    (snapshot.applicationStatus === "SECONDARY_ANALYZING"
                      ? getSecondaryStageMessage(0)
                      : getPrimaryStageMessage(0))
                  }
                  secondaryMessage={
                    analysisProgressView?.secondaryMessage ?? null
                  }
                  ariaValueText={
                    analysisProgressView?.ariaValueText ??
                    "CV review in progress."
                  }
                />
              ) : (
                getInitialBanner(snapshot, statusText, {
                  isEligibleContactCompletion,
                })
              )}

              {hasInitialCvReviewExtractData && snapshot.latestResult ? (
                <InitialCvReviewExtractCard
                  latestResult={snapshot.latestResult}
                />
              ) : null}

              {hasInitialCvReviewExtractData ? (
                <InitialCvReviewDeterminationCard snapshot={snapshot} />
              ) : null}

              {snapshot.latestResult?.reasonText &&
              snapshot.applicationStatus !== "INELIGIBLE" &&
              !hasInitialCvReviewExtractData ? (
                <SectionCard
                  title="CV review summary"
                  description={snapshot.latestResult.reasonText}
                />
              ) : null}

              {!isReadOnlyReview &&
              (snapshot.applicationStatus === "ELIGIBLE" ||
                snapshot.applicationStatus === "SECONDARY_REVIEW") &&
              !showUploadState &&
              !isAnalyzingStage ? (
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
                  <ActionButton
                    type="button"
                    onClick={() => router.push("/apply/materials")}
                    className="w-full sm:w-auto"
                  >
                    Continue to Additional Information
                  </ActionButton>
                </div>
              ) : null}

              {showSupplementalFields ? (
                <SectionCard
                  title={
                    isEligibleContactCompletion
                      ? "Complete your contact details"
                      : "Additional information requested"
                  }
                  description={
                    isEligibleContactCompletion
                      ? "We already have enough information to pass the CV review. Please fill the missing contact fields below before continuing to supporting materials."
                      : hasMixedContactAndCriticalGaps
                        ? "Suggested-from-CV entries are shaded softly. Fill the missing eligibility and contact fields below before submitting again."
                        : "Suggested-from-CV entries are shaded softly. Only blank fields need your input before you submit again."
                  }
                >
                  <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <MetaStrip
                      items={[
                        {
                          label: "Scope",
                          value: "Complete missing items only",
                        },
                        {
                          label: "Draft",
                          value: supplementalDraftLabel,
                        },
                        {
                          label: "After submit",
                          value: isEligibleContactCompletion
                            ? "Continue straight to supporting materials"
                            : "CV review runs again immediately",
                        },
                      ]}
                    />
                    <div className="grid gap-4">
                      {missingFields.map((field) =>
                        renderSupplementalField(
                          field,
                          register,
                          watch,
                          getValues,
                        ),
                      )}
                    </div>
                    <ActionButton
                      type="submit"
                      disabled={isSubmittingSupplemental || isReadOnlyReview}
                      className="w-full sm:w-auto"
                    >
                      {isSubmittingSupplemental
                        ? isEligibleContactCompletion
                          ? "Saving Contact Details..."
                          : "Submitting and Reanalyzing..."
                        : isEligibleContactCompletion
                          ? "Save Contact Details"
                          : "Submit Additional Information"}
                    </ActionButton>
                  </form>
                </SectionCard>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}

export function CvReviewExperienceWithSuspense() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-slate-600">
          Loading application status…
        </div>
      }
    >
      <CvReviewExperience />
    </Suspense>
  );
}
