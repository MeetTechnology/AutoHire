import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FlowStep = {
  label: string;
  hint?: string;
};

type PageFrameProps = {
  children: ReactNode;
  /** When set, constrains content width and centers the column (legacy narrow layout). */
  maxWidth?: "4xl" | "5xl" | "6xl";
  className?: string;
};

type PageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
  headerSlot?: ReactNode;
  steps?: readonly FlowStep[];
  currentStep?: number;
};

type StatusBannerProps = {
  tone?: "neutral" | "loading" | "success" | "danger";
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
      "border-stone-200 bg-[linear-gradient(145deg,rgba(255,253,248,0.96),rgba(245,239,227,0.86))] text-stone-800",
    accent: "bg-stone-500",
  },
  loading: {
    shell:
      "border-amber-200 bg-[linear-gradient(145deg,rgba(255,251,235,0.98),rgba(253,244,214,0.88))] text-amber-950",
    accent: "bg-amber-500",
  },
  success: {
    shell:
      "border-emerald-200 bg-[linear-gradient(145deg,rgba(240,253,244,0.98),rgba(221,247,234,0.88))] text-emerald-950",
    accent: "bg-emerald-500",
  },
  danger: {
    shell:
      "border-rose-200 bg-[linear-gradient(145deg,rgba(255,241,242,0.98),rgba(255,228,230,0.88))] text-rose-950",
    accent: "bg-rose-500",
  },
};

const BUTTON_STYLES: Record<
  NonNullable<ActionButtonProps["variant"]>,
  string
> = {
  primary:
    "bg-[linear-gradient(135deg,#0f766e,#14532d)] text-white shadow-[0_18px_40px_rgba(15,118,110,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(15,118,110,0.28)]",
  secondary:
    "border border-stone-300 bg-white/88 text-stone-900 shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:border-stone-400 hover:bg-white",
  success:
    "bg-[linear-gradient(135deg,#047857,#065f46)] text-white shadow-[0_18px_40px_rgba(4,120,87,0.22)] hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(4,120,87,0.26)]",
  danger:
    "bg-[linear-gradient(135deg,#be123c,#881337)] text-white shadow-[0_18px_40px_rgba(190,24,93,0.22)] hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(190,24,93,0.26)]",
  ghost:
    "border border-transparent bg-stone-100/80 text-stone-700 hover:-translate-y-0.5 hover:bg-stone-200/90",
};

export function PageFrame({
  children,
  maxWidth,
  className,
}: PageFrameProps) {
  return (
    <main
      className={cn(
        "flex min-h-screen w-full max-w-none flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10",
        maxWidth ? cn("mx-auto", MAX_WIDTH_CLASS[maxWidth]) : null,
        className,
      )}
    >
      {children}
    </main>
  );
}

export function PageShell({
  eyebrow,
  title,
  description,
  children,
  className,
  headerSlot,
  steps,
  currentStep,
}: PageShellProps) {
  return (
    <section
      className={cn(
        "w-full max-w-none pb-6 md:pb-8",
        className,
      )}
    >
      <div className="relative space-y-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-5">
            {eyebrow ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-300/90 bg-white/82 px-3 py-1 text-[0.68rem] font-semibold tracking-[0.26em] text-stone-700 uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-700" />
                {eyebrow}
              </span>
            ) : null}
            <div className="space-y-3">
              <h1 className="max-w-3xl font-[family-name:var(--font-serif)] text-4xl leading-tight text-stone-950 sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-stone-700 sm:text-lg">
                {description}
              </p>
            </div>
            {steps?.length ? (
              <FlowSteps steps={steps} currentStep={currentStep ?? 1} />
            ) : null}
          </div>
          {headerSlot ? <div className="lg:max-w-sm">{headerSlot}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function FlowSteps({
  steps,
  currentStep,
}: {
  steps: readonly FlowStep[];
  currentStep: number;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div
            key={step.label}
            className={cn(
              "rounded-2xl border px-4 py-3 transition",
              isActive
                ? "border-stone-900 bg-stone-950 text-white shadow-[0_18px_40px_rgba(28,25,23,0.18)]"
                : isCompleted
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-stone-200 bg-white/80 text-stone-600",
            )}
          >
            <p className="text-[0.65rem] font-semibold tracking-[0.22em] uppercase opacity-80">
              Step {stepNumber}
            </p>
            <p className="mt-2 text-sm font-medium">{step.label}</p>
            {step.hint ? (
              <p className="mt-1 text-xs leading-5 opacity-80">{step.hint}</p>
            ) : null}
          </div>
        );
      })}
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

  return (
    <div
      className={cn(
        "rounded-[1.6rem] border p-5 shadow-[0_16px_40px_rgba(28,25,23,0.05)]",
        styles.shell,
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 rounded-full shadow-[0_0_0_6px_rgba(255,255,255,0.65)]",
            styles.accent,
          )}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold tracking-[0.04em]">{title}</p>
          {description ? (
            <p className="text-sm leading-7 opacity-90">{description}</p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[1.6rem] border border-stone-200 bg-white/82 p-5 shadow-[0_16px_40px_rgba(28,25,23,0.05)] md:p-6",
        className,
      )}
    >
      {title || description || action ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            {title ? (
              <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-2 text-sm leading-7 text-stone-600">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DetailCard({
  eyebrow,
  title,
  description,
  className,
}: DetailCardProps) {
  return (
    <div
      className={cn(
        "rounded-[1.4rem] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,244,236,0.92))] p-4 shadow-[0_12px_28px_rgba(28,25,23,0.04)]",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-[0.68rem] font-semibold tracking-[0.2em] text-stone-500 uppercase">
          {eyebrow}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-stone-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-stone-600">{description}</p>
    </div>
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
    "inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55",
    BUTTON_STYLES[variant],
  );
}

export function getInputClassName(className?: string) {
  return cn(
    "w-full rounded-[1.25rem] border border-stone-300 bg-white/95 px-4 py-3 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition placeholder:text-stone-400 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/10",
    className,
  );
}
