"use client";

import {
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import type { MissingField } from "@/features/analysis/types";
import {
  buildInitialCvReviewExtractionText,
  getInitialCvReviewFieldValue,
  hasInitialCvReviewExtract,
  INITIAL_CV_REVIEW_FIELD_ROWS,
  type InitialCvReviewFieldKey,
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
  confirmResumeExtraction,
  createResumeUploadIntent,
  deleteUploadedResume,
  fetchAnalysisResult,
  fetchAnalysisStatus,
  fetchSession,
  startResumeAnalysis as startResumeAnalysisRequest,
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
import {
  createUploadId,
  trackClick,
  trackPageView,
} from "@/lib/tracking/client";
import type { TrackingPageName, TrackingStepName } from "@/lib/tracking/types";
import { usePageDurationTracking } from "@/lib/tracking/use-page-duration-tracking";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SupplementalFormValues = Record<string, string>;
type ExtractionCorrectionFields = Record<InitialCvReviewFieldKey, string>;
type ExtractionCorrectionErrors = Partial<
  Record<InitialCvReviewFieldKey, string>
>;

const ANALYZING_STATUSES = [
  "CV_EXTRACTING",
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

type CvReviewExperienceProps = {
  trackingPageName?: Extract<TrackingPageName, "apply_resume" | "apply_result">;
};

const EXTRACTION_READONLY_FIELD_KEYS = new Set<InitialCvReviewFieldKey>([
  "name",
]);

const EXTRACTION_OPTIONAL_FIELD_KEYS = new Set<InitialCvReviewFieldKey>([
  "work_email",
  "phone_number",
]);

const EXTRACTION_MULTILINE_FIELD_KEYS = new Set<InitialCvReviewFieldKey>([
  "work_experience_2020_present",
  "research_area",
]);

const EXTRACTION_EMAIL_FIELD_KEYS = new Set<InitialCvReviewFieldKey>([
  "personal_email",
  "work_email",
]);

const EXTRACTION_YEAR_FIELD_KEYS = new Set<InitialCvReviewFieldKey>([
  "year_of_birth",
  "doctoral_graduation_time",
]);

const DOCTORAL_DEGREE_STATUS_OPTIONS = [
  "Yes,obtained",
  "In progress/Candidate",
  "No,highest is Master's/Bachelor's",
] as const;

const DOCTORAL_DEGREE_NO_STATUS = "No,highest is Master's/Bachelor's";

function normalizeDoctoralDegreeStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (
    normalized === "yes,obtained" ||
    normalized === "obtained" ||
    normalized === "doctorate completed" ||
    normalized.includes("obtained") ||
    normalized.includes("completed")
  ) {
    return "Yes,obtained";
  }

  if (
    normalized === "in progress/candidate" ||
    normalized === "in progress" ||
    normalized === "expected" ||
    normalized.includes("candidate") ||
    normalized.includes("progress") ||
    normalized.includes("expected")
  ) {
    return "In progress/Candidate";
  }

  if (
    normalized === "no,highest is master's/bachelor's" ||
    normalized.includes("not obtained") ||
    normalized.includes("master") ||
    normalized.includes("bachelor") ||
    normalized === "no" ||
    normalized.includes("no doctoral")
  ) {
    return DOCTORAL_DEGREE_NO_STATUS;
  }

  return value.trim();
}

function normalizeExtractionCorrectionFields(
  fields: ExtractionCorrectionFields,
): ExtractionCorrectionFields {
  const doctoralDegreeStatus = normalizeDoctoralDegreeStatus(
    fields.doctoral_degree_status ?? "",
  );

  return {
    ...fields,
    doctoral_degree_status: doctoralDegreeStatus,
    doctoral_graduation_time:
      doctoralDegreeStatus === DOCTORAL_DEGREE_NO_STATUS
        ? "none"
        : (fields.doctoral_graduation_time ?? "").trim(),
  };
}

function buildExtractionCorrectionFields(
  extractedFields: Record<string, unknown>,
): ExtractionCorrectionFields {
  return normalizeExtractionCorrectionFields(
    Object.fromEntries(
      INITIAL_CV_REVIEW_FIELD_ROWS.map((row) => [
        row.key,
        getInitialCvReviewFieldValue(extractedFields, row.key),
      ]),
    ) as ExtractionCorrectionFields,
  );
}

function isMissingExtractionValue(value: string) {
  const trimmed = value.trim();

  return !trimmed || /^!!!\s*null\s*!!!$/i.test(trimmed);
}

function validateExtractionCorrectionFields(
  fields: ExtractionCorrectionFields,
): ExtractionCorrectionErrors {
  const errors: ExtractionCorrectionErrors = {};
  const normalizedFields = normalizeExtractionCorrectionFields(fields);

  for (const row of INITIAL_CV_REVIEW_FIELD_ROWS) {
    if (EXTRACTION_READONLY_FIELD_KEYS.has(row.key)) {
      continue;
    }

    const value = normalizedFields[row.key] ?? "";
    const isOptional = EXTRACTION_OPTIONAL_FIELD_KEYS.has(row.key);

    if (isMissingExtractionValue(value)) {
      if (isOptional) {
        continue;
      }

      errors[row.key] = `${row.label} is required.`;
      continue;
    }

    if (
      row.key === "doctoral_degree_status" &&
      !DOCTORAL_DEGREE_STATUS_OPTIONS.includes(
        value as (typeof DOCTORAL_DEGREE_STATUS_OPTIONS)[number],
      )
    ) {
      errors[row.key] = `${row.label} must use one of the listed options.`;
      continue;
    }

    if (
      row.key === "doctoral_graduation_time" &&
      normalizedFields.doctoral_degree_status === DOCTORAL_DEGREE_NO_STATUS
    ) {
      continue;
    }

    if (
      EXTRACTION_EMAIL_FIELD_KEYS.has(row.key) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ) {
      errors[row.key] = `${row.label} must be a valid email address.`;
      continue;
    }

    if (
      EXTRACTION_YEAR_FIELD_KEYS.has(row.key) &&
      !/^\d{4}$/.test(value.trim())
    ) {
      errors[row.key] = `${row.label} must be a four-digit year.`;
    }
  }

  return errors;
}

function getFirstExtractionErrorKey(errors: ExtractionCorrectionErrors) {
  return (
    INITIAL_CV_REVIEW_FIELD_ROWS.find((row) => errors[row.key])?.key ?? null
  );
}

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
    status === "CV_EXTRACTION_REVIEW" ||
    status === "SECONDARY_ANALYZING" ||
    status === "SECONDARY_REVIEW" ||
    status === "SECONDARY_FAILED"
  );
}

function getCvReviewTrackingStepName(
  status: ApplicationSnapshot["applicationStatus"],
): TrackingStepName {
  if (status === "INTRO_VIEWED" || status === "CV_UPLOADED") {
    return "resume_upload";
  }

  if (status === "INFO_REQUIRED") {
    return "supplemental";
  }

  if (status === "CV_EXTRACTING" || status === "CV_EXTRACTION_REVIEW") {
    return "resume_extraction";
  }

  if (
    status === "SECONDARY_ANALYZING" ||
    status === "SECONDARY_REVIEW" ||
    status === "SECONDARY_FAILED"
  ) {
    return "secondary_analysis";
  }

  return "analysis_result";
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

function formatAnalysisStatusLabel(jobStatus: string | undefined) {
  const normalized = jobStatus?.trim().toUpperCase();

  if (normalized === "QUEUED") {
    return "Queued";
  }

  if (normalized === "PROCESSING") {
    return "Processing";
  }

  if (normalized === "RETRYING") {
    return "Retrying";
  }

  return "Processing";
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
            placeholder={field.placeholder}
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
            placeholder={field.placeholder}
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
  primaryMessage,
  secondaryMessage,
  progressRatio,
  ariaValueText,
}: {
  primaryMessage: string;
  secondaryMessage?: string | null;
  progressRatio: number;
  ariaValueText: string;
}) {
  const titleId = useId();
  const progressLabelId = useId();
  const primaryMessageId = useId();
  const secondaryMessageId = useId();
  const clamped = Math.min(1, Math.max(0, progressRatio));
  const widthPercent = `${Math.round(clamped * 1000) / 10}%`;
  const describedBy = secondaryMessage
    ? `${primaryMessageId} ${secondaryMessageId}`
    : primaryMessageId;

  return (
    <SectionCard className="overflow-hidden">
      <div className="mx-auto max-w-2xl text-center" aria-labelledby={titleId}>
        <p
          id={titleId}
          className="text-sm font-semibold text-[color:var(--primary)]"
        >
          Please be patient
        </p>
        <div
          className="mx-auto mt-4 max-w-xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--muted)]/55 px-4 py-4"
          aria-busy="true"
        >
          {/* Unmount this panel when analysis ends—no brief 100% flash before result content. */}
          <div
            className="h-2 overflow-hidden rounded-full bg-white"
            role="progressbar"
            aria-labelledby={progressLabelId}
            aria-describedby={describedBy}
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
          <p
            id={primaryMessageId}
            className="mt-3 text-sm font-medium text-[color:var(--primary)]"
          >
            {primaryMessage}
          </p>
          {secondaryMessage ? (
            <p
              id={secondaryMessageId}
              className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]"
            >
              {secondaryMessage}
            </p>
          ) : null}
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {`Please be patient. ${primaryMessage}${
            secondaryMessage ? ` ${secondaryMessage}` : ""
          }`}
        </p>
      </div>
    </SectionCard>
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
    snapshot.applicationStatus === "CV_EXTRACTING" ||
    snapshot.applicationStatus === "CV_ANALYZING" ||
    snapshot.applicationStatus === "REANALYZING"
  ) {
    return (
      <StatusBanner
        tone="loading"
        title={
          snapshot.applicationStatus === "CV_EXTRACTING"
            ? "Your CV information is being extracted"
            : "Your CV is being reviewed"
        }
        description={statusText}
      />
    );
  }

  if (snapshot.applicationStatus === "CV_EXTRACTION_REVIEW") {
    return null;
  }

  if (snapshot.applicationStatus === "INELIGIBLE") {
    return null;
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
        title="Additional review in progress"
        description="When this step finishes, you can continue to Additional Information to upload supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_REVIEW") {
    return (
      <StatusBanner
        tone="success"
        title="Additional review is ready"
        description="Continue to Additional Information to upload supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "SECONDARY_FAILED") {
    return (
      <StatusBanner
        tone="danger"
        title="The additional review step could not be completed"
        description="Please contact the program team if you need help continuing to supporting materials."
      />
    );
  }

  if (snapshot.applicationStatus === "INFO_REQUIRED") {
    return null;
  }

  return null;
}

function InitialCvReviewExtractCard({
  extract,
}: {
  extract: { extractedFields: Record<string, unknown> };
}) {
  return (
    <SectionCard
      title="Key Profile Information"
      description="Review the key details extracted from your CV."
    >
      <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] bg-white">
        <table className="min-w-full border-collapse">
          <tbody>
            {INITIAL_CV_REVIEW_FIELD_ROWS.map((row) => {
              const value = getInitialCvReviewFieldValue(
                extract.extractedFields,
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

function EditableExtractionReviewCard({
  fields,
  errors,
  activeField,
  draftValue,
  showErrors,
  isConfirming,
  fieldRefs,
  onStartEdit,
  onDraftChange,
  onCommitEdit,
  onConfirm,
}: {
  fields: ExtractionCorrectionFields;
  errors: ExtractionCorrectionErrors;
  activeField: InitialCvReviewFieldKey | null;
  draftValue: string;
  showErrors: boolean;
  isConfirming: boolean;
  fieldRefs: MutableRefObject<
    Partial<Record<InitialCvReviewFieldKey, HTMLTableRowElement | null>>
  >;
  onStartEdit: (fieldKey: InitialCvReviewFieldKey) => void;
  onDraftChange: (value: string) => void;
  onCommitEdit: (value?: string) => void;
  onConfirm: () => void;
}) {
  const hasErrors = Object.keys(errors).length > 0;
  const doctoralGraduationLocked =
    fields.doctoral_degree_status === DOCTORAL_DEGREE_NO_STATUS;

  function renderEditor(row: (typeof INITIAL_CV_REVIEW_FIELD_ROWS)[number]) {
    const hasError = Boolean(errors[row.key]);
    const isDoctoralGraduationLocked =
      row.key === "doctoral_graduation_time" && doctoralGraduationLocked;
    const inputClassName = getInputClassName(
      cn(
        "bg-white",
        isDoctoralGraduationLocked && "bg-[color:var(--muted)]/75",
        hasError &&
          showErrors &&
          "border-[color:var(--accent)] ring-1 ring-[color:var(--ring)]",
      ),
    );
    const commonProps = {
      value: isDoctoralGraduationLocked ? "none" : draftValue,
      disabled: isConfirming || isDoctoralGraduationLocked,
      "aria-invalid": hasError && showErrors,
      onChange: (
        event:
          | ChangeEvent<HTMLInputElement>
          | ChangeEvent<HTMLTextAreaElement>
          | ChangeEvent<HTMLSelectElement>,
      ) => {
        const nextValue = EXTRACTION_YEAR_FIELD_KEYS.has(row.key)
          ? event.currentTarget.value.replace(/\D/g, "").slice(0, 4)
          : event.currentTarget.value;

        onDraftChange(nextValue);
      },
      onBlur: (
        event: FocusEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
      ) => onCommitEdit(event.currentTarget.value),
    };

    if (row.key === "doctoral_degree_status") {
      return (
        <select
          autoFocus
          className={inputClassName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommitEdit(event.currentTarget.value);
            }
          }}
          {...commonProps}
        >
          <option value="">Please select</option>
          {DOCTORAL_DEGREE_STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (EXTRACTION_MULTILINE_FIELD_KEYS.has(row.key)) {
      return (
        <textarea
          autoFocus
          className={getInputClassName(
            cn(
              "min-h-28",
              hasError &&
                showErrors &&
                "border-[color:var(--accent)] ring-1 ring-[color:var(--ring)]",
            ),
          )}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onCommitEdit(event.currentTarget.value);
            }
          }}
          {...commonProps}
        />
      );
    }

    return (
      <input
        autoFocus
        type={EXTRACTION_EMAIL_FIELD_KEYS.has(row.key) ? "email" : "text"}
        inputMode={
          EXTRACTION_YEAR_FIELD_KEYS.has(row.key) ? "numeric" : undefined
        }
        maxLength={EXTRACTION_YEAR_FIELD_KEYS.has(row.key) ? 4 : undefined}
        className={inputClassName}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommitEdit(event.currentTarget.value);
          }
        }}
        {...commonProps}
      />
    );
  }

  return (
    <SectionCard
      title="Key information review"
      description="Please verify the extracted details below. Click any editable value to make a correction before starting eligibility judgment."
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)] bg-white">
          <table className="min-w-full border-collapse">
            <tbody>
              {INITIAL_CV_REVIEW_FIELD_ROWS.map((row) => {
                const value = fields[row.key] ?? "";
                const isReadonly =
                  EXTRACTION_READONLY_FIELD_KEYS.has(row.key) ||
                  (row.key === "doctoral_graduation_time" &&
                    doctoralGraduationLocked);
                const isEditing = activeField === row.key;
                const hasError = Boolean(errors[row.key]);
                const displayValue =
                  row.key === "doctoral_graduation_time" &&
                  doctoralGraduationLocked
                    ? "none"
                    : isMissingExtractionValue(value)
                      ? "Not provided"
                      : value;

                return (
                  <tr
                    key={row.key}
                    ref={(node) => {
                      fieldRefs.current[row.key] = node;
                    }}
                    className={cn(
                      "border-b border-[color:var(--border)] last:border-b-0",
                      hasError && showErrors && "bg-red-50/70",
                    )}
                  >
                    <th
                      scope="row"
                      className="w-64 px-4 py-3 text-left align-top text-sm font-medium text-[color:var(--primary)]"
                    >
                      {row.label}
                    </th>
                    <td className="px-4 py-3 align-top text-sm">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          {renderEditor(row)}
                          {hasError && showErrors ? (
                            <span className="text-xs text-red-600">
                              {errors[row.key]}
                            </span>
                          ) : (
                            <span className="text-xs text-[color:var(--muted-foreground)]">
                              Press Enter or click outside to save.
                            </span>
                          )}
                        </div>
                      ) : isReadonly ? (
                        <span className="block break-words whitespace-pre-wrap text-[color:var(--muted-foreground)]">
                          {displayValue}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isConfirming}
                          onClick={() => onStartEdit(row.key)}
                          className={cn(
                            "group -mx-2 -my-1 block w-full rounded-md px-2 py-1 text-left transition",
                            "hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none",
                            hasError && showErrors
                              ? "text-red-700"
                              : "text-[color:var(--foreground-soft)]",
                          )}
                        >
                          <span className="break-words whitespace-pre-wrap">
                            {displayValue}
                          </span>
                          <span className="ml-2 text-xs font-medium text-[color:var(--muted-foreground)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                            Edit
                          </span>
                          {hasError && showErrors ? (
                            <span className="mt-1 block text-xs text-red-600">
                              {errors[row.key]}
                            </span>
                          ) : null}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <p className="max-w-2xl text-sm leading-6 text-[color:var(--foreground-soft)]">
            Corrections are saved to the review service first; eligibility
            judgment starts only after these fields pass validation.
          </p>
          <ActionButton
            type="button"
            onClick={onConfirm}
            disabled={isConfirming || hasErrors}
            className="w-full sm:w-auto"
          >
            {isConfirming
              ? "Saving Correction and Starting Judgment..."
              : "Confirm and Start Eligibility Judgment"}
          </ActionButton>
        </div>
      </div>
    </SectionCard>
  );
}

function PreliminaryAssessmentResultBody({
  statusBadge,
  description,
  extraNote,
  appearance = "default",
}: {
  statusBadge: ReactNode;
  description: string;
  extraNote?: string | null;
  /** `success` matches Submission Complete: emerald panel typography. */
  appearance?: "default" | "success";
}) {
  const isSuccessPanel = appearance === "success";

  return (
    <div
      className={cn(
        "border-l-2 pl-4",
        isSuccessPanel ? "border-emerald-300" : "border-[color:var(--border)]",
      )}
    >
      <div className="flex flex-col gap-3">
        <h2
          className={cn(
            "text-base font-semibold tracking-[-0.02em]",
            isSuccessPanel ? "text-emerald-950" : "text-[color:var(--primary)]",
          )}
        >
          Preliminary Assessment Result
        </h2>
        <div
          className="flex flex-wrap items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span
            className={cn(
              "text-sm",
              isSuccessPanel
                ? "text-emerald-800"
                : "text-[color:var(--foreground-soft)]",
            )}
          >
            Status:
          </span>
          {statusBadge}
        </div>
        <p
          className={cn(
            "text-sm leading-6",
            isSuccessPanel
              ? "text-emerald-950/90"
              : "text-[color:var(--foreground-soft)]",
          )}
        >
          {description}
        </p>
        {extraNote ? (
          <p
            className={cn(
              "text-sm leading-6",
              isSuccessPanel
                ? "text-emerald-900/85"
                : "text-[color:var(--muted-foreground)]",
            )}
          >
            {extraNote}
          </p>
        ) : null}
      </div>
    </div>
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
    const description =
      displaySummary ??
      "This submission does not meet the published requirements for the current review stage.";
    return (
      <SectionCard>
        <PreliminaryAssessmentResultBody
          statusBadge={<Badge variant="destructive">Not eligible</Badge>}
          description={description}
          extraNote={reasonText}
        />
      </SectionCard>
    );
  }

  if (
    eligibilityResult === "INSUFFICIENT_INFO" ||
    snapshot.applicationStatus === "INFO_REQUIRED"
  ) {
    return null;
  }

  if (eligibilityResult === "ELIGIBLE") {
    const primary =
      reasonText ??
      displaySummary ??
      "Your profile meets the basic application requirements for this talent program. Please proceed to the next step to provide the required documents.";
    const secondary =
      reasonText &&
      displaySummary &&
      displaySummary.trim() !== reasonText.trim()
        ? displaySummary
        : null;

    return (
      <SectionCard className="border-emerald-200 bg-emerald-50">
        <PreliminaryAssessmentResultBody
          appearance="success"
          statusBadge={<Badge variant="success">Eligible</Badge>}
          description={primary}
          extraNote={secondary}
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <PreliminaryAssessmentResultBody
        statusBadge={<Badge variant="outline">Outcome</Badge>}
        description={
          displaySummary ??
          "Initial CV review returned an outcome. Review the extract and any messages above."
        }
      />
    </SectionCard>
  );
}

export function CvReviewExperience({
  trackingPageName = "apply_resume",
}: CvReviewExperienceProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);
  const [statusText, setStatusText] = useState(
    "Preparing your CV review outcome...",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingResume, startResumeUploadTransition] = useTransition();
  const [isStartingResumeAnalysis, startResumeAnalysisTransition] =
    useTransition();
  const [isConfirmingExtraction, startExtractionConfirmTransition] =
    useTransition();
  const [isDeletingUploadedResume, startDeleteResumeTransition] =
    useTransition();
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
  const [extractionCorrectionFields, setExtractionCorrectionFields] =
    useState<ExtractionCorrectionFields>(() =>
      buildExtractionCorrectionFields({}),
    );
  const [activeExtractionField, setActiveExtractionField] =
    useState<InitialCvReviewFieldKey | null>(null);
  const [extractionDraftValue, setExtractionDraftValue] = useState("");
  const [hasAttemptedExtractionSubmit, setHasAttemptedExtractionSubmit] =
    useState(false);
  const extractionFieldRefs = useRef<
    Partial<Record<InitialCvReviewFieldKey, HTMLTableRowElement | null>>
  >({});
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
  const trackingStepName = snapshot
    ? getCvReviewTrackingStepName(snapshot.applicationStatus)
    : trackingPageName === "apply_result"
      ? "analysis_result"
      : "resume_upload";

  usePageDurationTracking({
    pageName: trackingPageName,
    stepName: trackingStepName,
    applicationId: snapshot?.applicationId,
  });

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

        if (
          trackingPageName === "apply_result" &&
          (nextSnapshot.applicationStatus === "INTRO_VIEWED" ||
            nextSnapshot.applicationStatus === "CV_UPLOADED")
        ) {
          router.replace("/apply/resume");
          return;
        }

        if (
          trackingPageName === "apply_resume" &&
          !requestedResultView &&
          resolveRouteFromStatus(nextSnapshot.applicationStatus) ===
            "/apply/result"
        ) {
          router.replace("/apply/result");
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
  }, [requestedResultView, router, trackingPageName]);

  useEffect(() => {
    const review = snapshot?.latestExtractionReview;

    if (!review || snapshot?.applicationStatus !== "CV_EXTRACTION_REVIEW") {
      return;
    }

    setExtractionCorrectionFields(
      buildExtractionCorrectionFields(review.extractedFields),
    );
    setActiveExtractionField(null);
    setExtractionDraftValue("");
    setHasAttemptedExtractionSubmit(false);
  }, [snapshot?.applicationStatus, snapshot?.latestExtractionReview]);

  useEffect(() => {
    if (!snapshot || hasTrackedPageView.current) {
      return;
    }

    hasTrackedPageView.current = true;
    void trackPageView({
      pageName: trackingPageName,
      stepName: trackingStepName,
      applicationId: snapshot.applicationId,
    });
  }, [snapshot, trackingPageName, trackingStepName]);

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
      ![
        "CV_EXTRACTING",
        "CV_ANALYZING",
        "REANALYZING",
        "SECONDARY_ANALYZING",
      ].includes(snapshot.applicationStatus)
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

  function performResumeUpload(file: File) {
    if (
      !snapshot ||
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
          file,
          uploadId,
        );
        await uploadBinary(intent, file, {
          applicationId: snapshot.applicationId,
          uploadId,
          kind: "resume",
        });
        await confirmResumeUpload(
          snapshot.applicationId,
          file,
          intent.objectKey,
          uploadId,
        );
        setSnapshot(await fetchSession());
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "CV upload failed.",
        );
      } finally {
        const input = resumeFileInputRef.current;

        if (input) {
          input.value = "";
        }
      }
    });
  }

  function handleStartResumeAnalysis() {
    if (
      !snapshot ||
      snapshot.applicationStatus !== "CV_UPLOADED" ||
      !snapshot.latestResumeFile
    ) {
      return;
    }

    startResumeAnalysisTransition(async () => {
      try {
        setError(null);
        void trackClick({
          eventType: "resume_extraction_start_clicked",
          pageName: trackingPageName,
          stepName: "resume_extraction",
          applicationId: snapshot.applicationId,
        });
        await startResumeAnalysisRequest(snapshot.applicationId);
        setSnapshot((current) =>
          current
            ? {
                ...current,
                applicationStatus: "CV_EXTRACTING",
                currentStep: "result",
              }
            : current,
        );
        setStatusText("");
        await syncAnalysisProgress(snapshot.applicationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to start CV analysis.",
        );
      }
    });
  }

  function scrollToFirstExtractionError(errors: ExtractionCorrectionErrors) {
    const firstErrorKey = getFirstExtractionErrorKey(errors);

    if (!firstErrorKey) {
      return;
    }

    extractionFieldRefs.current[firstErrorKey]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  function handleStartExtractionFieldEdit(fieldKey: InitialCvReviewFieldKey) {
    if (
      EXTRACTION_READONLY_FIELD_KEYS.has(fieldKey) ||
      isConfirmingExtraction
    ) {
      return;
    }

    if (
      fieldKey === "doctoral_graduation_time" &&
      extractionCorrectionFields.doctoral_degree_status ===
        DOCTORAL_DEGREE_NO_STATUS
    ) {
      setExtractionCorrectionFields((current) =>
        current.doctoral_graduation_time === "none"
          ? current
          : {
              ...current,
              doctoral_graduation_time: "none",
            },
      );
      return;
    }

    if (snapshot) {
      void trackClick({
        eventType: "extraction_field_edit_started",
        pageName: trackingPageName,
        stepName: "resume_extraction",
        applicationId: snapshot.applicationId,
        payload: { fieldKey },
      });
    }

    setActiveExtractionField(fieldKey);
    setExtractionDraftValue(extractionCorrectionFields[fieldKey] ?? "");
  }

  function handleCommitExtractionFieldEdit(value?: string) {
    if (!activeExtractionField) {
      return;
    }

    const nextValue =
      activeExtractionField === "doctoral_degree_status"
        ? normalizeDoctoralDegreeStatus(value ?? extractionDraftValue)
        : EXTRACTION_YEAR_FIELD_KEYS.has(activeExtractionField)
          ? (value ?? extractionDraftValue).replace(/\D/g, "").slice(0, 4)
          : (value ?? extractionDraftValue).trim();

    setExtractionCorrectionFields((current) => {
      const nextFields = normalizeExtractionCorrectionFields({
        ...current,
        [activeExtractionField]: nextValue,
      });

      if (
        current[activeExtractionField] === nextFields[activeExtractionField] &&
        current.doctoral_graduation_time === nextFields.doctoral_graduation_time
      ) {
        return current;
      }

      return nextFields;
    });
    setActiveExtractionField(null);
    setExtractionDraftValue("");
  }

  function handleConfirmExtraction() {
    if (
      !snapshot ||
      snapshot.applicationStatus !== "CV_EXTRACTION_REVIEW" ||
      !snapshot.latestExtractionReview
    ) {
      return;
    }

    const normalizedCorrectionFields = normalizeExtractionCorrectionFields(
      extractionCorrectionFields,
    );
    const errors = validateExtractionCorrectionFields(
      normalizedCorrectionFields,
    );

    if (Object.keys(errors).length > 0) {
      setHasAttemptedExtractionSubmit(true);
      void trackClick({
        eventType: "eligibility_judgment_start_clicked",
        pageName: trackingPageName,
        stepName: "resume_extraction",
        eventStatus: "FAIL",
        applicationId: snapshot.applicationId,
        errorCode: "extraction_validation_failed",
        payload: { errorFields: Object.keys(errors) },
      });
      scrollToFirstExtractionError(errors);
      return;
    }

    startExtractionConfirmTransition(async () => {
      try {
        setError(null);
        void trackClick({
          eventType: "eligibility_judgment_start_clicked",
          pageName: trackingPageName,
          stepName: "resume_extraction",
          applicationId: snapshot.applicationId,
        });
        await confirmResumeExtraction(snapshot.applicationId, {
          extractionRawResponse: buildInitialCvReviewExtractionText(
            normalizedCorrectionFields,
          ),
        });
        setSnapshot((current) =>
          current
            ? {
                ...current,
                applicationStatus: "CV_ANALYZING",
                currentStep: "result",
              }
            : current,
        );
        setStatusText("");
        await syncAnalysisProgress(snapshot.applicationId);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to start eligibility judgment.",
        );
      }
    });
  }

  function handleDeleteUploadedResume() {
    if (
      !snapshot ||
      !snapshot.latestResumeFile ||
      !["INTRO_VIEWED", "CV_UPLOADED"].includes(snapshot.applicationStatus)
    ) {
      return;
    }

    startDeleteResumeTransition(async () => {
      try {
        setError(null);
        await deleteUploadedResume(snapshot.applicationId);
        setSnapshot(await fetchSession());
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Failed to delete the uploaded CV.",
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

    void trackClick({
      eventType: "supplemental_submit_clicked",
      pageName: trackingPageName,
      stepName: "supplemental",
      applicationId: snapshot.applicationId,
    });

    startSupplementalTransition(async () => {
      try {
        setError(null);
        const result = await submitSupplementalFields(
          snapshot.applicationId,
          values,
        );
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

  function onSupplementalInvalid() {
    if (!snapshot) {
      return;
    }

    void trackClick({
      eventType: "supplemental_submit_clicked",
      pageName: trackingPageName,
      stepName: "supplemental",
      eventStatus: "FAIL",
      applicationId: snapshot.applicationId,
      errorCode: "supplemental_validation_failed",
    });
  }

  function handleContinueToMaterials() {
    if (!snapshot) {
      return;
    }

    void trackClick({
      eventType: "continue_to_materials_clicked",
      pageName: trackingPageName,
      stepName: "analysis_result",
      applicationId: snapshot.applicationId,
    });
    router.push("/apply/materials");
  }

  const activeInitialCvReviewExtract = useMemo(
    () =>
      snapshot?.latestResult ??
      (snapshot?.latestExtractionReview
        ? {
            extractedFields: snapshot.latestExtractionReview.extractedFields,
          }
        : null),
    [snapshot?.latestExtractionReview, snapshot?.latestResult],
  );
  const hasInitialCvReviewExtractData = useMemo(
    () =>
      hasInitialCvReviewExtract(activeInitialCvReviewExtract?.extractedFields),
    [activeInitialCvReviewExtract?.extractedFields],
  );
  const extractionCorrectionErrors = useMemo(
    () => validateExtractionCorrectionFields(extractionCorrectionFields),
    [extractionCorrectionFields],
  );
  const missingFields = useMemo(
    () => snapshot?.latestResult?.missingFields ?? [],
    [snapshot?.latestResult?.missingFields],
  );
  const missingContactFields = useMemo(
    () =>
      missingFields.filter((field) =>
        isScreeningContactFieldKey(field.fieldKey),
      ),
    [missingFields],
  );
  const missingCriticalFields = useMemo(
    () =>
      missingFields.filter(
        (field) => !isScreeningContactFieldKey(field.fieldKey),
      ),
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
  const uploadedResumeFile = snapshot?.latestResumeFile ?? null;
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
    [
      "CV_EXTRACTING",
      "CV_ANALYZING",
      "REANALYZING",
      "SECONDARY_ANALYZING",
    ].includes(snapshot.applicationStatus),
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

    const ariaValueText = `Estimated wait progress is about ${Math.round(progressRatio * 100)} percent. Actual completion depends on the CV review status.`;

    return {
      progressRatio,
      primaryMessage,
      secondaryMessage,
      ariaValueText,
      statusLabel: formatAnalysisStatusLabel(analysisJobStatus),
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
      return "Upload your CV to start the application. You will receive eligibility feedback based on our initial assessment.";
    }

    switch (snapshot.applicationStatus) {
      case "CV_EXTRACTING":
        return "";
      case "CV_EXTRACTION_REVIEW":
        return "Review the information extracted from your CV. Eligibility judgment will start after you confirm it.";
      case "CV_ANALYZING":
      case "REANALYZING":
        return "Your confirmed CV information is being evaluated. This page will update automatically; please keep it open.";
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
        return "An additional review is running. This page will refresh automatically until it is ready.";
      case "SECONDARY_REVIEW":
        return "Continue to Additional Information to upload supporting materials.";
      case "SECONDARY_FAILED":
        return "The additional review step did not finish successfully. Please contact the program team if you need help continuing.";
      case "INELIGIBLE":
        return "This submission does not meet the published requirements. See the summary below for the reasons provided.";
      case "INTRO_VIEWED":
        return 'Upload your latest CV and click "Confirm Upload". Keep this page open as we will extract key information for eligibility assessment. You may re-upload your CV before confirming, but it cannot be replaced once confirmed.';
      case "CV_UPLOADED":
        return "Your CV has been saved. Start CV analysis when you are ready.";
      default:
        return "Upload your CV to start the application. You will receive eligibility feedback based on our initial assessment.";
    }
  }, [
    currentResultStep,
    hasMixedContactAndCriticalGaps,
    isEligibleContactCompletion,
    snapshot,
  ]);
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
            ? snapshot?.applicationStatus === "CV_EXTRACTION_REVIEW"
              ? "Confirm CV Information"
              : "CV Upload & Preliminary Assessment"
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
                <SectionCard title={undefined} description={undefined}>
                  <div className="flex flex-col gap-5">
                    <label className="block">
                      <input
                        ref={resumeFileInputRef}
                        type="file"
                        disabled={
                          isLoading ||
                          isUploadingResume ||
                          isStartingResumeAnalysis ||
                          isDeletingUploadedResume
                        }
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null;

                          if (!nextFile) {
                            return;
                          }

                          performResumeUpload(nextFile);
                        }}
                        className="sr-only"
                        accept=".pdf,.doc,.docx,.zip"
                      />
                      <div
                        className={cn(
                          "rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--muted)]/70 px-5 py-8 text-center transition hover:border-[color:var(--primary)] hover:bg-white",
                          (isLoading ||
                            isUploadingResume ||
                            isStartingResumeAnalysis ||
                            isDeletingUploadedResume) &&
                            "pointer-events-none opacity-60",
                        )}
                      >
                        <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                          {isUploadingResume ? "Uploading" : "Select file"}
                        </p>
                        <p className="mt-2 text-xl font-semibold text-[color:var(--primary)]">
                          {isUploadingResume
                            ? "Saving your CV…"
                            : "Upload your latest CV"}
                        </p>
                        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--foreground-soft)]">
                          PDF or Word is preferred. ZIP archives are accepted
                          when the CV package needs to stay bundled. Maximum 20
                          MB per file, or up to 100 MB for ZIP.
                        </p>
                      </div>
                    </label>

                    {uploadedResumeFile ? (
                      <div className="flex flex-row items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-emerald-700 uppercase">
                            Saved CV
                          </p>
                          <p
                            className="mt-1.5 truncate text-sm font-semibold text-[color:var(--primary)]"
                            title={uploadedResumeFile.fileName}
                          >
                            {uploadedResumeFile.fileName}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--foreground-soft)]">
                            Uploaded{" "}
                            {new Date(
                              uploadedResumeFile.uploadedAt,
                            ).toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}{" "}
                            - {Math.ceil(uploadedResumeFile.fileSize / 1024)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDeleteUploadedResume}
                          disabled={
                            isLoading ||
                            isUploadingResume ||
                            isStartingResumeAnalysis ||
                            isDeletingUploadedResume
                          }
                          className="shrink-0 rounded-lg border border-[color:var(--border-strong)] bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeletingUploadedResume ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <ActionButton
                        onClick={handleStartResumeAnalysis}
                        disabled={
                          !uploadedResumeFile ||
                          isLoading ||
                          isUploadingResume ||
                          isStartingResumeAnalysis ||
                          isDeletingUploadedResume
                        }
                        className="w-full sm:w-auto"
                      >
                        {isStartingResumeAnalysis
                          ? "Starting Analysis..."
                          : "Confirm Upload"}
                      </ActionButton>
                    </div>
                  </div>
                </SectionCard>
              ) : isAnalyzingStage ? (
                <AnalysisProgressPanel
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
                getInitialBanner(snapshot, statusText)
              )}

              {hasInitialCvReviewExtractData &&
              activeInitialCvReviewExtract &&
              snapshot.applicationStatus !== "CV_EXTRACTION_REVIEW" ? (
                <InitialCvReviewExtractCard
                  extract={activeInitialCvReviewExtract}
                />
              ) : null}

              {snapshot.applicationStatus === "CV_EXTRACTION_REVIEW" &&
              snapshot.latestExtractionReview ? (
                <EditableExtractionReviewCard
                  fields={extractionCorrectionFields}
                  errors={extractionCorrectionErrors}
                  activeField={activeExtractionField}
                  draftValue={extractionDraftValue}
                  showErrors={hasAttemptedExtractionSubmit}
                  isConfirming={isConfirmingExtraction}
                  fieldRefs={extractionFieldRefs}
                  onStartEdit={handleStartExtractionFieldEdit}
                  onDraftChange={setExtractionDraftValue}
                  onCommitEdit={handleCommitExtractionFieldEdit}
                  onConfirm={handleConfirmExtraction}
                />
              ) : null}

              {hasInitialCvReviewExtractData && snapshot.latestResult ? (
                <InitialCvReviewDeterminationCard snapshot={snapshot} />
              ) : null}

              {snapshot.latestResult?.reasonText &&
              snapshot.applicationStatus !== "INELIGIBLE" &&  snapshot.applicationStatus !== "SECONDARY_FAILED" &&
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
                    onClick={handleContinueToMaterials}
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
                  <form
                    className="space-y-4"
                    onSubmit={handleSubmit(onSubmit, onSupplementalInvalid)}
                  >
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

export function CvReviewExperienceWithSuspense(
  props: CvReviewExperienceProps = {},
) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center px-4 text-sm text-slate-600">
          Loading application status…
        </div>
      }
    >
      <CvReviewExperience {...props} />
    </Suspense>
  );
}
