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
import { ChevronsDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { flushSync } from "react-dom";
import { useForm } from "react-hook-form";

import type { MissingField } from "@/features/analysis/types";
import type { EditableSecondaryField } from "@/features/analysis/types";
import {
  buildVisibleExtractedFieldSummary,
  getRawReasoning,
} from "@/features/analysis/display";
import { MarkdownProse } from "@/components/ui/markdown-prose";
import {
  ActionButton,
  DisclosureSection,
  MetaStrip,
  MobileSupportCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
  getInputClassName,
} from "@/components/ui/page-shell";
import {
  enterMaterialsStage,
  fetchEditableSecondaryAnalysis,
  fetchAnalysisResult,
  fetchAnalysisStatus,
  fetchSession,
  saveEditableSecondaryAnalysis,
  submitSupplementalFields,
  triggerSecondaryAnalysis,
} from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/application/draft-storage";
import {
  buildApplyFlowStepLinks,
  canAccessFlowStep,
  getReachableFlowStep,
  isFlowStepReadOnly,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type { ApplicationFlowStep } from "@/features/application/route";
import type {
  ApplicationSnapshot,
  EditableSecondaryAnalysisSnapshot,
  SecondaryAnalysisStatus,
} from "@/features/application/types";
import { cn } from "@/lib/utils";

type SupplementalFormValues = Record<string, string>;
const ANALYSIS_MESSAGES = [
  "Analyzing educational background...",
  "Matching project profile...",
  "Checking research direction...",
  "Normalizing structured profile fields...",
  "Syncing the latest review state...",
] as const;
const RESULT_VIEW_TO_STEP = {
  review: 2,
  additional: 3,
} as const;

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

function getSecondaryStatusMessage(status: SecondaryAnalysisStatus) {
  switch (status) {
    case "pending":
      return "Detailed analysis has been queued.";
    case "processing":
      return "Detailed analysis is running.";
    case "retrying":
      return "Detailed analysis is retrying after a temporary issue.";
    case "completed":
      return "Detailed analysis has completed.";
    case "completed_partial":
      return "Detailed analysis completed with partial output.";
    case "failed":
      return "Detailed analysis failed.";
    default:
      return "Detailed analysis has not started yet.";
  }
}

function sortSecondaryFieldsMissingFirst(
  rows: EditableSecondaryField[],
): EditableSecondaryField[] {
  return [...rows].sort((left, right) => {
    if (left.isMissing !== right.isMissing) {
      return left.isMissing ? -1 : 1;
    }

    return left.no - right.no;
  });
}

function secondaryFieldNosMissingFirst(
  fields: EditableSecondaryField[],
): number[] {
  return sortSecondaryFieldsMissingFirst(fields).map((field) => field.no);
}

function formatSavedAt(value: string | null) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not saved yet";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSecondaryFieldState(field: EditableSecondaryField) {
  if (field.isMissing) {
    return {
      label: "Missing",
      className: "border-slate-400 bg-slate-200 text-[#0A192F]",
    };
  }

  if (field.isEdited) {
    return {
      label: "Expert edited",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  return {
    label: "Model value",
    className: "border-slate-300 bg-slate-100 text-slate-700",
  };
}

function buildDraftSecondaryField(
  field: EditableSecondaryField,
  input: {
    editedValue: string;
    hasOverride: boolean;
  },
) {
  const effectiveValue = input.hasOverride
    ? input.editedValue
    : field.sourceValue;

  return {
    ...field,
    editedValue: input.editedValue,
    hasOverride: input.hasOverride,
    effectiveValue,
    isMissing: effectiveValue.trim().length === 0,
    isEdited:
      input.hasOverride &&
      input.editedValue.trim() !== field.sourceValue.trim(),
  } satisfies EditableSecondaryField;
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
            AI prefilled
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

function renderEditableSecondaryField(input: {
  field: EditableSecondaryField;
  disabled: boolean;
  onChange: (no: number, value: string) => void;
  onReset: (no: number) => void;
}) {
  const { field, disabled, onChange, onReset } = input;
  const inputClassName = getInputClassName();
  const state = getSecondaryFieldState(field);
  const helperText = field.helpText
    ? field.helpText
    : field.sourceValue
      ? "You may replace the extracted value if it needs correction."
      : "No model value was extracted for this field yet. Please complete it manually if available.";
  const controlId = `secondary-field-${field.fieldKey}`;
  const blockAnchorId = `secondary-field-block-${field.fieldKey}`;

  const control =
    field.inputType === "textarea" ? (
      <textarea
        id={controlId}
        aria-label={field.label}
        value={field.hasOverride ? field.editedValue : field.effectiveValue}
        disabled={disabled}
        className={getInputClassName("min-h-32")}
        placeholder={field.placeholder}
        onChange={(event) => onChange(field.no, event.currentTarget.value)}
      />
    ) : field.inputType === "select" ? (
      <select
        id={controlId}
        aria-label={field.label}
        value={field.hasOverride ? field.editedValue : field.effectiveValue}
        disabled={disabled}
        className={inputClassName}
        onChange={(event) => onChange(field.no, event.currentTarget.value)}
      >
        <option value="">Please select</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : field.inputType === "radio" ? (
      <div className="flex flex-wrap gap-3">
        {field.options?.map((option) => (
          <label
            key={option}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 transition",
              disabled ? "opacity-60" : "hover:border-slate-500",
            )}
          >
            <input
              type="radio"
              value={option}
              disabled={disabled}
              checked={
                (field.hasOverride
                  ? field.editedValue
                  : field.effectiveValue) === option
              }
              onChange={(event) =>
                onChange(field.no, event.currentTarget.value)
              }
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    ) : (
      <input
        id={controlId}
        aria-label={field.label}
        type={field.inputType === "number" ? "number" : field.inputType}
        value={field.hasOverride ? field.editedValue : field.effectiveValue}
        disabled={disabled}
        min={field.inputType === "date" ? "1900-01-01" : undefined}
        max={field.inputType === "date" ? "2100-12-31" : undefined}
        className={inputClassName}
        placeholder={field.placeholder}
        onChange={(event) => onChange(field.no, event.currentTarget.value)}
      />
    );

  return (
    <div
      key={field.no}
      id={blockAnchorId}
      className={cn(
        "block scroll-mt-24 rounded-xl border p-3.5 text-sm text-slate-700",
        field.isMissing
          ? "border-[color:var(--accent)] bg-white"
          : "border-[color:var(--border)] bg-[color:var(--muted)]/55",
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <label
            htmlFor={field.inputType === "radio" ? undefined : controlId}
            className="block text-sm font-semibold text-[#0A192F]"
          >
            {field.label}
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold tracking-[0.1em] text-slate-700 uppercase">
              No. {field.no}
              {field.column ? ` / ${field.column}` : ""}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase",
                state.className,
              )}
            >
              {state.label}
            </span>
          </div>
        </div>
        <ActionButton
          type="button"
          variant="ghost"
          disabled={disabled || !field.hasOverride}
          onClick={() => onReset(field.no)}
        >
          Reset to Model Value
        </ActionButton>
      </div>
      <div className="mt-4">
        <div
          className={cn(
            field.sourceValue
              ? "rounded-xl bg-[color:var(--muted)]/75 p-2"
              : "",
          )}
        >
          {control}
        </div>
      </div>
      <div className="mt-3 space-y-2 text-xs leading-6 text-slate-500">
        <p>{helperText}</p>
        <p>
          Model value:{" "}
          <span className="font-medium text-slate-700">
            {field.sourceValue || "No extracted value"}
          </span>
        </p>
      </div>
    </div>
  );
}

function AnalysisProgressPanel({
  title,
  description,
  message,
}: {
  title: string;
  description: string;
  message: string;
}) {
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
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full w-3/5 rounded-full bg-[color:var(--primary)]" />
          </div>
          <p className="mt-3 text-sm font-medium text-[color:var(--primary)]">
            {message}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function mergeSecondaryDraft(
  fields: EditableSecondaryField[],
  draftValues:
    | Record<
        string,
        {
          editedValue: string;
          hasOverride: boolean;
        }
      >
    | null
    | undefined,
) {
  if (!draftValues) {
    return fields;
  }

  return fields.map((field) => {
    const draft = draftValues[field.fieldKey];

    if (!draft) {
      return field;
    }

    return buildDraftSecondaryField(field, draft);
  });
}

function getInitialBanner(
  snapshot: ApplicationSnapshot | null,
  statusText: string,
  detailedStatusText?: string | null,
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
        title="The initial eligibility review has passed"
        description={
          detailedStatusText ??
          "Run the detailed analysis to prepare the expert-facing review before supporting materials become available."
        }
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_ANALYZING") {
    return (
      <StatusBanner
        tone="loading"
        title="Detailed analysis is in progress"
        description={
          detailedStatusText ??
          "The system is preparing the detailed expert-facing analysis before the materials stage opens."
        }
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_REVIEW") {
    return (
      <StatusBanner
        tone="success"
        title="Detailed analysis is ready"
        description={
          detailedStatusText ??
          "Review the detailed analysis below, save any changes you need, and then continue to supporting materials."
        }
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_FAILED") {
    return (
      <StatusBanner
        tone="danger"
        title="Detailed analysis could not be completed"
        description={
          detailedStatusText ??
          "The supporting materials stage stays locked until the detailed analysis succeeds."
        }
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

function InitialAnalysisNotesSection({
  rawReasoning,
}: {
  rawReasoning: string;
}) {
  return (
    <DisclosureSection
      title="Initial analysis notes"
      summary="Reference notes retained from the initial eligibility pass."
    >
      <div className="rounded-md border border-slate-300 bg-white p-4">
        <MarkdownProse markdown={rawReasoning} />
      </div>
    </DisclosureSection>
  );
}

function ResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [statusText, setStatusText] = useState(
    "Preparing your analysis result...",
  );
  const [error, setError] = useState<string | null>(null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [secondarySaveMessage, setSecondarySaveMessage] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editableSecondarySnapshot, setEditableSecondarySnapshot] =
    useState<EditableSecondaryAnalysisSnapshot | null>(null);
  const [secondaryDraftFields, setSecondaryDraftFields] = useState<
    EditableSecondaryField[]
  >([]);
  /** Field `no` order from last committed (saved) missing-first layout; kept while editing. */
  const committedSecondaryFieldOrderRef = useRef<number[]>([]);
  const [isSubmittingSupplemental, startSupplementalTransition] =
    useTransition();
  const [isStartingSecondary, startSecondaryTransition] = useTransition();
  const [isSavingSecondary, startSecondarySaveTransition] = useTransition();
  const [isEnteringMaterials, startMaterialsTransition] = useTransition();
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [analysisMessageIndex, setAnalysisMessageIndex] = useState(0);
  const [supplementalDraftSavedAt, setSupplementalDraftSavedAt] = useState<
    string | null
  >(null);
  const [mailtoHref, setMailtoHref] = useState<string | undefined>(undefined);
  const { register, handleSubmit, reset, watch, getValues } =
    useForm<SupplementalFormValues>();

  const rawReasoning = useMemo(
    () => getRawReasoning(snapshot?.latestResult?.extractedFields),
    [snapshot?.latestResult?.extractedFields],
  );

  useEffect(() => {
    setMailtoHref(getMailtoHref());
  }, []);

  const requestedResultView = searchParams.get("view");

  const statusDrivenResultStep: ApplicationFlowStep = !snapshot
    ? 2
    : [
          "INFO_REQUIRED",
          "SECONDARY_ANALYZING",
          "SECONDARY_REVIEW",
          "SECONDARY_FAILED",
        ].includes(snapshot.applicationStatus)
      ? 3
      : 2;

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

    const refreshedSession = await fetchSession();
    setSnapshot(refreshedSession);
  }

  async function fetchDetailedAnalysisState(
    applicationId: string,
    runId?: string | null,
  ) {
    const [nextDetailedSnapshot, refreshedSession] = await Promise.all([
      fetchEditableSecondaryAnalysis(applicationId, runId),
      fetchSession(),
    ]);

    return {
      nextDetailedSnapshot,
      refreshedSession,
    };
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const nextSnapshot = await fetchSession();

        if (!active) {
          return;
        }

        if (!canAccessFlowStep(nextSnapshot.applicationStatus, 2)) {
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
    if (
      !snapshot ||
      !["CV_ANALYZING", "REANALYZING", "SECONDARY_ANALYZING"].includes(
        snapshot.applicationStatus,
      )
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setAnalysisMessageIndex(
        (current) => (current + 1) % ANALYSIS_MESSAGES.length,
      );
    }, 1800);

    return () => {
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
    if (!snapshot?.applicationId) {
      return;
    }

    let active = true;

    void fetchDetailedAnalysisState(snapshot.applicationId)
      .then(({ nextDetailedSnapshot, refreshedSession }) => {
        if (active) {
          setEditableSecondarySnapshot(nextDetailedSnapshot);
          const draftKey = nextDetailedSnapshot.runId
            ? `autohire:secondary:${snapshot.applicationId}:${nextDetailedSnapshot.runId}`
            : null;
          const storedDraft = draftKey
            ? readDraft<
                Record<
                  string,
                  {
                    editedValue: string;
                    hasOverride: boolean;
                  }
                >
              >(draftKey)
            : null;
          setSecondaryDraftFields(
            mergeSecondaryDraft(
              nextDetailedSnapshot.fields,
              storedDraft?.values,
            ),
          );
          setSnapshot(refreshedSession);
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
      !editableSecondarySnapshot ||
      !["pending", "processing", "retrying"].includes(
        editableSecondarySnapshot.status,
      )
    ) {
      return;
    }

    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const { nextDetailedSnapshot, refreshedSession } =
          await fetchDetailedAnalysisState(
            snapshot.applicationId,
            editableSecondarySnapshot.runId,
          );

        if (!active) {
          return;
        }

        setEditableSecondarySnapshot(nextDetailedSnapshot);
        const draftKey = nextDetailedSnapshot.runId
          ? `autohire:secondary:${snapshot.applicationId}:${nextDetailedSnapshot.runId}`
          : null;
        const storedDraft = draftKey
          ? readDraft<
              Record<
                string,
                {
                  editedValue: string;
                  hasOverride: boolean;
                }
              >
            >(draftKey)
          : null;
        setSecondaryDraftFields(
          mergeSecondaryDraft(nextDetailedSnapshot.fields, storedDraft?.values),
        );
        setSnapshot(refreshedSession);
        setSecondaryError(null);
      } catch (nextError) {
        if (active) {
          setSecondaryError(
            nextError instanceof Error
              ? nextError.message
              : "Failed to refresh the detailed analysis.",
          );
        }
      }
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [editableSecondarySnapshot, snapshot?.applicationId]);

  useEffect(() => {
    function updateJumpToBottomVisibility() {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      const nearBottom = maxScroll - scrollTop < 160;
      setShowJumpToBottom(scrollTop > 240 && !nearBottom && maxScroll > 320);
    }

    updateJumpToBottomVisibility();
    window.addEventListener("scroll", updateJumpToBottomVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateJumpToBottomVisibility);

    return () => {
      window.removeEventListener("scroll", updateJumpToBottomVisibility);
      window.removeEventListener("resize", updateJumpToBottomVisibility);
    };
  }, [snapshot?.applicationStatus]);

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

  useEffect(() => {
    if (!snapshot?.applicationId || !editableSecondarySnapshot?.runId) {
      return;
    }

    const values = Object.fromEntries(
      secondaryDraftFields.map((field) => [
        field.fieldKey,
        {
          editedValue: field.editedValue,
          hasOverride: field.hasOverride,
        },
      ]),
    );
    const draftKey = `autohire:secondary:${snapshot.applicationId}:${editableSecondarySnapshot.runId}`;
    const timer = window.setTimeout(() => {
      writeDraft(draftKey, values);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    editableSecondarySnapshot?.runId,
    secondaryDraftFields,
    snapshot?.applicationId,
  ]);

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
        clearDraft(`autohire:supplemental:${snapshot.applicationId}`);
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
    if (
      !snapshot ||
      isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    ) {
      return;
    }

    startSecondaryTransition(async () => {
      try {
        setSecondaryError(null);
        setSecondarySaveMessage(null);
        const triggered = await triggerSecondaryAnalysis(
          snapshot.applicationId,
        );
        const { nextDetailedSnapshot, refreshedSession } =
          await fetchDetailedAnalysisState(
            snapshot.applicationId,
            triggered.runId,
          );

        setEditableSecondarySnapshot(nextDetailedSnapshot);
        setSecondaryDraftFields(nextDetailedSnapshot.fields);
        setSnapshot(refreshedSession);
      } catch (nextError) {
        setSecondaryError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to start the detailed analysis.",
        );
      }
    });
  }

  function updateSecondaryDraftField(no: number, value: string) {
    if (
      snapshot &&
      isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    ) {
      return;
    }
    setSecondarySaveMessage(null);
    setSecondaryDraftFields((current) =>
      current.map((field) =>
        field.no === no
          ? buildDraftSecondaryField(field, {
              editedValue: value,
              hasOverride: true,
            })
          : field,
      ),
    );
  }

  function resetSecondaryDraftField(no: number) {
    if (
      snapshot &&
      isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    ) {
      return;
    }
    setSecondarySaveMessage(null);
    setSecondaryDraftFields((current) =>
      current.map((field) =>
        field.no === no
          ? buildDraftSecondaryField(field, {
              editedValue: "",
              hasOverride: false,
            })
          : field,
      ),
    );
  }

  function onSaveSecondaryFields() {
    const runId = editableSecondarySnapshot?.runId;

    if (
      !snapshot ||
      !runId ||
      isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    ) {
      return;
    }

    startSecondarySaveTransition(async () => {
      try {
        setSecondaryError(null);
        const nextSnapshot = await saveEditableSecondaryAnalysis(
          snapshot.applicationId,
          {
            runId,
            fields: Object.fromEntries(
              secondaryDraftFields.map((field) => [
                field.fieldKey,
                {
                  value: field.editedValue,
                  hasOverride: field.hasOverride,
                },
              ]),
            ),
          },
        );

        const refreshedSession = await fetchSession();

        const firstStillMissing = nextSnapshot.fields.find(
          (field) => field.isMissing,
        );

        flushSync(() => {
          setEditableSecondarySnapshot(nextSnapshot);
          setSecondaryDraftFields(nextSnapshot.fields);
          setSnapshot(refreshedSession);
          setSecondarySaveMessage(
            "The detailed analysis fields have been saved.",
          );
        });
        clearDraft(`autohire:secondary:${snapshot.applicationId}:${runId}`);

        if (firstStillMissing) {
          document
            .getElementById(
              `secondary-field-block-${firstStillMissing.fieldKey}`,
            )
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch (nextError) {
        setSecondaryError(
          nextError instanceof Error
            ? nextError.message
            : "The detailed analysis fields could not be saved.",
        );
      }
    });
  }

  function onContinueToMaterials() {
    if (
      !snapshot ||
      isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    ) {
      return;
    }

    startMaterialsTransition(async () => {
      try {
        setSecondaryError(null);
        if (editableSecondarySnapshot?.runId) {
          clearDraft(
            `autohire:secondary:${snapshot.applicationId}:${editableSecondarySnapshot.runId}`,
          );
        }
        await enterMaterialsStage(snapshot.applicationId);
        router.push("/apply/materials");
      } catch (nextError) {
        setSecondaryError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to continue to supporting materials.",
        );
      }
    });
  }

  const visibleExtractedFields = buildVisibleExtractedFieldSummary(
    snapshot?.latestResult?.extractedFields ?? {},
  );
  const secondaryRunAlreadyStarted = Boolean(editableSecondarySnapshot?.runId);
  const canTriggerSecondaryAnalysis = Boolean(
    snapshot &&
    snapshot.applicationStatus === "ELIGIBLE" &&
    !secondaryRunAlreadyStarted,
  );
  const isSecondaryRunning = Boolean(
    editableSecondarySnapshot &&
    ["pending", "processing", "retrying"].includes(
      editableSecondarySnapshot.status,
    ),
  );
  const secondaryHasUnsavedChanges =
    editableSecondarySnapshot?.fields.length === secondaryDraftFields.length &&
    secondaryDraftFields.some((field) => {
      const savedField = editableSecondarySnapshot.fields.find(
        (item) => item.no === field.no,
      );

      return (
        savedField?.editedValue !== field.editedValue ||
        savedField?.hasOverride !== field.hasOverride
      );
    });

  useEffect(() => {
    if (secondaryHasUnsavedChanges) {
      return;
    }

    if (secondaryDraftFields.length === 0) {
      return;
    }

    committedSecondaryFieldOrderRef.current =
      secondaryFieldNosMissingFirst(secondaryDraftFields);
  }, [
    secondaryHasUnsavedChanges,
    secondaryDraftFields,
    editableSecondarySnapshot?.runId,
  ]);

  /** Missing-first when saved; while editing, reuse last committed row order via ref. */
  const orderedSecondaryDraftFields = useMemo(() => {
    const byNo = new Map(
      secondaryDraftFields.map((field) => [field.no, field] as const),
    );

    if (!secondaryHasUnsavedChanges) {
      return sortSecondaryFieldsMissingFirst(secondaryDraftFields);
    }

    const committed = committedSecondaryFieldOrderRef.current;
    const draftNos = secondaryDraftFields.map((field) => field.no);
    const sameLength = committed.length === secondaryDraftFields.length;
    const sameMultiset =
      sameLength &&
      committed.every((no) => byNo.has(no)) &&
      draftNos.every((no) => committed.includes(no));

    if (!sameMultiset) {
      return sortSecondaryFieldsMissingFirst(secondaryDraftFields);
    }

    return committed
      .map((no) => byNo.get(no))
      .filter((field): field is EditableSecondaryField => field !== undefined);
  }, [secondaryDraftFields, secondaryHasUnsavedChanges]);
  const secondaryMissingCount = secondaryDraftFields.filter(
    (field) => field.isMissing,
  ).length;
  const missingFields = snapshot?.latestResult?.missingFields ?? [];
  const hasMissingFields = missingFields.length > 0;
  const showDetailedAnalysisSection = Boolean(
    snapshot &&
    [
      "ELIGIBLE",
      "SECONDARY_ANALYZING",
      "SECONDARY_REVIEW",
      "SECONDARY_FAILED",
    ].includes(snapshot.applicationStatus),
  );
  const secondaryInputsDisabled = Boolean(
    !editableSecondarySnapshot ||
    ["pending", "processing", "retrying"].includes(
      editableSecondarySnapshot.status,
    ),
  );
  const canContinueToMaterials =
    snapshot?.applicationStatus === "SECONDARY_REVIEW";
  const isReadOnlyReview = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, currentResultStep)
    : false;
  const detailedStatusDescription =
    editableSecondarySnapshot?.status &&
    editableSecondarySnapshot.status !== "idle"
      ? getSecondaryStatusMessage(editableSecondarySnapshot.status)
      : null;
  const shouldShowDetailedResult = Boolean(
    editableSecondarySnapshot &&
    (editableSecondarySnapshot.status !== "idle" ||
      editableSecondarySnapshot.fields.length > 0 ||
      editableSecondarySnapshot.runId),
  );
  const shouldShowJumpToBottom =
    showJumpToBottom &&
    (hasMissingFields || orderedSecondaryDraftFields.length > 6);
  const isAnalyzingStage = Boolean(
    snapshot &&
    ["CV_ANALYZING", "REANALYZING", "SECONDARY_ANALYZING"].includes(
      snapshot.applicationStatus,
    ),
  );

  useEffect(() => {
    if (!requestedResultView) {
      return;
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  }, [requestedResultView]);
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
        return "The initial review is complete. Run the detailed analysis before the supporting materials stage becomes available.";
      case "SECONDARY_ANALYZING":
        return "The detailed analysis is running. This page will refresh automatically until the expert-facing review is ready.";
      case "SECONDARY_REVIEW":
        return "The detailed analysis is ready. Review the prepared fields, save any edits you want to keep, and then continue to supporting materials.";
      case "SECONDARY_FAILED":
        return "The detailed analysis did not complete successfully. Supporting materials stay locked until this review step succeeds.";
      case "INELIGIBLE":
        return "The current submission does not satisfy the application criteria. Review the assessment summary below for context.";
      default:
        return "The result page explains the current review state, surfaces recognized information, and provides the next appropriate action.";
    }
  }, [snapshot]);
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
  const secondarySaveState = secondaryInputsDisabled
    ? "Editing unlocks when ready"
    : secondaryHasUnsavedChanges
      ? "Unsaved changes"
      : "All changes saved";

  return (
    <PageFrame>
      <PageShell
        eyebrow={`Step ${currentResultStep + 1}`}
        title={
          currentResultStep === 2
            ? "Track the AI review and wait for the screening outcome."
            : "Provide the remaining information needed to complete the review."
        }
        description={headerSummary}
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={currentResultStep}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 2
        }
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {currentResultStep === 3 ? (
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
              {isAnalyzingStage ? (
                <AnalysisProgressPanel
                  title={
                    snapshot.applicationStatus === "SECONDARY_ANALYZING"
                      ? "Detailed analysis is running"
                      : "AI review is running"
                  }
                  description={
                    snapshot.applicationStatus === "SECONDARY_ANALYZING"
                      ? "The system is preparing the editable expert-facing review before the final submission stage opens."
                      : "The current CV is being screened and normalized into the structured review model."
                  }
                  message={
                    ANALYSIS_MESSAGES[analysisMessageIndex] ?? statusText
                  }
                />
              ) : (
                getInitialBanner(
                  snapshot,
                  statusText,
                  detailedStatusDescription,
                )
              )}

              {snapshot.latestResult?.reasonText &&
              snapshot.applicationStatus !== "INELIGIBLE" ? (
                <SectionCard
                  title="Review summary"
                  description={snapshot.latestResult.reasonText}
                />
              ) : null}

              {visibleExtractedFields.length > 0 ? (
                <DisclosureSection
                  title="Recognized information summary"
                  summary="These items were extracted from the current resume and normalized for display."
                >
                  <div className="space-y-2">
                    {visibleExtractedFields.map((field) => (
                      <div
                        key={`${field.no}-${field.label}`}
                        className="flex flex-col gap-1 rounded-xl border border-[color:var(--border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm font-medium text-[color:var(--primary)]">
                          {field.label}
                        </span>
                        <span className="text-sm text-[color:var(--foreground-soft)]">
                          {field.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </DisclosureSection>
              ) : null}

              {hasMissingFields ? (
                <SectionCard
                  title="Additional information requested"
                  description={
                    snapshot.applicationStatus === "INFO_REQUIRED"
                      ? "AI-prefilled entries are shaded softly. Only blank fields require your manual input before you resubmit the review."
                      : "These fields were previously marked as missing and remain visible here for reference."
                  }
                >
                  <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                    {snapshot.applicationStatus === "INFO_REQUIRED" ? (
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
                            value: "Review runs again immediately",
                          },
                        ]}
                      />
                    ) : null}
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
                    {snapshot.applicationStatus === "INFO_REQUIRED" ? (
                      <ActionButton
                        type="submit"
                        disabled={isSubmittingSupplemental || isReadOnlyReview}
                        className="w-full sm:w-auto"
                      >
                        {isSubmittingSupplemental
                          ? "Submitting and Reanalyzing..."
                          : "Submit Additional Information"}
                      </ActionButton>
                    ) : (
                      <StatusBanner
                        tone="neutral"
                        title="Read-only field context"
                        description="The missing-field set is displayed for reference. Editing is available only when the workflow returns to the information-required state."
                      />
                    )}
                  </form>
                </SectionCard>
              ) : null}

              {rawReasoning ? (
                <InitialAnalysisNotesSection rawReasoning={rawReasoning} />
              ) : null}

              {showDetailedAnalysisSection ? (
                <SectionCard
                  title="Detailed analysis"
                  description="This section stays subordinate to the immediate action above. It unlocks the final submission page only after the detailed review is ready."
                >
                  <div className="flex flex-wrap gap-3">
                    {canTriggerSecondaryAnalysis ? (
                      <ActionButton
                        variant="secondary"
                        onClick={onTriggerSecondaryAnalysis}
                        disabled={
                          isStartingSecondary ||
                          isSecondaryRunning ||
                          isReadOnlyReview
                        }
                      >
                        {isStartingSecondary || isSecondaryRunning
                          ? "Running Detailed Analysis..."
                          : "Start Detailed Analysis"}
                      </ActionButton>
                    ) : null}
                    {secondaryRunAlreadyStarted ? (
                      <span className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-600">
                        Detailed analysis has already been started for this
                        application.
                      </span>
                    ) : null}
                  </div>
                </SectionCard>
              ) : null}

              {secondaryError ? (
                <StatusBanner
                  tone="danger"
                  title="Detailed analysis could not be refreshed"
                  description={secondaryError}
                />
              ) : null}

              {shouldShowDetailedResult && editableSecondarySnapshot ? (
                <DisclosureSection
                  title="Detailed analysis result"
                  summary={getSecondaryStatusMessage(
                    editableSecondarySnapshot.status,
                  )}
                  defaultOpen={snapshot.applicationStatus === "SECONDARY_REVIEW"}
                  meta={
                    canContinueToMaterials ? (
                      <div className="hidden sm:block">
                        <ActionButton
                          variant="success"
                          onClick={onContinueToMaterials}
                          disabled={isEnteringMaterials || isReadOnlyReview}
                        >
                          {isEnteringMaterials
                            ? "Opening Final Step..."
                            : "Next: Submission Complete"}
                        </ActionButton>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <MetaStrip
                        items={[
                          {
                            label: "Needs attention",
                            value: `${secondaryMissingCount} fields`,
                          },
                          {
                            label: "Saved",
                            value: formatSavedAt(editableSecondarySnapshot.savedAt),
                          },
                          {
                            label: "Status",
                            value: secondarySaveState,
                          },
                        ]}
                      />
                      {editableSecondarySnapshot.runId ? (
                        <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-slate-600 uppercase">
                          Run #{editableSecondarySnapshot.runId}
                        </span>
                      ) : null}
                      {canContinueToMaterials ? (
                        <ActionButton
                          variant="success"
                          onClick={onContinueToMaterials}
                          disabled={isEnteringMaterials || isReadOnlyReview}
                          className="sm:hidden"
                        >
                          {isEnteringMaterials
                            ? "Opening Final Step..."
                            : "Next: Submission Complete"}
                        </ActionButton>
                      ) : null}
                    </div>

                    {secondarySaveMessage ? (
                      <StatusBanner
                        tone="success"
                        title="Detailed analysis fields saved"
                        description={secondarySaveMessage}
                      />
                    ) : null}

                    {orderedSecondaryDraftFields.length > 0 ? (
                      <form
                        className="space-y-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          onSaveSecondaryFields();
                        }}
                      >
                        <div className="grid gap-4">
                          {orderedSecondaryDraftFields.map((field) =>
                            renderEditableSecondaryField({
                              field,
                              disabled:
                                secondaryInputsDisabled || isReadOnlyReview,
                              onChange: updateSecondaryDraftField,
                              onReset: resetSecondaryDraftField,
                            }),
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <ActionButton
                            type="submit"
                            disabled={
                              isReadOnlyReview ||
                              secondaryInputsDisabled ||
                              !secondaryHasUnsavedChanges ||
                              isSavingSecondary
                            }
                          >
                            {isSavingSecondary
                              ? "Saving Detailed Analysis Fields..."
                              : "Save Detailed Analysis Fields"}
                          </ActionButton>
                          <span className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-600">
                            Reset to Model Value clears the manual override for
                            that field.
                          </span>
                        </div>
                      </form>
                    ) : editableSecondarySnapshot.status === "completed" ||
                      editableSecondarySnapshot.status ===
                        "completed_partial" ? (
                      <p className="text-sm leading-6 text-slate-600">
                        The detailed analysis completed, but no editable
                        expert-facing fields were prepared.
                      </p>
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-400 bg-slate-100 p-3.5 text-sm leading-6 text-slate-600">
                        The detailed analysis is still preparing the editable
                        field set. This page will update automatically.
                      </div>
                    )}

                    {(editableSecondarySnapshot.run ||
                      editableSecondarySnapshot.errorMessage) && (
                      <DisclosureSection
                        title="Technical details"
                        summary="Low-priority run diagnostics and error details."
                        className="shadow-none"
                      >
                        <div className="space-y-3 text-sm text-slate-700">
                          {editableSecondarySnapshot.run ? (
                            <div className="rounded-md border border-slate-300 bg-white p-3.5">
                              <p>
                                Status:{" "}
                                {editableSecondarySnapshot.run.status ??
                                  editableSecondarySnapshot.status}
                              </p>
                              <p className="mt-1">
                                Completed prompts:{" "}
                                {editableSecondarySnapshot.run.completedPrompts ??
                                  0}
                                {editableSecondarySnapshot.run.totalPrompts
                                  ? ` / ${editableSecondarySnapshot.run.totalPrompts}`
                                  : ""}
                              </p>
                              {editableSecondarySnapshot.run.failedPromptIds
                                .length > 0 ? (
                                <p className="mt-1">
                                  Failed prompt IDs:{" "}
                                  {editableSecondarySnapshot.run.failedPromptIds.join(
                                    ", ",
                                  )}
                                </p>
                              ) : null}
                              {editableSecondarySnapshot.run.errorMessage ? (
                                <p className="mt-1">
                                  {editableSecondarySnapshot.run.errorMessage}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {editableSecondarySnapshot.errorMessage ? (
                            <div className="rounded-md border border-slate-300 bg-white p-3.5">
                              {editableSecondarySnapshot.errorMessage}
                            </div>
                          ) : null}
                        </div>
                      </DisclosureSection>
                    )}
                  </div>
                </DisclosureSection>
              ) : !isLoading && !error ? (
                <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 text-sm leading-6 text-[color:var(--foreground-soft)] shadow-[var(--shadow-card)] sm:px-5">
                  No detailed analysis fields are currently available for this
                  application state.
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>

      {shouldShowJumpToBottom ? (
        <button
          type="button"
          className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md border border-slate-300 bg-white/95 px-4 py-2.5 text-sm font-semibold text-[#0A192F] shadow-[0_10px_24px_rgba(10,25,47,0.14)] backdrop-blur-sm transition hover:border-[#166534] hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#22C55E]/35 focus-visible:outline-none"
          onClick={() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }}
        >
          <ChevronsDown className="h-4 w-4 text-[#166534]" aria-hidden />
          Jump to bottom
        </button>
      ) : null}
    </PageFrame>
  );
}

export default function ResultPageWithSuspense() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-slate-600">
          Loading application status…
        </div>
      }
    >
      <ResultPage />
    </Suspense>
  );
}
