"use client";

import {
  Fragment,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronRight, Mail, type LucideIcon } from "lucide-react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type FlowStep = {
  label: string;
  hint?: string;
};

type PageFrameProps = {
  children: ReactNode;
  maxWidth?: "4xl" | "5xl" | "6xl";
  className?: string;
};

type PageShellProps = {
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  headerSlot?: ReactNode;
  headerVariant?: "default" | "centered";
  /** Merged into the main `<h1>`; omit to keep the default semibold title weight. */
  headerTitleClassName?: string;
  steps?: readonly FlowStep[];
  currentStep?: number;
  stepIndexing?: "zero" | "one";
  stepLinks?: readonly string[];
  maxAccessibleStep?: number;
};

type StatusBannerProps = {
  tone?: "neutral" | "loading" | "success" | "danger" | "review";
  title: string;
  description?: string | null;
  children?: ReactNode;
  className?: string;
};

type SectionCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "success" | "danger" | "ghost";
};

type DetailCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  className?: string;
};

type MobileSupportCardProps = {
  title?: string;
  description?: string;
  href?: string;
  actionLabel?: string;
  icon?: LucideIcon;
  className?: string;
};

type DisclosureSectionProps = {
  title: string;
  summary?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
};

type MetaStripProps = {
  items: Array<{
    label: string;
    value: string;
  }>;
  className?: string;
};

const MAX_WIDTH_CLASS: Record<
  NonNullable<PageFrameProps["maxWidth"]>,
  string
> = {
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
};

const STATUS_STYLES: Record<
  NonNullable<StatusBannerProps["tone"]>,
  { shell: string; accent: string }
> = {
  neutral: {
    shell:
      "border-[color:var(--border)] bg-[color:var(--background-elevated)] text-[color:var(--foreground)]",
    accent: "bg-[color:var(--primary)]",
  },
  loading: {
    shell: "border-sky-200 bg-sky-50 text-[color:var(--primary)]",
    accent: "bg-sky-600",
  },
  success: {
    shell: "border-emerald-200 bg-emerald-50 text-emerald-950",
    accent: "bg-[color:var(--accent)]",
  },
  danger: {
    shell: "border-rose-200 bg-rose-50 text-rose-950",
    accent: "bg-rose-700",
  },
  review: {
    shell: "border-rose-200 bg-rose-50 text-rose-950",
    accent: "bg-rose-600",
  },
};

const BUTTON_STYLES: Record<
  NonNullable<ActionButtonProps["variant"]>,
  string
> = {
  primary:
    "border border-[color:var(--primary)] bg-[color:var(--primary)] text-white shadow-[0_10px_24px_rgba(10,25,47,0.18)] hover:bg-[color:var(--primary-strong)]",
  secondary:
    "border border-[color:var(--border-strong)] bg-white text-[color:var(--primary)] hover:border-[color:var(--primary)] hover:bg-slate-50",
  success:
    "border border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-[0_10px_24px_rgba(22,101,52,0.18)] hover:bg-[#14532d]",
  danger: "border border-rose-700 bg-rose-700 text-white hover:bg-rose-800",
  ghost:
    "border border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--foreground-soft)] hover:bg-slate-200",
};

export function PageFrame({ children, maxWidth, className }: PageFrameProps) {
  return (
    <MotionConfig transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
      <main
        className={cn(
          "min-h-screen w-full px-3 pb-3 text-[color:var(--foreground)] sm:px-4 sm:pb-4 lg:px-5 lg:pb-5",
          maxWidth
            ? cn("mx-auto", MAX_WIDTH_CLASS[maxWidth])
            : "mx-auto max-w-[1180px]",
          className,
        )}
      >
        {children}
      </main>
    </MotionConfig>
  );
}

export function PageShell({
  title,
  description,
  children,
  className,
  headerSlot,
  headerVariant = "default",
  headerTitleClassName,
  steps,
  currentStep,
  stepIndexing = "one",
  stepLinks,
  maxAccessibleStep,
}: PageShellProps) {
  const shouldReduceMotion = useReducedMotion();
  const trimmedDescription = description.trim();

  return (
    <motion.section
      className={cn("mx-auto w-full", className)}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      <div className="space-y-4">
        {steps?.length ? (
          <div className="sticky top-0 z-40 -mt-3 sm:-mt-4 lg:-mt-5">
            <div className="relative left-1/2 w-screen -translate-x-1/2 border-b border-[color:var(--border)] bg-[color:var(--background-elevated)]/98 shadow-[0_6px_18px_rgba(10,25,47,0.04)] backdrop-blur">
              <div className="px-4 py-2 sm:px-6 sm:py-2.5 lg:px-8">
                <FlowArrowStepper
                  steps={steps}
                  currentStep={currentStep ?? (stepIndexing === "zero" ? 0 : 1)}
                  stepIndexing={stepIndexing}
                  stepLinks={stepLinks}
                  maxAccessibleStep={maxAccessibleStep}
                />
              </div>
            </div>
          </div>
        ) : null}

        {headerVariant === "centered" ? (
          <div className="mx-auto flex max-w-4xl flex-col items-center px-3 py-7 text-center sm:px-4 sm:py-10">
            <h1
              className={cn(
                "max-w-4xl text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--primary)] sm:text-[2.6rem]",
                headerTitleClassName ?? "font-semibold",
              )}
            >
              {title}
            </h1>
            {trimmedDescription ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--foreground-soft)] sm:text-[0.98rem]">
                {trimmedDescription}
              </p>
            ) : null}
            {headerSlot ? (
              <div className="mt-5 w-full">{headerSlot}</div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-4 shadow-[var(--shadow-card)] sm:px-5 sm:py-5">
              <div className="max-w-4xl space-y-3">
                <div className="space-y-2">
                  <h1
                    className={cn(
                      "max-w-4xl text-[1.8rem] leading-tight tracking-[-0.03em] text-[color:var(--primary)] sm:text-[2.15rem]",
                      headerTitleClassName ?? "font-semibold",
                    )}
                  >
                    {title}
                  </h1>
                  {trimmedDescription ? (
                    <p className="max-w-3xl text-sm leading-6 text-[color:var(--foreground-soft)] sm:text-[0.96rem]">
                      {trimmedDescription}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {headerSlot ? <div className="w-full">{headerSlot}</div> : null}
          </div>
        )}

        {children}
      </div>
    </motion.section>
  );
}

function StepDoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.25L6.4 11.15L12.5 5.05"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FlowArrowStepper({
  steps,
  currentStep,
  stepIndexing = "one",
  stepLinks,
  maxAccessibleStep,
}: {
  steps: readonly FlowStep[];
  currentStep: number;
  stepIndexing?: "zero" | "one";
  stepLinks?: readonly string[];
  maxAccessibleStep?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="w-full overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="list"
      aria-label="Application progress"
    >
      <div className="flex min-w-[40rem] items-center">
        {steps.map((step, index) => {
          const displayStepNumber =
            stepIndexing === "zero" ? index + 1 : index + 1;
          const rawStep = stepIndexing === "zero" ? index : index + 1;
          const isActive = rawStep === currentStep;
          const isCompleted = rawStep < currentStep;
          const isLast = index === steps.length - 1;
          const isClickable =
            Boolean(stepLinks?.[index]) &&
            (maxAccessibleStep === undefined || rawStep <= maxAccessibleStep);

          const content = (
            <div className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-200",
                  isCompleted &&
                    "border-[color:var(--accent)] bg-[color:var(--accent)] text-white",
                  isActive &&
                    "border-[color:var(--primary)] bg-[color:var(--background-elevated)] text-[color:var(--primary)] shadow-[inset_0_0_0_2px_rgba(10,25,47,0.08)]",
                  !isCompleted &&
                    !isActive &&
                    "border-[color:var(--border-strong)] bg-white text-slate-500",
                )}
              >
                {isCompleted ? (
                  <StepDoneIcon className="h-4 w-4" />
                ) : (
                  displayStepNumber
                )}
              </span>
              <p
                className={cn(
                  "mt-2 max-w-[8.6rem] text-[0.8rem] leading-5 font-semibold",
                  isCompleted && "text-[color:var(--accent)]",
                  isActive && "text-[color:var(--primary)]",
                  !isCompleted && !isActive && "text-slate-500",
                )}
              >
                {step.label}
              </p>
            </div>
          );

          const wrapperClassName = cn(
            "relative z-10 flex flex-col items-center",
            isClickable ? "cursor-pointer" : "cursor-default",
          );

          return (
            <Fragment key={`${index}-${step.label}`}>
              <div
                role="listitem"
                className="flex min-w-0 flex-1 justify-center"
              >
                {isClickable ? (
                  <a
                    href={stepLinks![index]!}
                    aria-current={isActive ? "step" : undefined}
                    className={wrapperClassName}
                  >
                    <motion.div
                      initial={
                        shouldReduceMotion ? undefined : { opacity: 0, y: 6 }
                      }
                      animate={
                        shouldReduceMotion ? undefined : { opacity: 1, y: 0 }
                      }
                    >
                      {content}
                    </motion.div>
                  </a>
                ) : (
                  <motion.div
                    aria-current={isActive ? "step" : undefined}
                    className={wrapperClassName}
                    initial={
                      shouldReduceMotion ? undefined : { opacity: 0, y: 6 }
                    }
                    animate={
                      shouldReduceMotion ? undefined : { opacity: 1, y: 0 }
                    }
                  >
                    {content}
                  </motion.div>
                )}
              </div>
              {!isLast ? (
                <div
                  className={cn(
                    "mx-2 mt-[18px] h-[2px] flex-1 rounded-full",
                    isCompleted
                      ? "bg-[color:var(--accent)]"
                      : "bg-[color:var(--border)]",
                  )}
                  aria-hidden
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function StatusBanner({
  tone = "neutral",
  title,
  description,
  children,
  className,
}: StatusBannerProps) {
  const styles = STATUS_STYLES[tone];
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "rounded-2xl border px-4 py-3.5 shadow-[var(--shadow-card)]",
        styles.shell,
        className,
      )}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn("mt-1.5 h-2.5 w-2.5 rounded-full", styles.accent)}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-semibold">{title}</p>
          {description ? (
            <p className="text-sm leading-6 opacity-90">{description}</p>
          ) : null}
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: SectionCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      className={cn(
        "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-4 shadow-[var(--shadow-card)] sm:px-5 sm:py-5",
        className,
      )}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
    >
      {title || description || action ? (
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl space-y-1">
            {title ? (
              <h2 className="text-base font-semibold tracking-[-0.02em] text-[color:var(--primary)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm leading-6 whitespace-pre-line text-[color:var(--foreground-soft)]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </motion.section>
  );
}

export function DetailCard({
  eyebrow,
  title,
  description,
  className,
}: DetailCardProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/70 p-3.5",
        className,
      )}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 6 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
    >
      {eyebrow ? (
        <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-slate-500 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <p className="mt-1.5 text-sm font-semibold text-[color:var(--primary)]">
        {title}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-[color:var(--foreground-soft)]">
        {description}
      </p>
    </motion.div>
  );
}

export function DisclosureSection({
  title,
  summary,
  meta,
  children,
  className,
  contentClassName,
  defaultOpen = false,
  open,
  onToggle,
}: DisclosureSectionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();
  const expanded = open ?? internalOpen;

  function handleToggle() {
    const nextOpen = !expanded;
    setInternalOpen(nextOpen);
    onToggle?.(nextOpen);
  }

  return (
    <motion.section
      className={cn(
        "overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] shadow-[var(--shadow-card)]",
        className,
      )}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion
          ? undefined
          : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
      }
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-[color:var(--muted)]/45 sm:px-5"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold tracking-[-0.02em] text-[color:var(--primary)]">
            {title}
          </p>
          {summary ? (
            <div className="mt-1 text-sm leading-6 text-[color:var(--foreground-soft)]">
              {summary}
            </div>
          ) : null}
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
        <ChevronRight
          className={cn(
            "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
            expanded ? "rotate-90 text-[color:var(--primary)]" : "",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div
          className={cn(
            "border-t border-[color:var(--border)] bg-[color:var(--muted)]/35 px-4 py-4 sm:px-5",
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </motion.section>
  );
}

export function MetaStrip({ items, className }: MetaStripProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <div
          key={`${item.label}-${item.value}`}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-white px-3 py-1.5 text-sm"
        >
          <span className="text-[color:var(--foreground-soft)]">
            {item.label}
          </span>
          <span className="font-semibold text-[color:var(--primary)]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MobileSupportCard({
  title = "Recommended to complete on desktop",
  description = "Long uploads and structured review tasks are easier to complete on a larger screen. You can email this link to yourself and continue later.",
  href,
  actionLabel = "Send link to email",
  icon: Icon = Mail,
  className,
}: MobileSupportCardProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      className={cn("border-dashed md:hidden", className)}
      action={
        href ? (
          <a href={href} className={getButtonClassName("secondary")}>
            <Icon className="h-4 w-4" aria-hidden />
            <span>{actionLabel}</span>
          </a>
        ) : null
      }
    />
  );
}

export function ActionButton({
  className,
  variant = "primary",
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(getButtonClassName(variant), className)}
      {...props}
    />
  );
}

export function getButtonClassName(
  variant: NonNullable<ActionButtonProps["variant"]> = "primary",
) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] disabled:cursor-not-allowed disabled:opacity-55",
    BUTTON_STYLES[variant],
  );
}

export function getInputClassName(className?: string) {
  return cn(
    "w-full rounded-xl border border-[color:var(--border)] bg-white px-3 py-2.5 text-sm text-[color:var(--foreground)] transition placeholder:text-slate-400 focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]",
    className,
  );
}
