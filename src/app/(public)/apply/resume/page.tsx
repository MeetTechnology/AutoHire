"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";

import { buildVisibleExtractedFieldSummary } from "@/features/analysis/display";
import {
  ActionButton,
  DetailCard,
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
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  clearDraft,
  readDraft,
  writeDraft,
} from "@/features/application/draft-storage";
import {
  canAccessFlowStep,
  getReachableFlowStep,
  isFlowStepReadOnly,
  resolveRouteFromStatus,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

const RESUME_DRAFT_KEY = "autohire:resume-draft";
const FLOW_STEP_LINKS = [
  "/apply",
  "/apply/resume",
  "/apply/result?view=review",
  "/apply/result?view=additional",
  "/apply/materials",
] as const;

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
  const isReadOnly = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, 1)
    : false;

  return (
    <PageFrame>
      <PageShell
        eyebrow="Step 2"
        title="Upload your CV and confirm the core identity details used for screening."
        description="This step collects the passport name, contact email, and latest CV file that will anchor the first AI screening pass. Draft text fields are saved locally in this browser to reduce accidental loss."
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={1}
        stepIndexing="zero"
        stepLinks={FLOW_STEP_LINKS}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 1
        }
        headerSlot={
          <SectionCard
            title="CV submission rules"
            description="The first review uses the current CV file only."
          >
            <div className="space-y-3">
              <DetailCard
                eyebrow="Formats"
                title="PDF and Word are preferred"
                description="ZIP archives remain accepted for bundled supporting CV content, but a direct PDF or Word file is ideal."
              />
              <DetailCard
                eyebrow="After upload"
                title="The AI review begins immediately"
                description="You will be taken to the review page, where the system shows live progress and requests additional information only if needed."
              />
            </div>
          </SectionCard>
        }
      >
        <div className="space-y-4">
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
            title="Applicant details"
            description="These values are stored locally in this browser only and help you complete the step without losing progress on refresh."
          >
            <div className="grid gap-4 lg:grid-cols-[1fr_0.84fr]">
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
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        passportFullName: event.currentTarget.value,
                      }))
                    }
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
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        email: event.currentTarget.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/70 p-3.5">
                <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Local draft status
                </p>
                <p className="mt-1.5 text-sm font-semibold text-[color:var(--primary)]">
                  {draftSavedAt
                    ? "Draft saved in this browser"
                    : "Draft will save automatically"}
                </p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--foreground-soft)]">
                  {draftSavedAt
                    ? `Last saved ${new Date(draftSavedAt).toLocaleString(
                        "en-US",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}.`
                    : "Typed values will be cached locally after a short pause."}
                </p>
                <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-white p-3">
                  <div className="flex items-center gap-2 text-sm text-[color:var(--foreground-soft)]">
                    <Mail
                      className="h-4 w-4 text-[color:var(--accent)]"
                      aria-hidden
                    />
                    <span>
                      Use the mobile card above to email this application link
                      to yourself.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Upload CV"
            description="Choose one current CV file. The upload card stays intentionally compact so the next action remains obvious."
          >
            <div className="space-y-4">
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

              <div className="grid gap-4 lg:grid-cols-[1fr_0.84fr]">
                <div className="space-y-3">
                  <input
                    value={selectedFile?.name ?? ""}
                    readOnly
                    placeholder="No file selected yet"
                    className={getInputClassName(
                      "pointer-events-none bg-[color:var(--muted)]/40",
                    )}
                  />

                  {selectedFile ? (
                    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/70 p-3.5">
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
                  ) : null}
                </div>

                <div className="rounded-xl border border-[color:var(--border)] bg-white p-3.5">
                  <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Parsed preview
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    When prior AI-recognized profile data is available for this
                    application, it appears here for a quick confirmation before
                    you proceed.
                  </p>
                  {previewFields.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {previewFields.map((field) => (
                        <div
                          key={`${field.no}-${field.label}`}
                          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)]/60 px-3 py-2"
                        >
                          <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-slate-500 uppercase">
                            {field.label}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[color:var(--primary)]">
                            {field.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-[color:var(--border)] bg-[color:var(--muted)]/50 px-3 py-3 text-sm text-[color:var(--foreground-soft)]">
                      No parsed preview is available yet. The AI review page
                      will generate and display recognized profile details after
                      submission.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <ActionButton
                  onClick={handleUpload}
                  disabled={
                    !selectedFile ||
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

          {snapshot?.latestResumeFile ? (
            <SectionCard
              title="Previously uploaded CV"
              description="The latest confirmed file remains available in your application history."
            >
              <DetailCard
                eyebrow="Latest upload"
                title={snapshot.latestResumeFile.fileName}
                description={`Uploaded on ${new Date(
                  snapshot.latestResumeFile.uploadedAt,
                ).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}.`}
              />
            </SectionCard>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
