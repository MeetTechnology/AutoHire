"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
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
import { cn } from "@/lib/utils";

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
const APPLICATION_PERIOD = "Application Period: Q2 2026";
const INTRO_SECTION_ITEMS = [
  {
    id: "overview",
    title: "What is GESF",
    summary: "Understand the program mission and the target candidate profile.",
  },
  {
    id: "benefits",
    title: "Benefits",
    summary: "Review compensation, rewards, and practical support.",
  },
  {
    id: "eligibility",
    title: "Eligibility",
    summary: "Check the minimum degree, experience, and role criteria.",
  },
  {
    id: "process",
    title: "Process",
    summary: "See the five-step application journey before you begin.",
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

/** Decorative backdrop for `/apply` only; replace `public/apply/entry-background.png` for production art. */
const APPLY_ENTRY_BACKDROP_STYLE: CSSProperties = {
  backgroundImage:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(244, 247, 251, 0.78) 38%, rgba(244, 247, 251, 0.7) 100%), url("/apply/entry-background.png")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

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

  function renderSectionContent(sectionId: IntroSectionId) {
    switch (sectionId) {
      case "overview":
        return (
          <div className="space-y-3 text-sm leading-7 text-[color:var(--foreground-soft)]">
            <p>
              GESF, the Global Excellent Scientists Fund, is a national-level
              talent program designed to attract world-class researchers and
              experts.
            </p>
            <p>
              The program is hosted by relevant government departments and
              targets high-level researchers and experts currently working
              overseas, including Hong Kong, Macau, and Taiwan.
            </p>
          </div>
        );
      case "benefits":
        return (
          <ul className="space-y-2 text-sm leading-7 text-[color:var(--foreground-soft)]">
            {BENEFITS.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
        );
      case "eligibility":
        return (
          <ul className="space-y-2 text-sm leading-7 text-[color:var(--foreground-soft)]">
            {ELIGIBILITY.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-[color:var(--border)] bg-white px-4 py-3"
              >
                {item}
              </li>
            ))}
          </ul>
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
            <p className="text-sm leading-7 text-[color:var(--foreground-soft)]">
              The journey is intentionally linear: introduction first, then CV
              upload, AI review, any required follow-up fields, and finally the
              submission package.
            </p>
          </div>
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
    <div className="relative isolate min-h-screen w-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={APPLY_ENTRY_BACKDROP_STYLE}
      />
      <div className="relative z-10">
        <PageFrame>
          <PageShell
            eyebrow="GESF"
            title="Global Excellent Scientists Fund"
            description="A concise introduction before you move into CV submission and review."
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
                  {APPLICATION_PERIOD}
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
                              isOpen
                                ? "rotate-90 text-[color:var(--primary)]"
                                : "",
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

              <section className="rounded-[1.75rem] border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-5 py-5 shadow-[var(--shadow-card)] sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-[color:var(--primary)]">
                      {invitationTitle}
                    </p>
                    <p className="text-sm leading-6 text-[color:var(--foreground-soft)]">
                      {invitationDescription}
                    </p>
                  </div>
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
              </section>
            </div>
          </PageShell>
        </PageFrame>
      </div>
    </div>
  );
}
