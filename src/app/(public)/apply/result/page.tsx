"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { ChevronDown, ChevronsDown } from "lucide-react";
import { useRouter } from "next/navigation";
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
  DetailCard,
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
import { APPLICATION_FLOW_STEPS } from "@/features/application/constants";
import type {
  ApplicationSnapshot,
  EditableSecondaryAnalysisSnapshot,
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
      className:
        "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (field.isEdited) {
    return {
      label: "Expert edited",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  }

  return {
    label: "Model value",
    className: "border-stone-200 bg-stone-100 text-stone-700",
  };
}

function buildDraftSecondaryField(
  field: EditableSecondaryField,
  input: {
    editedValue: string;
    hasOverride: boolean;
  },
) {
  const effectiveValue = input.hasOverride ? input.editedValue : field.sourceValue;

  return {
    ...field,
    editedValue: input.editedValue,
    hasOverride: input.hasOverride,
    effectiveValue,
    isMissing: effectiveValue.trim().length === 0,
    isEdited: input.hasOverride && input.editedValue.trim() !== field.sourceValue.trim(),
  } satisfies EditableSecondaryField;
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
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800 transition",
              disabled ? "opacity-60" : "hover:border-stone-400",
            )}
          >
            <input
              type="radio"
              value={option}
              disabled={disabled}
              checked={(field.hasOverride ? field.editedValue : field.effectiveValue) === option}
              onChange={(event) => onChange(field.no, event.currentTarget.value)}
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
      className="block scroll-mt-24 rounded-[1.4rem] border border-stone-200 bg-stone-50/70 p-4 text-sm text-stone-700"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <label
            htmlFor={field.inputType === "radio" ? undefined : controlId}
            className="block text-sm font-semibold text-stone-950"
          >
            {field.label}
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full border border-stone-200 bg-white px-3 py-1 text-[0.68rem] font-semibold tracking-[0.16em] text-stone-600 uppercase">
              No. {field.no}
              {field.column ? ` / ${field.column}` : ""}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-semibold tracking-[0.16em] uppercase",
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
      <div className="mt-4">{control}</div>
      <div className="mt-3 space-y-2 text-xs leading-6 text-stone-500">
        <p>{helperText}</p>
        <p>
          Model value:{" "}
          <span className="font-medium text-stone-700">
            {field.sourceValue || "No extracted value"}
          </span>
        </p>
      </div>
    </div>
  );
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
  expanded,
  onToggle,
}: {
  rawReasoning: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <SectionCard
      title="Initial analysis notes"
      description="Reference notes retained from the initial eligibility pass."
      action={
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={
            expanded ? "Collapse analysis notes" : "Expand analysis notes"
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
        <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-5">
          <MarkdownProse markdown={rawReasoning} />
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
  const [secondarySaveMessage, setSecondarySaveMessage] = useState<string | null>(
    null,
  );
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

    void fetchDetailedAnalysisState(snapshot.applicationId)
      .then(({ nextDetailedSnapshot, refreshedSession }) => {
        if (active) {
          setEditableSecondarySnapshot(nextDetailedSnapshot);
          setSecondaryDraftFields(nextDetailedSnapshot.fields);
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
        const {
          nextDetailedSnapshot,
          refreshedSession,
        } = await fetchDetailedAnalysisState(
          snapshot.applicationId,
          editableSecondarySnapshot.runId,
        );

        if (!active) {
          return;
        }

        setEditableSecondarySnapshot(nextDetailedSnapshot);
        setSecondaryDraftFields(nextDetailedSnapshot.fields);
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
      setShowJumpToBottom(
        scrollTop > 240 && !nearBottom && maxScroll > 320,
      );
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
  }, []);

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
        setSecondarySaveMessage(null);
        const triggered = await triggerSecondaryAnalysis(
          snapshot.applicationId,
        );
        const {
          nextDetailedSnapshot,
          refreshedSession,
        } = await fetchDetailedAnalysisState(
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

    if (!snapshot || !runId) {
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
    if (!snapshot) {
      return;
    }

    startMaterialsTransition(async () => {
      try {
        setSecondaryError(null);
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
    ["pending", "processing", "retrying"].includes(editableSecondarySnapshot.status),
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
  const canContinueToMaterials = snapshot?.applicationStatus === "SECONDARY_REVIEW";
  const detailedStatusDescription =
    editableSecondarySnapshot?.status && editableSecondarySnapshot.status !== "idle"
      ? getSecondaryStatusMessage(editableSecondarySnapshot.status)
      : null;

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
            description="The system can keep processing, request missing structured fields, confirm initial eligibility, and then require detailed analysis before materials."
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
                title="Detailed analysis before materials"
                description="A successful initial review unlocks the detailed analysis first. Supporting materials open only after that step finishes."
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
              {getInitialBanner(snapshot, statusText, detailedStatusDescription)}

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

              {rawReasoning ? (
                <InitialAnalysisNotesSection
                  rawReasoning={rawReasoning}
                  expanded={isDetailedAnalysisOpen}
                  onToggle={() =>
                    setIsDetailedAnalysisOpen((previous) => !previous)
                  }
                />
              ) : null}

              {showDetailedAnalysisSection ? (
                <SectionCard
                  title="Detailed analysis"
                  description="This step prepares the detailed expert-facing review. Supporting materials remain locked until the detailed analysis has completed."
                >
                  <div className="flex flex-wrap gap-3">
                    {canTriggerSecondaryAnalysis ? (
                      <ActionButton
                        variant="secondary"
                        onClick={onTriggerSecondaryAnalysis}
                        disabled={isStartingSecondary || isSecondaryRunning}
                      >
                        {isStartingSecondary || isSecondaryRunning
                          ? "Running Detailed Analysis..."
                          : "Run Detailed Analysis"}
                      </ActionButton>
                    ) : null}
                    {secondaryRunAlreadyStarted ? (
                      <span className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-stone-50 px-4 py-2 text-sm text-stone-600">
                        Detailed analysis has already been started for this application.
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

              {editableSecondarySnapshot &&
              editableSecondarySnapshot.status !== "idle" ? (
                <SectionCard
                  title="Detailed analysis result"
                  description={getSecondaryStatusMessage(
                    editableSecondarySnapshot.status,
                  )}
                  action={
                    <div className="flex flex-wrap items-center gap-3">
                      {editableSecondarySnapshot.runId ? (
                        <span className="inline-flex items-center rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-stone-600 uppercase">
                          Run #{editableSecondarySnapshot.runId}
                        </span>
                      ) : null}
                      {canContinueToMaterials ? (
                        <ActionButton
                          variant="success"
                          onClick={onContinueToMaterials}
                          disabled={isEnteringMaterials}
                        >
                          {isEnteringMaterials
                            ? "Opening Materials..."
                            : "Continue to Materials"}
                        </ActionButton>
                      ) : null}
                    </div>
                  }
                >
                  <div className="space-y-5">
                    {secondarySaveMessage ? (
                      <StatusBanner
                        tone="success"
                        title="Detailed analysis fields saved"
                        description={secondarySaveMessage}
                      />
                    ) : null}

                    {editableSecondarySnapshot.run ? (
                      <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-4 text-sm text-stone-700">
                        <p>
                          Status:{" "}
                          {editableSecondarySnapshot.run.status ??
                            editableSecondarySnapshot.status}
                        </p>
                        <p className="mt-1">
                          Completed prompts:{" "}
                          {editableSecondarySnapshot.run.completedPrompts ?? 0}
                          {editableSecondarySnapshot.run.totalPrompts
                            ? ` / ${editableSecondarySnapshot.run.totalPrompts}`
                            : ""}
                        </p>
                        {editableSecondarySnapshot.run.failedPromptIds.length > 0 ? (
                          <p className="mt-1">
                            Failed prompt IDs:{" "}
                            {editableSecondarySnapshot.run.failedPromptIds.join(", ")}
                          </p>
                        ) : null}
                        {editableSecondarySnapshot.run.errorMessage ? (
                          <p className="mt-1 text-rose-700">
                            {editableSecondarySnapshot.run.errorMessage}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {editableSecondarySnapshot.errorMessage ? (
                      <p className="text-sm text-rose-700">
                        {editableSecondarySnapshot.errorMessage}
                      </p>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-3">
                      <DetailCard
                        eyebrow="Summary"
                        title={`${secondaryMissingCount} fields still need attention`}
                        description="Missing fields are grouped at the top whenever your edits are saved. While you have unsaved changes, the list keeps the same row order as before you started typing; after you save, it refreshes to missing-first order and scrolls to the next item that still needs attention when applicable."
                      />
                      <DetailCard
                        eyebrow="Saved"
                        title={formatSavedAt(editableSecondarySnapshot.savedAt)}
                        description="This timestamp reflects the latest saved expert revision for the current secondary run."
                      />
                      <DetailCard
                        eyebrow="Status"
                        title={
                          secondaryHasUnsavedChanges
                            ? "Unsaved changes"
                            : "All changes saved"
                        }
                        description={
                          secondaryInputsDisabled
                            ? "Editing will unlock as soon as the detailed analysis finishes."
                            : "Use Save Detailed Analysis Fields to persist the current expert-reviewed values."
                        }
                      />
                    </div>

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
                              disabled: secondaryInputsDisabled,
                              onChange: updateSecondaryDraftField,
                              onReset: resetSecondaryDraftField,
                            }),
                          )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <ActionButton
                            type="submit"
                            disabled={
                              secondaryInputsDisabled ||
                              !secondaryHasUnsavedChanges ||
                              isSavingSecondary
                            }
                          >
                            {isSavingSecondary
                              ? "Saving Detailed Analysis Fields..."
                              : "Save Detailed Analysis Fields"}
                          </ActionButton>
                          <span className="inline-flex min-h-11 items-center rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-600">
                            Reset to Model Value clears the manual override for that field.
                          </span>
                        </div>
                      </form>
                    ) : editableSecondarySnapshot.status === "completed" ||
                      editableSecondarySnapshot.status === "completed_partial" ? (
                      <p className="text-sm leading-7 text-stone-600">
                        The detailed analysis completed, but no editable expert-facing fields were prepared.
                      </p>
                    ) : (
                      <div className="rounded-[1.4rem] border border-dashed border-stone-300 bg-stone-50/70 p-4 text-sm leading-7 text-stone-600">
                        The detailed analysis is still preparing the editable field set. This page will update automatically.
                      </div>
                    )}
                  </div>
                </SectionCard>
              ) : null}
            </>
          ) : null}
        </div>
      </PageShell>

      {showJumpToBottom ? (
        <button
          type="button"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-stone-300 bg-white/95 px-5 py-3 text-sm font-semibold text-stone-800 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm transition hover:border-teal-700/35 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40"
          onClick={() => {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }}
        >
          <ChevronsDown className="h-4 w-4 text-teal-800" aria-hidden />
          Jump to bottom
        </button>
      ) : null}
    </PageFrame>
  );
}
