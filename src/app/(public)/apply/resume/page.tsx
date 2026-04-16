"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { buildVisibleExtractedFieldSummary } from "@/features/analysis/display";
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
  confirmResumeUpload,
  createResumeUploadIntent,
  fetchSession,
  uploadBinary,
} from "@/features/application/client";
import { resumeScreeningIdentityOnlySchema } from "@/features/application/schemas";
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
import type { ApplicationSnapshot } from "@/features/application/types";

const RESUME_DRAFT_KEY = "autohire:resume-draft";
type ResumeDraft = {
  passportFullName: string;
  email: string;
};

const EMPTY_DRAFT: ResumeDraft = {
  passportFullName: "",
  email: "",
};

function getMailtoHref() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `mailto:?subject=${encodeURIComponent("Continue my GESF application")}&body=${encodeURIComponent(window.location.href)}`;
}

export default function ResumePage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ResumeDraft>(EMPTY_DRAFT);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [mailtoHref, setMailtoHref] = useState<string | undefined>(undefined);

  useEffect(() => {
    const storedDraft = readDraft<ResumeDraft>(RESUME_DRAFT_KEY);

    if (storedDraft) {
      setDraft({
        passportFullName: storedDraft.values.passportFullName ?? "",
        email: storedDraft.values.email ?? "",
      });
      setDraftSavedAt(storedDraft.savedAt);
    }
  }, []);

  useEffect(() => {
    setMailtoHref(getMailtoHref());
  }, []);

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
              : "Unable to load the current application.",
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
      draft.passportFullName === EMPTY_DRAFT.passportFullName &&
      draft.email === EMPTY_DRAFT.email
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const savedAt = writeDraft(RESUME_DRAFT_KEY, draft);
      setDraftSavedAt(savedAt);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft]);

  function handleUpload() {
    if (
      !snapshot ||
      !selectedFile ||
      isFlowStepReadOnly(snapshot.applicationStatus, 1)
    ) {
      return;
    }

    if (!screeningIdentityValid) {
      setError(
        "Enter your passport full name and a valid email address before submitting your CV.",
      );
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const intent = await createResumeUploadIntent(
          snapshot.applicationId,
          selectedFile,
        );
        await uploadBinary(intent, selectedFile);
        await confirmResumeUpload(
          snapshot.applicationId,
          selectedFile,
          intent.objectKey,
          {
            passportFullName: draft.passportFullName,
            email: draft.email,
          },
        );
        clearDraft(RESUME_DRAFT_KEY);
        router.push("/apply/result");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Resume upload failed.",
        );
      }
    });
  }

  const previewFields = useMemo(
    () =>
      buildVisibleExtractedFieldSummary(
        snapshot?.latestResult?.extractedFields ?? {},
      ).slice(0, 4),
    [snapshot?.latestResult?.extractedFields],
  );
  const screeningIdentityValid = useMemo(() => {
    return resumeScreeningIdentityOnlySchema.safeParse({
      screeningPassportFullName: draft.passportFullName,
      screeningContactEmail: draft.email,
    }).success;
  }, [draft.passportFullName, draft.email]);
  const isReadOnly = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, 1)
    : false;
  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus),
    [snapshot?.applicationStatus],
  );

  return (
    <PageFrame>
      <PageShell
        eyebrow="Step 2"
        title="Upload your CV and confirm the core identity details used for screening."
        description="Provide the passport name, contact email, and latest CV file used for the first review pass."
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={1}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 1
        }
      >
        <div className="mx-auto max-w-4xl space-y-4">
          <MobileSupportCard href={mailtoHref} />

          {isReadOnly ? (
            <StatusBanner
              tone="neutral"
              title="Reference-only access"
              description="Your application has already moved beyond CV upload. This step remains visible for review, but input and upload controls are locked."
            />
          ) : null}

          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Restoring your application"
              description="Checking the saved server state before the CV form becomes available."
            />
          ) : null}

          {error ? (
            <StatusBanner
              tone="danger"
              title="The CV step could not be completed"
              description={error}
            />
          ) : null}

          <SectionCard
            title="Applicant details and CV"
            description="Complete the identity fields, choose one current CV file, and submit the package for review."
          >
            <div className="space-y-5">
              <div className="grid gap-4">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--primary)]">
                    Passport Full Name
                  </span>
                  <input
                    type="text"
                    value={draft.passportFullName}
                    disabled={isLoading || !snapshot || isReadOnly}
                    placeholder="Enter the passport name exactly as shown"
                    className={getInputClassName()}
                    onChange={(event) => {
                      const { value } = event.currentTarget;
                      setDraft((current) => ({
                        ...current,
                        passportFullName: value,
                      }));
                    }}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[color:var(--primary)]">
                    Email
                  </span>
                  <input
                    type="email"
                    value={draft.email}
                    disabled={isLoading || !snapshot || isReadOnly}
                    placeholder="name@example.com"
                    className={getInputClassName()}
                    onChange={(event) => {
                      const { value } = event.currentTarget;
                      setDraft((current) => ({
                        ...current,
                        email: value,
                      }));
                    }}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/55 px-4 py-3 text-sm">
                <Mail
                  className="h-4 w-4 shrink-0 text-[color:var(--accent)]"
                  aria-hidden
                />
                <span className="font-medium text-[color:var(--primary)]">
                  {draftSavedAt
                    ? "Draft saved in this browser"
                    : "Draft saves automatically"}
                </span>
                <span className="text-[color:var(--foreground-soft)]">
                  {draftSavedAt
                    ? `Last saved ${new Date(draftSavedAt).toLocaleString(
                        "en-US",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}.`
                    : "Typed values will be cached locally after a short pause."}
                </span>
              </div>

              <label className="block">
                <input
                  type="file"
                  disabled={isLoading || !snapshot || isReadOnly}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setSelectedFile(nextFile);
                  }}
                  className="sr-only"
                  accept=".pdf,.doc,.docx,.zip"
                />
                <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--muted)]/70 px-5 py-8 text-center transition hover:border-[color:var(--primary)] hover:bg-white">
                  <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Drag or select
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[color:var(--primary)]">
                    Upload your latest CV
                  </p>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--foreground-soft)]">
                    PDF or Word is preferred. ZIP archives are accepted when the
                    resume package needs to stay bundled. Maximum 20 MB per
                    file, or up to 100 MB for ZIP.
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

              <div className="flex justify-end">
                <ActionButton
                  onClick={handleUpload}
                  disabled={
                    !selectedFile ||
                    !screeningIdentityValid ||
                    isPending ||
                    isLoading ||
                    !snapshot ||
                    isReadOnly
                  }
                  className="w-full sm:w-auto"
                >
                  {isPending ? "Submitting CV..." : "Submit CV"}
                </ActionButton>
              </div>
            </div>
          </SectionCard>

          <DisclosureSection
            title="Submission rules"
            summary="PDF and Word are preferred. Resume screening starts immediately after submission."
          >
            <div className="space-y-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
              <p>
                PDF and Word are preferred. ZIP archives remain accepted for
                bundled supporting CV content when needed.
              </p>
              <p>
                Once submitted, you will move to the review page and the system
                will request additional information only if required.
              </p>
            </div>
          </DisclosureSection>

          {(previewFields.length > 0 || selectedFile) && (
            <DisclosureSection
              title="Parsed preview"
              summary="Review the recognized profile details before you continue."
            >
              {previewFields.length > 0 ? (
                <div className="space-y-2">
                  {previewFields.map((field) => (
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
              ) : (
                <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                  No parsed preview is available yet. The screening page will
                  generate and display recognized profile details after
                  submission.
                </p>
              )}
            </DisclosureSection>
          )}

          {snapshot?.latestResumeFile ? (
            <DisclosureSection
              title="Previously uploaded CV"
              summary="The latest confirmed file remains available in your application history."
            >
              <MetaStrip
                items={[
                  {
                    label: "Latest upload",
                    value: snapshot.latestResumeFile.fileName,
                  },
                  {
                    label: "Uploaded on",
                    value: new Date(
                      snapshot.latestResumeFile.uploadedAt,
                    ).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                  },
                ]}
              />
            </DisclosureSection>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
