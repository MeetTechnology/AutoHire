"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import type { MissingField } from "@/features/analysis/types";
import {
  buildVisibleExtractedFieldSummary,
  getRawReasoning,
} from "@/features/analysis/display";
import {
  ActionButton,
  DetailCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
  getInputClassName,
} from "@/components/ui/page-shell";
import {
  fetchSecondaryAnalysisResult,
  fetchAnalysisResult,
  fetchAnalysisStatus,
  fetchSession,
  submitSupplementalFields,
  triggerSecondaryAnalysis,
} from "@/features/application/client";
import { APPLICATION_FLOW_STEPS } from "@/features/application/constants";
import type {
  ApplicationSnapshot,
  SecondaryAnalysisSnapshot,
  SecondaryAnalysisStatus,
} from "@/features/application/types";
import { cn } from "@/lib/utils";

type SupplementalFormValues = Record<string, string>;

function normalizeDateInputYearToFourDigits(event: ChangeEvent<HTMLInputElement>) {
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

function getSecondaryStatusMessage(status: SecondaryAnalysisStatus) {
  switch (status) {
    case "pending":
      return "Secondary analysis has been queued.";
    case "processing":
      return "Secondary analysis is running.";
    case "retrying":
      return "Secondary analysis is retrying after a temporary issue.";
    case "completed":
      return "Secondary analysis has completed.";
    case "completed_partial":
      return "Secondary analysis completed with partial output.";
    case "failed":
      return "Secondary analysis failed.";
    default:
      return "Secondary analysis has not started yet.";
  }
}

function renderSupplementalField(
  field: MissingField,
  register: ReturnType<typeof useForm<SupplementalFormValues>>["register"],
  watch: ReturnType<typeof useForm<SupplementalFormValues>>["watch"],
  getValues: ReturnType<typeof useForm<SupplementalFormValues>>["getValues"],
) {
  const inputClassName = getInputClassName();

  return (
    <label
      key={field.fieldKey}
      className="block rounded-[1.4rem] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700"
    >
      <span className="block text-sm font-semibold text-stone-950">
        {field.label}
      </span>
      <span className="mt-1 block text-xs tracking-[0.18em] text-stone-500 uppercase">
        {field.required ? "Required field" : "Optional field"}
      </span>
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
              <div className="mt-3 rounded-xl border border-stone-200 bg-white/80 p-3">
                <span className="mb-2 block text-xs font-medium text-stone-700">
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
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800 transition hover:border-stone-400"
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
      {field.helpText ? (
        <span className="mt-3 block text-xs leading-6 text-stone-500">
          {field.helpText}
        </span>
      ) : null}
    </label>
  );
}

function getInitialBanner(
  snapshot: ApplicationSnapshot | null,
  statusText: string,
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
        title="Your resume is currently under review"
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
          <p className="text-sm leading-7 text-rose-900/85">
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
        title="The initial eligibility review has passed"
        description={snapshot.latestResult?.displaySummary ?? undefined}
      />
    );
  }

  if (snapshot.applicationStatus === "INFO_REQUIRED") {
    return (
      <StatusBanner
        tone="neutral"
        title="Some required information is still missing"
        description={
          snapshot.latestResult?.displaySummary ??
          "Please complete the fields below and run the analysis again."
        }
      />
    );
  }

  return null;
}

function DetailedInitialAnalysisSection({
  rawReasoning,
  expanded,
  onToggle,
}: {
  rawReasoning: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <SectionCard
      title="Detailed initial analysis"
      description="This section contains the full model-facing reasoning block retained for review."
      action={
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={
            expanded ? "Collapse detailed analysis" : "Expand detailed analysis"
          }
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white/95 text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition hover:border-stone-400 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "h-5 w-5 transition-transform duration-200",
              expanded ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      }
    >
      {expanded ? (
        <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-5 text-sm leading-7 text-stone-700">
          <p className="whitespace-pre-wrap">{rawReasoning}</p>
        </div>
      ) : null}
    </SectionCard>
  );
}

export default function ResultPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [statusText, setStatusText] = useState(
    "Preparing your analysis result...",
  );
  const [error, setError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [secondarySnapshot, setSecondarySnapshot] =
    useState<SecondaryAnalysisSnapshot | null>(null);
  const [isSubmittingSupplemental, startSupplementalTransition] =
    useTransition();
  const [isStartingSecondary, startSecondaryTransition] = useTransition();
  const [isDetailedAnalysisOpen, setIsDetailedAnalysisOpen] = useState(true);
  const { register, handleSubmit, reset, watch, getValues } =
    useForm<SupplementalFormValues>();

  const rawReasoning = useMemo(
    () => getRawReasoning(snapshot?.latestResult?.extractedFields),
    [snapshot?.latestResult?.extractedFields],
  );

  useEffect(() => {
    if (rawReasoning) {
      setIsDetailedAnalysisOpen(true);
    }
  }, [rawReasoning, snapshot?.applicationStatus]);

  async function syncAnalysisProgress(applicationId: string) {
    const status = await fetchAnalysisStatus(applicationId);
    setStatusText(status.progressMessage);

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

        if (
          nextSnapshot.applicationStatus === "INIT" ||
          nextSnapshot.applicationStatus === "INTRO_VIEWED"
        ) {
          router.replace("/apply/resume");
          return;
        }

        if (
          nextSnapshot.applicationStatus === "MATERIALS_IN_PROGRESS" ||
          nextSnapshot.applicationStatus === "SUBMITTED"
        ) {
          router.replace("/apply/materials");
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to load the analysis result.",
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
    if (
      !snapshot ||
      (snapshot.applicationStatus !== "CV_ANALYZING" &&
        snapshot.applicationStatus !== "REANALYZING")
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

        if (status.jobStatus === "FAILED") {
          const refreshedSession = await fetchSession();

          if (!active) {
            return;
          }

          setSnapshot(refreshedSession);
          setError(
            status.errorMessage ?? "Analysis failed. Please try again later.",
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
              : "Failed to refresh the analysis status.",
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
          reset(defaults);
        }
      })
      .catch(() => undefined);
  }, [reset, snapshot?.applicationId]);

  useEffect(() => {
    if (!snapshot?.applicationId) {
      return;
    }

    let active = true;

    void fetchSecondaryAnalysisResult(snapshot.applicationId)
      .then((result) => {
        if (active) {
          setSecondarySnapshot(result);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [snapshot?.applicationId]);

  useEffect(() => {
    if (
      !snapshot?.applicationId ||
      !secondarySnapshot ||
      !["pending", "processing", "retrying"].includes(secondarySnapshot.status)
    ) {
      return;
    }

    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const nextSnapshot = await fetchSecondaryAnalysisResult(
          snapshot.applicationId,
          secondarySnapshot.runId,
        );

        if (!active) {
          return;
        }

        setSecondarySnapshot(nextSnapshot);
        setSecondaryError(null);
      } catch (nextError) {
        if (active) {
          setSecondaryError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to refresh the secondary analysis.",
          );
        }
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [secondarySnapshot, snapshot?.applicationId]);

  function onSubmit(values: SupplementalFormValues) {
    if (!snapshot) {
      return;
    }

    startSupplementalTransition(async () => {
      try {
        setError(null);
        await submitSupplementalFields(snapshot.applicationId, values);
        setSnapshot((current) =>
          current
            ? {
                ...current,
                applicationStatus: "REANALYZING",
              }
            : current,
        );
        setStatusText(
          "The system is reanalyzing your resume with the supplemental information...",
        );
        await syncAnalysisProgress(snapshot.applicationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to submit the supplemental information.",
        );
      }
    });
  }

  function onTriggerSecondaryAnalysis() {
    if (!snapshot) {
      return;
    }

    startSecondaryTransition(async () => {
      try {
        setSecondaryError(null);
        const triggered = await triggerSecondaryAnalysis(
          snapshot.applicationId,
        );
        const nextSnapshot = await fetchSecondaryAnalysisResult(
          snapshot.applicationId,
          triggered.runId,
        );

        setSecondarySnapshot(nextSnapshot);
      } catch (nextError) {
        setSecondaryError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to start the secondary analysis.",
        );
      }
    });
  }

  const visibleExtractedFields = buildVisibleExtractedFieldSummary(
    snapshot?.latestResult?.extractedFields ?? {},
  );
  const canTriggerSecondaryAnalysis = Boolean(
    snapshot &&
    snapshot.applicationStatus !== "CV_ANALYZING" &&
    snapshot.applicationStatus !== "REANALYZING",
  );
  const isSecondaryRunning = Boolean(
    secondarySnapshot &&
    ["pending", "processing", "retrying"].includes(secondarySnapshot.status),
  );

  const headerSummary = useMemo(() => {
    if (!snapshot) {
      return "The result page explains the current review state, surfaces recognized information, and provides the next appropriate action.";
    }

    switch (snapshot.applicationStatus) {
      case "CV_ANALYZING":
      case "REANALYZING":
        return "Your application is still being evaluated. This page will update automatically while the analysis is in progress.";
      case "INFO_REQUIRED":
        return "The current review is incomplete because a few structured fields are still missing. Once submitted, the application will be analyzed again.";
      case "ELIGIBLE":
        return "The initial review is complete and you can move forward to the supporting materials stage.";
      case "INELIGIBLE":
        return "The current submission does not satisfy the application criteria. Review the assessment summary below for context.";
      default:
        return "The result page explains the current review state, surfaces recognized information, and provides the next appropriate action.";
    }
  }, [snapshot]);

  return (
    <PageFrame>
      <PageShell
        eyebrow="Eligibility Review"
        title="Review the current assessment and continue with the appropriate next step."
        description={headerSummary}
        steps={APPLICATION_FLOW_STEPS}
        currentStep={2}
        headerSlot={
          <SectionCard
            title="Review outcomes"
            description="The system can keep processing, request missing structured fields, or confirm that you may continue to the materials stage."
            className="bg-white/90"
          >
            <div className="space-y-3">
              <DetailCard
                eyebrow="Outcome 01"
                title="Analysis in progress"
                description="The page refreshes the review state automatically until the result is ready."
              />
              <DetailCard
                eyebrow="Outcome 02"
                title="Additional information required"
                description="You only need to complete the exact structured fields that were identified as missing."
              />
              <DetailCard
                eyebrow="Outcome 03"
                title="Ready for materials"
                description="If the initial review is successful, you can continue to upload supporting evidence and submit the package."
              />
            </div>
          </SectionCard>
        }
      >
        <div className="space-y-6">
          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Loading the analysis result"
              description="Restoring the latest review state and any recognized fields."
            />
          ) : null}

          {error ? (
            <StatusBanner
              tone="danger"
              title="The analysis result could not be refreshed"
              description={error}
            />
          ) : null}

          {snapshot ? (
            <>
              {rawReasoning &&
              snapshot.applicationStatus === "ELIGIBLE" ? (
                <DetailedInitialAnalysisSection
                  rawReasoning={rawReasoning}
                  expanded={isDetailedAnalysisOpen}
                  onToggle={() =>
                    setIsDetailedAnalysisOpen((previous) => !previous)
                  }
                />
              ) : null}

              {getInitialBanner(snapshot, statusText)}

              {snapshot.latestResult?.reasonText &&
              snapshot.applicationStatus !== "INELIGIBLE" ? (
                <SectionCard
                  title="Review summary"
                  description={snapshot.latestResult.reasonText}
                />
              ) : null}

              {visibleExtractedFields.length > 0 ? (
                <SectionCard
                  title="Recognized information summary"
                  description="These items were extracted from the current resume and normalized for display."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {visibleExtractedFields.map((field) => (
                      <DetailCard
                        key={`${field.no}-${field.label}`}
                        eyebrow={`No. ${field.no}`}
                        title={field.label}
                        description={field.value}
                      />
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {snapshot.applicationStatus === "INFO_REQUIRED" ? (
                <SectionCard
                  title="Complete the missing information"
                  description="Please add the structured information below, then submit it for another review pass."
                >
                  <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid gap-4">
                      {snapshot.latestResult?.missingFields.map((field) =>
                        renderSupplementalField(field, register, watch, getValues),
                      )}
                    </div>
                    <ActionButton
                      type="submit"
                      disabled={isSubmittingSupplemental}
                      className="w-full sm:w-auto"
                    >
                      {isSubmittingSupplemental
                        ? "Submitting and Reanalyzing..."
                        : "Submit and Reanalyze"}
                    </ActionButton>
                  </form>
                </SectionCard>
              ) : null}

              {rawReasoning &&
              snapshot.applicationStatus !== "ELIGIBLE" ? (
                <DetailedInitialAnalysisSection
                  rawReasoning={rawReasoning}
                  expanded={isDetailedAnalysisOpen}
                  onToggle={() =>
                    setIsDetailedAnalysisOpen((previous) => !previous)
                  }
                />
              ) : null}

              {canTriggerSecondaryAnalysis ? (
                <SectionCard
                  title="Further analysis"
                  description="Run the secondary analysis flow to inspect mapped expert-facing fields, or continue directly to the materials stage when eligible."
                  action={
                    snapshot.applicationStatus === "ELIGIBLE" ? (
                      <ActionButton
                        variant="success"
                        onClick={() => router.push("/apply/materials")}
                      >
                        Continue to Materials
                      </ActionButton>
                    ) : null
                  }
                >
                  <div className="flex flex-wrap gap-3">
                    <ActionButton
                      variant="secondary"
                      onClick={onTriggerSecondaryAnalysis}
                      disabled={isStartingSecondary || isSecondaryRunning}
                    >
                      {isStartingSecondary || isSecondaryRunning
                        ? "Running Secondary Analysis..."
                        : secondarySnapshot?.runId
                          ? "Run Secondary Analysis Again"
                          : "Run Secondary Analysis"}
                    </ActionButton>
                  </div>
                </SectionCard>
              ) : null}

              {secondaryError ? (
                <StatusBanner
                  tone="danger"
                  title="Secondary analysis could not be refreshed"
                  description={secondaryError}
                />
              ) : null}

              {secondarySnapshot && secondarySnapshot.status !== "idle" ? (
                <SectionCard
                  title="Secondary analysis result"
                  description={getSecondaryStatusMessage(
                    secondarySnapshot.status,
                  )}
                  action={
                    secondarySnapshot.runId ? (
                      <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-stone-600 uppercase">
                        Run #{secondarySnapshot.runId}
                      </span>
                    ) : null
                  }
                >
                  <div className="space-y-4">
                    {secondarySnapshot.run ? (
                      <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-700">
                        <p>
                          Status:{" "}
                          {secondarySnapshot.run.status ??
                            secondarySnapshot.status}
                        </p>
                        <p className="mt-1">
                          Completed prompts:{" "}
                          {secondarySnapshot.run.completedPrompts ?? 0}
                          {secondarySnapshot.run.totalPrompts
                            ? ` / ${secondarySnapshot.run.totalPrompts}`
                            : ""}
                        </p>
                        {secondarySnapshot.run.failedPromptIds.length > 0 ? (
                          <p className="mt-1">
                            Failed prompt IDs:{" "}
                            {secondarySnapshot.run.failedPromptIds.join(", ")}
                          </p>
                        ) : null}
                        {secondarySnapshot.run.errorMessage ? (
                          <p className="mt-1 text-rose-700">
                            {secondarySnapshot.run.errorMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {secondarySnapshot.errorMessage ? (
                      <p className="text-sm text-rose-700">
                        {secondarySnapshot.errorMessage}
                      </p>
                    ) : null}

                    {secondarySnapshot.fields.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {secondarySnapshot.fields.map((field) => (
                          <DetailCard
                            key={`${field.no}-${field.label}`}
                            eyebrow={`No. ${field.no}${
                              field.column ? ` / Column ${field.column}` : ""
                            }`}
                            title={field.label}
                            description={field.value}
                          />
                        ))}
                      </div>
                    ) : secondarySnapshot.status === "completed" ||
                      secondarySnapshot.status === "completed_partial" ? (
                      <p className="text-sm leading-7 text-stone-600">
                        No expert-facing secondary fields were available to
                        display.
                      </p>
                    ) : null}
                  </div>
                </SectionCard>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
