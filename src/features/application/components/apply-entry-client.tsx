"use client";

import { useEffect, useState, useTransition } from "react";
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
import {
  resolveRouteFromStatus,
  shouldRedirectFromApply,
} from "@/features/application/route";
import type { ApplicationSnapshot } from "@/features/application/types";

type ApplyEntryClientProps = {
  token: string | null;
};

const PROGRAM_HIGHLIGHTS = [
  {
    eyebrow: "Program Focus",
    title: "Global expertise with a research and impact orientation",
    description:
      "This placeholder overview introduces the GESF fund as an invitation-based channel for internationally recognized experts whose work can contribute to long-term academic, scientific, and institutional development.",
  },
  {
    eyebrow: "Application Logic",
    title: "A staged review rather than a one-time upload form",
    description:
      "The application starts with a resume review, requests only the missing structured details when needed, and collects supporting materials only after the initial assessment is complete.",
  },
  {
    eyebrow: "Review Experience",
    title: "Clear outcomes and calm decision points",
    description:
      "Applicants see whether the profile is in review, needs more information, or is ready for the final materials stage, so the next action is always explicit.",
  },
] as const;

const PROGRAM_SECTIONS = [
  {
    title: "What this fund is designed to support",
    body: "Use this area for the official GESF program introduction. Placeholder copy can describe the strategic purpose of the fund, the kind of global experts it aims to attract, and the longer-term institutional or regional value expected from the program.",
  },
  {
    title: "Who this invitation is intended for",
    body: "Use placeholder text here for the intended applicant profile, such as international researchers, technical leaders, industry specialists, or interdisciplinary experts with a strong record of contribution and collaboration.",
  },
  {
    title: "How applicants are reviewed",
    body: "Use placeholder text here for the assessment principles. For example: resume quality, research or professional achievements, alignment with the program direction, and the completeness of supporting evidence submitted later in the process.",
  },
] as const;

const PROCESS_OVERVIEW = [
  {
    eyebrow: "Stage One",
    title: "Read the program brief",
    description:
      "Review the invitation context, the scope of the fund, and the overall application rhythm before you begin.",
  },
  {
    eyebrow: "Stage Two",
    title: "Upload your resume",
    description:
      "The formal application starts with a resume submission for the initial review.",
  },
  {
    eyebrow: "Stage Three",
    title: "Respond only if more detail is required",
    description:
      "If some key facts are missing, the system asks for a short set of structured follow-up fields instead of a full re-entry.",
  },
  {
    eyebrow: "Stage Four",
    title: "Provide supporting materials and submit",
    description:
      "Once the profile is ready to proceed, upload the supporting documents you wish to include and confirm the final package.",
  },
] as const;

const PREPARATION_NOTES = [
  "Prepare one current resume in PDF, Word, or ZIP format.",
  "Supporting documents can be organized after the initial review.",
  "Use the invitation link associated with this application only.",
] as const;

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

        if (shouldRedirectFromApply(nextSnapshot)) {
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
    if (!snapshot) {
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
      ? "Invitation confirmed"
      : "Invitation available";
  const invitationDescription =
    snapshot?.applicationStatus === "INTRO_VIEWED"
      ? "You have already opened this invitation. Continue when you are ready to move into the formal application flow."
      : "This invitation is active and ready. After you start, the application will reopen at the latest saved stage if you pause and return later.";
  const buttonLabel =
    snapshot?.applicationStatus === "INTRO_VIEWED"
      ? "Continue Application"
      : "Start Application";

  return (
    <PageFrame>
      <PageShell
        eyebrow="GESF / Fund Introduction"
        title="A considered introduction to the GESF fund before the formal application begins."
        description="This entry page is now positioned as the program brief for invited experts. It can hold the official fund narrative, the intended applicant profile, the review logic, and a clear explanation of how the application will unfold after you decide to proceed."
        headerSlot={
          <SectionCard
            title="Program at a glance"
            description="A refined first read for invited experts, with placeholder content ready to be replaced by the final approved fund copy."
            className="bg-white/90"
          >
            <div className="space-y-3">
              {PROGRAM_HIGHLIGHTS.map((item) => (
                <DetailCard
                  key={item.title}
                  eyebrow={item.eyebrow}
                  title={item.title}
                  description={item.description}
                />
              ))}
            </div>
          </SectionCard>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <SectionCard
              title="Fund profile"
              description="Use this area to present the official GESF project background and explain why invited experts are being considered for this application track."
            >
              <div className="grid gap-4 md:grid-cols-3">
                {PROGRAM_SECTIONS.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-[1.5rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,244,236,0.88))] p-5 shadow-[0_14px_32px_rgba(28,25,23,0.04)]"
                  >
                    <p className="text-[0.68rem] font-semibold tracking-[0.22em] text-stone-500 uppercase">
                      Placeholder Section
                    </p>
                    <h2 className="mt-3 font-[family-name:var(--font-serif)] text-2xl text-stone-950">
                      {section.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stone-700">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="How the application will unfold"
              description="This overview is intentionally simple. The formal step bar appears only after you choose to start the application."
            >
              <div className="grid gap-4 md:grid-cols-2">
                {PROCESS_OVERVIEW.map((item) => (
                  <DetailCard
                    key={item.title}
                    eyebrow={item.eyebrow}
                    title={item.title}
                    description={item.description}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="What to prepare"
              description="A short checklist keeps the entry page practical without turning it into the formal application flow."
            >
              <ul className="grid gap-3 md:grid-cols-3">
                {PREPARATION_NOTES.map((note, index) => (
                  <li
                    key={note}
                    className="flex min-h-28 gap-4 rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-4"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-sm font-semibold text-stone-700">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-7 text-stone-700">{note}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="space-y-4">
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
                <p className="text-sm leading-7">{error}</p>
                <p className="text-xs text-rose-800/80">
                  For local testing, you can use the sample token:
                  <code className="ml-2 rounded bg-white px-2 py-1 text-[0.72rem] text-rose-900">
                    sample-init-token
                  </code>
                </p>
              </StatusBanner>
            ) : null}

            {snapshot ? (
              <SectionCard
                title={invitationTitle}
                description={invitationDescription}
              >
                <div className="space-y-5">
                  <div className="rounded-[1.4rem] border border-stone-200 bg-stone-50/80 p-4">
                    <p className="text-[0.68rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
                      Next move
                    </p>
                    <p className="mt-2 text-base font-semibold text-stone-950">
                      Begin the formal application when the program brief is clear.
                    </p>
                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      The next screen starts the application flow with resume
                      submission as the first formal step.
                    </p>
                  </div>

                  <ActionButton
                    onClick={handleStart}
                    disabled={isPending}
                    className="w-full sm:w-auto"
                  >
                    {isPending ? "Opening Application..." : buttonLabel}
                  </ActionButton>
                </div>
              </SectionCard>
            ) : null}
          </div>
        </div>
      </PageShell>
    </PageFrame>
  );
}
