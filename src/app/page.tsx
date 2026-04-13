import Link from "next/link";

import {
  DetailCard,
  PageFrame,
  PageShell,
  SectionCard,
  getButtonClassName,
} from "@/components/ui/page-shell";

const highlights = [
  {
    eyebrow: "Assisted Review",
    title: "Resume review with structured follow-up",
    description:
      "Applicants upload a resume once, receive a clear review state, and only complete the information that is genuinely missing.",
  },
  {
    eyebrow: "Safe Continuity",
    title: "Resume progress across visits",
    description:
      "The invitation link restores the application state, so experts can continue the process without restarting from the beginning.",
  },
  {
    eyebrow: "Controlled Delivery",
    title: "Materials grouped by evidence category",
    description:
      "Supporting documents are uploaded in a controlled sequence and confirmed with an explicit final submission step.",
  },
];

const pillars = [
  "Clear editorial layout with strong reading hierarchy",
  "Server-driven status recovery across the full application flow",
  "Asynchronous resume analysis with visible progress feedback",
  "Structured supplemental fields instead of free-form guesswork",
];

export default function HomePage() {
  return (
    <PageFrame className="justify-center">
      <PageShell
        eyebrow="AutoHire / Global Expert Application"
        title="A calmer, clearer application journey for invited global experts."
        description="This experience is designed for invited applicants who need a trustworthy, elegant path from invitation entry to resume review, supplemental details, materials upload, and final confirmation."
        headerSlot={
          <div className="rounded-[1.75rem] border border-stone-200 bg-white/88 p-5 shadow-[0_16px_40px_rgba(28,25,23,0.05)]">
            <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-stone-500 uppercase">
              Application Flow
            </p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-sm font-medium text-stone-900">
                  Invitation and secure session recovery
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-sm font-medium text-stone-900">
                  Resume upload and eligibility review
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-sm font-medium text-stone-900">
                  Materials collection and final submission
                </p>
              </div>
            </div>
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard className="bg-transparent p-0 shadow-none md:p-0">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="max-w-2xl text-base leading-8 text-stone-700">
                  Built on Next.js App Router with resume analysis integration,
                  controlled file upload, and server-side application recovery,
                  the experience favors confidence over complexity and keeps
                  each step visibly grounded.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/apply" className={getButtonClassName("primary")}>
                    Open Application Entry
                  </Link>
                  <Link
                    href="/api/health"
                    className={getButtonClassName("secondary")}
                  >
                    Check API Health
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {highlights.map((item) => (
                  <DetailCard
                    key={item.title}
                    eyebrow={item.eyebrow}
                    title={item.title}
                    description={item.description}
                  />
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Experience Principles"
            description="The interface intentionally balances a premium editorial tone with operational clarity, so applicants always know what the system needs next."
          >
            <ul className="space-y-4">
              {pillars.map((pillar, index) => (
                <li
                  key={pillar}
                  className="flex items-start gap-4 border-b border-stone-200/80 pb-4 last:border-b-0 last:pb-0"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-stone-50 text-xs font-semibold text-stone-700">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-stone-700">{pillar}</p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </PageShell>
    </PageFrame>
  );
}
