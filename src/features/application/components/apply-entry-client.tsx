"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  ActionButton,
  DetailCard,
  PageFrame,
  PageShell,
  SectionCard,
  StatusBanner,
} from "@/components/ui/page-shell";
import { fetchSession, postIntroConfirm } from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  getReachableFlowStep,
  isFlowStepReadOnly,
  resolveRouteFromStatus,
  shouldRedirectFromApply,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

type ApplyEntryClientProps = {
  token: string | null;
};

const BENEFITS = [
  "Annual Salary: ¥500K – ¥2M RMB, negotiable according to profile and institutional fit.",
  "Talent Reward: ¥1.5M – ¥6M RMB, typically paid over 3–5 years.",
  "Comprehensive Benefits: housing subsidy support, children's school enrollment support, and tax-related support where applicable.",
  "Recognition: eligible candidates may obtain the National High-Level Talent title through the formal review pathway.",
  "Open to all nationalities. Relocation is not required before selection.",
  "Flexible engagement. Full-time and part-time onboarding arrangements remain negotiable after successful selection and must be completed within two years.",
] as const;

const ELIGIBILITY = [
  "A Ph.D. is required.",
  "Applicants under 40 must normally show at least 36 consecutive months of work or research experience outside mainland China.",
  "For applicants aged 40+, the 36-month criterion is waived.",
  "Applicants aged 40+ should normally hold a position equivalent to Associate Professor or above outside mainland China.",
] as const;

const PROCESS = [
  "Project Introduction",
  "Upload CV",
  "AI Review",
  "Additional Information",
  "Submission Complete",
] as const;
const FLOW_STEP_LINKS = [
  "/apply",
  "/apply/resume",
  "/apply/result?view=review",
  "/apply/result?view=additional",
  "/apply/materials",
] as const;

const ABOUT_US =
  "Meet Technology (Wuhan) Co., Ltd. is a professional talent intermediary company specializing in assisting overseas high-level talents in applying for talent programs in China. We have served more than 100 cities and regions nationwide, organized over 200 meetings, forums, competitions, training sessions, and project investigation activities, connected more than 5,000 overseas high-level talents with local governments and enterprises, and successfully introduced more than 200 overseas high-level talents. More than 20 of those candidates were selected into national and provincial talent programs. We are one of multiple professional service providers participating in the GESF ecosystem.";

export function ApplyEntryClient({ token }: ApplyEntryClientProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const nextSnapshot = await fetchSession(token);

        if (!active) {
          return;
        }

        if (token && shouldRedirectFromApply(nextSnapshot)) {
          router.replace(
            resolveRouteFromStatus(nextSnapshot.applicationStatus),
          );
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (nextError) {
        if (!active) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to initialize the current application session.",
        );
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
  }, [router, token]);

  function handleStart() {
    if (!snapshot || isFlowStepReadOnly(snapshot.applicationStatus, 0)) {
      return;
    }

    startTransition(async () => {
      try {
        await postIntroConfirm(snapshot.applicationId);
        router.push("/apply/resume");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to open the resume upload page.",
        );
      }
    });
  }

  const invitationTitle =
    snapshot?.applicationStatus === "INTRO_VIEWED"
      ? "Application session restored"
      : "Invitation verified";
  const invitationDescription =
    snapshot?.applicationStatus === "INTRO_VIEWED"
      ? "Your previous progress remains available. Continue when you are ready to move into the CV stage."
      : "This invitation is active. The system will restore your progress automatically whenever you return through the same invitation flow.";
  const buttonLabel =
    snapshot?.applicationStatus === "INTRO_VIEWED"
      ? "Next: Upload CV"
      : "Next: Upload CV";
  const isReadOnlyReview = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, 0)
    : false;

  return (
    <PageFrame>
      <PageShell
        eyebrow="GESF Application"
        title="Global Excellent Scientists Fund high-end scientific talent program."
        description="GESF is a national-level talent program designed to attract world-class researchers and experts. This application flow provides a compact, review-oriented route from project briefing to CV screening, additional information, and final submission."
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={0}
        stepIndexing="zero"
        stepLinks={FLOW_STEP_LINKS}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 0
        }
        headerSlot={
          <SectionCard
            title="Process snapshot"
            description="The journey is intentionally linear and concise."
          >
            <div className="space-y-3">
              <DetailCard
                eyebrow="Current"
                title="Five-step guided flow"
                description="Introduction, CV upload, AI review, additional information, and final completion tracking."
              />
              <DetailCard
                eyebrow="Recovery"
                title="Progress resumes automatically"
                description="If you pause, the invitation can reopen the latest saved stage on your next visit."
              />
            </div>
          </SectionCard>
        }
      >
        <div className="space-y-4">
          <SectionCard
            title="Program overview"
            description="Direct briefing for invited candidates before formal submission begins."
          >
            <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <DetailCard
                eyebrow="What is GESF"
                title="National-level talent attraction program"
                description="GESF focuses on world-class researchers and experts currently working overseas, including Hong Kong, Macau, and Taiwan."
              />
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/70 p-3.5">
                <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Compact process timeline
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-5">
                  {PROCESS.map((item, index) => (
                    <div
                      key={item}
                      className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2"
                    >
                      <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                        Step {index + 1}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--primary)]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <SectionCard
              title="Program details"
              description="Expand each section only when you need more context."
            >
              <div className="space-y-3">
                <details
                  open
                  className="group rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/60 px-4 py-3"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--primary)]">
                    Benefits
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    {BENEFITS.map((item) => (
                      <li key={item} className="rounded-lg bg-white px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>

                <details className="group rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/60 px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--primary)]">
                    Eligibility
                  </summary>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    {ELIGIBILITY.map((item) => (
                      <li key={item} className="rounded-lg bg-white px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>

                <details className="group rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/60 px-4 py-3">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--primary)]">
                    About us
                  </summary>
                  <p className="mt-3 rounded-lg bg-white px-3 py-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    {ABOUT_US}
                  </p>
                </details>
              </div>
            </SectionCard>

            <SectionCard
              title={invitationTitle}
              description={invitationDescription}
            >
              <div className="space-y-4">
                {isReadOnlyReview ? (
                  <StatusBanner
                    tone="neutral"
                    title="Reference-only access"
                    description="This invitation has already moved beyond the introduction stage. You may review it here, but the active workflow continues from a later page."
                  />
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailCard
                    eyebrow="Preparation"
                    title="Use your latest CV"
                    description="Ensure your passport name, email, current role, and key academic milestones are up to date before continuing."
                  />
                  <DetailCard
                    eyebrow="Review cadence"
                    title="Asynchronous evaluation"
                    description="After submission, the system may request only the additional items needed to complete accelerated evaluation."
                  />
                </div>

                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)] px-4 py-3">
                  <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Next action
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    Continue to the CV stage when you are ready to provide your
                    passport name, email address, and latest resume file.
                  </p>
                </div>

                <div className="flex justify-end">
                  <ActionButton
                    onClick={handleStart}
                    disabled={isPending || isReadOnlyReview}
                    className="w-full sm:w-auto"
                  >
                    <span>
                      {isPending ? "Opening CV Step..." : buttonLabel}
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </ActionButton>
                </div>
              </div>
            </SectionCard>
          </div>

          {isLoading ? (
            <StatusBanner
              tone="loading"
              title="Preparing your invitation"
              description="Validating the invitation link and checking whether an application session is already available."
            />
          ) : null}

          {error ? (
            <StatusBanner
              tone="danger"
              title="Unable to open the application entry"
            >
              <p className="text-sm leading-6">{error}</p>
              <p className="text-xs text-[color:var(--foreground-soft)]">
                For local testing, you can use the sample token:
                <code className="ml-2 rounded-md bg-white px-2 py-1 text-[0.72rem] text-[color:var(--primary)]">
                  sample-init-token
                </code>
              </p>
            </StatusBanner>
          ) : null}
        </div>
      </PageShell>
    </PageFrame>
  );
}
