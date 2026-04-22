"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  ActionButton,
  PageFrame,
  PageShell,
  StatusBanner,
} from "@/components/ui/page-shell";
import { fetchSession, postIntroConfirm } from "@/features/application/client";
import { APPLICATION_FLOW_STEPS_WITH_INTRO } from "@/features/application/constants";
import {
  buildApplyFlowStepLinks,
  getReachableFlowStep,
  isFlowStepReadOnly,
  resolveRouteFromStatus,
  shouldRedirectFromApply,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";
import { trackClick, trackPageView } from "@/lib/tracking/client";
import { cn } from "@/lib/utils";

type ApplyEntryClientProps = {
  token: string | null;
};

const PROCESS = [
  "Project Introduction",
  "CV Review",
  "Additional Information",
  "Submission Complete",
] as const;

const INTRO_DESCRIPTION =
  "We accept applications year-round. However, the formal application window for the 2026 cycle closes in mid-June.";

const APPLICATION_DEADLINE_PILL = "Application Deadline: Mid-June 2026";

const COMPETITIVE_PACKAGE_ITEMS = [
  "Annual Salary: ¥500K – ¥2M RMB (negotiable)",
  "Talent Reward: ¥1.5M – ¥6M RMB (paid over 3–5 years)",
  "Comprehensive Benefits: Including housing subsidies, children's school enrollment support, tax benefits",
  'Title: the prestigious "National High-Level Talent" title.',
] as const;

const ELIGIBILITY_RULES = [
  "Ph.D. degree required.",
  "Minimum of 3 consecutive years of work experience outside mainland China after obtaining the Ph.D.",
  "For applicants over 40, a position equivalent to Associate Professor or higher is required.",
] as const;

const TIMELINE_ITEMS = [
  "Rolling Admissions: We accept applications year-round.",
  "2026 Deadline: The application window for 2026 remains open until mid-June.",
  "Notification: For applications submitted before mid-June 2026, results will be announced in December 2026.",
  "Flexibility: Selected candidates for the 2026 cohort will have a two-year consideration period, with the option to arrive in China as late as early 2029.",
] as const;

const SUB_PROGRAMS = [
  "Qiming (QM)",
  "Torch Plan (HJ)",
  "Changjiang Scholar",
] as const;

const INTRO_SECTION_ITEMS = [
  {
    id: "overview",
    title: "Global Excellent Scientists Fund (GESF)",
    summary: "Program Mission & Objectives",
  },
  {
    id: "benefits",
    title: "Benefits",
    summary: "Competitive Package",
  },
  {
    id: "eligibility",
    title: "Eligibility",
    summary: "Check the minimum degree, experience, and role criteria.",
  },
  {
    id: "process",
    title: "Online Application Process",
    summary:
      "Five steps, progress saves at each stage, and feedback after you submit.",
  },
  {
    id: "timeline",
    title: "Timeline & Key Dates",
    summary:
      "Rolling admissions, deadlines, results notification, and arrival flexibility.",
  },
  {
    id: "about",
    title: "About the Service Provider",
    summary:
      "Learn the role of Meet Technology (Wuhan) Co., Ltd. in this process.",
  },
] as const;

type IntroSectionId = (typeof INTRO_SECTION_ITEMS)[number]["id"];

const ABOUT_US =
  "Meet Technology (Wuhan) Co., Ltd. is a professional talent intermediary company specializing in assisting overseas high-level talents in applying for talent programs in China. We have served more than 100 cities and regions nationwide, organized over 200 meetings, forums, competitions, training sessions, and project investigation activities, connected more than 5,000 overseas high-level talents with local governments and enterprises, and successfully introduced more than 200 overseas high-level talents. More than 20 of those candidates were selected into national and provincial talent programs. We are one of multiple professional service providers participating in the GESF ecosystem.";

export function ApplyEntryClient({ token }: ApplyEntryClientProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const flowStepLinks = useMemo(
    () => buildApplyFlowStepLinks(snapshot?.applicationStatus),
    [snapshot?.applicationStatus],
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] =
    useState<IntroSectionId>("overview");
  const hasTrackedPageView = useRef(false);

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

        // Only skip the intro when opening an invite link with `t` / `token`
        // while the application is already past INIT. Stepper navigation to
        // `/apply` uses the session cookie without a URL token and must stay
        // on the project introduction (read-only when progress > INIT).
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

  useEffect(() => {
    if (!snapshot || hasTrackedPageView.current) {
      return;
    }

    hasTrackedPageView.current = true;
    void trackPageView({
      pageName: "apply_entry",
      stepName: "intro",
      applicationId: snapshot.applicationId,
      token,
    });
  }, [snapshot, token]);

  function handleStart() {
    if (!snapshot || isFlowStepReadOnly(snapshot.applicationStatus, 0)) {
      return;
    }

    startTransition(async () => {
      try {
        void trackClick({
          eventType: "start_apply_clicked",
          pageName: "apply_entry",
          stepName: "intro",
          applicationId: snapshot.applicationId,
        });
        await postIntroConfirm(snapshot.applicationId);
        router.push("/apply/resume");
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unable to open the CV upload page.",
        );
      }
    });
  }

  const isReadOnlyReview = snapshot
    ? isFlowStepReadOnly(snapshot.applicationStatus, 0)
    : false;

  function renderSectionContent(sectionId: IntroSectionId) {
    switch (sectionId) {
      case "overview":
        return (
          <div className="space-y-4 text-sm leading-7 text-[color:var(--foreground-soft)]">
            <p>
              The Global Excellent Scientists Fund (GESF), also known as the
              China Talent Program, is a prestigious national-level talent
              program initiated by relevant Chinese government departments. Its
              primary mission is to attract overseas scholars—including those
              from Hong Kong, Macau, and Taiwan, regardless of nationality—to
              conduct research and innovation in China, thereby contributing to
              the nation&apos;s scientific and technological advancement.
            </p>
            <p>The program encompasses the following sub-projects:</p>
            <ul className="list-disc space-y-2 pl-5">
              {SUB_PROGRAMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        );
      case "benefits":
        return (
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-[color:var(--foreground-soft)] marker:font-semibold">
            {COMPETITIVE_PACKAGE_ITEMS.map((item) => (
              <li key={item} className="pl-1">
                {item}
              </li>
            ))}
          </ol>
        );
      case "eligibility":
        return (
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-7 text-[color:var(--foreground-soft)] marker:font-semibold">
            {ELIGIBILITY_RULES.map((item) => (
              <li key={item} className="pl-1">
                {item}
              </li>
            ))}
          </ol>
        );
      case "process":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-5">
              {PROCESS.map((item, index) => (
                <div
                  key={item}
                  className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-3"
                >
                  <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--primary)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-sm leading-7 text-[color:var(--foreground-soft)]">
              <p>
                The application process is linear; steps cannot be bypassed.
              </p>
              <p>Progress can be saved at each stage.</p>
              <p>
                You will receive feedback from our team within one week of final
                submission.
              </p>
            </div>
          </div>
        );
      case "timeline":
        return (
          <ul className="space-y-2 text-sm leading-7 text-[color:var(--foreground-soft)]">
            {TIMELINE_ITEMS.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        );
      case "about":
        return (
          <p className="text-sm leading-7 text-[color:var(--foreground-soft)]">
            {ABOUT_US}
          </p>
        );
      default:
        return null;
    }
  }

  return (
    <PageFrame>
      <PageShell
        title="Global Excellent Scientists Fund"
        description={INTRO_DESCRIPTION}
        headerTitleClassName="font-normal"
        headerVariant="centered"
        steps={APPLICATION_FLOW_STEPS_WITH_INTRO}
        currentStep={0}
        stepIndexing="zero"
        stepLinks={flowStepLinks}
        maxAccessibleStep={
          snapshot ? getReachableFlowStep(snapshot.applicationStatus) : 0
        }
        headerSlot={
          <div className="flex justify-center">
            <span className="inline-flex min-h-11 items-center rounded-full bg-[color:var(--primary)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(10,25,47,0.16)]">
              {APPLICATION_DEADLINE_PILL}
            </span>
          </div>
        }
      >
        <div className="mx-auto max-w-4xl space-y-4">
          {isReadOnlyReview ? (
            <StatusBanner
              tone="neutral"
              title="Reference-only access"
              description="This invitation has already moved beyond the introduction stage. You may review this page, but the active workflow continues from a later step."
            />
          ) : null}

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

          <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--background-elevated)] shadow-[var(--shadow-card)]">
            <div className="divide-y divide-[color:var(--border)]">
              {INTRO_SECTION_ITEMS.map((section) => {
                const isOpen = activeSection === section.id;

                return (
                  <div key={section.id} className="bg-white/72">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition hover:bg-[color:var(--muted)]/55 sm:px-6"
                      onClick={() =>
                        setActiveSection((current) =>
                          current === section.id ? current : section.id,
                        )
                      }
                    >
                      <div className="min-w-0">
                        <p className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--primary)]">
                          {section.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--foreground-soft)]">
                          {section.summary}
                        </p>
                      </div>
                      <ChevronRight
                        className={cn(
                          "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                          isOpen ? "rotate-90 text-[color:var(--primary)]" : "",
                        )}
                        aria-hidden
                      />
                    </button>
                    {isOpen ? (
                      <div className="border-t border-[color:var(--border)] bg-[color:var(--muted)]/38 px-5 py-5 sm:px-6">
                        {renderSectionContent(section.id)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex justify-center py-4">
            <ActionButton
              onClick={handleStart}
              disabled={isPending || isReadOnlyReview}
            >
              <span>{isPending ? "Opening..." : "Continue to CV Review"}</span>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </ActionButton>
          </div>
        </div>
      </PageShell>
    </PageFrame>
  );
}
